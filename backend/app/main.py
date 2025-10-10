# backend/app/main.py
from pathlib import Path
import logging
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal, engine, Base
from .schemas import (
    LoginIn, LoginOut, DraftOut,
    StartSessionIn, StartSessionOut,
    LanguageCompleteIn, ContentSubmitIn,
    RevisionStatusOut, MessageOut
)
from . import crud, models_db as models

# Logging
logging.basicConfig(
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("rev-app")

# Ensure tables are created
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------
# Simple health
# ------------------------
@app.get("/health", response_model=MessageOut)
def health() -> MessageOut:
    return MessageOut(message="ok")

# ------------------------
# Login (check existence)
# ------------------------
@app.post("/api/login", response_model=LoginOut)
def post_login(payload: LoginIn, db: Session = Depends(get_db)) -> LoginOut:
    email = (payload.email or "").strip().lower()
    asurite = email.split("@")[0] if "@" in email else email
    draft = crud.find_draft_by_asurite(db, asurite)
    if draft is None:
        raise HTTPException(status_code=404, detail="Participant or draft not found.")
    return LoginOut(asurite=asurite, found=True, draft_id=draft.id)

# ------------------------
# Fetch draft & feedback
# ------------------------
@app.get("/api/draft/{asurite}", response_model=DraftOut)
def get_draft(asurite: str, db: Session = Depends(get_db)) -> DraftOut:
    asurite = (asurite or "").strip().lower()
    draft = crud.find_draft_by_asurite(db, asurite)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return DraftOut(
        draft_id=draft.id,
        asurite=draft.asurite,
        essay_text=draft.essay_text,
        language_feedback=draft.language_feedback,
        content_feedback=draft.content_feedback
    )

# ------------------------
# Start session
# ------------------------
@app.post("/api/session/start", response_model=StartSessionOut)
def start_session(payload: StartSessionIn, db: Session = Depends(get_db)) -> StartSessionOut:
    if not payload.asurite:
        raise HTTPException(status_code=422, detail="asurite required")
    session = crud.start_session(db, payload.asurite)
    logger.info("Started revision session %s for %s", session.id, session.asurite)
    return StartSessionOut(session_id=session.id, started_at=session.started_at)

# ------------------------
# Save language completion (rating + revised text)
# ------------------------
@app.post("/api/revision/language/complete", response_model=RevisionStatusOut)
def language_complete(payload: LanguageCompleteIn, db: Session = Depends(get_db)) -> RevisionStatusOut:
    try:
        rev = crud.save_language_completion(db, payload.session_id, payload.language_revision_text, payload.language_rating)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return RevisionStatusOut(session_id=payload.session_id, language_saved=True, rating_saved=rev.language_rating)

# ------------------------
# Submit content revision (finalize)
# ------------------------
@app.post("/api/revision/content/submit", response_model=MessageOut)
def submit_content(payload: ContentSubmitIn, db: Session = Depends(get_db)) -> MessageOut:
    try:
        rev = crud.submit_content_revision(db, payload.session_id, payload.content_revision_text)
    except ValueError as e:
        msg = str(e)
        code = 400 if "already" in msg else 404
        raise HTTPException(status_code=code, detail=msg)
    logger.info("Submitted revision for session %s (asurite=%s)", rev.session_id, rev.asurite)
    return MessageOut(message="Revision submitted. Thank you!")

# ------------------------
# STATIC FRONTEND
# ------------------------
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend_rev"
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
