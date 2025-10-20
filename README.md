# writing_feedback_data_collection_occasion2
This app is built for data collection on occasion II for the writing feedback generation project.

## Quick start

**Step1:** Create virtualenv & install deps from `backend` directory 
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# seed the DB
python -m app.ingest_data
uvicorn app.main:app --reload --port 8000
```

**Step2:**  Open "http://localhost:8000/"

**Step3:**  Test accounts (from seed):
- student1@asu.edu

- student2@asu.edu

- student3@asu.edu

