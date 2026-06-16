import random
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
        return PercentileStats(p50=0, p75=0, p90=0, p95=0)
    sorted_d = sorted(delays)
    n = len(sorted_d)

    def pct(p: float) -> float:
        idx = (p / 100.0) * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        frac = idx - lo
        return round(sorted_d[lo] * (1 - frac) + sorted_d[hi] * frac, 2)

    return PercentileStats(p50=pct(50), p75=pct(75), p90=pct(90), p95=pct(95))


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
            delay = r.delay_seconds
            local = r.recorded_at.astimezone(SYDNEY_TZ)
            dow = local.weekday()
            hb = local.hour // 3
        else:
            if r.get("status") == "cancelled":
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
    elif period == "all_time":
        start = datetime.min.replace(tzinfo=timezone.utc)
    else:
        start = now - timedelta(days=7)

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

    non_cancelled = [r for r in records if r.status.value != "cancelled"]
    delays = [float(r.delay_seconds) for r in non_cancelled]
    percentile = _compute_percentiles(delays) if delays else None
    arrival_distribution = _compute_arrival_distribution(delays)

    daily_breakdown = (
        _daily_breakdown(records)
        if period in ("week", "month", "all_time")
        else []
    )

    heatmap = (
        _compute_heatmap_with_filter(records)
        if period in ("week", "month", "all_time")
        else []
    )

    weekday_heatmap: list[HeatmapCell] = []
    weekend_heatmap: list[HeatmapCell] = []
    if period in ("week", "month", "all_time"):
        weekday_heatmap = _compute_heatmap_with_filter(records, dow_filter={0, 1, 2, 3, 4})
        weekend_heatmap = _compute_heatmap_with_filter(records, dow_filter={5, 6})

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
        heatmap=heatmap,
        percentile=percentile,
        arrival_distribution=arrival_distribution,
        weekday_heatmap=weekday_heatmap,
        weekend_heatmap=weekend_heatmap,
    )


def compute_mock_stats(monitor_id: str, period: str = "month") -> DelayStats:
    now = datetime.now(timezone.utc).astimezone(SYDNEY_TZ)
    if period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "all_time":
        start = now - timedelta(days=365)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    mock_records = _generate_mock_records(monitor_id, start, now)
    total = len(mock_records)

    early = sum(1 for r in mock_records if r["status"] == "early")
    on_time = sum(1 for r in mock_records if r["status"] == "on_time")
    delayed = sum(1 for r in mock_records if r["status"] == "delayed")
    cancelled = sum(1 for r in mock_records if r["status"] == "cancelled")
    avg_delay = sum(r["delay_seconds"] for r in mock_records) / total if total else 0
    max_delay = max((r["delay_seconds"] for r in mock_records), default=0)
    on_time_pct = (on_time / total * 100) if total else 0

    non_cancelled = [r for r in mock_records if r["status"] != "cancelled"]
    delays = [float(r["delay_seconds"]) for r in non_cancelled]
    percentile = _compute_percentiles(delays) if delays else None
    arrival_distribution = _compute_arrival_distribution(delays)

    daily_breakdown = (
        _mock_daily_breakdown(mock_records)
        if period in ("week", "month", "all_time")
        else []
    )

    show_heatmaps = period in ("week", "month", "all_time")

    heatmap = _compute_heatmap_with_filter(mock_records) if show_heatmaps else []
    weekday_heatmap = (
        _compute_heatmap_with_filter(mock_records, dow_filter={0, 1, 2, 3, 4})
        if show_heatmaps
        else []
    )
    weekend_heatmap = (
        _compute_heatmap_with_filter(mock_records, dow_filter={5, 6})
        if show_heatmaps
        else []
    )

    return DelayStats(
        period=period + "_mock",
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
        heatmap=heatmap,
        percentile=percentile,
        arrival_distribution=arrival_distribution,
        weekday_heatmap=weekday_heatmap,
        weekend_heatmap=weekend_heatmap,
    )


def _generate_mock_records(monitor_id: str, start: datetime, end: datetime) -> list[dict]:
    route_profiles = {
        "370": {"weekday_base": 180, "weekend_base": 60, "peak_amplitude": 240, "noise": 90, "cancellation_rate": 0.02},
        "333": {"weekday_base": 120, "weekend_base": 300, "peak_amplitude": 180, "noise": 120, "cancellation_rate": 0.01},
        "610X": {"weekday_base": 300, "weekend_base": 90, "peak_amplitude": 360, "noise": 150, "cancellation_rate": 0.03},
        "B1": {"weekday_base": 150, "weekend_base": 120, "peak_amplitude": 200, "noise": 200, "cancellation_rate": 0.05},
    }

    route_id = monitor_id.split("-")[0] if "-" in monitor_id else "370"
    profile = route_profiles.get(route_id, route_profiles["370"])

    records = []
    current = start
    while current < end:
        hour = current.hour
        if hour < 5 or hour >= 23:
            current += timedelta(minutes=30)
            continue

        if random.random() < 0.1:
            current += timedelta(minutes=random.randint(8, 15))
            continue

        day_of_week = current.weekday()
        is_weekend = day_of_week >= 5

        if is_weekend:
            base_delay = profile["weekend_base"]
        else:
            base_delay = profile["weekday_base"]

        if 7 <= hour < 10:
            rush_factor = 1.0 + profile["peak_amplitude"] / base_delay if base_delay else 2.0
        elif 16 <= hour < 19:
            rush_factor = 0.8 + profile["peak_amplitude"] / base_delay if base_delay else 2.0
        elif 10 <= hour < 16:
            rush_factor = 0.5
        elif 22 <= hour or hour < 5:
            rush_factor = -0.3
        else:
            rush_factor = 0.0

        delay = base_delay * (1 + rush_factor) + random.gauss(0, profile["noise"])
        delay = max(-300, min(1800, int(delay)))

        if random.random() < profile["cancellation_rate"]:
            status = "cancelled"
            delay = 0
        elif delay < -120:
            status = "early"
        elif delay > 120:
            status = "delayed"
        else:
            status = "on_time"

        records.append({
            "recorded_at": current,
            "delay_seconds": delay,
            "status": status,
            "day_of_week": day_of_week,
            "hour_block": hour // 3,
        })

        current += timedelta(minutes=random.randint(10, 25))

    return records


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


def _mock_daily_breakdown(records: list[dict]) -> list[DailyStats]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        day = r["recorded_at"].strftime("%Y-%m-%d")
        grouped[day].append(r)

    result: list[DailyStats] = []
    for day in sorted(grouped.keys()):
        day_records = grouped[day]
        total = len(day_records)
        early = sum(1 for r in day_records if r["status"] == "early")
        on_time = sum(1 for r in day_records if r["status"] == "on_time")
        delayed = sum(1 for r in day_records if r["status"] == "delayed")
        avg = sum(r["delay_seconds"] for r in day_records) / total if total else 0

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


def compute_bunching(
    db: Session, monitor_id: str, period: str = "week"
) -> list[BunchingEvent]:
    trip = db.query(MonitoredTrip).filter(MonitoredTrip.id == monitor_id).first()
    if not trip:
        raise ValueError("Monitor not found")

    now = datetime.now(timezone.utc)
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "all_time":
        start = datetime.min.replace(tzinfo=timezone.utc)
    else:
        start = now - timedelta(days=7)

    records = (
        db.query(ArrivalRecord)
        .filter(
            ArrivalRecord.monitored_trip_id == trip.id,
            ArrivalRecord.recorded_at >= start,
            ArrivalRecord.recorded_at <= now,
            ArrivalRecord.status != "cancelled",
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


def compute_mock_bunching(
    monitor_id: str, period: str = "month"
) -> list[BunchingEvent]:
    now = datetime.now(timezone.utc).astimezone(SYDNEY_TZ)
    if period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "all_time":
        start = now - timedelta(days=365)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    mock_records = _generate_mock_records(monitor_id, start, now)
    non_cancelled = [r for r in mock_records if r["status"] != "cancelled"]
    non_cancelled.sort(key=lambda r: r["recorded_at"])

    if len(non_cancelled) < 2:
        return []

    events: list[BunchingEvent] = []
    timestamps = [r["recorded_at"] for r in non_cancelled]

    for i in range(1, len(non_cancelled)):
        prev_ts = timestamps[i - 1]
        curr_ts = timestamps[i]
        prev_delay = non_cancelled[i - 1]["delay_seconds"]
        curr_delay = non_cancelled[i]["delay_seconds"]

        scheduled_headway = (curr_ts - prev_ts).total_seconds() / 60.0
        prev_actual = prev_ts + timedelta(seconds=prev_delay)
        curr_actual = curr_ts + timedelta(seconds=curr_delay)
        actual_headway = (curr_actual - prev_actual).total_seconds() / 60.0

        if scheduled_headway <= 0 or actual_headway <= 0:
            continue

        bunching_threshold = scheduled_headway * 0.25
        if actual_headway < bunching_threshold or actual_headway < 3.0:
            events.append(
                BunchingEvent(
                    scheduled_time=curr_ts,
                    actual_time=curr_actual,
                    scheduled_headway_minutes=round(scheduled_headway, 2),
                    actual_headway_minutes=round(actual_headway, 2),
                    delay_minutes=round(curr_delay / 60.0, 2),
                )
            )

    return events
