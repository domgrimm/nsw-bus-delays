"""Tests for the TfNSW API client."""

from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app.tf_nsw_client import TfNSWClient, TfNSWDeparture, TfNSWStop


@pytest.fixture
def mock_client(monkeypatch):
    client = TfNSWClient()
    mock_async_client = AsyncMock(spec=httpx.AsyncClient)
    client._client = mock_async_client
    return client


@pytest.mark.asyncio
async def test_find_stops_parses_response(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {
        "stops": [
            {"id": "200013", "name": "Town Hall", "latitude": -33.873, "longitude": 151.206},
            {"id": "200014", "name": "Wynyard", "latitude": -33.865, "longitude": 151.205},
        ]
    }
    mock_client._client.get.return_value = mock_response

    stops = await mock_client.find_stops("Town Hall")
    assert len(stops) == 2
    assert stops[0] == TfNSWStop(id="200013", name="Town Hall", latitude=-33.873, longitude=151.206)
    assert stops[1].name == "Wynyard"


@pytest.mark.asyncio
async def test_find_stops_empty_response(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {"stops": []}
    mock_client._client.get.return_value = mock_response

    stops = await mock_client.find_stops("NoSuchStop")
    assert stops == []


@pytest.mark.asyncio
async def test_get_departures_parses_response(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {
        "departures": [
            {
                "tripId": "trip1",
                "routeId": "370",
                "routeNumber": "370",
                "scheduledDeparture": "2026-06-15T10:00:00+10:00",
                "estimatedDeparture": "2026-06-15T10:05:00+10:00",
            },
        ]
    }
    mock_client._client.get.return_value = mock_response

    deps = await mock_client.get_departures("200013")
    assert len(deps) == 1
    assert deps[0] == TfNSWDeparture(
        trip_id="trip1",
        route_id="370",
        route_number="370",
        scheduled_departure="2026-06-15T10:00:00+10:00",
        estimated_departure="2026-06-15T10:05:00+10:00",
    )


@pytest.mark.asyncio
async def test_get_departures_without_estimate(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {
        "departures": [
            {
                "tripId": "trip2",
                "routeId": "370",
                "routeNumber": "370",
                "scheduledDeparture": "2026-06-15T10:00:00+10:00",
            },
        ]
    }
    mock_client._client.get.return_value = mock_response

    deps = await mock_client.get_departures("200013")
    assert deps[0].estimated_departure is None


@pytest.mark.asyncio
async def test_client_passes_route_id_param(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {"departures": []}
    mock_client._client.get.return_value = mock_response

    await mock_client.get_departures("200013", route_id="370")
    mock_client._client.get.assert_called_once_with(
        "publictransport/departure/200013",
        params={"routeId": "370", "maxresults": 20},
    )


@pytest.mark.asyncio
async def test_client_raises_on_api_error(mock_client):
    mock_response = Mock()
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "403 Forbidden", request=Mock(), response=Mock()
    )
    mock_client._client.get.return_value = mock_response

    with pytest.raises(httpx.HTTPStatusError):
        await mock_client.find_stops("test")
