# backend/app/seed_data.py
"""

Run from the repository root as:
    python -m backend.app.ingest_data

This will:
 - ensure tables exist (Base.metadata.create_all)
 - insert the data (without prompt type info) 
 - print inserted rows for verification
"""

from sqlalchemy.exc import IntegrityError
from .db import SessionLocal, engine, Base
from .models_db import Participant, Draft
from .config import settings
from .data import ALL_DATA, SAMPLE_DATA
from datetime import datetime, timezone



def ensure_tables():
    """Create DB tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)


def ingest_data():
    ensure_tables()
    db = SessionLocal()
    try:
        inserted = []
        for s in SAMPLE_DATA:
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
                prompt_type=s.get("prompt_type", "") or "",
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
    print("Running ingest_data.py — DB URL:", settings.DATABASE_URL)
    ingest_data()
    print("Done.")
