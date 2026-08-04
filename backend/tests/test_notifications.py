import asyncio
import smtplib
from datetime import date, timedelta
from unittest.mock import MagicMock

from services.notifications_service import send_swap_digest_emails
from tests.conftest import _TestSessionLocal


def test_get_prefs_requires_auth(client):
    response = client.get("/api/notifications/preferences")

    assert response.status_code == 401


def test_get_prefs_returns_defaults_when_none_set(auth_client):
    response = auth_client.get("/api/notifications/preferences")

    assert response.status_code == 200
    assert response.json() == {
        "email_enabled": True,
    }


def test_update_then_get_prefs_persists(auth_client):
    response = auth_client.put(
        "/api/notifications/preferences",
        json={
            "email_enabled": False,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "email_enabled": False,
    }

    get_response = auth_client.get(
        "/api/notifications/preferences"
    )

    assert get_response.status_code == 200
    assert get_response.json() == {
        "email_enabled": False,
    }


def test_send_test_email_not_configured_without_gmail_credentials(
    auth_client,
    monkeypatch,
):
    monkeypatch.setattr(
        "services.email_service.settings.gmail_user",
        "",
    )
    monkeypatch.setattr(
        "services.email_service.settings.gmail_app_password",
        "",
    )

    response = auth_client.post("/api/notifications/test")

    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


def _mock_smtp(
    monkeypatch,
    login_side_effect=None,
):
    mock_smtp = MagicMock()
    mock_smtp.__enter__.return_value = mock_smtp

    if login_side_effect:
        mock_smtp.login.side_effect = login_side_effect

    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP",
        lambda *args, **kwargs: mock_smtp,
    )

    return mock_smtp


def test_send_test_email_sent_when_configured(
    auth_client,
    monkeypatch,
):
    monkeypatch.setattr(
        "services.email_service.settings.gmail_user",
        "bot@example.com",
    )
    monkeypatch.setattr(
        "services.email_service.settings.gmail_app_password",
        "fake-app-password",
    )

    mock_smtp = _mock_smtp(monkeypatch)

    response = auth_client.post("/api/notifications/test")

    assert response.status_code == 200
    assert response.json()["status"] == "sent"

    mock_smtp.login.assert_called_once_with(
        "bot@example.com",
        "fake-app-password",
    )
    mock_smtp.sendmail.assert_called_once()


def test_send_test_email_reports_auth_error(
    auth_client,
    monkeypatch,
):
    monkeypatch.setattr(
        "services.email_service.settings.gmail_user",
        "bot@example.com",
    )
    monkeypatch.setattr(
        "services.email_service.settings.gmail_app_password",
        "wrong-password",
    )

    _mock_smtp(
        monkeypatch,
        login_side_effect=smtplib.SMTPAuthenticationError(
            535,
            b"bad creds",
        ),
    )

    response = auth_client.post("/api/notifications/test")

    assert response.status_code == 200
    assert response.json()["status"] == "error"


def _create_trip(
    auth_client,
    monkeypatch,
    name="Rainy Trip",
):
    monkeypatch.setattr(
        "services.trips_service.geocoding_service.geocode",
        lambda destination: (51.5074, -0.1278),
    )

    start_date = date.today() + timedelta(days=5)
    end_date = start_date + timedelta(days=1)

    response = auth_client.post(
        "/api/trips/",
        json={
            "name": name,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
    )

    assert response.status_code == 200, response.json()

    return response.json()["id"], start_date


def _run_digest(swapped, tips=None):
    async def _inner():
        async with _TestSessionLocal() as db:
            return await send_swap_digest_emails(db, swapped, tips)
    return asyncio.run(_inner())


def _swap(
    trip_id,
    activity_id,
    day_date,
    original_name="Hyde Park Walk",
    original_location="Hyde Park",
    alternate_name="British Museum",
    alternate_location="Great Russell St",
    rule_id="rain",
    reason="Heavy rain expected (80.0% chance)",
    rain_mm=3.2,
):
    return {
        "trip_id": trip_id,
        "activity_id": activity_id,
        "rule_id": rule_id,
        "reason": reason,
        "rain_mm": rain_mm,
        "day_date": day_date,
        "original_name": original_name,
        "original_location": original_location,
        "alternate_name": alternate_name,
        "alternate_location": alternate_location,
    }


def test_send_swap_digest_emails_sends_one_email_per_user(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    swapped = [
        _swap(
            trip_id,
            1,
            trip_start_date.isoformat(),
        ),
        _swap(
            trip_id,
            2,
            trip_start_date.isoformat(),
        ),
    ]

    results = _run_digest(swapped)

    assert len(results) == 1
    assert results[0]["status"] == "sent"

    mock_send.assert_called_once()

    body = mock_send.call_args.args[2]

    assert body.count("Rainy Trip") == 2


def test_send_swap_digest_emails_shows_day_and_before_after(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    _run_digest(
        [
            _swap(
                trip_id,
                1,
                trip_start_date.isoformat(),
                original_name="Hyde Park Walk",
                original_location="Hyde Park",
                alternate_name="British Museum",
                alternate_location="Great Russell St",
            )
        ]
    )

    mock_send.assert_called_once()

    html_body = mock_send.call_args.args[2]
    text_body = mock_send.call_args.args[3]

    for body in (html_body, text_body):
        assert "Hyde Park Walk" in body
        assert "Hyde Park" in body
        assert "British Museum" in body
        assert "Great Russell St" in body

    expected_display_date = trip_start_date.strftime(
        "%a, %d %b"
    )

    assert expected_display_date in html_body


def test_send_swap_digest_emails_skips_users_with_email_disabled(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    preferences_response = auth_client.put(
        "/api/notifications/preferences",
        json={
            "email_enabled": False,
        },
    )

    assert preferences_response.status_code == 200

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    results = _run_digest(
        [
            _swap(
                trip_id,
                1,
                trip_start_date.isoformat(),
            )
        ]
    )

    assert results == []
    mock_send.assert_not_called()


def test_non_rain_swap_email_content_is_correct(
    auth_client,
    monkeypatch,
):
    """A swap caused by e.g. strong wind (services/weather_rules.py's
    scoring engine, not just rain) should still send, and the email should
    describe the actual reason rather than the old hardcoded rain copy."""
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    results = _run_digest(
        [
            _swap(
                trip_id,
                1,
                trip_start_date.isoformat(),
                rule_id="wind",
                reason="Very Strong winds expected — unsafe/unpleasant for this activity",
                rain_mm=0.0,
            )
        ]
    )

    assert len(results) == 1
    assert results[0]["status"] == "sent"

    body = mock_send.call_args.args[2]
    assert "Very Strong winds expected" in body
    assert "Rain is in the forecast" not in body


def _tip(trip_id, activity_id, day_date="2026-08-01", name="Beach Day", location="Bondi Beach"):
    return {
        "trip_id": trip_id, "activity_id": activity_id,
        "reason": "Poor beach safety conditions expected",
        "tip": "Beach conditions may be unsafe for swimming — check local flags/lifeguard signage.",
        "day_date": day_date, "name": name, "location": location,
    }


def test_send_tip_only_digest_sends_an_email(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    results = _run_digest(
        [],
        tips=[
            _tip(
                trip_id,
                1,
                day_date=trip_start_date.isoformat(),
            )
        ],
    )

    assert len(results) == 1
    assert results[0]["status"] == "sent"

    subject = mock_send.call_args.args[1]
    assert "tips" in subject.lower()

    body = mock_send.call_args.args[2]
    assert "Beach Day" in body
    assert "Bondi Beach" in body
    assert "check local flags" in body


def test_tip_copy_does_not_claim_the_activity_cant_be_swapped(
    auth_client,
    monkeypatch,
):
    """A tip can come from either a genuinely *fixed* activity, or a
    swappable activity whose combined score only reached the advisory band
    (see run_auto_swap()'s docstring in services/auto_swap_service.py) — the
    tip dict itself doesn't distinguish which, so the copy must stay
    accurate for both rather than asserting every tip is for a fixed,
    unswappable plan."""
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    _run_digest(
        [],
        tips=[
            _tip(
                trip_id,
                1,
                day_date=trip_start_date.isoformat(),
            )
        ],
    )

    body = mock_send.call_args.args[2]
    assert "can't be swapped" not in body.lower()


def test_tips_still_respect_email_enabled(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    preferences_response = auth_client.put(
        "/api/notifications/preferences",
        json={
            "email_enabled": False,
        },
    )

    assert preferences_response.status_code == 200

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    results = _run_digest(
        [],
        tips=[
            _tip(
                trip_id,
                1,
                day_date=trip_start_date.isoformat(),
            )
        ],
    )

    assert results == []
    mock_send.assert_not_called()


def test_combined_swap_and_tip_digest_sends_one_email(
    auth_client,
    monkeypatch,
):
    trip_id, trip_start_date = _create_trip(
        auth_client,
        monkeypatch,
    )

    mock_send = MagicMock(
        return_value={"status": "sent"}
    )
    monkeypatch.setattr(
        "services.notifications_service.email_service.send_email",
        mock_send,
    )

    day_date = trip_start_date.isoformat()

    results = _run_digest(
        [
            _swap(
                trip_id,
                1,
                day_date,
            )
        ],
        tips=[
            _tip(
                trip_id,
                2,
                day_date=day_date,
            )
        ],
    )

    assert len(results) == 1
    mock_send.assert_called_once()

    body = mock_send.call_args.args[2]
    assert "British Museum" in body
    assert "Beach Day" in body