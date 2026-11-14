"""Notification delivery, retry recovery and private inbox checks; no live DB."""

import copy
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from auth import create_access_token, get_user_repository
from main import app, get_notification_repository
from persistence.notifications import NotificationRepository
from persistence.persistence import UserRepository, FeedbackRepository
from proposals_DTO import ProposalFeedbackSubmissionDTO
from service import test_proposal_snapshots as snapshot_fixtures


class NotificationCollection(snapshot_fixtures.Collection):
    def find(self, query):
        class Cursor(list):
            def sort(self, key, direction):
                return Cursor(sorted(self, key=lambda row: row[key], reverse=direction == -1))

            def limit(self, count):
                return Cursor(self[:count])
        return Cursor(copy.deepcopy(row) for row in self.documents.values() if self.matches(row, query))

    def count_documents(self, query):
        return len(self.find(query))

    def update_many(self, query, update):
        for row in self.find(query):
            self.update_one({"_id": row["_id"]}, update)

    def delete_one(self, query):
        row = self.find_one(query)
        if row:
            del self.documents[row["_id"]]


class NotificationsTests(unittest.TestCase):
    def setUp(self):
        fixture = snapshot_fixtures.SnapshotTests("runTest")
        fixture.setUp()
        self.db, self.service, self.raw = fixture.db, fixture.service, fixture.raw
        self.db.collections["notifications"] = NotificationCollection()
        self.db.collections["proposal_follows"] = NotificationCollection()
        self.repo = NotificationRepository(self.db)
        self.service.notifications = self.repo
        self.before = datetime.now(timezone.utc) - timedelta(days=1)
        for username in ("alice", "bob", "late", "follower"):
            self.db["users"].insert_one({
                "_id": username, "username": username, "password_hash": "unused",
                "created_at": self.before.isoformat(),
            })
        self.participate("alice")
        self.service.check_proposal_updates("example")

    def participate(self, username, proposal_id="example", when=None):
        self.db["feedback"].insert_one({
            "_id": f"{proposal_id}:{username}", "proposal_id": proposal_id,
            "participant_id": username, "created_at": when or self.before,
        })

    def change(self):
        self.raw["noticeDescription"] += "<p>Evening pickup added.</p>"
        return self.service.check_proposal_updates("example").diffs[-1]

    def test_only_prior_participants_and_followers_receive_changes_once(self):
        self.participate("bob", "another-proposal")
        self.participate("fictional-seed")
        self.participate("late", when=datetime.now(timezone.utc) + timedelta(days=1))
        self.assertTrue(self.repo.follow("follower", "example"))
        self.repo.follow("alice", "example")  # Two interactions still produce one alert.
        self.assertEqual(0, self.repo.inbox("alice").unread_count)  # Baseline is quiet.
        diff = self.change()
        for username in ("alice", "follower"):
            inbox = self.repo.inbox(username)
            self.assertEqual(1, inbox.unread_count)
            self.assertEqual(diff.id, inbox.items[0].diff_id)
        for username in ("bob", "late", "fictional-seed"):
            self.assertEqual([], self.repo.inbox(username).items)
        self.service.check_proposal_updates("example")
        self.assertEqual(1, len(self.repo.inbox("alice").items))

    def test_opening_clears_all_new_flags_keeps_history_and_retry_does_not_unread(self):
        self.change()
        self.change()
        self.assertEqual(2, self.repo.inbox("alice").unread_count)
        seen = self.repo.mark_all_read("alice")
        self.assertEqual(0, seen.unread_count)
        self.assertEqual(2, len(seen.items))
        self.assertTrue(all(row.read_at for row in seen.items))
        self.service.check_proposal_updates("example")
        self.assertEqual(0, self.repo.inbox("alice").unread_count)
        self.change()
        self.assertEqual(1, self.repo.inbox("alice").unread_count)
        self.assertEqual(3, len(self.repo.inbox("alice").items))

    def test_interrupted_delivery_recovers_after_diff_was_saved(self):
        self.raw["noticeDescription"] += "<p>Changed.</p>"
        with patch.object(self.service.notifications, "notify_participants", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                self.service.check_proposal_updates("example")
        self.assertEqual(1, len(self.db["proposal_snapshot_diffs"].documents))
        self.assertEqual([], self.repo.inbox("alice").items)
        self.service.check_proposal_updates("example")
        self.assertEqual(1, self.repo.inbox("alice").unread_count)

    def test_follow_is_repeatable_unfollow_stops_alerts_but_feedback_remains_subscribed(self):
        self.assertFalse(self.repo.follow("follower", "missing"))
        self.repo.follow("follower", "example")
        self.repo.follow("follower", "example")
        self.assertEqual(["example"], self.repo.following("follower"))
        self.repo.unfollow("follower", "example")
        self.assertEqual([], self.repo.following("follower"))
        self.repo.follow("alice", "example")
        self.repo.unfollow("alice", "example")
        self.change()
        self.assertEqual([], self.repo.inbox("follower").items)
        self.assertEqual(1, self.repo.inbox("alice").unread_count)

    def test_demo_comparison_does_not_send_notifications(self):
        diff = self.change().model_copy(update={"is_demo": True, "id": "demo"})
        self.repo.mark_all_read("alice")
        snapshot = self.service.history.latest("example")
        self.repo.notify_participants(diff, snapshot)
        self.assertEqual(0, self.repo.inbox("alice").unread_count)

    def test_feedback_edits_preserve_first_participation_time(self):
        from persistence.test_persistence import MockMongoDatabase
        repo = FeedbackRepository(MockMongoDatabase())
        submission = ProposalFeedbackSubmissionDTO(
            proposal_id="example", participant_id="alice", position="support", stakeholder_role="resident",
        )
        repo.save_submission(submission)
        original = repo.collection.find_one({"_id": "example:alice"})["created_at"]
        repo.save_submission(submission.model_copy(update={"comment": "Edited"}))
        self.assertEqual(original, repo.collection.find_one({"_id": "example:alice"})["created_at"])

    def test_authenticated_inboxes_follows_and_read_all_are_scoped_to_the_token(self):
        self.participate("bob")
        self.change()
        app.dependency_overrides[get_notification_repository] = lambda: self.repo
        app.dependency_overrides[get_user_repository] = lambda: UserRepository(self.db)
        try:
            client = TestClient(app)
            for path in ("/api/notifications", "/api/following"):
                self.assertEqual(401, client.get(path).status_code)
            self.assertEqual(401, client.post("/api/notifications/read").status_code)
            self.assertEqual(401, client.put("/api/proposals/example/follow").status_code)
            self.assertEqual(401, client.delete("/api/proposals/example/follow").status_code)
            headers = {"Authorization": f"Bearer {create_access_token('alice')}"}
            inbox = client.get("/api/notifications?username=bob", headers=headers)
            self.assertEqual(200, inbox.status_code)
            self.assertEqual(1, inbox.json()["unread_count"])
            seen = client.post("/api/notifications/read", headers=headers).json()
            self.assertEqual(0, seen["unread_count"])
            self.assertEqual(1, len(seen["items"]))
            self.assertEqual(1, self.repo.inbox("bob").unread_count)
            self.assertEqual(200, client.put("/api/proposals/example/follow", headers=headers).status_code)
            self.assertEqual(["example"], client.get("/api/following", headers=headers).json())
            self.assertEqual([], self.repo.following("bob"))
            self.assertEqual(404, client.put("/api/proposals/missing/follow", headers=headers).status_code)
            self.assertEqual(200, client.delete("/api/proposals/example/follow", headers=headers).status_code)
            self.assertEqual([], client.get("/api/following", headers=headers).json())
        finally:
            app.dependency_overrides.clear()
