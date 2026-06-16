from fastapi import APIRouter, HTTPException, Query

from app.schemas import StopResponse
from app.services.gtfs import get_route_stops as gtfs_route_stops
from app.services.gtfs import get_timetable as gtfs_timetable
from app.tf_nsw_client import TfNSWClient

router = APIRouter(tags=["stops"])


@router.get("/stops/nearby")
async def search_stops_nearby(lat: float, lng: float):
    client = TfNSWClient()
    try:
        stops = await client.find_stops_by_coord(lng, lat)
        return [
            StopResponse(
                id=s.id, name=s.name, latitude=s.latitude, longitude=s.longitude
            )
            for s in stops
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TfNSW API error: {e}")
    finally:
        await client.close()


@router.get("/stops", response_model=list[StopResponse])
async def search_stops(q: str):
    if not q.strip():
        return []
    client = TfNSWClient()
    try:
        stops = await client.find_stops(q)
        return [
            StopResponse(
                id=s.id, name=s.name, latitude=s.latitude, longitude=s.longitude
            )
            for s in stops
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TfNSW API error: {e}")
    finally:
        await client.close()


@router.get("/routes")
async def search_routes(q: str):
    if not q.strip():
        return []
    client = TfNSWClient()
    try:
        results = await client.search_routes(q)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TfNSW API error: {e}")
    finally:
        await client.close()


@router.get("/routes/{description:path}/stops")
async def get_route_stops(description: str):
    client = TfNSWClient()
    try:
        stops = await client.get_route_stops(description)
        return stops
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TfNSW API error: {e}")
    finally:
        await client.close()


@router.get("/gtfs/routes/{route_number}/stops")
async def get_gtfs_route_stops(route_number: str):
    try:
        stops = await gtfs_route_stops(route_number)
        return {"stops": stops}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GTFS error: {e}")


@router.get("/gtfs/routes/{route_number}/timetable")
async def get_gtfs_timetable(route_number: str, stop_id: str = Query(...)):
    try:
        timetable = await gtfs_timetable(route_number, stop_id)
        return {
            "route_number": route_number,
            "stop_id": stop_id,
            "weekday": timetable.get("weekday", []),
            "saturday": timetable.get("saturday", []),
            "sunday": timetable.get("sunday", []),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GTFS error: {e}")


@router.post("/gtfs/refresh")
async def refresh_gtfs():
    from app.services.gtfs import refresh as gtfs_refresh
    try:
        await gtfs_refresh()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GTFS refresh failed: {e}")


@router.get("/stops/{stop_id}/routes")
async def get_stop_routes(stop_id: str):
    client = TfNSWClient()
    try:
        departures = await client.get_departures(stop_id, max_results=100, lookback_minutes=360)
        seen: set[str] = set()
        routes = []
        for d in departures:
            if d.route_id not in seen:
                seen.add(d.route_id)
                routes.append(
                    {
                        "route_id": d.route_id,
                        "route_number": d.route_number,
                        "name": d.description or d.route_number,
                        "description": d.description,
                        "destination_name": d.destination_name,
                    }
                )
        return routes
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TfNSW API error: {e}")
    finally:
        await client.close()
