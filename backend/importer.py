"""Offline, selected-batch public-notice importer. Dry run unless --write is set."""

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from pydantic import ValidationError
from database.database import get_mongo_client

from imported_data_dto import (
    Address, Category, Contact, IMPORTED_FIELDS, Point, Proposal, Reference, Review,
    SourceNotice,
)

HERE = Path(__file__).resolve().parent
DEFAULT_SELECTION = HERE / "data/example-selection.json"
DEFAULT_INPUT = HERE.parent / "sources/imports/toronto-notices-examples.raw.json"
DEFAULT_OUTPUT = HERE / "data/proposals.preview.json"
API_URL = "https://secure.toronto.ca/nm/notices.json"


class NoticeText(HTMLParser):
    """Extract text, retaining paragraph boundaries and dropping executable content."""

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
        if tag in {"p", "div", "br", "tr", "li", "h1", "h2", "h3"}:
            self.parts.append("\n")
        if tag in {"td", "th"}:
            self.parts.append(" ")
        if tag == "a":
            href = dict(attrs).get("href", "")
            if href.startswith(("https://", "http://")):
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.hidden:
            self.hidden -= 1
        elif not self.hidden and tag in {"p", "div", "tr", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

    def text(self):
        return "\n".join(line for p in "".join(self.parts).splitlines() if (line := " ".join(p.split())))


def raw_hash(record):
    return hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def load_feed(path):
    data = json.loads(Path(path).read_text())
    if data.get("Result") != "OK" or not isinstance(data.get("Records"), list):
        raise ValueError(f"{path}: expected Result=OK and a Records array")
    records = data["Records"]
    if data.get("TotalRecordCount") != len(records):
        raise ValueError(f"{path}: incomplete response; reported and received counts differ")
    return records


def fetch_feed(date_from, date_to, destination):
    # Deliberately restricted to the documented Toronto API, not arbitrary URLs.
    datetime.strptime(date_from, "%Y-%m-%d")
    datetime.strptime(date_to, "%Y-%m-%d")
    if date_from > date_to:
        raise ValueError("--from-date must be before --to-date")
    url = API_URL + "?" + urlencode({"noticeDateFrom": date_from, "noticeDateTo": date_to, "locationId": 1})
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "proviso-Importer/1.0"})
    with urlopen(request, timeout=90) as response:
        payload = response.read(30_000_001)
    if len(payload) > 30_000_000:
        raise ValueError("Response exceeds 30 MB; use a narrower date window")
    data = json.loads(payload)
    if data.get("Result") != "OK" or not isinstance(data.get("Records"), list):
        raise ValueError("Source returned an unexpected response")
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    load_feed(destination)
    return url


def notice_kind(title):
    title = title.lower()
    if "declaration of surplus" in title:
        return "surplus"
    if "adoption" in title or "passing of" in title:
        return "adoption"
    if "notice of decision" in title:
        return "decision"
    if "intention" in title or "proposal" in title or "proposed" in title:
        return "intention"
    if "public meeting" in title:
        return "meeting"
    if "application" in title:
        return "application"
    return "other"


def clean(value):
    return " ".join(str(value).split()) if value is not None else None


def normalize_group(entries, now):
    """Each entry pairs one source record with its explicit selection metadata."""
    entries = sorted(entries, key=lambda e: (e[0]["noticeDate"], e[0]["noticeId"]))
    latest, selected = entries[-1]
    notices, addresses, contacts, references = [], [], [], []
    topics, apps, agenda_ids, chapters, wards, snapshots = set(), set(), set(), set(), set(), []
    issues = {"Current decision status and participation dates require source review.",
              "Proposal features, impacts and summaries have not been extracted or verified."}
    for raw, meta in entries:
        parser = NoticeText()
        parser.feed(raw.get("noticeDescription") or "")
        text = parser.text()
        nid = int(raw["noticeId"])
        url = f"https://secure.toronto.ca/nm/api/individual/notice/{nid}.do"
        digest = raw_hash(raw)
        snapshots.append(f"toronto-notice-{nid}:{digest}")
        notices.append(SourceNotice(
            notice_id=nid, url=url, title=clean(raw["title"]),
            published_at=datetime.fromtimestamp(raw["noticeDate"] / 1000, timezone.utc),
            description_text=text, subheading=clean(raw.get("subheading")),
            notice_heading_type=raw.get("noticeHeadingType"), decision_body=raw.get("decisionBody"),
            signed_by=raw.get("signedBy"), notice_kind=notice_kind(raw["title"]), raw_sha256=digest,
        ))
        references.append(Reference(label=clean(raw["title"]), url=url, kind="notice"))
        for field, kind in [("backgroundInformationList", "background"), ("otherReferenceList", "reference")]:
            for ref in raw.get(field) or []:
                ref_url = urljoin(url, ref.get("url", ""))
                if urlparse(ref_url).scheme in {"http", "https"}:
                    references.append(Reference(label=clean(ref.get("description")), url=ref_url, kind=kind))
        for link in parser.links:
            references.append(Reference(url=link, kind="description_link"))
        for address in raw.get("addressList") or []:
            point = None
            lat, lon = address.get("latitudeCoordinate"), address.get("longitudeCoordinate")
            if lat is not None and lon is not None:
                try:
                    point = Point(coordinates=(float(lon), float(lat)))
                    if not (-79.7 <= float(lon) <= -79.0 and 43.5 <= float(lat) <= 44.0):
                        issues.add("A source coordinate falls outside the approximate Toronto bounds; review it.")
                except (ValueError, TypeError, ValidationError):
                    issues.add("An invalid source coordinate was omitted.")
            addresses.append(Address(
                street_address=clean(address.get("streetAddress")), full_address=clean(address.get("fullAddress")),
                city=address.get("city"), province=address.get("province"), postal_code=address.get("postalCode"),
                country=address.get("country"), point=point,
            ))
        raw_contact = raw.get("contact") or {}
        if raw_contact:
            contacts.append(Contact(**{dest: clean(raw_contact.get(src)) for src, dest in {
                "contactName": "name", "emailAddress": "email", "phone": "phone", "fax": "fax",
                "locationName": "location_name", "streetAddress": "street_address", "city": "city",
                "province": "province", "postalCode": "postal_code", "country": "country",
            }.items()}))
        topics.update(raw.get("topics") or [])
        apps.update(clean(a) for a in raw.get("planningApplicationNumbers") or [] if clean(a))
        searchable = text + " " + " ".join(ref.url for ref in references)
        agenda_ids.update(re.findall(r"\b20\d{2}\.[A-Z]{1,3}\d+\.\d+\b", searchable))
        chapters.update(re.findall(r"\bChapter\s+(\d+)\b", text, re.I))
        wards.update(clean(w) for w in re.findall(r"\bWard\s+\d+\s*[-–]\s*[^\n]+", text))
        if not raw.get("eventList"):
            issues.add("Empty eventList does not establish absence of meetings; inspect the description.")
    if addresses:
        issues.add("Source coordinates and addresses are unverified; no primary map point was chosen.")
    else:
        issues.add("No source address: determine whether the proposal is citywide or needs a checked location.")
    def unique_models(values):
        return list({value.model_dump_json(): value for value in values}.values())
    categories = list(dict.fromkeys(meta["category"] for _, meta in entries))
    return Proposal(
        id=selected["proposal_key"], title=clean(latest["title"]), category=selected["category"],
        categories=categories, topics=sorted(topics), source_notices=notices,
        planning_application_numbers=sorted(apps), agenda_item_ids=sorted(agenda_ids),
        municipal_code_chapters=sorted(chapters, key=int), addresses=unique_models(addresses),
        contacts=unique_models(contacts), references=unique_models(references), ward_labels=sorted(wards),
        imported_at=now, source_snapshot_ids=snapshots, review=Review(issues=sorted(issues)),
    )


def build_proposals(records, selection, now):
    if not selection:
        raise ValueError("Selection must contain at least one notice")
    by_id = {}
    for raw in records:
        nid = int(raw["noticeId"])
        if nid in by_id and raw_hash(by_id[nid]) != raw_hash(raw):
            raise ValueError(f"Conflicting snapshots for notice {nid}; choose an explicit source snapshot")
        by_id[nid] = raw
    groups = defaultdict(list)
    seen = set()
    for item in selection:
        nid = item["notice_id"]
        if nid in seen:
            raise ValueError(f"Repeated selected notice ID: {nid}")
        seen.add(nid)
        if nid not in by_id:
            raise ValueError(f"Selected notice {nid} is missing from input; import aborted")
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]+", item["proposal_key"]):
            raise ValueError("proposal_key must be a stable lowercase slug")
        groups[item["proposal_key"]].append((by_id[nid], item))
    proposals = [normalize_group(group, now) for group in groups.values()]
    return proposals, {nid: by_id[nid] for nid in seen}


def update_for(proposal):
    document = proposal.model_dump(mode="python")
    imported = {key: document[key] for key in IMPORTED_FIELDS}
    inserted = {key: value for key, value in document.items() if key not in IMPORTED_FIELDS and key != "source_snapshot_ids"}
    return {"$set": imported, "$setOnInsert": inserted,
            "$addToSet": {"source_snapshot_ids": {"$each": document["source_snapshot_ids"]}}}


def write_proposals(database, proposals, raw_records, now):
    """Stage imported records separately from the frontend's published proposals."""
    collection = database.imported_proposals
    collection.create_index("category")
    collection.create_index("source_notices.notice_id")
    counts = Counter()
    for proposal in proposals:
        for source in proposal.source_notices:
            sid = f"toronto-notice-{source.notice_id}:{source.raw_sha256}"
            database.source_notices.update_one({"_id": sid}, {"$setOnInsert": {
                "notice_id": source.notice_id, "source_url": source.url, "retrieved_at": now,
                "raw_sha256": source.raw_sha256, "record": raw_records[source.notice_id],
            }}, upsert=True)
        update = update_for(proposal)
        previous = collection.find_one({"_id": proposal.id}, {"source_notices.raw_sha256": 1})
        if previous is not None:
            old_hashes = {source["raw_sha256"] for source in previous.get("source_notices", [])}
            if old_hashes != {source.raw_sha256 for source in proposal.source_notices}:
                # MongoDB rejects parent/child updates across operators even if
                # $setOnInsert would not run for this existing document.
                update["$setOnInsert"].pop("review", None)
                update["$set"]["review.state"] = "needs_review"
                update["$addToSet"]["review.issues"] = "Imported source changed; recheck existing editorial interpretation."
        result = collection.update_one({"_id": proposal.id}, update, upsert=True)
        counts["inserted" if result.upserted_id is not None else "matched_existing"] += 1
        counts["modified"] += result.modified_count
    return dict(counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", type=Path, help="Repeat to combine raw response files")
    parser.add_argument("--selection", type=Path, default=DEFAULT_SELECTION)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--write", action="store_true", help="Write selected examples to configured MongoDB")
    parser.add_argument("--fetch", type=Path, help="Download a response to this path before importing")
    parser.add_argument("--from-date", default="2025-01-01")
    parser.add_argument("--to-date", default="2026-11-13")
    args = parser.parse_args()
    try:
        inputs = args.input or ([args.fetch] if args.fetch else [DEFAULT_INPUT])
        if args.fetch:
            fetch_feed(args.from_date, args.to_date, args.fetch)
            if args.fetch not in inputs:
                inputs.append(args.fetch)
        records = [record for path in inputs for record in load_feed(path)]
        selection = json.loads(args.selection.read_text())["selection"]
        now = datetime.now(timezone.utc)
        proposals, raw_records = build_proposals(records, selection, now)
        # Validate the entire batch before writing anything to the database.
        output = {"schema_version": 1, "generated_at": now.isoformat(),
                  "count": len(proposals), "proposals": [p.model_dump(mode="json") for p in proposals]}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
        report = {"mode": "write" if args.write else "dry_run", "collection": "imported_proposals", "proposals": len(proposals),
                  "by_category": dict(Counter(p.category for p in proposals)),
                  "with_source_coordinates": sum(any(a.point for a in p.addresses) for p in proposals),
                  "review_required": sum(p.review.state == "needs_review" for p in proposals),
                  "preview": str(args.output)}
        if args.write:
            load_dotenv(HERE / ".env")
            uri = os.getenv("MONGODB_URI", "").strip()
            if not uri:
                raise ValueError("MONGODB_URI is not configured")
            client = get_mongo_client(uri)
            if client is None:
                raise ValueError("MongoDB client could not be configured")
            with client:
                report["database_result"] = write_proposals(
                    client[os.getenv("MONGODB_DATABASE", "civic_hack")], proposals, raw_records, now)
        print(json.dumps(report, indent=2))
        return 0
    except Exception as exc:
        # Driver/HTTP exception strings may contain connection details. Never echo them.
        if isinstance(exc, (ValueError, FileNotFoundError)) and not isinstance(exc, ValidationError):
            print(f"Import failed: {exc}", file=sys.stderr)
        else:
            print(f"Import failed ({type(exc).__name__}); check the source file or database configuration.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
