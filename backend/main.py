"""FastAPI entry point and HTTP controller.

Run from backend/ with:
    uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from database.database import ensure_indexes, get_database, get_mongo_client
from proposals_DTO import (
    Proposal,
    ProposalCommunityAggregateDTO,
    ProposalFeedbackSubmissionDTO,
)
from service.service import FeedbackService

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

    if db is not None:
        try:
            ensure_indexes(db)
            service = FeedbackService(db)
            service.seed_initial_proposals(force=False)
        except Exception:
            # Allow startup even if network/db is temporarily unreachable
            pass

    try:
        yield
    finally:
        if client is not None:
            client.close()


app = FastAPI(
    title="Civic Hack API",
    description="Municipal proposal feedback and community aggregate persistence API.",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.post("/api/proposals", response_model=Proposal, status_code=status.HTTP_201_CREATED, tags=["Proposals"])
def save_proposal(
    proposal: Proposal,
    service: FeedbackService = Depends(get_service),
):
    """Create or update a proposal in MongoDB with its attached feedback aggregate."""
    try:
        saved = service.save_proposal(proposal)
        return saved
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save proposal to database.",
        ) from exc


@app.post("/api/proposals/seed", tags=["Proposals"])
def seed_proposals(
    force: bool = Query(False, description="Whether to overwrite existing proposals"),
    service: FeedbackService = Depends(get_service),
):
    """Seed the saved set of existing proposals into MongoDB if empty or if force=true."""
    try:
        count = service.seed_initial_proposals(force=force)
        return {"status": "ok", "seeded_count": count}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed proposals: {type(exc).__name__}",
        ) from exc


# ============================================================================
# Feedback Endpoints (Controller)
# ============================================================================

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
):
    """Store citizen feedback in MongoDB and atomically update the proposal's attached aggregate."""
    if submission.proposal_id and submission.proposal_id != proposal_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path proposal_id '{proposal_id}' does not match body proposal_id '{submission.proposal_id}'.",
        )
    submission.proposal_id = proposal_id

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
):
    """Retrieve all stored feedback submissions for a proposal."""
    try:
        if service.get_proposal(proposal_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' was not found.",
            )
        return service.get_feedback_submissions(proposal_id)
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving feedback submissions.",
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
