import json

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.activity import Activity
from models.trip import Trip

MODEL = "claude-haiku-4-5"

ALTERNATE_ACTIVITY_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "location": {"type": "string"},
        "lat": {"type": "number"},
        "lng": {"type": "number"},
        # Matches ITINERARY_SCHEMA's per-activity "type" field/enum in
        # itinerary_service.py — whichever this alternative actually is
        # (Claude may pick indoor or a different outdoor spot, see the
        # system prompt below), not assumed to always be indoor.
        "type": {"type": "string", "enum": ["indoor", "outdoor"]},
    },
    "required": ["name", "location", "lat", "lng", "type"],
    "additionalProperties": False,
}


async def find_alternative_activity(
    activity: Activity, trip: Trip, reason: str, exclude_names: list[str] = ()
) -> dict:
    """Ask Claude for one real alternative to replace a weather-affected activity.

    `reason` is the WeatherRiskRule's trigger message (e.g. "Heavy rain expected
    (80% chance)", "Reduced visibility expected (900m) — the view would be
    ruined"). Rather than always assuming "go indoor" — right for rain, wrong
    for e.g. a foggy viewpoint where a different outdoor spot with no view
    dependency could fit just as well — the reason is passed straight through
    so Claude can judge whether the actual problem is the outdoor setting
    itself (go indoor) or something specific to the original activity (pick a
    different outdoor activity that doesn't have the same vulnerability).

    `exclude_names` should list every other activity already planned elsewhere in
    the trip (including past alternate names from earlier swaps) so Claude doesn't
    suggest something the traveler is already doing on a different day.

    Shares the model/schema/structured-output pattern used by
    itinerary_service.generate_itinerary, just scoped to a single activity.
    Raises on API/config failure — callers running this in a batch job should
    catch per-activity so one failure doesn't abort the whole run.
    """
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    content = (
        f'The activity "{activity.name}" at "{activity.location}" '
        f'(time slot {activity.time_slot}) is affected by this: {reason}. Suggest one '
        f'real alternative nearby in {trip.destination} that avoids this specific '
        f'problem.'
    )
    other_activities = [n for n in exclude_names if n and n != activity.name]
    if other_activities:
        content += (
            f' The rest of this trip already includes: {", ".join(other_activities)}. '
            f'Do not suggest any of those — pick something different.'
        )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=(
            f"You suggest activity alternatives for {trip.destination} travel "
            f"itineraries when a planned activity is affected by weather. Suggest one "
            f"real, well-known venue reasonably close to the original activity's "
            f"location, suitable for the same time slot, that isn't already planned "
            f"elsewhere on the trip. Choose indoor if the problem is weather generally "
            f"(like rain or a thunderstorm) — going inside fixes that regardless of "
            f"activity. Choose a different outdoor spot instead if the problem is "
            f"specific to what the original activity needed (e.g. a view fog would "
            f"ruin, or open-water/height wind would make unsafe) rather than the "
            f"outdoor setting itself — outdoor is fine as long as the new activity "
            f"doesn't have the same specific vulnerability. Also give its real "
            f"approximate latitude and longitude (as decimal degrees, e.g. lat "
            f"51.5194, lng -0.1270 for the British Museum) — use your knowledge of "
            f"the actual location, not a placeholder or the original activity's "
            f"coordinates. Also state whether the venue you suggested is indoor "
            f"or outdoor, matching whichever you actually picked above — not "
            f"always indoor."
        ),
        messages=[{"role": "user", "content": content}],
        output_config={"format": {"type": "json_schema", "schema": ALTERNATE_ACTIVITY_SCHEMA}},
    )
    text = next(block.text for block in response.content if block.type == "text")
    return json.loads(text)


async def apply_swap(db: AsyncSession, activity: Activity, alternate: dict, reason: str) -> None:
    activity.is_swapped = True
    activity.alternate_name = alternate["name"]
    activity.alternate_location = alternate["location"]
    activity.swap_reason = reason
    # The map pin (lat/lng) has no separate pre/post-swap field — it always
    # reflects the activity's current plan, so it must move to the
    # alternative's coordinates here or it silently keeps pointing at the
    # rained-out original instead of the new venue.
    activity.lat = alternate["lat"]
    activity.lng = alternate["lng"]
    # Same reasoning as lat/lng above: `type` reflects the current plan, not
    # the pre-swap original. Claude can pick indoor OR a different outdoor
    # spot (see the system prompt above) — it must not be assumed indoor.
    activity.type = alternate["type"]
    await db.commit()
