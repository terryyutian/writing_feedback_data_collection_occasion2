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
    LanguageCompleteIn,
    RevisionStatusOut, MessageOut
)
from . import crud, models_db as models

# new imports for normalization
import json
import re
from typing import Any

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
# Helpers
# ------------------------
def normalize_essay_text(raw: Any) -> str:
    """
    Normalize essay text stored in the DB.
    Accepts:
      - a plain string with \n paragraph separators (single or double)
      - a Python list/tuple of paragraphs
      - bytes
    Returns a single string with paragraphs separated by double newlines ("\n\n").
    """
    if raw is None:
        return ""

    # If it's already a list/tuple, join them into paragraphs
    if isinstance(raw, (list, tuple)):
        parts = [str(p).strip() for p in raw if p is not None]
        return "\n\n".join(p for p in parts if p != "")

    # If it's bytes, decode
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except Exception:
            raw = str(raw)

    text = str(raw)

    # Heuristic: If it looks like a JSON array, try parsing it (defensive)
    s = text.strip()
    if s.startswith("[") and s.endswith("]"):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                parts = [str(p).strip() for p in parsed if p is not None]
                return "\n\n".join(p for p in parts if p != "")
        except Exception:
            pass  # fall back to plain text handling

    # Normalize CRLF -> LF
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # If there are NO double-newlines but there ARE single newlines,
    # assume single newlines mark paragraphs and convert them to double-newlines.
    # This handles datasets that use "\n" between paragraphs.
    if "\n\n" not in text and "\n" in text:
        # But avoid converting single newlines that are clearly within sentences:
        # Simple approach: convert every single newline to two newlines.
        # (If you have wrapped lines inside paragraphs this may create extra paras.)
        text = text.replace("\n", "\n\n")

    # Replace any sequences of 3+ newlines with exactly 2 (normalize)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Trim leading/trailing whitespace
    text = text.strip()

    return text

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

    # Normalize essay_text so paragraphs are preserved as "\n\n"
    essay_raw = getattr(draft, "essay_text", "") or ""
    essay = normalize_essay_text(essay_raw)

    # get prompt_type (default to empty string if missing)
    ptype = getattr(draft, "prompt_type", "") or ""

    return DraftOut(
        draft_id=draft.id,
        asurite=draft.asurite,
        essay_text=essay,
        feedback_strengths=getattr(draft, "feedback_strengths", "") or "",
        feedback_area1=getattr(draft, "feedback_area1", "") or "",
        feedback_area2=getattr(draft, "feedback_area2", "") or "",
        feedback_area3=getattr(draft, "feedback_area3", "") or "",
        content_feedback=getattr(draft, "content_feedback", "") or "",
        prompt_type=ptype,
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
# Save language completion (rating + revised text) — now the final step
# ------------------------
@app.post("/api/revision/language/complete", response_model=RevisionStatusOut)
def language_complete(payload: LanguageCompleteIn, db: Session = Depends(get_db)) -> RevisionStatusOut:
    try:
        # pass the revision_duration_seconds from the payload into the CRUD saver
        rev = crud.save_language_completion(
            db,
            payload.session_id,
            payload.language_revision_text,
            payload.language_rating,
            payload.revision_duration_seconds, 
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return RevisionStatusOut(session_id=payload.session_id, language_saved=True, rating_saved=rev.language_rating)
# ------------------------
# STATIC FRONTEND
# ------------------------
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend_rev"
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
