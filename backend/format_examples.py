"""Apply source-anchored enrichment to the selected examples without replacing IDs."""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bson.codec_options import CodecOptions

from database.database import get_database, get_mongo_client
from imported_data_dto import DatedEvent, Evidence, Feature, Proposal, Version

HERE = Path(__file__).resolve().parent
ENRICHMENT = HERE / "data/proposal-enrichment.json"
OUTPUT = HERE / "data/proposals.formatted.json"
MONTHS = "January February March April May June July August September October November December".split()
DATE = re.compile(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b")
FIELDS = ("summary", "summary_evidence", "features", "versions", "current_version_id", "map_point",
          "geographic_scope", "neighbourhood", "status", "status_as_of", "status_evidence", "dates",
          "participation", "planning_details", "heritage_details", "transportation_details",
          "financial_details", "licensing_details", "property_details", "review")


def enrich(proposal, curated):
    p = proposal.model_copy(deep=True)
    source = p.source_notices[-1]
    if len(p.source_notices) != 1 or source.raw_sha256 != curated["source_sha256"]:
        raise ValueError(f"Source changed for {p.id}; review enrichment before applying")
    text = source.description_text
    features = []
    for index, entry in enumerate(curated["features"], 1):
        anchor = entry["anchor"]
        if anchor not in text:
            raise ValueError(f"Evidence missing for {p.id}: {anchor}")
        quote = next(line for line in text.splitlines() if anchor in line)
        evidence = Evidence(source_url=source.url, notice_id=source.notice_id, quote=quote)
        features.append(Feature(id=f"{p.id}-feature-{index}", label=entry["label"],
                                description=quote, proposed_change=quote,
                                question=f"What concerns or requirements do you have about {entry['label'].lower()}?",
                                evidence=[evidence]))
    if not p.summary:
        p.summary = curated["summary"]
        p.summary_evidence = [e for f in features for e in f.evidence]
    if not p.features:
        p.features = features
    data = p.model_dump(mode="python")
    for field, value in curated["details"].items():
        if field == "status":
            continue
        if data.get(field) is None:
            data[field] = {**value, "evidence": [e.model_dump() for e in p.summary_evidence]}
    p = Proposal.model_validate(data)
    # These statuses describe the archived notice, not a fresh municipal check.
    if p.status == "unknown":
        p.status = curated["details"].get("status", "proposed")
        p.status_as_of = source.published_at
        p.status_evidence = [Evidence(source_url=source.url, notice_id=source.notice_id,
                                     quote=source.title + "\n" + features[0].evidence[0].quote)]
    points = [a.point for a in p.addresses if a.point]
    if p.geographic_scope == "unknown":
        p.geographic_scope = "multiple_sites" if len(p.addresses) > 1 else "site" if p.addresses else "citywide"
    if p.map_point is None and points:
        p.map_point = points[0]  # An existing source point, not a fabricated centroid/boundary.
    if not p.neighbourhood:
        match = re.search(r"in the ([A-Z][\w -]+?) neighbourhood", text)
        if match:
            p.neighbourhood = match.group(1)

    dates = []
    instructions = []
    for line in text.splitlines():
        matches = list(DATE.finditer(line))
        lower = line.lower()
        relevant = any(word in lower for word in ("meeting", "no later than", "until ", "effect on", "on july 30, 2026"))
        if relevant:
            for match in matches:
                month, day, year = match.groups()
                date = datetime(int(year), MONTHS.index(month) + 1, int(day)).date().isoformat()
                kind = "other"
                if len(matches) == 1:
                    if "no later than" in lower and any(word in lower for word in ("presentation", "register", "address", "speak")):
                        kind = "speaker_deadline"
                    elif "meeting" in lower:
                        kind = "meeting"
                    elif "come into effect" in lower:
                        kind = "effective"
                time = re.search(r"\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?|AM|PM)", line, re.I)
                dates.append(DatedEvent(kind=kind, label=f"{kind.replace('_', ' ').title()} in archived notice",
                                       date=date, time=time.group(0) if time else None, timezone="America/Toronto",
                                       raw_text=line, evidence=[Evidence(source_url=source.url, notice_id=source.notice_id, quote=line)],
                                       verified=False))
        if any(phrase in lower for phrase in ("to submit comments", "if you wish to make a presentation", "you may send written", "enquiries may be made", "if you wish to receive notice")):
            instructions.append(line)
    if p.dates is None:
        p.dates = list({(d.kind, d.date, d.raw_text): d for d in dates}.values()) or None
    if not p.participation.official_url:
        p.participation.official_url = source.url
    if not p.participation.instructions:
        p.participation.instructions = "Instructions from the archived notice; current availability is not verified.\n" + "\n".join(instructions[:4]) if instructions else None
        p.participation.evidence = [Evidence(source_url=source.url, notice_id=source.notice_id, quote=s) for s in instructions[:4]]
    if not p.participation.accessibility_instructions:
        p.participation.accessibility_instructions = next((line for line in text.splitlines() if "special assistance" in line.lower()), None)
    # Do not manufacture review rounds. This is exactly one source snapshot.
    if not p.versions:
        version_id = f"notice-{source.notice_id}-{source.raw_sha256[:12]}"
        p.versions = [Version(id=version_id, label=f"Notice published {source.published_at.date().isoformat()}",
                             published_at=source.published_at, description=p.summary, features=p.features,
                             evidence=p.summary_evidence)]
        p.current_version_id = version_id
    p.review.issues = ["Current municipal status/participation requires a fresh check; stored status is dated to the source notice.",
                       "Dates are extracted mentions with original context; verify their role before treating them as deadlines."]
    if p.map_point:
        p.review.issues.append("Representative map point is the first source address; geographic placement remains unverified.")
    p.review.notes = "Source-anchored summaries, features and category details prepared from archived text. No new revision, current consultation window or measured impact inferred."
    p.review.state = "needs_review"
    return Proposal.model_validate(p.model_dump())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    curated = json.loads(ENRICHMENT.read_text())
    client = None
    try:
        if args.write:
            client = get_mongo_client()
            if client is None:
                raise ValueError("MongoDB is not configured")
            db = get_database(client).with_options(codec_options=CodecOptions(tz_aware=True))
            records = list(db.imported_proposals.find({"_id": {"$in": list(curated)}}))
        else:
            records = json.loads((HERE / "data/proposals.preview.json").read_text())["proposals"]
        if len(records) != len(curated):
            raise ValueError("Selected batch is incomplete; no writes performed")
        before = {}
        enriched = []
        for record in records:
            record = dict(record)
            record.pop("_id", None)
            original = Proposal.model_validate({k: v for k, v in record.items() if k in Proposal.model_fields})
            before[original.id] = original
            enriched.append(enrich(original, curated[original.id]))
        # All records validate before the first database update.
        OUTPUT.write_text(json.dumps({"count": len(enriched), "proposals": [p.model_dump(mode="json") for p in enriched]}, ensure_ascii=False, indent=2) + "\n")
        modified = 0
        if args.write:
            for p in enriched:
                data = p.model_dump(mode="python")
                hashes = [s.raw_sha256 for s in before[p.id].source_notices]
                result = db.imported_proposals.update_one(
                    {"_id": p.id, "source_notices.raw_sha256": {"$all": hashes}},
                    {"$set": {field: data[field] for field in FIELDS}})
                if result.matched_count != 1:
                    raise ValueError("A source changed during update; inspect and rerun")
                modified += result.modified_count
            stored = list(db.imported_proposals.find({"_id": {"$in": list(curated)}}))
            by_id = {p.id: p for p in enriched}
            for record in stored:
                p = by_id[record["_id"]]
                for field in FIELDS:
                    actual = Proposal.model_validate({k: v for k, v in record.items() if k in Proposal.model_fields})
                    if actual.model_dump(mode="json")[field] != p.model_dump(mode="json")[field]:
                        raise ValueError("Read-back verification failed")
        print(json.dumps({"mode": "write" if args.write else "dry_run", "count": len(enriched),
                          "summaries": sum(bool(p.summary) for p in enriched), "features": sum(len(p.features or []) for p in enriched),
                          "with_dates": sum(bool(p.dates) for p in enriched), "with_map_points": sum(p.map_point is not None for p in enriched),
                          "citywide": sum(p.geographic_scope == "citywide" for p in enriched), "modified": modified,
                          "output": str(OUTPUT)}, indent=2))
    except Exception as exc:
        print(f"Formatting failed ({type(exc).__name__}); no credentials or database details logged.")
        return 1
    finally:
        if client is not None:
            client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
