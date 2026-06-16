"""GTFS static data service for full route stop listings and timetables."""
import csv
import logging
import shutil
import tempfile
from datetime import datetime
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
_timetable: dict[str, dict[str, dict[str, list[str]]]] | None = None
# {route_number: {stop_id: {"weekday": ["07:02", "07:15", ...], "saturday": [...], "sunday": [...]}}}


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


def _parse() -> tuple[dict[str, list[dict]], dict[str, dict[str, dict[str, list[str]]]]]:
    route_to_stops: dict[str, list[dict]] = {}
    timetable: dict[str, dict[str, dict[str, list[str]]]] = {}
    route_file = GTFS_EXTRACT / "routes.txt"
    trip_file = GTFS_EXTRACT / "trips.txt"
    stop_time_file = GTFS_EXTRACT / "stop_times.txt"
    stop_file = GTFS_EXTRACT / "stops.txt"
    calendar_file = GTFS_EXTRACT / "calendar.txt"

    if not all(f.exists() for f in [route_file, trip_file, stop_time_file, stop_file]):
        logger.error("GTFS files missing at %s", GTFS_EXTRACT)
        return route_to_stops, timetable

    stops: dict[str, dict] = {}
    with stop_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            parent = row.get("parent_station", "").strip()
            stops[row["stop_id"]] = {
                "id": row["stop_id"],
                "name": row.get("stop_name", ""),
                "latitude": float(row.get("stop_lat", 0)),
                "longitude": float(row.get("stop_lon", 0)),
                "parent_station": parent if parent else None,
            }

    stop_times: dict[str, list[tuple[int, str, str]]] = {}
    with stop_time_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            trip_id = row["trip_id"]
            seq = int(row["stop_sequence"])
            sid = row["stop_id"]
            dep_time = row.get("departure_time", "")
            stop_times.setdefault(trip_id, []).append((seq, sid, dep_time))

    for trip_id in list(stop_times.keys()):
        stop_times[trip_id].sort(key=lambda x: x[0])

    route_short_map: dict[str, str] = {}
    with route_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            short = row.get("route_short_name", "").strip()
            if short:
                route_short_map[row["route_id"]] = short

    service_types: dict[str, list[str]] = {}
    if calendar_file.exists():
        with calendar_file.open("r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                sid = row["service_id"]
                types: list[str] = []
                weekday_cols = [
                    row.get("monday", "0"),
                    row.get("tuesday", "0"),
                    row.get("wednesday", "0"),
                    row.get("thursday", "0"),
                    row.get("friday", "0"),
                ]
                if any(c == "1" for c in weekday_cols):
                    types.append("weekday")
                if row.get("saturday", "0") == "1":
                    types.append("saturday")
                if row.get("sunday", "0") == "1":
                    types.append("sunday")
                if types:
                    service_types[sid] = types

    calendar_dates_file = GTFS_EXTRACT / "calendar_dates.txt"
    if calendar_dates_file.exists():
        cal_dates: dict[str, set[int]] = {}
        with calendar_dates_file.open("r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                sid = row["service_id"]
                if sid in service_types:
                    continue
                exception_type = row.get("exception_type", "1")
                if exception_type != "1":
                    continue
                date_str = row.get("date", "")
                if len(date_str) != 8:
                    continue
                try:
                    dt = datetime.strptime(date_str, "%Y%m%d")
                    cal_dates.setdefault(sid, set()).add(dt.weekday())
                except ValueError:
                    continue
        for sid, dows in cal_dates.items():
            types: list[str] = []
            if any(d in dows for d in range(0, 5)):
                types.append("weekday")
            if 5 in dows:
                types.append("saturday")
            if 6 in dows:
                types.append("sunday")
            if types:
                service_types[sid] = types

    trip_to_service: dict[str, list[str]] = {}
    trip_to_route: dict[str, str] = {}
    done: set[str] = set()
    with trip_file.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rid = row["route_id"]
            short = route_short_map.get(rid)
            trip_id = row["trip_id"]
            service_id = row.get("service_id", "")
            if service_id and service_id in service_types:
                trip_to_service[trip_id] = service_types[service_id]
            trip_to_route[trip_id] = rid
            if not short:
                continue
            key = f"{short}|{rid}"
            if key in done:
                continue
            done.add(key)
            seq_stops = stop_times.get(trip_id)
            if not seq_stops:
                continue
            route_stops = []
            seen_ids: set[str] = set()
            for _seq, sid, _dep in seq_stops:
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

    for trip_id, s_types in trip_to_service.items():
        route_id = trip_to_route.get(trip_id)
        if not route_id:
            continue
        short = route_short_map.get(route_id)
        if not short:
            continue
        seq_stops = stop_times.get(trip_id)
        if not seq_stops:
            continue
        for _seq, sid, dep_time in seq_stops:
            if not dep_time:
                continue
            time_str = dep_time[:5]
            route_entry = timetable.setdefault(short, {})

            target_ids = [sid]
            stop_entry = stops.get(sid)
            if stop_entry and stop_entry.get("parent_station"):
                target_ids.append(stop_entry["parent_station"])

            for target_sid in target_ids:
                stop_t = route_entry.setdefault(target_sid, {})
                for st in s_types:
                    stop_t.setdefault(st, set()).add(time_str)

    for route_number in timetable:
        for stop_id in timetable[route_number]:
            for svc in timetable[route_number][stop_id]:
                sorted_times = sorted(timetable[route_number][stop_id][svc])
                timetable[route_number][stop_id][svc] = sorted_times

    logger.info(
        "GTFS parsed: %d routes indexed, %d routes with timetables (%d service types from calendar.txt+calendar_dates.txt)",
        len(route_to_stops),
        len(timetable),
        len(service_types),
    )
    return route_to_stops, timetable


async def refresh() -> None:
    global _route_to_stops, _timetable
    await download_and_extract()
    _route_to_stops, _timetable = _parse()


async def _ensure_loaded() -> None:
    global _route_to_stops, _timetable
    if _route_to_stops is not None and _timetable is not None:
        return
    if GTFS_EXTRACT.exists():
        _route_to_stops, _timetable = _parse()
    if _route_to_stops is None:
        await refresh()


async def get_route_stops(route_number: str) -> list[dict]:
    await _ensure_loaded()
    return _route_to_stops.get(route_number, []) if _route_to_stops else []


async def get_timetable(route_number: str, stop_id: str) -> dict[str, list[str]]:
    await _ensure_loaded()
    if _timetable is None:
        return {}
    route_entry = _timetable.get(route_number, {})
    return route_entry.get(stop_id, {})
