"""MongoDB persistence used only when the internal snapshot service is called."""

from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database

try:
    from proposal_snapshots_DTO import SnapshotDTO, SnapshotDiffDTO
except ImportError:
    from backend.proposal_snapshots_DTO import SnapshotDTO, SnapshotDiffDTO


class ProposalSnapshotRepository:
    def __init__(self, db: Database):
        self.snapshots = db["proposal_snapshots"]
        self.diffs = db["proposal_snapshot_diffs"]
        self._indexes_ready = False

    def latest(self, proposal_id: str) -> SnapshotDTO | None:
        document = self.snapshots.find_one(
            {"proposal_id": proposal_id}, sort=[("sequence", DESCENDING)]
        )
        return self._snapshot(document)

    def get(self, proposal_id: str, snapshot_id: str) -> SnapshotDTO:
        result = self._snapshot(self.snapshots.find_one({
            "_id": snapshot_id, "proposal_id": proposal_id,
        }))
        if result is None:
            raise ValueError(f"Snapshot '{snapshot_id}' does not belong to proposal '{proposal_id}'.")
        return result

    def since(self, proposal_id: str, sequence: int, through_sequence: int) -> list[SnapshotDTO]:
        cursor = self.snapshots.find({
            "proposal_id": proposal_id,
            "sequence": {"$gt": sequence, "$lte": through_sequence},
        }).sort("sequence", ASCENDING)
        return [self._snapshot(document) for document in cursor]

    @staticmethod
    def _snapshot(document):
        if document is None:
            return None
        return SnapshotDTO.model_validate({k: v for k, v in document.items() if k != "_id"})

    def insert(self, snapshot: SnapshotDTO) -> None:
        if not self._indexes_ready:
            # A sequence can have only one successor, even with concurrent refreshes.
            self.snapshots.create_index(
                [("proposal_id", ASCENDING), ("sequence", ASCENDING)],
                unique=True, name="uniq_proposal_snapshot_sequence",
            )
            self._indexes_ready = True
        self.snapshots.insert_one({"_id": snapshot.id, **snapshot.model_dump(mode="python")})

    def save_diff(self, diff: SnapshotDiffDTO) -> SnapshotDiffDTO:
        self.diffs.update_one(
            {"_id": diff.id}, {"$setOnInsert": diff.model_dump(mode="python")}, upsert=True,
        )
        document = self.diffs.find_one({"_id": diff.id})
        return SnapshotDiffDTO.model_validate({k: v for k, v in document.items() if k != "_id"})
