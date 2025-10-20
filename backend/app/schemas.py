# backend/app/schemas.py
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime

class LoginIn(BaseModel):
    email: EmailStr

class LoginOut(BaseModel):
    asurite: str
    found: bool
    draft_id: Optional[int] = None

class DraftOut(BaseModel):
    draft_id: int
    asurite: str
    essay_text: str
    # bifurcated feedback
    feedback_strengths: str
    feedback_area1: str
    feedback_area2: str
    feedback_area3: str
    content_feedback: str
    # NEW: prompt_type (useful for downstream analysis)
    prompt_type: Optional[str] = ""

class StartSessionIn(BaseModel):
    asurite: str

class StartSessionOut(BaseModel):
    session_id: str
    started_at: datetime

class StartSessionErr(BaseModel):
    detail: str

class LanguageCompleteIn(BaseModel):
    session_id: str
    language_revision_text: str = ""
    language_rating: int = Field(..., ge=1, le=5)
    revision_duration_seconds: Optional[float] = None

class RevisionStatusOut(BaseModel):
    session_id: str
    language_saved: bool
    rating_saved: Optional[int] = None

class MessageOut(BaseModel):
    message: str
