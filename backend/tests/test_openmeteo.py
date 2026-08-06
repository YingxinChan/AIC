# Run: python -m pytest tests/test_openmeteo.py
#
# Covers the additions made after Open-Meteo started 429ing from Render's
# shared-IP outbound traffic: retrying a 429 or a timeout/connection error
# instead of failing immediately, and caching get_forecast() so the
# prediction/hourly endpoints' identical back-to-back calls collapse into one
# real request.

from unittest.mock import Mock, patch

import requests
import services.openmeteo as openmeteo
from services.openmeteo import get_forecast


def _response(status_code, json_data=None, headers=None):
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.headers = headers or {}
    return resp


def _forecast_json():
    return {
        "hourly": {"time": []},
        "daily": {"time": []},
        "utc_offset_seconds": 3600,
    }


def setup_function(_):
    # Each test controls its own cache state — a hit from a previous test
    # would otherwise make later tests pass for the wrong reason.
    openmeteo._forecast_cache.clear()


def test_retries_on_429_then_succeeds():
    responses = [
        _response(429, headers={}),
        _response(200, _forecast_json()),
    ]
    with patch("services.openmeteo.requests.get", side_effect=responses) as mock_get, \
         patch("services.openmeteo.time.sleep") as mock_sleep:
        result = get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")

    assert mock_get.call_count == 2
    assert mock_sleep.call_count == 1
    assert result["utc_offset_seconds"] == 3600


def test_gives_up_after_max_retries_on_persistent_429():
    responses = [_response(429, headers={}) for _ in range(openmeteo.MAX_RETRIES)]
    with patch("services.openmeteo.requests.get", side_effect=responses) as mock_get, \
         patch("services.openmeteo.time.sleep"):
        try:
            get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")
            assert False, "expected an exception for a non-200 response"
        except Exception as e:
            assert "429" in str(e)

    assert mock_get.call_count == openmeteo.MAX_RETRIES


def test_retries_on_timeout_then_succeeds():
    responses = [requests.exceptions.Timeout(), _response(200, _forecast_json())]
    with patch("services.openmeteo.requests.get", side_effect=responses) as mock_get, \
         patch("services.openmeteo.time.sleep") as mock_sleep:
        result = get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")

    assert mock_get.call_count == 2
    assert mock_sleep.call_count == 1
    assert result["utc_offset_seconds"] == 3600


def test_gives_up_after_max_retries_on_persistent_timeout():
    responses = [requests.exceptions.Timeout() for _ in range(openmeteo.MAX_RETRIES)]
    with patch("services.openmeteo.requests.get", side_effect=responses) as mock_get, \
         patch("services.openmeteo.time.sleep"):
        try:
            get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")
            assert False, "expected the Timeout to propagate"
        except requests.exceptions.Timeout:
            pass

    assert mock_get.call_count == openmeteo.MAX_RETRIES


def test_retry_after_header_is_respected():
    responses = [
        _response(429, headers={"Retry-After": "5"}),
        _response(200, _forecast_json()),
    ]
    with patch("services.openmeteo.requests.get", side_effect=responses), \
         patch("services.openmeteo.time.sleep") as mock_sleep:
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")

    mock_sleep.assert_called_once_with(5.0)


def test_second_call_with_same_params_is_served_from_cache():
    with patch("services.openmeteo.requests.get", return_value=_response(200, _forecast_json())) as mock_get:
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")

    assert mock_get.call_count == 1


def test_different_params_are_not_cached_together():
    with patch("services.openmeteo.requests.get", return_value=_response(200, _forecast_json())) as mock_get:
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")
        get_forecast(3.0, 4.0, "2026-08-08", "2026-08-10")

    assert mock_get.call_count == 2


def test_cache_expires_after_ttl():
    # monotonic() is called once to store the first response's timestamp (0),
    # once to check staleness on the second call (999 - 0 exceeds the TTL),
    # and once more to store that second (now genuinely fresh) response.
    with patch("services.openmeteo.requests.get", return_value=_response(200, _forecast_json())) as mock_get, \
         patch("services.openmeteo.time.monotonic", side_effect=[0, 999, 1000]):
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")
        get_forecast(1.0, 2.0, "2026-08-08", "2026-08-10")

    assert mock_get.call_count == 2
