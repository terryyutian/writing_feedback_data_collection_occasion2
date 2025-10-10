# Run this script (python -m app.seed_data) or import from main on first run.
from .db import SessionLocal, engine, Base
from . import models_db as models
from datetime import datetime, timezone

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # only create if participants table is empty
        if db.query(models.Participant).count() == 0:
            entries = [
                {
                    "asurite": "student1",
                    "essay_text": "When I moved to a new city, I learned to rely on myself...",
                    "language_feedback": "Fix verb tense consistency and reduce sentence fragments.",
                    "content_feedback": "Add more details about the climax and consequences of the event."
                },
                {
                    "asurite": "student2",
                    "essay_text": "My first job taught me responsibility and time management...",
                    "language_feedback": "Eliminate passive voice and clarify pronoun references.",
                    "content_feedback": "Consider adding specific examples that show growth."
                },
                {
                    "asurite": "student3",
                    "essay_text": "The volunteer trip was eye-opening and changed my perspective...",
                    "language_feedback": "Vary sentence openings and tighten wordy phrases.",
                    "content_feedback": "Expand on why the experience mattered and what actions followed."
                },
            ]
            for e in entries:
                p = models.Participant(asurite=e["asurite"])
                db.add(p)
                db.flush()
                d = models.Draft(asurite=e["asurite"], essay_text=e["essay_text"],
                                 language_feedback=e["language_feedback"],
                                 content_feedback=e["content_feedback"])
                db.add(d)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
    print("Seeded database.")
