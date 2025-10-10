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
    language_feedback: str
    content_feedback: str

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

class ContentSubmitIn(BaseModel):
    session_id: str
    content_revision_text: str = ""

class RevisionStatusOut(BaseModel):
    session_id: str
    language_saved: bool
    rating_saved: Optional[int] = None

class MessageOut(BaseModel):
    message: str
