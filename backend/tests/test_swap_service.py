import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from models.activity import Activity
from models.trip import Trip
from services import swap_service


def _mock_claude(monkeypatch, alternate=None):
    alternate = alternate or {
        "name": "British Museum", "location": "Great Russell St",
        "lat": 51.5194, "lng": -0.1270, "type": "indoor",
    }
    fake_block = MagicMock(type="text", text=json.dumps(alternate))
    fake_response = MagicMock(content=[fake_block])
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=fake_response)
    monkeypatch.setattr("services.swap_service.settings.anthropic_api_key", "fake-key")
    monkeypatch.setattr("services.swap_service.anthropic.AsyncAnthropic", lambda **kwargs: mock_client)
    return mock_client


def _activity(**overrides):
    defaults = dict(
        id=1, trip_id=1, name="Hyde Park Walk", type="outdoor",
        time_slot="10:00 - 12:00", location="Hyde Park",
        lat=51.5073, lng=-0.1657,  # Hyde Park's real coordinates
    )
    defaults.update(overrides)
    return Activity(**defaults)


def _trip(**overrides):
    defaults = dict(id=1, user_id=1, name="Test Trip", destination="London")
    defaults.update(overrides)
    return Trip(**defaults)


def test_prompt_excludes_other_planned_activities(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(
        activity, trip, "Heavy rain expected (80% chance)",
        exclude_names=["British Museum", "Tower of London"],
    ))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "British Museum" in prompt
    assert "Tower of London" in prompt
    assert "Do not suggest" in prompt


def test_prompt_omits_exclusion_text_when_nothing_else_planned(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(activity, trip, "Heavy rain expected (80% chance)"))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Do not suggest" not in prompt


def test_prompt_never_excludes_the_activity_being_swapped_itself(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity(name="Hyde Park Walk")
    trip = _trip()

    # exclude_names includes the activity's own (pre-swap) name, as it would
    # when auto_swap_service builds it from the full trip roster
    asyncio.run(swap_service.find_alternative_activity(
        activity, trip, "Heavy rain expected (80% chance)",
        exclude_names=["Hyde Park Walk", "British Museum"],
    ))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "British Museum" in prompt
    assert "Do not suggest" in prompt
    # its own name shouldn't appear in the exclusion clause
    exclusion_clause = prompt.split("already includes: ")[1]
    assert "Hyde Park Walk" not in exclusion_clause


def test_prompt_includes_the_trigger_reason(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(
        activity, trip, "Reduced visibility expected (900m) — the view would be ruined"
    ))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Reduced visibility expected (900m) — the view would be ruined" in prompt


def test_system_prompt_allows_indoor_or_different_outdoor_alternative(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(activity, trip, "Strong winds expected"))

    system_prompt = mock_client.messages.create.call_args.kwargs["system"]
    assert "indoor" in system_prompt
    assert "different outdoor spot" in system_prompt


def test_alternative_request_asks_for_coordinates(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(activity, trip, "Heavy rain expected (80% chance)"))

    system_prompt = mock_client.messages.create.call_args.kwargs["system"]
    assert "latitude" in system_prompt and "longitude" in system_prompt


def test_alternative_request_asks_for_indoor_or_outdoor_matching_its_own_choice(monkeypatch):
    # Regression test: the system prompt already tells Claude it can pick
    # indoor OR a different outdoor spot — but never asked it to report back
    # which one it actually picked, so callers had no way to know without
    # assuming indoor every time (see the frontend bug this was found from).
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_alternative_activity(activity, trip, "Strong winds expected"))

    system_prompt = mock_client.messages.create.call_args.kwargs["system"]
    assert "indoor or outdoor" in system_prompt
    assert "not always indoor" in system_prompt


def test_find_alternative_activity_returns_the_alternates_coordinates(monkeypatch):
    _mock_claude(monkeypatch, alternate={
        "name": "British Museum", "location": "Great Russell St",
        "lat": 51.5194, "lng": -0.1270, "type": "indoor",
    })
    activity = _activity()
    trip = _trip()

    alternate = asyncio.run(
        swap_service.find_alternative_activity(activity, trip, "Heavy rain expected (80% chance)")
    )

    assert alternate["lat"] == 51.5194
    assert alternate["lng"] == -0.1270


def test_apply_swap_moves_the_map_pin_to_the_alternates_coordinates():
    # Regression test: apply_swap used to only touch alternate_name/
    # alternate_location, leaving lat/lng pointing at the original
    # (pre-swap) activity — so the map pin silently showed the wrong
    # location under the new activity's label.
    activity = _activity()  # Hyde Park's real coordinates
    alternate = {
        "name": "British Museum", "location": "Great Russell St",
        "lat": 51.5194, "lng": -0.1270, "type": "indoor",
    }

    asyncio.run(swap_service.apply_swap(AsyncMock(), activity, alternate, "Heavy rain expected"))

    assert (activity.lat, activity.lng) == (51.5194, -0.1270)


def test_apply_swap_updates_the_activity_type_to_match_the_alternative():
    # Regression test: apply_swap never touched `type` at all, so an
    # originally-outdoor activity stayed labeled "outdoor" in the database
    # forever even after being swapped to an indoor venue (or vice versa) —
    # the frontend then had to (wrongly) assume every swap goes indoor.
    activity = _activity(type="outdoor")
    alternate = {
        "name": "British Museum", "location": "Great Russell St",
        "lat": 51.5194, "lng": -0.1270, "type": "indoor",
    }

    asyncio.run(swap_service.apply_swap(AsyncMock(), activity, alternate, "Heavy rain expected"))

    assert activity.type == "indoor"


def test_apply_swap_keeps_type_outdoor_when_the_alternative_is_also_outdoor():
    # A wind/fog/heat/etc. swap can legitimately pick a different outdoor
    # activity instead of forcing indoor — type must reflect that too.
    activity = _activity(type="outdoor")
    alternate = {
        "name": "Regent's Park Walk", "location": "Regent's Park",
        "lat": 51.5313, "lng": -0.1570, "type": "outdoor",
    }

    asyncio.run(swap_service.apply_swap(AsyncMock(), activity, alternate, "Strong winds expected"))

    assert activity.type == "outdoor"
