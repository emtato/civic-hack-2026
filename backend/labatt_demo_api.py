"""HTTP interface for the isolated Labatt feedback demo."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from proposals_DTO import ProposalFeedbackSubmissionDTO
from service.labatt_demo import COLLECTION, DemoConflict, DemoJourney, LabattDemo

router = APIRouter(prefix="/api/demos/labatt", tags=["Labatt demo"])


class DemoMutation(BaseModel):
    revision: str | None = Field(pattern=r"^[0-9a-f]{32}$")


class DemoSave(DemoMutation):
    response: ProposalFeedbackSubmissionDTO


def get_demo(
    request: Request,
    session: Annotated[str, Header(alias="X-Proviso-Demo-Session", pattern=r"^[0-9a-f]{64}$")],
) -> LabattDemo:
    db = request.app.state.database
    if db is None:
        raise HTTPException(status_code=503, detail="Demo storage is unavailable.")
    return LabattDemo(db[COLLECTION], session)


@router.get("", response_model=DemoJourney)
def read_journey(response: Response, demo: LabattDemo = Depends(get_demo)):
    response.headers["Cache-Control"] = "private, no-store"
    try:
        return demo.read()
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="The demo couldn’t load. Try again.") from exc


@router.put("/response", response_model=DemoJourney)
def save_response(payload: DemoSave, demo: LabattDemo = Depends(get_demo)):
    try:
        return demo.save(payload.revision, payload.response)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DemoConflict as exc:
        raise HTTPException(status_code=409, detail="The demo session changed while you were editing.") from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="The response couldn’t be saved. Try again.") from exc


@router.post("/reset", response_model=DemoJourney)
def reset_journey(payload: DemoMutation, demo: LabattDemo = Depends(get_demo)):
    try:
        return demo.reset(payload.revision)
    except DemoConflict as exc:
        raise HTTPException(status_code=409, detail="The demo session changed before it could be reset.") from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="The demo couldn’t reset. Try again.") from exc
