"""Private, persistent proposal-change notifications."""

from datetime import datetime
from pydantic import BaseModel


class NotificationDTO(BaseModel):
    id: str
    proposal_id: str
    proposal_title: str
    diff_id: str
    created_at: datetime
    read_at: datetime | None = None


class NotificationInboxDTO(BaseModel):
    items: list[NotificationDTO]
    unread_count: int
