from datetime import datetime, timezone, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from app.config import settings
from app.models import ArrivalRecord, MonitoredTrip
from app.schemas import DailyStats, DelayStats


def compute_status(delay_seconds: int) -> str:
    threshold = settings.on_time_threshold_seconds
    if delay_seconds < -threshold:
        return "early"
    if delay_seconds > threshold:
        return "delayed"
    return "on_time"


def compute_stats(
    db: Session, monitor_id: str, period: str = "day"
) -> DelayStats:
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise ValueError("Monitor not found")

    now = datetime.now(timezone.utc)
    if period == "day":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    else:
        start = datetime.min.replace(tzinfo=timezone.utc)

    records = (
        db.query(ArrivalRecord)
        .filter(
            ArrivalRecord.monitored_trip_id == trip.id,
            ArrivalRecord.recorded_at >= start,
            ArrivalRecord.recorded_at <= now,
        )
        .all()
    )

    total = len(records)
    early = sum(1 for r in records if r.status.value == "early")
    on_time = sum(1 for r in records if r.status.value == "on_time")
    delayed = sum(1 for r in records if r.status.value == "delayed")
    cancelled = sum(1 for r in records if r.status.value == "cancelled")
    avg_delay = sum(r.delay_seconds for r in records) / total if total else 0
    max_delay = max((r.delay_seconds for r in records), default=0)
    on_time_pct = (on_time / total * 100) if total else 0

    daily_breakdown = _daily_breakdown(records) if period in ("week", "month") else []

    return DelayStats(
        period=period,
        period_start=start,
        period_end=now,
        total_arrivals=total,
        early_count=early,
        on_time_count=on_time,
        delayed_count=delayed,
        cancelled_count=cancelled,
        average_delay_seconds=round(avg_delay, 2),
        max_delay_seconds=max_delay,
        on_time_percentage=round(on_time_pct, 2),
        daily_breakdown=daily_breakdown,
    )


def _daily_breakdown(records: list[ArrivalRecord]) -> list[DailyStats]:
    grouped: dict[str, list[ArrivalRecord]] = defaultdict(list)
    for r in records:
        day = r.recorded_at.strftime("%Y-%m-%d")
        grouped[day].append(r)

    result: list[DailyStats] = []
    for day in sorted(grouped.keys()):
        day_records = grouped[day]
        total = len(day_records)
        early = sum(1 for r in day_records if r.status.value == "early")
        on_time = sum(1 for r in day_records if r.status.value == "on_time")
        delayed = sum(1 for r in day_records if r.status.value == "delayed")
        avg = sum(r.delay_seconds for r in day_records) / total if total else 0

        result.append(
            DailyStats(
                date=day,
                total_arrivals=total,
                early_count=early,
                on_time_count=on_time,
                delayed_count=delayed,
                average_delay_seconds=round(avg, 2),
            )
        )

    return result
