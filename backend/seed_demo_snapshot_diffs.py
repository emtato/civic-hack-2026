"""Insert a labelled synthetic predecessor per proposal. Dry-run unless --write.

Real snapshots, catalogue records, raw source evidence and feedback are untouched.
Sequence zero is reserved for the fake predecessor, keeping real snapshots current.
"""

import argparse
import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from database.database import get_database, get_mongo_client
from proposal_snapshots_DTO import SnapshotDTO
from service.proposal_snapshots import ProposalSnapshotService, _digest

DEMO_LABEL = "Synthetic previous version for demonstration; not a municipal record."
DEMO_SENTENCE = "Demo previous version example."


def build_demo_previous(current: SnapshotDTO) -> SnapshotDTO:
    if current.is_demo or current.sequence < 1:
        raise ValueError("A real current snapshot is required.")
    content = copy.deepcopy(current.content)
    notices = content.get("notices", {})
    if not notices:
        raise ValueError(f"No source notice content for {current.proposal_id}.")
    notice = notices[sorted(notices)[0]]
    description = notice.get("noticeDescription")
    title = notice.get("title")
    if not isinstance(description, str) or not description.strip() or not isinstance(title, str):
        raise ValueError(f"Missing title/description for {current.proposal_id}.")
    first_sentence = re.match(r"^.*?[.!?](?:\s+|$)", description, flags=re.S)
    if first_sentence:
        remaining = description[first_sentence.end():]
    else:
        remaining = description.partition("\n")[2]
    notice["noticeDescription"] = DEMO_SENTENCE + ("\n" + remaining if remaining else "")
    notice["title"] = "Demo previous title — " + title
    return SnapshotDTO(
        id="demo-previous-v1:" + current.proposal_id, proposal_id=current.proposal_id,
        sequence=0, captured_at=datetime.now(timezone.utc), source_urls=current.source_urls,
        content_sha256=_digest(content), content=content,
        # There is no downloaded official raw record for invented text.
        raw_notices=[], is_demo=True, demo_label=DEMO_LABEL, demo_after_snapshot_id=current.id,
    )


def seed_demo_diffs(db, *, write=False):
    service = ProposalSnapshotService(db)
    results = []
    for proposal in service.proposals.get_all():
        proposal_id = proposal.get("id", str(proposal["_id"]))
        current = service.history.latest(proposal_id)
        if current is None:
            raise ValueError(f"Capture a real baseline before seeding {proposal_id}.")
        demo_id = "demo-previous-v1:" + proposal_id
        existing = db["proposal_snapshots"].find_one({"_id": demo_id, "proposal_id": proposal_id})
        if existing:
            before = SnapshotDTO.model_validate({k: v for k, v in existing.items() if k != "_id"})
            if not before.is_demo or not before.demo_after_snapshot_id:
                raise ValueError(f"Unexpected record at demo ID for {proposal_id}; no overwrite attempted.")
            after = service.history.get(proposal_id, before.demo_after_snapshot_id)
        else:
            after = current
            before = build_demo_previous(after)
        if write:
            if not existing:
                service.history.insert(before)
            diff = service.compare_proposal_snapshots(proposal_id, before.id, after.id)
            if len(diff.changes) != 2 or not diff.is_demo:
                raise ValueError(f"Unexpected comparison for {proposal_id}.")
        results.append({
            "proposal_id": proposal_id, "before_snapshot_id": before.id, "after_snapshot_id": after.id,
            "after_content_sha256": after.content_sha256, "synthetic": True,
            "status": "already_seeded" if existing else "inserted" if write else "planned",
        })
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    client = get_mongo_client()
    if client is None:
        raise SystemExit("MongoDB is not configured.")
    try:
        results = seed_demo_diffs(get_database(client), write=args.write)
        report = {"generated_at": datetime.now(timezone.utc).isoformat(), "write": args.write,
                  "proposal_count": len(results), "demo_label": DEMO_LABEL, "comparisons": results}
        if args.manifest:
            args.manifest.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2))
    finally:
        client.close()


if __name__ == "__main__":
    main()
