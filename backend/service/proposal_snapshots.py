"""On-demand source capture, comparison and orchestration for frontend polling.

Only existing Toronto notice IDs are refreshed. This does not discover new notices,
download linked attachments, publish revisions or alter participant feedback.
"""

import hashlib
import json
import re
import ssl
from datetime import datetime, timezone
from difflib import unified_diff
from html.parser import HTMLParser
from typing import Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4
from zoneinfo import ZoneInfo

import certifi
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

try:
    from imported_data_dto import SourceNotice
    from persistence.persistence import ProposalRepository
    from persistence.proposal_snapshots import ProposalSnapshotRepository
    from persistence.notifications import NotificationRepository
    from proposal_snapshots_DTO import SnapshotChangeDTO, SnapshotDiffDTO, SnapshotDTO, SnapshotRefreshDTO, SnapshotPollResponseDTO, SnapshotViewDTO
except ImportError:
    from backend.imported_data_dto import SourceNotice
    from backend.persistence.persistence import ProposalRepository
    from backend.persistence.proposal_snapshots import ProposalSnapshotRepository
    from backend.persistence.notifications import NotificationRepository
    from backend.proposal_snapshots_DTO import SnapshotChangeDTO, SnapshotDiffDTO, SnapshotDTO, SnapshotRefreshDTO, SnapshotPollResponseDTO, SnapshotViewDTO


API_URL = "https://secure.toronto.ca/nm/notices.json"
MAX_RESPONSE_BYTES = 30_000_000


class ProposalNotFoundError(ValueError):
    pass


class SnapshotCursorError(ValueError):
    pass


class _NoticeText(HTMLParser):
    """Ignore layout markup while preserving readable paragraphs and link targets."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.links = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        if self.hidden:
            return
        if tag in {"p", "div", "br", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")
        if tag in {"td", "th"}:
            self.parts.append(" ")
        if tag == "a" and dict(attrs).get("href"):
            self.links.append(dict(attrs)["href"])

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.hidden:
            self.hidden -= 1
        elif not self.hidden and tag in {"p", "div", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            # Line wrapping in HTML source is whitespace, not a new paragraph.
            self.parts.append(re.sub(r"\s+", " ", data))

    def text(self):
        return "\n".join(line for raw in "".join(self.parts).splitlines() if (line := " ".join(raw.split())))


def _json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _digest(value):
    return hashlib.sha256(_json(value).encode("utf-8")).hexdigest()


def _normalize(value):
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        # Notice arrays are sets of addresses, topics, events or references;
        # source ordering alone should not generate an update.
        return sorted((_normalize(item) for item in value), key=_json)
    return value


def _notice_content(record):
    # Retain unknown source metadata too: don't silently discard future fields.
    content = _normalize({key: value for key, value in record.items()
                          if key not in {"noticeDescription", "accessibilityDescription", "uniqueMapUrl"}})
    for field in ("noticeDescription", "accessibilityDescription"):
        if field in record:
            parser = _NoticeText()
            parser.feed(record[field] or "")
            parser.close()
            content[field] = parser.text()
            content[field + "Links"] = sorted(set(parser.links))
    return content


def _fetch_notices(sources: list[SourceNotice]) -> list[dict]:
    """Fetch complete, narrow date windows using Toronto's documented API filters."""
    dates = sorted({(source.published_at if source.published_at.tzinfo else
                     source.published_at.replace(tzinfo=timezone.utc))
                    .astimezone(ZoneInfo("America/Toronto")).date().isoformat()
                    for source in sources})
    wanted = {source.notice_id for source in sources}
    found = {}
    # Use the same maintained CA bundle as MongoDB. Some Python installations
    # (including python.org builds on macOS) lack a configured system CA store.
    tls_context = ssl.create_default_context(cafile=certifi.where())
    for date in dates:
        url = API_URL + "?" + urlencode({
            "noticeDateFrom": date, "noticeDateTo": date, "locationId": 1,
        })
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "proviso-Snapshots/1.0"})
        with urlopen(request, timeout=30, context=tls_context) as response:
            payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError("Notice response exceeds 30 MB; no snapshot saved.")
        data = json.loads(payload)
        records = data.get("Records")
        if (data.get("Result") != "OK" or not isinstance(records, list)
                or data.get("TotalRecordCount") != len(records)):
            raise ValueError("Incomplete or invalid notice response; no snapshot saved.")
        for record in records:
            notice_id = int(record["noticeId"])
            if notice_id in wanted:
                if notice_id in found and found[notice_id] != record:
                    raise ValueError(f"Conflicting source records for notice {notice_id}.")
                found[notice_id] = record
    if set(found) != wanted:
        raise ValueError("One or more linked notices were not returned; no snapshot saved.")
    return [found[notice_id] for notice_id in sorted(found)]


def _changes(before, after, path=""):
    if isinstance(before, dict) and isinstance(after, dict):
        changes = []
        for key in sorted(before.keys() | after.keys()):
            pointer = path + "/" + key.replace("~", "~0").replace("/", "~1")
            if key not in before:
                changes.append(SnapshotChangeDTO(path=pointer, operation="added", after=after[key]))
            elif key not in after:
                changes.append(SnapshotChangeDTO(path=pointer, operation="removed", before=before[key]))
            else:
                changes.extend(_changes(before[key], after[key], pointer))
        return changes
    if _json(before) == _json(after):
        return []
    text_diff = None
    if isinstance(before, str) and isinstance(after, str):
        text_diff = "\n".join(unified_diff(
            before.splitlines(), after.splitlines(), fromfile="before", tofile="after", lineterm="",
        ))
    return [SnapshotChangeDTO(path=path, operation="changed", before=before, after=after, text_diff=text_diff)]


class ProposalSnapshotService:
    """Snapshot operations; construction performs no fetches or writes."""

    def __init__(self, db: Database, *, fetch_notices: Callable | None = None):
        self.proposals = ProposalRepository(db)
        self.history = ProposalSnapshotRepository(db)
        self.notifications = NotificationRepository(db)
        self.statuses = db["proposal_snapshot_status"]
        self.fetch_notices = fetch_notices or _fetch_notices

    def refresh_proposal_snapshot(self, proposal_id: str) -> SnapshotRefreshDTO:
        """Fetch known official notices; append only when normalized content changes.

        An unchanged refresh returns the existing snapshot with created=False.
        Fetch/validation/database failures propagate to the eventual caller.
        """
        proposal = self.proposals.get_by_id(proposal_id)
        if proposal is None:
            raise ProposalNotFoundError(f"Proposal '{proposal_id}' was not found.")
        sources = [SourceNotice.model_validate(source) for source in proposal.get("source_notices", [])]
        if not sources:
            raise ValueError("Proposal has no linked source notices to refresh.")
        records = self.fetch_notices(sources)
        if (len(records) != len({source.notice_id for source in sources})
                or {int(record["noticeId"]) for record in records} != {source.notice_id for source in sources}):
            raise ValueError("Fetched records must match all linked source notice IDs exactly.")
        for record in records:
            if (not isinstance(record.get("title"), str)
                    or not isinstance(record.get("noticeDescription"), str)
                    or not isinstance(record.get("noticeDate"), (int, float))):
                raise ValueError("Source notice is missing required title, description or publication date.")
        records = sorted(records, key=lambda record: int(record["noticeId"]))
        content = {"notices": {str(int(record["noticeId"])): _notice_content(record) for record in records}}
        digest = _digest(content)
        for attempt in range(3):
            previous = self.history.latest(proposal_id)
            if previous is not None and previous.content_sha256 == digest:
                return SnapshotRefreshDTO(snapshot=previous, created=False)
            snapshot = SnapshotDTO(
                id=str(uuid4()), proposal_id=proposal_id,
                sequence=previous.sequence + 1 if previous else 1,
                previous_snapshot_id=previous.id if previous else None,
                captured_at=datetime.now(timezone.utc),
                source_urls=sorted({f"https://secure.toronto.ca/nm/api/individual/notice/{source.notice_id}.do"
                                    for source in sources}),
                content_sha256=digest, content=content, raw_notices=records,
            )
            try:
                self.history.insert(snapshot)
                return SnapshotRefreshDTO(snapshot=snapshot, created=True)
            except DuplicateKeyError:
                # Another refresh appended first; compare with its new head.
                if attempt == 2:
                    raise

    def compare_proposal_snapshots(
        self, proposal_id: str, before_snapshot_id: str, after_snapshot_id: str,
    ) -> SnapshotDiffDTO:
        """Persist an ordered, repeatable field/text diff; never classify an amendment."""
        before = self.history.get(proposal_id, before_snapshot_id)
        after = self.history.get(proposal_id, after_snapshot_id)
        if before.sequence > after.sequence:
            raise ValueError("The before snapshot must not be newer than the after snapshot.")
        changes = _changes(before.content, after.content)
        diff = SnapshotDiffDTO(
            id=_digest([proposal_id, before.id, after.id]), proposal_id=proposal_id,
            before_snapshot_id=before.id, after_snapshot_id=after.id,
            compared_at=datetime.now(timezone.utc), changes=changes, review_required=bool(changes),
            is_demo=before.is_demo or after.is_demo,
            demo_label=before.demo_label if before.is_demo else after.demo_label if after.is_demo else None,
        )
        saved = self.history.save_diff(diff)
        # Run on repeat comparisons too: a scheduler retry repairs an interrupted
        # notification fan-out, while stable recipient/change IDs prevent spam.
        self.notifications.notify_participants(saved, after)
        return saved

    def get_proposal_snapshot(self, proposal_id: str, snapshot_id: str) -> SnapshotViewDTO:
        """Read a saved source without fetching, refreshing or writing anything."""
        snapshot = self.history.get(proposal_id, snapshot_id)
        return SnapshotViewDTO.model_validate(snapshot.model_dump(include=set(SnapshotViewDTO.model_fields)))

    def check_proposal_updates(self, proposal_id: str, after_sequence: int = 0) -> SnapshotPollResponseDTO:
        """Refresh, then return every unseen transition, including other clients' changes.

        Computing diffs from stored snapshots also repairs a previous check that
        saved its snapshot but failed before saving/returning the comparison.
        """
        if after_sequence < 0:
            raise SnapshotCursorError("Snapshot sequence must be nonnegative.")
        refresh = self.refresh_proposal_snapshot(proposal_id)
        latest = refresh.snapshot
        if after_sequence > latest.sequence:
            raise SnapshotCursorError("Requested sequence is ahead of the stored snapshot history.")
        # Synthetic predecessors live at sequence zero, outside observed source
        # history. Include their labelled examples even for returning browsers.
        diffs = self.history.demo_diffs(proposal_id)
        for snapshot in self.history.since(proposal_id, after_sequence, latest.sequence):
            if snapshot.previous_snapshot_id is not None:
                diffs.append(self.compare_proposal_snapshots(
                    proposal_id, snapshot.previous_snapshot_id, snapshot.id,
                ))
        return SnapshotPollResponseDTO(
            proposal_id=proposal_id, checked_at=datetime.now(timezone.utc),
            snapshot_id=latest.id, snapshot_sequence=latest.sequence,
            snapshot_created=refresh.created, diffs=diffs,
        )

    def read_proposal_updates(self, proposal_id: str, after_sequence: int = 0) -> SnapshotPollResponseDTO:
        """Serve saved scheduler results only. No source calls or database writes."""
        if self.proposals.get_by_id(proposal_id) is None:
            raise ProposalNotFoundError(f"Proposal '{proposal_id}' was not found.")
        latest = self.history.latest(proposal_id)
        sequence = latest.sequence if latest else 0
        if after_sequence < 0 or after_sequence > sequence:
            raise SnapshotCursorError("Requested sequence is outside the stored snapshot history.")
        diffs = []
        for diff in self.history.all_diffs(proposal_id):
            after = self.history.get(proposal_id, diff.after_snapshot_id).sequence
            if diff.is_demo or after_sequence < after <= sequence:
                diffs.append((not diff.is_demo, after, diff))
        # Keep the demo first; a genuine newer source change should be selected last.
        diffs.sort(key=lambda item: item[:2])
        status = self.statuses.find_one({"_id": proposal_id}) or {}
        return SnapshotPollResponseDTO(
            proposal_id=proposal_id, checked_at=status.get("last_successful_at") or (latest.captured_at if latest else None),
            snapshot_id=latest.id if latest else None, snapshot_sequence=sequence,
            snapshot_created=False, diffs=[item[2] for item in diffs],
            source_status=status.get("source_status", "ready" if latest else "pending"),
            source_error=status.get("source_error"),
        )
