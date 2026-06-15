# NSW Bus Delays

Monitor real-time bus delays for Transport for NSW services. Track on-time performance for any bus stop and route combination.

## Prerequisites

- Docker + docker-compose
- A TfNSW Open Data API key (free)

## Obtaining an API Key

1. Register at [opendata.transport.nsw.gov.au](https://opendata.transport.nsw.gov.au/)
2. Log in, click your profile icon → **API Tokens**
3. Enter a name and click **CREATE API TOKEN**
4. Copy the token — it won't be shown again
5. Go to the [data catalogue](https://opendata.transport.nsw.gov.au/data/dataset/trip-planner-api) and find the **Trip Planner API** dataset
6. Click **EXPLORE** next to each resource (Stop Finder, Departure Monitor, etc.) and authorize with `apikey <your_token>` in the Swagger console — this activates the endpoints for your key

## Quick Start

```bash
cp .env.example .env
```

Edit `.env` and set `TFNSW_API_KEY` to your real key, then:

```bash
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000). Check the API:

```bash
curl http://localhost:8000/api/health
```

### First Use

1. Click **+ New Monitor** → **By Map**, search for a suburb, then zoom to your area and click "Search this area"
2. Or switch to **By Stop** tab and search for a stop name
3. Select a stop, then pick a route → the monitor dashboard shows live delay stats

## Production Deployment

Pull pre-built images:

```bash
TAG=v1.0.0 docker compose -f docker-compose.prod.yml up -d
```

Build and push your own via GHCR (works on `git tag v*`):

```bash
git tag v1.0.0 && git push origin v1.0.0
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TFNSW_API_KEY` | — | yes | TfNSW Open Data API key |
| `DATABASE_URL` | `postgresql://nswbus:nswbus@db:5432/nswbusdelays` | yes | PostgreSQL connection |
| `POLLING_INTERVAL_SECONDS` | `60` | no | Scheduler poll interval |
| `ON_TIME_THRESHOLD_SECONDS` | `120` | no | Seconds threshold for on-time status |
| `MAX_CONSECUTIVE_FAILURES` | `5` | no | Auto-deactivate monitor after N failures |
| `BACKEND_PORT` | `8000` | no | Backend API port |
| `FRONTEND_PORT` | `3000` | no | Frontend UI port |

## Architecture

```
frontend  (Next.js, port 3000)
    ↓ (Next.js rewrites proxy)
backend   (FastAPI, port 8000)
    ↓ ↔
db        (PostgreSQL)
    ↓
scheduler (APScheduler, polls TfNSW every 60s)
```

- **frontend**: Next.js 14 + TypeScript + Recharts + Leaflet
- **backend**: Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **scheduler**: Python APScheduler, polls `departure_mon` API, records arrivals
- **db**: PostgreSQL 16, stores stops, routes, monitors, arrivals

GTFS static timetable data (~293 MB) is downloaded at container startup and refreshed daily at 3:00 AM.
