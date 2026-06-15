"""Integration tests for the FastAPI endpoints using TestClient."""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import (
    ArrivalRecord,
    ArrivalStatus,
    BusRoute,
    BusStop,
    MonitoredTrip,
)

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seeded_db():
    db = TestSession()
    stop = BusStop(
        stop_id="200013", name="Town Hall", latitude=-33.87, longitude=151.21
    )
    route = BusRoute(route_id="370", route_number="370", name="Coogee to Glebe")
    trip = MonitoredTrip(stop_id=stop.id, route_id=route.id, active=True)
    db.add_all([stop, route, trip])
    db.commit()
    db.close()
    return str(trip.id), stop.stop_id, route.route_id


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestMonitors:
    def test_list_monitors_empty(self, client):
        resp = client.get("/api/monitors")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_and_list_monitor(self, client):
        resp = client.post(
            "/api/monitors",
            json={
                "stop_id": "200013",
                "route_id": "370",
                "route_number": "370",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["stop_id"] == "200013"
        assert data["route_number"] == "370"
        assert data["active"] is True

        list_resp = client.get("/api/monitors")
        assert len(list_resp.json()) == 1

    def test_get_monitor_not_found(self, client):
        resp = client.get("/api/monitors/nonexistent")
        assert resp.status_code == 404

    def test_delete_monitor(self, client, seeded_db):
        trip_id, _, _ = seeded_db
        resp = client.delete(f"/api/monitors/{trip_id}")
        assert resp.status_code == 204

    def test_delete_monitor_not_found(self, client):
        resp = client.delete("/api/monitors/nonexistent")
        assert resp.status_code == 404

    def test_stats_empty(self, client, seeded_db):
        trip_id, _, _ = seeded_db
        resp = client.get(f"/api/monitors/{trip_id}/stats?period=day")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_arrivals"] == 0
        assert data["period"] == "day"

    def test_stats_with_arrivals(self, client, seeded_db):
        trip_id, _, _ = seeded_db

        db = TestSession()
        trip = db.query(MonitoredTrip).first()
        from datetime import datetime, timedelta, timezone

        now = datetime.now(timezone.utc)
        records = [
            ArrivalRecord(
                monitored_trip_id=trip.id,
                trip_id="t1",
                scheduled_arrival=now,
                actual_arrival=now + timedelta(seconds=60),
                delay_seconds=60,
                status=ArrivalStatus.on_time,
                recorded_at=now,
            ),
            ArrivalRecord(
                monitored_trip_id=trip.id,
                trip_id="t2",
                scheduled_arrival=now,
                actual_arrival=now + timedelta(seconds=300),
                delay_seconds=300,
                status=ArrivalStatus.delayed,
                recorded_at=now,
            ),
        ]
        db.add_all(records)
        db.commit()
        db.close()

        resp = client.get(f"/api/monitors/{trip_id}/stats?period=day")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_arrivals"] == 2
        assert data["on_time_count"] == 1
        assert data["delayed_count"] == 1

    def test_stats_invalid_period(self, client, seeded_db):
        trip_id, _, _ = seeded_db
        resp = client.get(f"/api/monitors/{trip_id}/stats?period=year")
        assert resp.status_code == 422

    def test_arrivals_empty(self, client, seeded_db):
        trip_id, _, _ = seeded_db
        resp = client.get(f"/api/monitors/{trip_id}/arrivals")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_arrivals_with_data(self, client, seeded_db):
        trip_id, _, _ = seeded_db
        db = TestSession()
        trip = db.query(MonitoredTrip).first()
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        record = ArrivalRecord(
            monitored_trip_id=trip.id,
            trip_id="t1",
            scheduled_arrival=now,
            actual_arrival=now,
            delay_seconds=0,
            status=ArrivalStatus.on_time,
            recorded_at=now,
        )
        db.add(record)
        db.commit()
        db.close()

        resp = client.get(f"/api/monitors/{trip_id}/arrivals")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["trip_id"] == "t1"
        assert data[0]["status"] == "on_time"


class TestStops:
    @patch("app.routers.stops.TfNSWClient")
    def test_search_stops_success(self, mock_client_class, client):
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client
        mock_client.find_stops.return_value = [
            Mock(id="200013", name="Town Hall", latitude=-33.87, longitude=151.21)
        ]

        resp = client.get("/api/stops?q=Town")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "200013"

    @patch("app.routers.stops.TfNSWClient")
    def test_search_stops_empty_query(self, mock_client_class, client):
        resp = client.get("/api/stops?q=")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.routers.stops.TfNSWClient")
    def test_stop_routes(self, mock_client_class, client):
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client
        mock_client.get_departures.return_value = []

        resp = client.get("/api/stops/200013/routes")
        assert resp.status_code == 200
        assert resp.json() == []
