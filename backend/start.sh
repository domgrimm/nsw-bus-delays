#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head || {
    echo "Migration failed — tables may already exist. Stamping head revision..."
    alembic stamp head
    echo "Stamp complete."
}

echo "Starting background GTFS download..."
python3 -c "
import asyncio
from app.services.gtfs import refresh
asyncio.run(refresh())
" &

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
