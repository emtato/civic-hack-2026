"""Preview or install an isolated Labatt demo fixture."""

import argparse
import json
from pathlib import Path

from service.labatt_demo import FIXTURE_PATH, PROPOSAL_ID, build_journey, load_seed


def seed_labatt_demo(source: Path, *, write: bool = False) -> None:
    seed = load_seed(source)
    journey = build_journey(seed, {})
    content = source.read_bytes()
    changed = not FIXTURE_PATH.exists() or content != FIXTURE_PATH.read_bytes()
    report = {
        "proposal_id": PROPOSAL_ID,
        "destination": str(FIXTURE_PATH),
        "planned_writes": ["replace bundled Labatt demo fixture"] if changed else [],
        "grouping_origin": journey.grouping_origin,
        "distinct_participants": journey.distinct_participants,
        "matched_participants": journey.matched_positions.participants,
        "matched_positions": journey.matched_positions.model_dump(exclude={"participants"}),
        "current_only": journey.current_only,
        "review": journey.review_totals.model_dump(),
        "rounds": [{
            "id": version.id,
            "responses": version.aggregate.total_participants,
            "positions": version.aggregate.position_distribution,
            "ratings": {feature.id: {"count": feature.total_responses, **feature.distribution}
                        for feature in version.aggregate.proposal_specific},
            "comments": len(version.comments),
            "requirements": version.aggregate.total_conditions,
            "groups": {group.id: group.count for group in version.aggregate.condition_clusters},
        } for version in journey.versions],
    }
    print(json.dumps(report, indent=2), flush=True)
    if write and changed:
        pending = FIXTURE_PATH.with_suffix(".json.pending")
        pending.write_bytes(content)
        pending.replace(FIXTURE_PATH)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, nargs="?", default=FIXTURE_PATH)
    parser.add_argument("--write", action="store_true", help="Apply the previewed fixture change.")
    args = parser.parse_args()
    seed_labatt_demo(args.source, write=args.write)
