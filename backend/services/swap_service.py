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
    },
    "required": ["name", "location"],
    "additionalProperties": False,
}


async def find_indoor_alternative(activity: Activity, trip: Trip, exclude_names: list[str] = ()) -> dict:
    """Ask Claude for one real indoor venue to replace a rained-out outdoor activity.

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
        f'The outdoor activity "{activity.name}" at "{activity.location}" '
        f'(time slot {activity.time_slot}) is rained out. Suggest one indoor '
        f'alternative nearby in {trip.destination}.'
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
            f"You suggest indoor activity alternatives for {trip.destination} travel "
            f"itineraries when outdoor plans get rained out. Suggest one real, well-known "
            f"indoor venue reasonably close to the original activity's location, suitable "
            f"for the same time slot, that isn't already planned elsewhere on the trip."
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
    await db.commit()
