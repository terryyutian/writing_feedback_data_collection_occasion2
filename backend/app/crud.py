# backend/app/crud.py
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone

from . import models_db as models
from .schemas import LoginIn
import logging

logger = logging.getLogger("rev-app")

def _norm_asurite(s: str) -> str:
    return (s or "").strip().lower()

def ensure_participant(db: Session, asurite: str) -> models.Participant:
    asurite = _norm_asurite(asurite)
    participant = db.get(models.Participant, asurite)
    if participant is None:
        participant = models.Participant(asurite=asurite)
        db.add(participant)
        db.flush()
    return participant

def find_draft_by_asurite(db: Session, asurite: str):
    asurite = _norm_asurite(asurite)
    stmt = select(models.Draft).where(models.Draft.asurite == asurite)
    return db.scalar(stmt)

def start_session(db: Session, asurite: str) -> models.WritingSession:
    asurite = _norm_asurite(asurite)
    participant = ensure_participant(db, asurite)
    session = models.WritingSession(asurite=participant.asurite)
    db.add(session)
    db.commit()
    db.refresh(session)
    # Create a matching revision row (one-to-one with session)
    revision = models.Revision(session_id=session.id, asurite=participant.asurite)
    db.add(revision)
    db.commit()
    db.refresh(revision)
    return session

def _as_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def save_language_completion(db: Session, session_id: str, language_revision_text: str, language_rating: int, revision_duration_seconds: float | None = None):
    session = db.get(models.WritingSession, session_id)
    if session is None:
        raise ValueError("Invalid session_id")
    # ensure revision exists
    rev = db.scalar(select(models.Revision).where(models.Revision.session_id == session.id))
    if rev is None:
        rev = models.Revision(session_id=session.id, asurite=session.asurite)
        db.add(rev)
    rev.language_revision_text = language_revision_text or ""
    rev.language_rating = int(language_rating)
    if revision_duration_seconds is not None:
        try:
            rev.language_revision_duration_seconds = float(revision_duration_seconds)
        except Exception:
            rev.language_revision_duration_seconds = None

    # set submitted timestamps for session and revision
    now_utc = _as_utc(datetime.now())
    try:
        session.submitted_at = now_utc
    except Exception:
        # defensive: in case the attribute doesn't exist or is None (shouldn't happen)
        pass
    try:
        rev.submitted_at = now_utc
    except Exception:
        pass

    db.commit()
    db.refresh(rev)
    return rev
