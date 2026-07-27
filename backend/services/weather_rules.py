from datetime import datetime

from services.time_slot import parse_time_slot, hourly_window_is_rainy


class WeatherRiskRule:
    id: str
    # None = "blanket" rule: fires for any outdoor activity on a day it
    # triggers, regardless of the activity itself (matches how rain works —
    # rain is bad for basically any outdoor activity, no need to check what
    # kind it is). A tag name = "targeted" rule: only fires for activities
    # that were tagged with this weather_sensitivity at generation time.
    activity_tag: str | None = None
    # Only used for targeted rules, to phrase a pre-generation prompt nudge
    # ("avoid planning {avoid_phrase} that day") before any activity exists
    # to check tags against.
    avoid_phrase: str | None = None

    def day_triggers(self, forecast_day: dict) -> bool:
        """Pure weather check for this day — does the condition occur at
        all, independent of any specific activity. Used directly for
        pre-generation steering (no activities exist yet), and as the first
        half of evaluate() below."""
        raise NotImplementedError

    def reason(self, forecast_day: dict) -> str:
        """Human-readable trigger reason. Only ever called after
        day_triggers() has already returned True."""
        raise NotImplementedError

    def evaluate(self, forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> str | None:
        """Full check used by the swap job: the day-level condition must be
        occurring, AND — for targeted rules — the specific activity must
        carry the matching tag. Blanket rules (activity_tag is None) never
        look at `activity` at all, same as before targeted rules existed.

        `hourly` is only meaningful to RainRule, which overrides this method
        to refine its own check against the activity's time_slot — every
        other rule inherits this base implementation unchanged and never
        reads `hourly` at all."""
        if not self.day_triggers(forecast_day):
            return None
        if self.activity_tag is not None:
            tags = (activity.weather_sensitivity or "").split(",") if activity else []
            if self.activity_tag not in tags:
                return None
        return self.reason(forecast_day)


class RainRule(WeatherRiskRule):
    id = "rain"
    # 95/96/99 = Thunderstorm codes — folded in here rather than a separate
    # rule, since the outcome (swap outdoor -> indoor) is identical either
    # way; this just closes the gap where a thunderstorm day might not
    # cross the ML model's heavy-rain-volume threshold but is still a real
    # outdoor safety concern (lightning), independent of rainfall amount.
    THUNDERSTORM_CODES = {95, 96, 99}
    # Hourly refinement only applies to the plain heavy-rain case, not
    # thunderstorm (see evaluate() below) — thunderstorm stays a whole-day
    # blanket signal regardless of hourly data.
    HOURLY_RAIN_PROBABILITY_THRESHOLD = 60  # TODO: confirm with team

    def day_triggers(self, forecast_day: dict) -> bool:
        return bool(forecast_day.get("heavy_rain_warning")) or forecast_day.get("weather_code") in self.THUNDERSTORM_CODES

    def reason(self, forecast_day: dict) -> str:
        if forecast_day.get("heavy_rain_warning"):
            return f"Heavy rain expected ({forecast_day['heavy_rain_probability']}% chance)"
        return "Thunderstorm expected"

    def evaluate(self, forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> str | None:
        """Thunderstorm stays a pure daily/blanket signal — never gated by
        hourly data or time_slot, regardless of activity. Heavy rain, when
        hourly data and a parseable activity time_slot are both available,
        only fires if an hour within that specific time_slot is actually
        forecast rainy — a 9am activity on a rainy morning is affected, a
        2pm activity the same day, if the afternoon is clear, is not.

        Falls back to the original whole-day blanket behavior whenever
        hourly refinement isn't possible: no hourly data (fetch failed, or
        this date isn't in the hourly response), or an unparseable
        time_slot. This can only ever narrow which activities get swapped
        relative to the pre-hourly behavior, never miss a genuinely rainy
        day entirely.
        """
        if forecast_day.get("weather_code") in self.THUNDERSTORM_CODES:
            return "Thunderstorm expected"

        if not forecast_day.get("heavy_rain_warning"):
            return None

        if not hourly:
            return self.reason(forecast_day)

        window = parse_time_slot(activity.time_slot) if activity else None
        if window is None:
            return self.reason(forecast_day)

        if hourly_window_is_rainy(hourly, window, self.HOURLY_RAIN_PROBABILITY_THRESHOLD):
            return self.reason(forecast_day)
        return None

    def describe_rainy_window(self, hourly_day: list[dict]) -> str | None:
        """Human-readable description of the rainy hour range within one
        day's hourly entries (e.g. "between 08:00 and 11:00"), or None if no
        hour meets HOURLY_RAIN_PROBABILITY_THRESHOLD. Used by pre-generation
        steering to describe a specific window instead of the whole-day
        blanket sentence — approximates with the earliest/latest qualifying
        hour as a single range rather than describing multiple separate
        rainy periods precisely, same spirit as the temperature sentence's
        "around X°C" approximation elsewhere in this app."""
        rainy_hours = [
            datetime.fromisoformat(entry["time"]).hour
            for entry in hourly_day
            if (entry.get("rain_probability") or 0) >= self.HOURLY_RAIN_PROBABILITY_THRESHOLD
        ]
        if not rainy_hours:
            return None
        start, end = min(rainy_hours), max(rainy_hours)
        return f"between {start:02d}:00 and {min(end + 1, 24):02d}:00"


class FogRule(WeatherRiskRule):
    id = "fog"
    activity_tag = "view_dependent"
    avoid_phrase = "viewpoint or scenic-vista activities"
    VISIBILITY_THRESHOLD_M = 2000  # TODO: confirm with team

    def day_triggers(self, forecast_day: dict) -> bool:
        visibility = forecast_day.get("visibility_m")
        return visibility is not None and visibility < self.VISIBILITY_THRESHOLD_M

    def reason(self, forecast_day: dict) -> str:
        return f"Reduced visibility expected ({int(forecast_day['visibility_m'])}m) — the view would be ruined"


class WindRule(WeatherRiskRule):
    id = "wind"
    activity_tag = "wind_exposed"
    avoid_phrase = "boat tours, cable cars, or other wind-exposed activities"
    STRONG_LEVELS = {"Strong", "Very Strong"}

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("wind_level") in self.STRONG_LEVELS

    def reason(self, forecast_day: dict) -> str:
        return f"{forecast_day['wind_level']} winds expected — unsafe/unpleasant for this activity"


class ExtremeHeatRule(WeatherRiskRule):
    id = "extreme_heat"
    activity_tag = "strenuous_outdoor"
    avoid_phrase = "strenuous outdoor activities (long hikes, extended walking tours)"
    TEMP_MAX_THRESHOLD_C = 35  # TODO: confirm with team

    def day_triggers(self, forecast_day: dict) -> bool:
        temp_max = forecast_day.get("temp_max")
        return temp_max is not None and temp_max >= self.TEMP_MAX_THRESHOLD_C

    def reason(self, forecast_day: dict) -> str:
        return f"Extreme heat expected (around {forecast_day['temp_max']}°C) — unsafe for extended outdoor exertion"


class ExtremeColdRule(WeatherRiskRule):
    id = "extreme_cold"
    activity_tag = "strenuous_outdoor"
    avoid_phrase = "strenuous outdoor activities (long hikes, extended walking tours)"
    TEMP_MIN_THRESHOLD_C = -5  # TODO: confirm with team

    def day_triggers(self, forecast_day: dict) -> bool:
        temp_min = forecast_day.get("temp_min")
        return temp_min is not None and temp_min <= self.TEMP_MIN_THRESHOLD_C

    def reason(self, forecast_day: dict) -> str:
        return f"Extreme cold expected (around {forecast_day['temp_min']}°C) — unsafe for extended outdoor exertion"


class ExtremeUVRule(WeatherRiskRule):
    id = "extreme_uv"
    activity_tag = "strenuous_outdoor"
    avoid_phrase = "extended sun-exposed activities (long hikes, all-day sightseeing)"
    HIGH_LEVELS = {"Very High", "Extreme"}

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("uv_level") in self.HIGH_LEVELS

    def reason(self, forecast_day: dict) -> str:
        return f"{forecast_day['uv_level']} UV expected — unsafe for extended sun exposure"


class BeachSafetyRule(WeatherRiskRule):
    id = "beach_safety"
    activity_tag = "beach"
    avoid_phrase = "beach activities"

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("beach_safety_level") == "Poor"

    def reason(self, forecast_day: dict) -> str:
        return "Poor beach safety conditions expected"


# Add new WeatherRiskRule subclasses here as more weather aspects are
# supported — the orchestrator only reads this list, so adding a rule never
# requires changing orchestrator/task code.
ACTIVE_RULES: list[WeatherRiskRule] = [
    RainRule(),
    FogRule(),
    WindRule(),
    ExtremeHeatRule(),
    ExtremeColdRule(),
    ExtremeUVRule(),
    BeachSafetyRule(),
]
