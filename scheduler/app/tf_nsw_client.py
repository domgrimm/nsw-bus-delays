import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TfNSWStop:
    id: str
    name: str
    latitude: float
    longitude: float


@dataclass
class TfNSWDeparture:
    trip_id: str
    route_id: str
    route_number: str
    description: str
    destination_name: str
    scheduled_departure: str
    estimated_departure: str | None
    is_cancelled: bool = False
    has_tracking: bool = True


@dataclass
class TfNSWServiceAlert:
    id: str
    description: str
    priority: str = ""
    alert_type: str = ""
    title: str = ""
    posted_at: str = ""
    updated_at: str = ""
    url: str = ""


class TfNSWClient:
    def __init__(self):
        self.api_key = settings.tfnsw_api_key
        self.base_url = "https://api.transport.nsw.gov.au/v1/tp/"
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"apikey {self.api_key}",
                "accept": "application/json",
            },
            timeout=30.0,
        )

    def _dm_params(self, stop_id: str | None = None, limit: int = 20, lookback_minutes: int = 0) -> dict:
        sydney = datetime.now(timezone.utc).astimezone(
            timezone(timedelta(hours=10))
        )
        t = sydney - timedelta(minutes=lookback_minutes)
        params: dict = {
            "outputFormat": "rapidJSON",
            "coordOutputFormat": "EPSG:4326",
            "mode": "direct",
            "type_dm": "stop",
            "name_dm": stop_id or "",
            "itdDate": t.strftime("%Y%m%d"),
            "itdTime": t.strftime("%H%M"),
            "departureMonitorMacro": "true",
            "TfNSWDM": "true",
            "version": "10.2.1.42",
            "limit": str(limit),
        }
        return params

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def find_stops_by_coord(
        self, lng: float, lat: float, max_results: int = 30
    ) -> list[TfNSWStop]:
        resp = await self._client.get(
            "coord",
            params={
                "outputFormat": "rapidJSON",
                "coord": f"{lng}:{lat}:EPSG:4326",
                "coordOutputFormat": "EPSG:4326",
                "inclFilter": "1",
                "type_1": "BUS_POINT",
                "radius_1": "1000",
                "PoisOnMapMacro": "true",
                "version": "10.2.1.42",
                "maxresults": str(max_results),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        stops: list[TfNSWStop] = []
        for loc in data.get("locations", []):
            coord = loc.get("coord", [0, 0])
            stops.append(
                TfNSWStop(
                    id=loc.get("id", ""),
                    name=loc.get("name", ""),
                    latitude=float(coord[0]) if coord else 0,
                    longitude=float(coord[1]) if coord else 0,
                )
            )
        return stops

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def find_stops(self, query: str, max_results: int = 20) -> list[TfNSWStop]:
        resp = await self._client.get(
            "stop_finder",
            params={
                "outputFormat": "rapidJSON",
                "type_sf": "any",
                "name_sf": query,
                "coordOutputFormat": "EPSG:4326",
                "TfNSWSF": "true",
                "version": "10.6.21.17",
                "maxresults": str(max_results),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        stops: list[TfNSWStop] = []
        for loc in data.get("locations", []):
            if loc.get("type") != "stop":
                continue
            coord = loc.get("coord", [0, 0])
            stops.append(
                TfNSWStop(
                    id=loc["id"],
                    name=loc.get("name", ""),
                    latitude=float(coord[0]),
                    longitude=float(coord[1]),
                )
            )
        if stops:
            return stops

        for loc in data.get("locations", []):
            if loc.get("type") == "suburb":
                coord = loc.get("coord", [0, 0])
                if coord and len(coord) == 2:
                    return await self.find_stops_by_coord(
                        float(coord[1]), float(coord[0])
                    )
        return []

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get_departures(
        self, stop_id: str, route_id: str | None = None, max_results: int = 20, lookback_minutes: int = 0
    ) -> list[TfNSWDeparture]:
        params = self._dm_params(stop_id=stop_id, limit=max_results, lookback_minutes=lookback_minutes)
        if route_id:
            params["routeId"] = route_id
        resp = await self._client.get(
            "departure_mon",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

        if not data.get("stopEvents"):
            for loc in data.get("locations", []):
                resolved_id = loc.get("id", "")
                if resolved_id and resolved_id != stop_id:
                    logger.info(
                        "No departures for stop %s, retrying with resolved stop %s",
                        stop_id, resolved_id,
                    )
                    return await self.get_departures(
                        resolved_id, route_id=route_id,
                        max_results=max_results, lookback_minutes=lookback_minutes,
                    )

        departures: list[TfNSWDeparture] = []
        for ev in data.get("stopEvents", []):
            t = ev.get("transportation", {})
            route_number = t.get("number", "")
            if route_id and route_number != route_id:
                continue
            scheduled = ev.get("departureTimeBaseTimetable", "")
            estimated = ev.get("departureTimeEstimated") or ev.get("departureTimePlanned")
            departures.append(
                TfNSWDeparture(
                    trip_id=t.get("id", ""),
                    route_id=route_number,
                    route_number=route_number,
                    description=t.get("description", ""),
                    destination_name=(
                        t.get("destination", {}).get("name", "")
                    ),
                    scheduled_departure=scheduled,
                    estimated_departure=estimated,
                    is_cancelled=ev.get("isCancelled", False),
                    has_tracking=bool(ev.get("departureTimeEstimated")),
                )
            )
        return departures

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def search_routes(self, query: str, max_results: int = 10) -> list[dict]:
        params = self._dm_params(stop_id=query, limit=max_results)
        params["type_dm"] = "any"
        resp = await self._client.get("departure_mon", params=params)
        resp.raise_for_status()
        data = resp.json()
        seen: set[str] = set()
        routes: list[dict] = []
        for loc in data.get("locations", []):
            if loc.get("type") != "line":
                continue
            name = loc.get("name", "")
            desc = loc.get("properties", {}).get("lineDescription", "")
            key = f"{name}|{desc}"
            if key in seen:
                continue
            seen.add(key)
            routes.append(
                {
                    "route_id": name,
                    "route_number": name,
                    "name": desc or name,
                    "description": desc,
                    "destination_name": "",
                }
            )
        return routes

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get_route_stops(
        self, description: str
    ) -> list[dict]:
        import re
        cleaned = re.sub(r"\s*\([^)]*\)", "", description).strip()
        parts = cleaned.split(" to ")
        if len(parts) < 2:
            return []
        origin_name = parts[0].strip()
        dest_name = parts[1].split(" via ")[0].strip()

        origin_stops = await self.find_stops(origin_name, max_results=1)
        dest_stops = await self.find_stops(dest_name, max_results=1)
        if not origin_stops or not dest_stops:
            return []

        sydney = datetime.now(timezone.utc).astimezone(
            timezone(timedelta(hours=10))
        )
        resp = await self._client.get(
            "trip",
            params={
                "outputFormat": "rapidJSON",
                "coordOutputFormat": "EPSG:4326",
                "type_origin": "stop",
                "name_origin": origin_stops[0].id,
                "type_destination": "stop",
                "name_destination": dest_stops[0].id,
                "itdDate": sydney.strftime("%Y%m%d"),
                "itdTime": sydney.strftime("%H%M"),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        best: list[dict] = []
        for journey in data.get("journeys", []):
            for leg in journey.get("legs", []):
                seq = leg.get("stopSequence", [])
                if len(seq) > len(best):
                    best = [
                        {
                            "id": s.get("id", ""),
                            "name": s.get("name", ""),
                            "latitude": float(s.get("coord", [0, 0])[0]),
                            "longitude": float(s.get("coord", [0, 0])[1]),
                        }
                        for s in seq
                    ]
        return best

    async def close(self):
        await self._client.aclose()
