import math
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from zoneinfo import ZoneInfo

SYDNEY_TZ = ZoneInfo("Australia/Sydney")

from sqlalchemy.orm import Session

from app.config import settings
from app.models import ArrivalRecord, MonitoredTrip
from app.schemas import (
    ArrivalBucket,
    BunchingEvent,
    DailyStats,
    DelayStats,
    HeatmapCell,
    PercentileStats,
)


def compute_status(delay_seconds: int) -> str:
    threshold = settings.on_time_threshold_seconds
    if delay_seconds < -threshold:
        return "early"
    if delay_seconds > threshold:
        return "delayed"
    return "on_time"


def _compute_percentiles(delays: list[float]) -> PercentileStats:
    if not delays:
        return PercentileStats(p5=0, p10=0, p50=0, p75=0, p90=0, p95=0)
    sorted_d = sorted(delays)
    n = len(sorted_d)

    def pct(p: float) -> float:
        idx = (p / 100.0) * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        frac = idx - lo
        return round(sorted_d[lo] * (1 - frac) + sorted_d[hi] * frac, 2)

    return PercentileStats(
        p5=pct(5), p10=pct(10),
        p50=pct(50), p75=pct(75), p90=pct(90), p95=pct(95),
    )


def _compute_arrival_distribution(delays: list[float]) -> list[ArrivalBucket]:
    if not delays:
        return []
    buckets: dict[int, int] = defaultdict(int)
    for d in delays:
        minute = int(math.floor(d / 60.0))
        buckets[minute] += 1

    min_b = min(buckets.keys())
    max_b = max(buckets.keys())
    result = []
    for m in range(min_b, max_b + 1):
        result.append(ArrivalBucket(delay_minutes=m, count=buckets.get(m, 0)))
    return result


def _compute_heatmap_with_filter(
    records, dow_filter: set[int] | None = None
) -> list[HeatmapCell]:
    cells: dict[tuple[int, int], list[int]] = defaultdict(list)
    for r in records:
        if hasattr(r, "status") and hasattr(r.status, "value"):
            if r.status.value == "cancelled":
                continue
            if r.status.value == "no_tracking":
                continue
            delay = r.delay_seconds
            local = r.recorded_at.astimezone(SYDNEY_TZ)
            dow = local.weekday()
            hb = local.hour // 3
        else:
            if r.get("status") == "cancelled":
                continue
            if r.get("status") == "no_tracking":
                continue
            delay = r["delay_seconds"]
            ts = r["recorded_at"]
            if isinstance(ts, datetime):
                local = ts.astimezone(SYDNEY_TZ)
            else:
                local = ts
            dow = r.get("day_of_week", local.weekday())
            hb = r.get("hour_block", local.hour // 3)

        if dow_filter is not None and dow not in dow_filter:
            continue
        cells[(dow, hb)].append(delay)

    result: list[HeatmapCell] = []
    for (dow, hb), delays_list in sorted(cells.items()):
        result.append(
            HeatmapCell(
                day_of_week=dow,
                hour_block=hb,
                average_delay_seconds=round(sum(delays_list) / len(delays_list), 2),
                count=len(delays_list),
            )
        )
    return result


def compute_stats(
    db: Session,
    monitor_id: str,
    period: str = "day",
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> DelayStats:
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise ValueError("Monitor not found")

    now = datetime.now(timezone.utc)
    custom_range = from_date is not None and to_date is not None

    if custom_range:
        start = from_date
        end = to_date
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

    records = (
        db.query(ArrivalRecord)
        .filter(
            ArrivalRecord.monitored_trip_id == trip.id,
            ArrivalRecord.recorded_at >= start,
            ArrivalRecord.recorded_at <= end,
        )
        .all()
    )

    total = len(records)
    early = sum(1 for r in records if r.status.value == "early")
    on_time = sum(1 for r in records if r.status.value == "on_time")
    delayed = sum(1 for r in records if r.status.value == "delayed")
    cancelled = sum(1 for r in records if r.status.value == "cancelled")
    no_tracking = sum(1 for r in records if r.status.value == "no_tracking")
    valid_for_avg = [r for r in records if r.status.value not in ("cancelled", "no_tracking")]
    avg_delay = sum(r.delay_seconds for r in valid_for_avg) / len(valid_for_avg) if valid_for_avg else 0
    max_delay = max((r.delay_seconds for r in records), default=0)
    on_time_pct = (on_time / total * 100) if total else 0

    non_cancelled = [r for r in records if r.status.value != "cancelled" and r.status.value != "no_tracking"]
    delays = [float(r.delay_seconds) for r in non_cancelled]
    percentile = _compute_percentiles(delays) if delays else None
    arrival_distribution = _compute_arrival_distribution(delays)

    show_breakdown = period_label in ("week", "month", "all_time") or (
        custom_range and (end - start).days >= 2
    )

    daily_breakdown = _daily_breakdown(records) if show_breakdown else []

    heatmap = _compute_heatmap_with_filter(records)
    weekday_heatmap: list[HeatmapCell] = []
    weekend_heatmap: list[HeatmapCell] = []
    if records:
        weekday_heatmap = _compute_heatmap_with_filter(records, dow_filter={0, 1, 2, 3, 4})
        weekend_heatmap = _compute_heatmap_with_filter(records, dow_filter={5, 6})

    return DelayStats(
        period=period_label,
        period_start=start,
        period_end=end,
        total_arrivals=total,
        early_count=early,
        on_time_count=on_time,
        delayed_count=delayed,
        cancelled_count=cancelled,
        no_tracking_count=no_tracking,
        average_delay_seconds=round(avg_delay, 2),
        max_delay_seconds=max_delay,
        on_time_percentage=round(on_time_pct, 2),
        daily_breakdown=daily_breakdown,
        heatmap=heatmap,
        percentile=percentile,
        arrival_distribution=arrival_distribution,
        weekday_heatmap=weekday_heatmap,
        weekend_heatmap=weekend_heatmap,
    )


def _daily_breakdown(records: list[ArrivalRecord]) -> list[DailyStats]:
    grouped: dict[str, list[ArrivalRecord]] = defaultdict(list)
    for r in records:
        local = r.recorded_at.astimezone(SYDNEY_TZ)
        day = local.strftime("%Y-%m-%d")
        grouped[day].append(r)

    result: list[DailyStats] = []
    for day in sorted(grouped.keys()):
        day_records = grouped[day]
        total = len(day_records)
        early = sum(1 for r in day_records if r.status.value == "early")
        on_time = sum(1 for r in day_records if r.status.value == "on_time")
        delayed = sum(1 for r in day_records if r.status.value == "delayed")
        no_tracking = sum(1 for r in day_records if r.status.value == "no_tracking")
        valid = [r for r in day_records if r.status.value not in ("cancelled", "no_tracking")]
        avg = sum(r.delay_seconds for r in valid) / len(valid) if valid else 0

        result.append(
            DailyStats(
                date=day,
                total_arrivals=total,
                early_count=early,
                on_time_count=on_time,
                delayed_count=delayed,
                no_tracking_count=no_tracking,
                average_delay_seconds=round(avg, 2),
            )
        )

    return result


def compute_bunching(
    db: Session,
    monitor_id: str,
    period: str = "week",
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> list[BunchingEvent]:
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise ValueError("Monitor not found")

    now = datetime.now(timezone.utc)
    custom_range = from_date is not None and to_date is not None

    if custom_range:
        start = from_date
        end = to_date
    elif period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "all_time":
        start = datetime.min.replace(tzinfo=timezone.utc)
        end = now
    else:
        start = now - timedelta(days=7)
        end = now

    records = (
        db.query(ArrivalRecord)
        .filter(
            ArrivalRecord.monitored_trip_id == trip.id,
            ArrivalRecord.recorded_at >= start,
            ArrivalRecord.recorded_at <= end,
            ArrivalRecord.status != "cancelled",
            ArrivalRecord.status != "no_tracking",
        )
        .order_by(ArrivalRecord.scheduled_arrival.asc())
        .all()
    )

    if len(records) < 2:
        return []

    events: list[BunchingEvent] = []
    for i in range(1, len(records)):
        prev = records[i - 1]
        curr = records[i]

        scheduled_headway = (
            curr.scheduled_arrival - prev.scheduled_arrival
        ).total_seconds() / 60.0
        actual_headway = (
            curr.actual_arrival - prev.actual_arrival
        ).total_seconds() / 60.0

        if scheduled_headway <= 0 or actual_headway <= 0:
            continue

        bunching_threshold = scheduled_headway * 0.25
        if actual_headway < bunching_threshold or actual_headway < 3.0:
            events.append(
                BunchingEvent(
                    scheduled_time=curr.scheduled_arrival,
                    actual_time=curr.actual_arrival,
                    scheduled_headway_minutes=round(scheduled_headway, 2),
                    actual_headway_minutes=round(actual_headway, 2),
                    delay_minutes=round(curr.delay_seconds / 60.0, 2),
                )
            )

    return events
