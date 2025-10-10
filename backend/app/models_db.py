from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, timezone
import uuid

from .db import Base

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class Participant(Base):
    __tablename__ = "participants"
    asurite: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    drafts = relationship("Draft", back_populates="participant", uselist=True)
    revisions = relationship("Revision", back_populates="participant", uselist=True)
    sessions = relationship("WritingSession", back_populates="participant")

class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asurite: Mapped[str] = mapped_column(String, ForeignKey("participants.asurite"), nullable=False, index=True)

    essay_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    language_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)
    content_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    participant = relationship("Participant", back_populates="drafts")

class WritingSession(Base):
    __tablename__ = "writing_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    asurite: Mapped[str] = mapped_column(String, ForeignKey("participants.asurite"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    participant = relationship("Participant", back_populates="sessions")
    revision = relationship("Revision", back_populates="session", uselist=False)

class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("writing_sessions.id"), nullable=False, unique=True)
    asurite: Mapped[str] = mapped_column(String, ForeignKey("participants.asurite"), nullable=False, index=True)

    language_revision_text: Mapped[str] = mapped_column(Text, default="", nullable=True)
    language_rating: Mapped[int] = mapped_column(Integer, nullable=True)  # 1..5
    content_revision_text: Mapped[str] = mapped_column(Text, default="", nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    participant = relationship("Participant", back_populates="revisions")
    session = relationship("WritingSession", back_populates="revision")
