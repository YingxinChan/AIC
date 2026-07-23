# Run: python -m pytest tests/test_activities.py

from unittest.mock import AsyncMock, patch
import httpx


def _mock_response(status_code, json_data=None):
    resp = AsyncMock()
    resp.status_code = status_code
    resp.json = lambda: json_data
    return resp


def test_walking_distance_requires_auth(client):
    response = client.get(
        "/api/activities/walking-distance?from_lat=51.5&from_lng=-0.1&to_lat=51.51&to_lng=-0.11"
    )
    assert response.status_code == 401


def test_walking_distance_returns_distance_and_duration_on_success(auth_client):
    ors_response = {
        "features": [
            {"properties": {"segments": [{"distance": 850.4, "duration": 612.3}]}}
        ]
    }
    mock_resp = _mock_response(200, ors_response)

    with patch("services.routing_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
        response = auth_client.get(
            "/api/activities/walking-distance?from_lat=51.5&from_lng=-0.1&to_lat=51.51&to_lng=-0.11"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["distance_m"] == 850
    assert data["duration_min"] == 10


def test_walking_distance_returns_none_fields_on_non_200(auth_client):
    mock_resp = _mock_response(429, {})

    with patch("services.routing_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
        response = auth_client.get(
            "/api/activities/walking-distance?from_lat=51.5&from_lng=-0.1&to_lat=51.51&to_lng=-0.11"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["distance_m"] is None
    assert data["duration_min"] is None


def test_walking_distance_returns_none_fields_on_request_exception(auth_client):
    with patch("services.routing_service.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=httpx.RequestError("timeout")
        )
        response = auth_client.get(
            "/api/activities/walking-distance?from_lat=51.5&from_lng=-0.1&to_lat=51.51&to_lng=-0.11"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["distance_m"] is None
    assert data["duration_min"] is None
