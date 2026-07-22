import asyncio
import smtplib
from unittest.mock import MagicMock

from services.notifications_service import send_swap_digest_emails
from tests.conftest import _TestSessionLocal


def test_get_prefs_requires_auth(client):
    response = client.get("/api/notifications/preferences")
    assert response.status_code == 401


def test_get_prefs_returns_defaults_when_none_set(auth_client):
    response = auth_client.get("/api/notifications/preferences")
    assert response.status_code == 200
    assert response.json() == {"email_enabled": True, "rain_threshold_mm": 0.0}


def test_update_then_get_prefs_persists(auth_client):
    response = auth_client.put(
        "/api/notifications/preferences",
        json={"email_enabled": False, "rain_threshold_mm": 5.0},
    )
    assert response.status_code == 200
    assert response.json() == {"email_enabled": False, "rain_threshold_mm": 5.0}

    get_response = auth_client.get("/api/notifications/preferences")
    assert get_response.json() == {"email_enabled": False, "rain_threshold_mm": 5.0}


def test_send_test_email_not_configured_without_gmail_credentials(auth_client, monkeypatch):
    monkeypatch.setattr("services.email_service.settings.gmail_user", "")
    monkeypatch.setattr("services.email_service.settings.gmail_app_password", "")

    response = auth_client.post("/api/notifications/test")
    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


def _mock_smtp(monkeypatch, login_side_effect=None):
    mock_smtp = MagicMock()
    mock_smtp.__enter__.return_value = mock_smtp
    if login_side_effect:
        mock_smtp.login.side_effect = login_side_effect
    monkeypatch.setattr("services.email_service.smtplib.SMTP", lambda *a, **kw: mock_smtp)
    return mock_smtp


def test_send_test_email_sent_when_configured(auth_client, monkeypatch):
    monkeypatch.setattr("services.email_service.settings.gmail_user", "bot@example.com")
    monkeypatch.setattr("services.email_service.settings.gmail_app_password", "fake-app-password")
    mock_smtp = _mock_smtp(monkeypatch)

    response = auth_client.post("/api/notifications/test")
    assert response.status_code == 200
    assert response.json()["status"] == "sent"
    mock_smtp.login.assert_called_once_with("bot@example.com", "fake-app-password")
    mock_smtp.sendmail.assert_called_once()


def test_send_test_email_reports_auth_error(auth_client, monkeypatch):
    monkeypatch.setattr("services.email_service.settings.gmail_user", "bot@example.com")
    monkeypatch.setattr("services.email_service.settings.gmail_app_password", "wrong-password")
    _mock_smtp(monkeypatch, login_side_effect=smtplib.SMTPAuthenticationError(535, b"bad creds"))

    response = auth_client.post("/api/notifications/test")
    assert response.status_code == 200
    assert response.json()["status"] == "error"


def _create_trip(auth_client, monkeypatch, name="Rainy Trip"):
    monkeypatch.setattr("services.trips_service.geocoding_service.geocode", lambda destination: (51.5074, -0.1278))
    response = auth_client.post("/api/trips/", json={
        "name": name, "start_date": "2026-08-01", "end_date": "2026-08-02",
    })
    return response.json()["id"]


def _run_digest(swapped):
    async def _inner():
        async with _TestSessionLocal() as db:
            return await send_swap_digest_emails(db, swapped)
    return asyncio.run(_inner())


def _swap(trip_id, activity_id, day_date="2026-08-01",
          original_name="Hyde Park Walk", original_location="Hyde Park",
          alternate_name="British Museum", alternate_location="Great Russell St"):
    return {
        "trip_id": trip_id, "activity_id": activity_id,
        "reason": "Heavy rain expected (80.0% chance)", "rain_mm": 3.2,
        "day_date": day_date, "original_name": original_name, "original_location": original_location,
        "alternate_name": alternate_name, "alternate_location": alternate_location,
    }


def test_send_swap_digest_emails_sends_one_email_per_user(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    mock_send = MagicMock(return_value={"status": "sent"})
    monkeypatch.setattr("services.notifications_service.email_service.send_email", mock_send)

    swapped = [_swap(trip_id, 1), _swap(trip_id, 2)]

    results = _run_digest(swapped)

    assert len(results) == 1
    assert results[0]["status"] == "sent"
    mock_send.assert_called_once()
    body = mock_send.call_args.args[2]
    assert body.count("Rainy Trip") == 2  # both swaps listed in one email


def test_send_swap_digest_emails_shows_day_and_before_after(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    mock_send = MagicMock(return_value={"status": "sent"})
    monkeypatch.setattr("services.notifications_service.email_service.send_email", mock_send)

    _run_digest([_swap(
        trip_id, 1, day_date="2026-08-01",
        original_name="Hyde Park Walk", original_location="Hyde Park",
        alternate_name="British Museum", alternate_location="Great Russell St",
    )])

    html_body = mock_send.call_args.args[2]
    text_body = mock_send.call_args.args[3]
    for body in (html_body, text_body):
        assert "Hyde Park Walk" in body
        assert "Hyde Park" in body
        assert "British Museum" in body
        assert "Great Russell St" in body
    assert "Sat, 01 Aug" in html_body


def test_send_swap_digest_emails_skips_users_with_email_disabled(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    auth_client.put("/api/notifications/preferences", json={"email_enabled": False, "rain_threshold_mm": 0.0})
    mock_send = MagicMock(return_value={"status": "sent"})
    monkeypatch.setattr("services.notifications_service.email_service.send_email", mock_send)

    results = _run_digest([_swap(trip_id, 1)])

    assert results == []
    mock_send.assert_not_called()


def test_send_swap_digest_emails_filters_by_rain_threshold(auth_client, monkeypatch):
    trip_id = _create_trip(auth_client, monkeypatch)
    auth_client.put("/api/notifications/preferences", json={"email_enabled": True, "rain_threshold_mm": 10.0})
    mock_send = MagicMock(return_value={"status": "sent"})
    monkeypatch.setattr("services.notifications_service.email_service.send_email", mock_send)

    results = _run_digest([_swap(trip_id, 1)])

    assert results == []
    mock_send.assert_not_called()
