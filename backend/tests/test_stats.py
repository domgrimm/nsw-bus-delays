"""Tests for the stats service."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import ArrivalRecord, ArrivalStatus, BusRoute, BusStop, MonitoredTrip
from app.services.stats import compute_stats, compute_status


def test_compute_status_on_time():
    assert compute_status(0) == "on_time"
    assert compute_status(120) == "on_time"
    assert compute_status(-120) == "on_time"
    assert compute_status(60) == "on_time"


def test_compute_status_delayed():
    assert compute_status(121) == "delayed"
    assert compute_status(300) == "delayed"


def test_compute_status_early():
    assert compute_status(-121) == "early"
    assert compute_status(-300) == "early"


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()


@pytest.fixture
def seeded_db(db_session):
    stop = BusStop(stop_id="200013", name="Town Hall", latitude=-33.87, longitude=151.21)
    route = BusRoute(route_id="370", route_number="370", name="Coogee to Glebe")
    trip = MonitoredTrip(stop_id=stop.id, route_id=route.id, active=True)
    db_session.add_all([stop, route, trip])
    db_session.commit()

    now = datetime.now(timezone.utc)
    records = [
        ArrivalRecord(
            monitored_trip_id=trip.id,
            trip_id="t1",
            scheduled_arrival=now - timedelta(hours=1),
            actual_arrival=now - timedelta(hours=1, seconds=60),
            delay_seconds=60,
            status=ArrivalStatus.on_time,
            recorded_at=now - timedelta(hours=1),
        ),
        ArrivalRecord(
            monitored_trip_id=trip.id,
            trip_id="t2",
            scheduled_arrival=now - timedelta(hours=2),
            actual_arrival=now - timedelta(hours=2, seconds=180),
            delay_seconds=180,
            status=ArrivalStatus.delayed,
            recorded_at=now - timedelta(hours=2),
        ),
        ArrivalRecord(
            monitored_trip_id=trip.id,
            trip_id="t3",
            scheduled_arrival=now - timedelta(hours=3),
            actual_arrival=now - timedelta(hours=3, seconds=-180),
            delay_seconds=-180,
            status=ArrivalStatus.early,
            recorded_at=now - timedelta(hours=3),
        ),
    ]
    db_session.add_all(records)
    db_session.commit()

    return db_session, str(trip.id)


def test_compute_stats_day(seeded_db):
    db, trip_id = seeded_db
    stats = compute_stats(db, trip_id, period="day")

    assert stats.total_arrivals == 3
    assert stats.early_count == 1
    assert stats.on_time_count == 1
    assert stats.delayed_count == 1
    assert stats.max_delay_seconds == 180
    assert stats.period == "day"
    assert len(stats.daily_breakdown) == 0


def test_compute_stats_empty(db_session):
    stop = BusStop(stop_id="999", name="Nowhere", latitude=0, longitude=0)
    route = BusRoute(route_id="X99", route_number="X99", name="Nowhere")
    trip = MonitoredTrip(stop_id=stop.id, route_id=route.id, active=True)
    db_session.add_all([stop, route, trip])
    db_session.commit()

    stats = compute_stats(db_session, str(trip.id), period="day")
    assert stats.total_arrivals == 0
    assert stats.average_delay_seconds == 0
    assert stats.max_delay_seconds == 0
    assert stats.on_time_percentage == 0


def test_compute_stats_unknown_monitor(db_session):
    with pytest.raises(ValueError, match="Monitor not found"):
        compute_stats(db_session, "00000000-0000-0000-0000-000000000000")
