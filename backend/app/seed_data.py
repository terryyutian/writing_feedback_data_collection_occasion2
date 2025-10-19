# backend/app/seed_data.py
"""
Seed script for the Writing Revision app.

Run from the repository root as:
    python -m backend.app.seed_data

This will:
 - ensure tables exist (Base.metadata.create_all)
 - insert a few sample participants + drafts (if not already present)
 - print inserted rows for quick verification
"""

from sqlalchemy.exc import IntegrityError
from .db import SessionLocal, engine, Base
from .models_db import Participant, Draft
from .config import settings
from datetime import datetime, timezone

SAMPLES = [
    {
        "asurite": "student1",
        "essay_text": (
            "Last summer I had an experience that changed my approach to learning. "
            "I volunteered at a community center and taught children to code. "
            "The joy I saw made me want to teach more."
        ),
        "feedback_strengths": (
            "Clear opening sentence and a personal anecdote that draws the reader in. "
            "Varied sentence structure in places and appropriate word choice overall."
        ),
        "feedback_area1": "Reduce sentence run-ons in the middle paragraph and break them into two sentences.",
        "feedback_area2": "Add more specific examples of a challenge you faced while teaching to strengthen the narrative.",
        "feedback_area3": "Watch for small verb tense shifts (e.g., 'made' vs 'has made').",
       
    },
    {
        "asurite": "student2",
        "essay_text": (
            "During my internship I learned the value of persistence. I was assigned a difficult dataset "
            "and at first I couldn't clean it, but with help I succeeded."
        ),
        "feedback_strengths": (
            "Good thematic focus on persistence and a clear arc: problem → struggle → resolution."
        ),
        "feedback_area1": "Improve transitions between sentences to make the narrative flow more smoothly.",
        "feedback_area2": "Vary sentence openings; avoid repeating 'I' at the start of multiple sentences.",
        "feedback_area3": "Expand on one specific technical challenge to give the reader more context.",
           },
    {
        "asurite": "student3",
        "essay_text": (
            "My team project in school taught me how to communicate under pressure. "
            "We had to present after only a week of preparation, which forced us to prioritize."
        ),
        "feedback_strengths": "Strong focus and concise writing. The reader can follow the progression easily.",
        "feedback_area1": "Provide more descriptive details about the prioritization decisions you made.",
        "feedback_area2": "Avoid passive voice in some sentences to increase clarity.",
        "feedback_area3": "Check punctuation around clauses (commas vs semicolons).",
    }
]


def ensure_tables():
    """Create DB tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)


def seed():
    ensure_tables()
    db = SessionLocal()
    try:
        inserted = []
        for s in SAMPLES:
            asurite = (s["asurite"] or "").strip().lower()
            # check if participant exists
            participant = db.get(Participant, asurite)
            if participant is None:
                participant = Participant(asurite=asurite)
                db.add(participant)
                db.flush()  # ensure the PK available

            # check if draft exists for this asurite
            existing = db.query(Draft).filter(Draft.asurite == asurite).first()
            if existing:
                print(f"[skip] draft already exists for {asurite} (id={existing.id})")
                continue

            draft = Draft(
                asurite=asurite,
                essay_text=s["essay_text"],
                feedback_strengths=s.get("feedback_strengths", ""),
                feedback_area1=s.get("feedback_area1", ""),
                feedback_area2=s.get("feedback_area2", ""),
                feedback_area3=s.get("feedback_area3", ""),
                created_at=datetime.now(timezone.utc),
            )
            db.add(draft)
            db.flush()
            inserted.append((asurite, draft.id))

        db.commit()
        if inserted:
            print("Inserted drafts for:", ", ".join(f"{a} (id={i})" for a, i in inserted))
        else:
            print("No new drafts inserted.")
    except IntegrityError as e:
        db.rollback()
        print("Integrity error while seeding:", e)
    finally:
        db.close()


if __name__ == "__main__":
    print("Running seed_data.py — DB URL:", settings.DATABASE_URL)
    seed()
    print("Done.")
