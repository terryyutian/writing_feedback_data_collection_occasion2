#!/bin/bash
set -e

echo "Running DB migration and seeding..."
python -m backend.app.ingest_data

echo "Starting FastAPI app with Uvicorn..."
exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
