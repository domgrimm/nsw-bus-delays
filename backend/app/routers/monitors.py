from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import ArrivalRecord, BusRoute, BusStop, MonitoredTrip
from app.schemas import (
    ArrivalRecordResponse,
    MonitorCreate,
    MonitorResponse,
)
from app.services.stats import compute_bunching, compute_stats
from app.tf_nsw_client import TfNSWClient

router = APIRouter(tags=["monitors"])


def _build_monitor_response(trip: MonitoredTrip) -> MonitorResponse:
    return MonitorResponse(
        id=str(trip.id),
        stop_id=trip.stop.stop_id,
        stop_name=trip.stop.name,
        stop_latitude=trip.stop.latitude,
        stop_longitude=trip.stop.longitude,
        route_id=trip.route.route_id,
        route_number=trip.route.route_number,
        route_name=trip.route.name,
        user_label=trip.user_label,
        active=trip.active,
        created_at=trip.created_at,
    )


@router.get("/monitors", response_model=list[MonitorResponse])
async def list_monitors(db: Session = Depends(get_db)):
    trips = (
        db.query(MonitoredTrip)
        .options(joinedload(MonitoredTrip.stop), joinedload(MonitoredTrip.route))
        .all()
    )
    return [_build_monitor_response(t) for t in trips]


@router.post("/monitors", response_model=MonitorResponse, status_code=201)
async def create_monitor(body: MonitorCreate, db: Session = Depends(get_db)):
    stop = db.query(BusStop).filter(BusStop.stop_id == body.stop_id).first()
    if not stop:
        name = None
        lat = None
        lng = None
        if body.stop_name and body.stop_latitude is not None:
            name = body.stop_name
            lat = body.stop_latitude
            lng = body.stop_longitude
        else:
            client = TfNSWClient()
            try:
                tfnsw_stops = await client.find_stops(body.stop_id, max_results=1)
                tfnsw_stop = tfnsw_stops[0] if tfnsw_stops else None
                if tfnsw_stop:
                    name = tfnsw_stop.name
                    lat = tfnsw_stop.latitude
                    lng = tfnsw_stop.longitude
            except Exception:
                pass
            finally:
                await client.close()

        stop = BusStop(
            stop_id=body.stop_id,
            name=name if name else body.stop_id,
            latitude=lat if lat is not None else 0,
            longitude=lng if lng is not None else 0,
        )
        db.add(stop)
        db.flush()

    route = db.query(BusRoute).filter(BusRoute.route_id == body.route_id).first()
    if not route:
        route = BusRoute(
            route_id=body.route_id,
            route_number=body.route_number,
            name=body.route_number,
        )
        db.add(route)
        db.flush()

    trip = MonitoredTrip(stop_id=stop.id, route_id=route.id, user_label=body.user_label)
    db.add(trip)
    db.commit()
    db.refresh(trip)

    trip = (
        db.query(MonitoredTrip)
        .options(joinedload(MonitoredTrip.stop), joinedload(MonitoredTrip.route))
        .filter(MonitoredTrip.id == trip.id)
        .first()
    )
    return _build_monitor_response(trip)


@router.get("/monitors/{monitor_id}", response_model=MonitorResponse)
async def get_monitor(monitor_id: str, db: Session = Depends(get_db)):
    trip = (
        db.query(MonitoredTrip)
        .options(joinedload(MonitoredTrip.stop), joinedload(MonitoredTrip.route))
        .filter(MonitoredTrip.id == monitor_id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return _build_monitor_response(trip)


@router.delete("/monitors/{monitor_id}", status_code=204)
async def delete_monitor(monitor_id: str, db: Session = Depends(get_db)):
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Monitor not found")
    db.delete(trip)
    db.commit()


@router.get("/monitors/{monitor_id}/stats")
async def get_monitor_stats(
    monitor_id: str,
    period: str = Query("day", pattern="^(day|week|month|all_time)$"),
    db: Session = Depends(get_db),
):
    try:
        return compute_stats(db, monitor_id, period)
    except ValueError:
        raise HTTPException(status_code=404, detail="Monitor not found")


@router.get("/monitors/{monitor_id}/bunching")
async def get_monitor_bunching(
    monitor_id: str,
    period: str = Query("week", pattern="^(day|week|month|all_time)$"),
    db: Session = Depends(get_db),
):
    try:
        return compute_bunching(db, monitor_id, period)
    except ValueError:
        raise HTTPException(status_code=404, detail="Monitor not found")


@router.get(
    "/monitors/{monitor_id}/arrivals", response_model=list[ArrivalRecordResponse]
)
async def get_monitor_arrivals(
    monitor_id: str,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Monitor not found")

    query = db.query(ArrivalRecord).filter(
        ArrivalRecord.monitored_trip_id == trip.id
    )

    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            query = query.filter(ArrivalRecord.recorded_at >= from_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from date format")

    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date)
            query = query.filter(ArrivalRecord.recorded_at <= to_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to date format")

    records = query.order_by(ArrivalRecord.recorded_at.desc()).all()

    return [
        ArrivalRecordResponse(
            id=str(r.id),
            trip_id=r.trip_id,
            scheduled_arrival=r.scheduled_arrival,
            actual_arrival=r.actual_arrival,
            delay_seconds=r.delay_seconds,
            status=r.status.value,
            recorded_at=r.recorded_at,
        )
        for r in records
    ]
