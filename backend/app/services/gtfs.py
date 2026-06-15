"""GTFS static data service for full route stop listings."""
import csv
import logging
import shutil
import tempfile
from pathlib import Path
from zipfile import ZipFile

import httpx

logger = logging.getLogger(__name__)

GTFS_URL = (
    "https://opendata.transport.nsw.gov.au/data/dataset/"
    "d1f68d4f-b778-44df-9823-cf2fa922e47f/resource/"
    "67974f14-01bf-47b7-bfa5-c7f2f8a950ca/download/full_greater_sydney_gtfs_static_0.zip"
)

GTFS_DIR = Path(tempfile.gettempdir()) / "nsw_gtfs"
GTFS_ZIP = GTFS_DIR / "gtfs.zip"
GTFS_EXTRACT = GTFS_DIR / "extract"

_route_to_stops: dict[str, list[dict]] | None = None


async def download_and_extract() -> None:
    GTFS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading GTFS data (293 MB)...")
    async with httpx.AsyncClient(timeout=600, follow_redirects=True) as client:
        resp = await client.get(GTFS_URL)
        resp.raise_for_status()
        GTFS_ZIP.write_bytes(resp.content)
    logger.info("GTFS download complete.")

    if GTFS_EXTRACT.exists():
        shutil.rmtree(GTFS_EXTRACT)
    with ZipFile(GTFS_ZIP) as z:
        z.extractall(GTFS_EXTRACT)
    logger.info("GTFS extracted to %s", GTFS_EXTRACT)


def _parse() -> dict[str, list[dict]]:
    route_to_stops: dict[str, list[dict]] = {}
    route_file = GTFS_EXTRACT / "routes.txt"
    trip_file = GTFS_EXTRACT / "trips.txt"
    stop_time_file = GTFS_EXTRACT / "stop_times.txt"
    stop_file = GTFS_EXTRACT / "stops.txt"

    if not all(f.exists() for f in [route_file, trip_file, stop_time_file, stop_file]):
        logger.error("GTFS files missing at %s", GTFS_EXTRACT)
        return route_to_stops

    stops: dict[str, dict] = {}
    with stop_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            stops[row["stop_id"]] = {
                "id": row["stop_id"],
                "name": row.get("stop_name", ""),
                "latitude": float(row.get("stop_lat", 0)),
                "longitude": float(row.get("stop_lon", 0)),
            }

    stop_times: dict[str, list[tuple[int, str]]] = {}
    with stop_time_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            trip_id = row["trip_id"]
            seq = int(row["stop_sequence"])
            stop_id = row["stop_id"]
            stop_times.setdefault(trip_id, []).append((seq, stop_id))

    for trip_id in list(stop_times.keys()):
        stop_times[trip_id].sort(key=lambda x: x[0])

    route_short_map: dict[str, str] = {}
    with route_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            short = row.get("route_short_name", "").strip()
            if short:
                route_short_map[row["route_id"]] = short

    done: set[str] = set()
    with trip_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rid = row["route_id"]
            short = route_short_map.get(rid)
            if not short:
                continue
            key = f"{short}|{rid}"
            if key in done:
                continue
            done.add(key)
            trip_id = row["trip_id"]
            seq_stops = stop_times.get(trip_id)
            if not seq_stops:
                continue
            route_stops = []
            seen_ids: set[str] = set()
            for _seq, sid in seq_stops:
                if sid in seen_ids:
                    continue
                seen_ids.add(sid)
                s = stops.get(sid)
                if s:
                    route_stops.append({
                        "id": sid,
                        "name": s["name"],
                        "latitude": s["latitude"],
                        "longitude": s["longitude"],
                    })
            if route_stops and short not in route_to_stops:
                route_to_stops[short] = route_stops

    logger.info("GTFS parsed: %d routes indexed", len(route_to_stops))
    return route_to_stops


async def refresh() -> None:
    global _route_to_stops
    await download_and_extract()
    _route_to_stops = _parse()


async def _ensure_loaded() -> None:
    global _route_to_stops
    if _route_to_stops is not None:
        return
    if GTFS_EXTRACT.exists():
        _route_to_stops = _parse()
    if _route_to_stops is None:
        await refresh()


async def get_route_stops(route_number: str) -> list[dict]:
    await _ensure_loaded()
    return _route_to_stops.get(route_number, []) if _route_to_stops else []
