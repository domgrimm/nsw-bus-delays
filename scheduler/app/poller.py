import logging
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import ArrivalRecord, ArrivalStatus, BusRoute, BusStop, MonitoredTrip
from app.tf_nsw_client import TfNSWClient

logger = logging.getLogger(__name__)

THRESHOLD = settings.on_time_threshold_seconds
MAX_FAILURES = settings.max_consecutive_failures

_consecutive_failures: dict[str, int] = defaultdict(int)


def compute_status(delay_seconds: int) -> ArrivalStatus:
    if delay_seconds < -THRESHOLD:
        return ArrivalStatus.early
    if delay_seconds > THRESHOLD:
        return ArrivalStatus.delayed
    return ArrivalStatus.on_time


def _record_success(monitor_id: str) -> None:
    _consecutive_failures.pop(monitor_id, None)


def _record_failure(monitor_id: str, db: Session) -> None:
    _consecutive_failures[monitor_id] += 1
    count = _consecutive_failures[monitor_id]
    logger.warning(
        "Monitor %s consecutive failures: %d/%d",
        monitor_id,
        count,
        MAX_FAILURES,
    )
    if count >= MAX_FAILURES:
        logger.error(
            "Deactivating monitor %s after %d consecutive failures",
            monitor_id,
            count,
        )
        trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
        if trip:
            trip.active = False
            db.commit()
        _consecutive_failures.pop(monitor_id, None)


async def poll_active_monitors():
    client = TfNSWClient()
    db: Session = SessionLocal()
    try:
        active_trips = (
            db.query(MonitoredTrip)
            .filter(MonitoredTrip.active == True)
            .all()
        )
        if not active_trips:
            logger.debug("No active monitors to poll")
            return

        for trip in active_trips:
            monitor_id = str(trip.id)
            stop = db.query(BusStop).filter(BusStop.id == trip.stop_id).first()
            route = db.query(BusRoute).filter(BusRoute.id == trip.route_id).first()
            if not stop or not route:
                logger.warning(
                    "Monitor %s missing stop or route data, deactivating",
                    monitor_id,
                )
                trip.active = False
                db.commit()
                continue

            try:
                departures = await client.get_departures(
                    stop.stop_id, route_id=route.route_id, lookback_minutes=30
                )
            except Exception as e:
                logger.error(
                    "Failed to poll monitor %s (stop=%s, route=%s): %s",
                    monitor_id,
                    stop.stop_id,
                    route.route_id,
                    e,
                )
                _record_failure(monitor_id, db)
                continue

            _record_success(monitor_id)

            for dep in departures:
                if dep.route_id != route.route_id:
                    continue

                try:
                    scheduled = datetime.fromisoformat(dep.scheduled_departure)
                    estimated = (
                        datetime.fromisoformat(dep.estimated_departure)
                        if dep.estimated_departure
                        else scheduled
                    )
                except ValueError:
                    continue

                now_utc = datetime.now(timezone.utc)
                age_seconds = (now_utc - scheduled).total_seconds()
                if age_seconds < 300:
                    continue
                if age_seconds > 1800:
                    continue

                if dep.is_cancelled:
                    delay = 0
                    status = ArrivalStatus.cancelled
                elif not dep.has_tracking:
                    delay = 0
                    status = ArrivalStatus.no_tracking
                else:
                    delay = int((estimated - scheduled).total_seconds())
                    status = compute_status(delay)

                existing = (
                    db.query(ArrivalRecord)
                    .filter(
                        ArrivalRecord.monitored_trip_id == trip.id,
                        ArrivalRecord.trip_id == dep.trip_id,
                        ArrivalRecord.scheduled_arrival == scheduled,
                    )
                    .first()
                )
                if existing:
                    if existing.actual_arrival == estimated:
                        continue
                    if estimated == scheduled and not dep.is_cancelled and dep.has_tracking:
                        continue
                    existing.actual_arrival = estimated
                    existing.delay_seconds = delay
                    existing.status = status
                    existing.recorded_at = now_utc
                    continue

                record = ArrivalRecord(
                    monitored_trip_id=trip.id,
                    trip_id=dep.trip_id,
                    scheduled_arrival=scheduled,
                    actual_arrival=estimated,
                    delay_seconds=delay,
                    status=status,
                    recorded_at=now_utc,
                )
                try:
                    with db.begin_nested():
                        db.add(record)
                        db.flush()
                except IntegrityError:
                    continue

            db.commit()
            logger.info(
                "Polled monitor %s — %d departures processed",
                monitor_id,
                len(departures),
            )
    except Exception as e:
        logger.error("Polling cycle failed: %s", e)
        db.rollback()
    finally:
        db.close()
        await client.close()
