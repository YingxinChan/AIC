import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from models.activity import Activity
from models.trip import Trip
from services import swap_service


def _mock_claude(monkeypatch, alternate=None):
    alternate = alternate or {"name": "British Museum", "location": "Great Russell St"}
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

    asyncio.run(swap_service.find_indoor_alternative(
        activity, trip, exclude_names=["British Museum", "Tower of London"]
    ))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "British Museum" in prompt
    assert "Tower of London" in prompt
    assert "Do not suggest" in prompt


def test_prompt_omits_exclusion_text_when_nothing_else_planned(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity()
    trip = _trip()

    asyncio.run(swap_service.find_indoor_alternative(activity, trip))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Do not suggest" not in prompt


def test_prompt_never_excludes_the_activity_being_swapped_itself(monkeypatch):
    mock_client = _mock_claude(monkeypatch)
    activity = _activity(name="Hyde Park Walk")
    trip = _trip()

    # exclude_names includes the activity's own (pre-swap) name, as it would
    # when auto_swap_service builds it from the full trip roster
    asyncio.run(swap_service.find_indoor_alternative(
        activity, trip, exclude_names=["Hyde Park Walk", "British Museum"]
    ))

    prompt = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "British Museum" in prompt
    assert "Do not suggest" in prompt
    # its own name shouldn't appear in the exclusion clause
    exclusion_clause = prompt.split("already includes: ")[1]
    assert "Hyde Park Walk" not in exclusion_clause
