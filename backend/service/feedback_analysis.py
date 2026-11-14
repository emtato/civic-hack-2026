"""Recoverable request extraction from authoritative feedback, with content-based caching."""

import hashlib
import json

try:
    from proposals_DTO import ConditionItemDTO
except ImportError:
    from backend.proposals_DTO import ConditionItemDTO
from .condition_grouping import CommentExtraction, GroupingUnavailable, extract_requests

ANALYSIS_VERSION = 2


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def submission_content(submission):
    return {
        "participant_id": submission.participant_id,
        "comment": submission.comment.strip(),
        "condition": submission.condition.model_dump() if submission.condition else None,
        "confirmed_requests": [r.model_dump() for r in submission.confirmed_requests]
        if submission.confirmed_requests is not None else None,
    }


def input_hash(submissions, aggregate):
    return digest({
        "version": ANALYSIS_VERSION,
        "feedback": sorted((submission_content(s) for s in submissions), key=lambda s: s["participant_id"]),
        "rejected": sorted(item.id for group in aggregate.condition_clusters for item in group.items
                           if item.grouping_rejected),
    })


def evidence_key(item):
    return (item.participant_id, item.source, item.extracted_requirement.strip().casefold(),
            (item.time_window or "").strip().casefold(), (item.location_label or "").strip().casefold())


def extract_bounded(rows, heartbeat):
    """Split a verbose batch rather than retrying the same truncated response forever."""
    heartbeat()
    try:
        return extract_requests(rows)
    except GroupingUnavailable as exc:
        if not exc.incomplete or len(rows) < 2:
            raise
        middle = len(rows) // 2
        return extract_bounded(rows[:middle], heartbeat) + extract_bounded(rows[middle:], heartbeat)


def collect_evidence(submissions, aggregate, cache, heartbeat=lambda: None):
    """Return all current requests; cache valid batches even if a later batch fails."""
    previous = {evidence_key(item): item for group in aggregate.condition_clusters for item in group.items}
    analysed = {}
    pending = []
    for submission in submissions:
        if submission.confirmed_requests is not None:
            # Already reviewed by the resident; never extract new requests later.
            analysed[submission.participant_id] = submission.confirmed_requests
            continue
        if not submission.comment.strip():
            analysed[submission.participant_id] = []
            continue
        cache_id = digest([ANALYSIS_VERSION, submission.proposal_id, submission_content(submission)])
        stored = cache.find_one({"_id": cache_id})
        if stored is not None:
            analysed[submission.participant_id] = CommentExtraction.model_validate(stored["analysis"]).requests
        else:
            pending.append((submission, cache_id))
    for offset in range(0, len(pending), 12):
        heartbeat()
        batch = pending[offset:offset + 12]
        results = extract_bounded([
            {"number": number, "comment": sub.comment.strip(),
             "explicit_requirement": sub.condition.requirement if sub.condition else None}
            for number, (sub, _) in enumerate(batch)
        ], heartbeat)
        # Validate at the boundary as well, so incomplete batches never become cached success.
        numbers = [result.number for result in results]
        if len(numbers) != len(batch) or set(numbers) != set(range(len(batch))):
            raise GroupingUnavailable("AI comment analysis did not cover every comment.")
        for result in results:
            sub, cache_id = batch[result.number]
            if any(not r.quote.strip() or r.quote not in sub.comment or not r.requirement.strip() for r in result.requests):
                raise GroupingUnavailable("AI comment analysis returned unsupported evidence.")
            analysed[sub.participant_id] = result.requests
            cache.update_one({"_id": cache_id}, {"$set": {"analysis": result.model_dump()}}, upsert=True)

    evidence = []
    for submission in sorted(submissions, key=lambda s: s.participant_id):
        requests = []
        if submission.condition:
            c = submission.condition
            requests.append(("requirement", c.requirement, submission.comment.strip(),
                             c.time_window, c.location_label, c.is_conditional_support))
        requests.extend(("comment", r.requirement, r.quote, r.time_window, r.location_label, False)
                        for r in analysed[submission.participant_id])
        seen = set()
        for source, requirement, quote, time, place, support in requests:
            # Exact repeats are removed here; semantic repeats of the explicit request
            # are excluded by extraction. Group voice counts additionally deduplicate authors.
            key = (requirement.strip().casefold(), (time or "").strip().casefold(),
                   (place or "").strip().casefold())
            if key in seen:
                continue
            seen.add(key)
            item = ConditionItemDTO(
                id="request-" + digest([submission.proposal_id, submission.participant_id, source, key])[:24],
                participant_id=submission.participant_id, source=source,
                extracted_requirement=requirement.strip(), verbatim_quote=quote,
                time_window=time, location_label=place, is_conditional_support=support,
                concern_coordinates=submission.concern_coordinates,
                submitted_at=submission.submitted_at or aggregate.last_updated,
            )
            old = previous.get(evidence_key(item))
            if old:
                item.id = old.id
                item.grouping_rejected = old.grouping_rejected
            evidence.append(item)
    return evidence
