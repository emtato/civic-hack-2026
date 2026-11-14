"""FastAPI entry point and HTTP controller.

Run from backend/ with:
.venv/bin/python -m uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from labatt_demo_api import router as labatt_demo_router
from database.database import ensure_indexes, get_database, get_mongo_client
from proposals_DTO import (
    CommentVoteRequestDTO,
    Proposal,
    ProposalCommunityAggregateDTO,
    ProposalFeedbackSubmissionDTO,
)
from service.condition_grouping import GroupingUnavailable
from service.service import FeedbackService, GroupingConflict
from service.snapshot_scheduler import SnapshotScheduler
from service.grouping_scheduler import GroupingScheduler
from service.proposal_snapshots import ProposalSnapshotService, ProposalNotFoundError, SnapshotCursorError
from proposal_snapshots_DTO import SnapshotPollRequestDTO, SnapshotPollResponseDTO, SnapshotViewDTO
from auth import (
    create_access_token,
    get_current_user,
    get_optional_user,
    get_user_repository,
    hash_password,
    verify_password,
)
from users_DTO import (
    TokenDTO,
    UserLoginDTO,
    UserPublicDTO,
    UserRecordDTO,
    UserRegisterDTO,
)
from persistence.persistence import UserRepository
from persistence.notifications import NotificationRepository
from notifications_DTO import NotificationInboxDTO

# Load environment variables from backend/.env
HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Share one MongoDB client across requests, ensure indexes, seed initial proposals, and close on shutdown."""
    client = get_mongo_client()
    db = get_database(client) if client is not None else None

    app.state.mongo_client = client
    app.state.database = db
    scheduler = None
    grouping_scheduler = None

    if db is not None:
        try:
            ensure_indexes(db)
            service = FeedbackService(db)
            service.seed_initial_proposals(force=False)
        except Exception:
            # Allow startup even if network/db is temporarily unreachable
            pass

        if os.getenv("SNAPSHOT_SCHEDULER_ENABLED", "true").lower() not in {"false", "0", "no"}:
            scheduler = SnapshotScheduler(db)
            scheduler.start()

        if os.getenv("GROUPING_SCHEDULER_ENABLED", "true").lower() not in {"false", "0", "no"}:
            grouping_scheduler = GroupingScheduler(db)
            grouping_scheduler.start()

    try:
        yield
    finally:
        try:
            if scheduler is not None:
                await scheduler.stop()
            if grouping_scheduler is not None:
                await grouping_scheduler.stop()
        finally:
            if client is not None:
                client.close()


app = FastAPI(
    title="proviso API",
    description="Municipal proposal feedback and community aggregate persistence API.",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(labatt_demo_router)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def get_service(request: Request) -> FeedbackService:
    """Dependency provider for FeedbackService."""
    db = request.app.state.database
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not configured or unavailable.",
        )
    return FeedbackService(db)


def get_notification_repository(request: Request) -> NotificationRepository:
    db = request.app.state.database
    if db is None:
        raise HTTPException(status_code=503, detail="Notifications are unavailable.")
    return NotificationRepository(db)


@app.get("/api/following", response_model=list[str], tags=["Notifications"])
def get_following(
    current_user: UserPublicDTO = Depends(get_current_user),
    notifications: NotificationRepository = Depends(get_notification_repository),
):
    try:
        return notifications.following(current_user.username)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Following could not be loaded.") from exc


@app.put("/api/proposals/{proposal_id}/follow", tags=["Notifications"])
def follow_proposal(
    proposal_id: str,
    current_user: UserPublicDTO = Depends(get_current_user),
    notifications: NotificationRepository = Depends(get_notification_repository),
):
    try:
        if not notifications.follow(current_user.username, proposal_id):
            raise HTTPException(status_code=404, detail="Proposal was not found.")
        return {"status": "ok"}
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Proposal could not be followed.") from exc


@app.delete("/api/proposals/{proposal_id}/follow", tags=["Notifications"])
def unfollow_proposal(
    proposal_id: str,
    current_user: UserPublicDTO = Depends(get_current_user),
    notifications: NotificationRepository = Depends(get_notification_repository),
):
    try:
        notifications.unfollow(current_user.username, proposal_id)
        return {"status": "ok"}
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Proposal could not be unfollowed.") from exc


@app.get("/api/notifications", response_model=NotificationInboxDTO, tags=["Notifications"])
def get_notifications(
    current_user: UserPublicDTO = Depends(get_current_user),
    notifications: NotificationRepository = Depends(get_notification_repository),
):
    try:
        return notifications.inbox(current_user.username)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Notifications could not be loaded.") from exc


@app.post("/api/notifications/read", response_model=NotificationInboxDTO, tags=["Notifications"])
def read_notifications(
    current_user: UserPublicDTO = Depends(get_current_user),
    notifications: NotificationRepository = Depends(get_notification_repository),
):
    try:
        return notifications.mark_all_read(current_user.username)
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Notifications could not be marked as seen.") from exc


def get_snapshot_service(request: Request) -> ProposalSnapshotService:
    db = request.app.state.database
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured or unavailable.")
    return ProposalSnapshotService(db)


# ============================================================================
# Health Check Endpoints
# ============================================================================

@app.get("/health", tags=["Health"])
def health():
    """Check that the API is running, independently of MongoDB."""
    return {"status": "ok"}


@app.get("/health/database", tags=["Health"])
def database_health(request: Request):
    """Verify database connectivity without exposing connection credentials."""
    client = request.app.state.mongo_client
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not configured.",
        )
    try:
        client.admin.command("ping")
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is unavailable.",
        ) from None
    return {"status": "ok", "database": "connected"}


# ============================================================================
# Auth Endpoints (Controller)
# ============================================================================

@app.post(
    "/api/auth/register",
    response_model=TokenDTO,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register(
    body: UserRegisterDTO,
    users: UserRepository = Depends(get_user_repository),
):
    """Create a username/password account and return a signed token.

    Reading proposals and feedback needs no account; an account is only
    required to submit feedback.
    """
    from datetime import datetime, timezone

    record = UserRecordDTO(
        username=body.username,
        password_hash=hash_password(body.password),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    try:
        created = users.create(record)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error creating account.",
        ) from exc

    if not created:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' is already taken.",
        )

    token = create_access_token(record.username)
    return TokenDTO(access_token=token, username=record.username)


@app.post("/api/auth/login", response_model=TokenDTO, tags=["Auth"])
def login(
    body: UserLoginDTO,
    users: UserRepository = Depends(get_user_repository),
):
    """Verify credentials and return a signed token.

    Returns 401 for both unknown username and wrong password so the
    response does not reveal whether a username exists.
    """
    try:
        record = users.get_by_username(body.username)
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error during login.",
        ) from exc

    if record is None or not verify_password(body.password, record.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = create_access_token(record.username)
    return TokenDTO(access_token=token, username=record.username)


@app.get("/api/auth/me", response_model=UserPublicDTO, tags=["Auth"])
def read_current_user(current_user: UserPublicDTO = Depends(get_current_user)):
    """Return the currently authenticated user (used by the frontend)."""
    return current_user


# ============================================================================
# Proposals Endpoints (Controller)
# ============================================================================

@app.get("/api/proposals", response_model=List[Proposal], tags=["Proposals"])
def list_proposals(
    topic: Optional[str] = Query(None, description="Filter by proposal topic"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    service: FeedbackService = Depends(get_service),
):
    """Retrieve all proposals from MongoDB, each with its attached community aggregate feedback object."""
    try:
        proposals = service.get_proposals()
        if topic:
            proposals = [p for p in proposals if p.topic.lower() == topic.lower()]
        if status_filter:
            proposals = [p for p in proposals if p.status.lower() == status_filter.lower()]
        return proposals
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to retrieve proposals from database.",
        ) from exc


@app.get("/api/proposals/{proposal_id}", response_model=Proposal, tags=["Proposals"])
def get_proposal(
    proposal_id: str,
    service: FeedbackService = Depends(get_service),
):
    """Retrieve a single proposal by ID with its attached community aggregate feedback object."""
    try:
        proposal = service.get_proposal(proposal_id)
        if proposal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' was not found.",
            )
        return proposal
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to query database for proposal.",
        ) from exc


# @app.post("/api/proposals", response_model=Proposal, status_code=status.HTTP_201_CREATED, tags=["Proposals"])
# def save_proposal(
#     proposal: Proposal,
#     service: FeedbackService = Depends(get_service),
# ):
#     """Create or update a proposal in MongoDB with its attached feedback aggregate."""
#     try:
#         saved = service.save_proposal(proposal)
#         return saved
#     except PyMongoError as exc:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to save proposal to database.",
#         ) from exc
#
#
# @app.post("/api/proposals/seed", tags=["Proposals"])
# def seed_proposals(
#     force: bool = Query(False, description="Whether to overwrite existing proposals"),
#     service: FeedbackService = Depends(get_service),
# ):
#     """Seed the saved set of existing proposals into MongoDB if empty or if force=true."""
#     try:
#         count = service.seed_initial_proposals(force=force)
#         return {"status": "ok", "seeded_count": count}
#     except Exception as exc:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to seed proposals: {type(exc).__name__}",
#         ) from exc


# ============================================================================
# Feedback Endpoints (Controller)
# ============================================================================

@app.get(
    "/api/proposals/{proposal_id}/snapshots/{snapshot_id}",
    response_model=SnapshotViewDTO,
    tags=["Proposal updates"],
)
def get_proposal_snapshot(
    proposal_id: str,
    snapshot_id: str,
    service: ProposalSnapshotService = Depends(get_snapshot_service),
):
    """Read a captured notice for comparison, scoped to its proposal."""
    try:
        return service.get_proposal_snapshot(proposal_id, snapshot_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Saved proposal version was not found.") from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Saved proposal versions are unavailable.") from exc


@app.get(
    "/api/proposals/{proposal_id}/updates",
    response_model=SnapshotPollResponseDTO,
    tags=["Proposal updates"],
)
def get_proposal_updates(
    proposal_id: str,
    after_sequence: int = Query(0, ge=0),
    service: ProposalSnapshotService = Depends(get_snapshot_service),
):
    """Read results saved by the backend's hourly source checker."""
    try:
        return service.read_proposal_updates(proposal_id, after_sequence)
    except ProposalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SnapshotCursorError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Proposal update history is unavailable.") from exc


@app.post(
    "/api/proposals/{proposal_id}/updates/check", response_model=SnapshotPollResponseDTO,
    tags=["Proposal updates"], deprecated=True,
)
def check_proposal_updates(
    proposal_id: str, poll: SnapshotPollRequestDTO,
    service: ProposalSnapshotService = Depends(get_snapshot_service),
):
    """Compatibility for older clients; now reads saved results without a source fetch."""
    return get_proposal_updates(proposal_id, poll.after_sequence, service)

@app.post(
    "/api/proposals/{proposal_id}/condition-groups",
    response_model=ProposalCommunityAggregateDTO,
    tags=["Feedback"],
    dependencies=[Depends(get_current_user)],
)
def group_conditions(proposal_id: str, service: FeedbackService = Depends(get_service)):
    try:
        return service.queue_condition_groups(proposal_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GroupingConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except GroupingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Could not update condition groups.") from exc


@app.post(
    "/api/proposals/{proposal_id}/condition-groups/{condition_id}/reject",
    response_model=ProposalCommunityAggregateDTO,
    tags=["Feedback"],
)
def reject_condition_group(
    proposal_id: str,
    condition_id: str,
    current_user: UserPublicDTO = Depends(get_current_user),
    service: FeedbackService = Depends(get_service),
):
    try:
        return service.reject_condition_group(proposal_id, condition_id, current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GroupingConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Could not update condition groups.") from exc


@app.post(
    "/api/proposals/{proposal_id}/feedback",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    tags=["Feedback"],
)
def submit_feedback(
    proposal_id: str,
    submission: ProposalFeedbackSubmissionDTO,
    service: FeedbackService = Depends(get_service),
    current_user: UserPublicDTO = Depends(get_current_user),
):
    """Store citizen feedback in MongoDB and atomically update the proposal's attached aggregate.

    Requires authentication. The participant is taken from the verified
    token, not the request body, so a logged-in user can only submit as
    themselves.
    """
    if submission.proposal_id and submission.proposal_id != proposal_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path proposal_id '{proposal_id}' does not match body proposal_id '{submission.proposal_id}'.",
        )
    submission.proposal_id = proposal_id
    # Identity comes from the token, overriding any client-supplied value.
    submission.participant_id = current_user.username

    try:
        saved_sub, updated_agg = service.submit_feedback(submission)
        return {
            "status": "success",
            "feedback": saved_sub.model_dump(mode="json"),
            "community_aggregate": updated_agg.model_dump(mode="json"),
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        ) from val_err
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error saving feedback submission.",
        ) from exc


@app.get(
    "/api/proposals/{proposal_id}/feedback",
    response_model=List[ProposalFeedbackSubmissionDTO],
    tags=["Feedback"],
)
def list_feedback_for_proposal(
    proposal_id: str,
    service: FeedbackService = Depends(get_service),
    viewer: Optional[UserPublicDTO] = Depends(get_optional_user),
):
    """Retrieve all stored feedback submissions for a proposal.

    Public route. When the caller is logged in, each comment also reports
    that viewer's own vote so the UI can highlight it.
    """
    try:
        if service.get_proposal(proposal_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' was not found.",
            )
        return service.get_feedback_submissions(
            proposal_id, viewer_id=viewer.username if viewer else None
        )
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving feedback submissions.",
        ) from exc


@app.post(
    "/api/proposals/{proposal_id}/comments/{comment_owner}/vote",
    response_model=ProposalFeedbackSubmissionDTO,
    tags=["Feedback"],
)
def vote_on_comment(
    proposal_id: str,
    comment_owner: str,
    body: CommentVoteRequestDTO,
    service: FeedbackService = Depends(get_service),
    current_user: UserPublicDTO = Depends(get_current_user),
):
    """Up/down-vote another participant's comment, or clear your vote (value 0).

    Requires authentication. Voters are taken from the verified token, so a
    user votes only as themselves and cannot vote on their own comment.
    """
    try:
        return service.vote_on_comment(
            proposal_id, comment_owner, current_user.username, body.value
        )
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_400_BAD_REQUEST if "own comment" in detail else status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=detail) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error saving your vote.",
        ) from exc


@app.get(
    "/api/proposals/{proposal_id}/feedback/{participant_id}",
    response_model=ProposalFeedbackSubmissionDTO,
    tags=["Feedback"],
)
def get_participant_feedback(
    proposal_id: str,
    participant_id: str,
    service: FeedbackService = Depends(get_service),
):
    """Retrieve a specific participant's feedback for a proposal."""
    try:
        feedback = service.get_participant_feedback(proposal_id, participant_id)
        if feedback is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No feedback found for participant '{participant_id}' on proposal '{proposal_id}'.",
            )
        return feedback
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving participant feedback.",
        ) from exc


@app.get(
    "/api/proposals/{proposal_id}/aggregate",
    response_model=ProposalCommunityAggregateDTO,
    tags=["Feedback"],
)
def get_proposal_aggregate(
    proposal_id: str,
    service: FeedbackService = Depends(get_service),
):
    """Retrieve the current community aggregate feedback object attached to a proposal."""
    try:
        aggregate = service.get_aggregate(proposal_id)
        if aggregate is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' was not found.",
            )
        return aggregate
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving proposal aggregate.",
        ) from exc
