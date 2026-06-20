from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import ArrivalRecord, BusRoute, BusStop, MonitoredTrip
from app.schemas import (
    ArrivalRecordResponse,
    LiveDepartureResponse,
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
    period: str = Query("day", pattern="^(day|week|month|all_time|custom)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    try:
        from_dt: datetime | None = None
        to_dt: datetime | None = None
        if from_date:
            from_dt = datetime.fromisoformat(from_date)
        if to_date:
            to_dt = datetime.fromisoformat(to_date)
        return compute_stats(db, monitor_id, period, from_date=from_dt, to_date=to_dt)
    except ValueError:
        raise HTTPException(status_code=404, detail="Monitor not found")


@router.get("/monitors/{monitor_id}/bunching")
async def get_monitor_bunching(
    monitor_id: str,
    period: str = Query("week", pattern="^(day|week|month|all_time|custom)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    try:
        from_dt: datetime | None = None
        to_dt: datetime | None = None
        if from_date:
            from_dt = datetime.fromisoformat(from_date)
        if to_date:
            to_dt = datetime.fromisoformat(to_date)
        return compute_bunching(db, monitor_id, period, from_date=from_dt, to_date=to_dt)
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


@router.get("/monitors/{monitor_id}/scheduled-departure-stats")
async def get_scheduled_departure_stats(
    monitor_id: str,
    scheduled_time: str = Query(..., pattern=r"^\d{1,2}:\d{2}$"),
    period: str = Query("week", pattern="^(day|week|month|all_time|custom)$"),
    service_type: str | None = Query(None, pattern="^(weekday|saturday|sunday)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Monitor not found")

    try:
        hour_str, minute_str = scheduled_time.split(":")
        hour = int(hour_str)
        minute = int(minute_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_time format. Use HH:MM")

    from datetime import timezone, timedelta

    now = datetime.now(timezone.utc)
    custom_range = from_date is not None and to_date is not None

    if custom_range:
        start = datetime.fromisoformat(from_date)
        end = datetime.fromisoformat(to_date)
        period_label = "custom"
    elif period == "day":
        start = now - timedelta(days=1)
        end = now
        period_label = period
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
        period_label = period
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
        period_label = period
    elif period == "all_time":
        start = datetime.min.replace(tzinfo=timezone.utc)
        end = now
        period_label = period
    else:
        start = now - timedelta(days=7)
        end = now
        period_label = period

    query = db.query(ArrivalRecord).filter(
        ArrivalRecord.monitored_trip_id == trip.id,
        ArrivalRecord.recorded_at >= start,
        ArrivalRecord.recorded_at <= end,
    )

    tz_col = text("arrival_records.scheduled_arrival AT TIME ZONE 'Australia/Sydney'")
    query = query.filter(
        func.extract("hour", tz_col) == hour,
        func.extract("minute", tz_col) == minute,
    )

    if service_type:
        if service_type == "weekday":
            query = query.filter(
                text("EXTRACT(DOW FROM arrival_records.scheduled_arrival AT TIME ZONE 'Australia/Sydney') IN (1,2,3,4,5)")
            )
        elif service_type == "saturday":
            query = query.filter(
                text("EXTRACT(DOW FROM arrival_records.scheduled_arrival AT TIME ZONE 'Australia/Sydney') = 6")
            )
        elif service_type == "sunday":
            query = query.filter(
                text("EXTRACT(DOW FROM arrival_records.scheduled_arrival AT TIME ZONE 'Australia/Sydney') = 0")
            )

    records = query.all()

    total = len(records)
    if total == 0:
        return {
            "service_type": service_type,
            "scheduled_time": scheduled_time,
            "period": period_label,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "total_arrivals": 0,
            "early_count": 0,
            "on_time_count": 0,
            "delayed_count": 0,
            "cancelled_count": 0,
            "no_tracking_count": 0,
            "average_delay_seconds": 0,
            "max_delay_seconds": 0,
            "on_time_percentage": 0,
            "arrivals": [],
        }

    early = sum(1 for r in records if r.status.value == "early")
    on_time = sum(1 for r in records if r.status.value == "on_time")
    delayed = sum(1 for r in records if r.status.value == "delayed")
    cancelled = sum(1 for r in records if r.status.value == "cancelled")
    no_tracking = sum(1 for r in records if r.status.value == "no_tracking")
    avg_delay = sum(r.delay_seconds for r in records) / total if total else 0
    max_delay = max((r.delay_seconds for r in records), default=0)
    on_time_pct = (on_time / total * 100) if total else 0

    arrival_responses = [
        {
            "id": str(r.id),
            "scheduled_arrival": r.scheduled_arrival.isoformat(),
            "actual_arrival": r.actual_arrival.isoformat(),
            "delay_seconds": r.delay_seconds,
            "status": r.status.value,
            "recorded_at": r.recorded_at.isoformat(),
        }
        for r in sorted(records, key=lambda x: x.recorded_at, reverse=True)
    ]

    return {
        "service_type": service_type,
        "scheduled_time": scheduled_time,
        "period": period_label,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "total_arrivals": total,
        "early_count": early,
        "on_time_count": on_time,
        "delayed_count": delayed,
        "cancelled_count": cancelled,
        "no_tracking_count": no_tracking,
        "average_delay_seconds": round(avg_delay, 2),
        "max_delay_seconds": max_delay,
        "on_time_percentage": round(on_time_pct, 2),
        "arrivals": arrival_responses,
    }


@router.get("/monitors/{monitor_id}/departures", response_model=list[LiveDepartureResponse])
async def get_departures(
    monitor_id: str,
    max_results: int = Query(default=60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(MonitoredTrip)
        .options(joinedload(MonitoredTrip.stop), joinedload(MonitoredTrip.route))
        .filter(MonitoredTrip.id == monitor_id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Monitor not found")

    client = TfNSWClient()
    try:
        departures = await client.get_departures(
            stop_id=trip.stop.stop_id,
            route_id=trip.route.route_id,
            max_results=max_results,
            lookback_minutes=0,
        )
    finally:
        await client.close()

    return [
        LiveDepartureResponse(
            trip_id=d.trip_id,
            route_id=d.route_id,
            route_number=d.route_number,
            description=d.description,
            destination_name=d.destination_name,
            scheduled_departure=d.scheduled_departure,
            estimated_departure=d.estimated_departure,
            is_cancelled=d.is_cancelled,
            has_tracking=d.has_tracking,
        )
        for d in departures
    ]
