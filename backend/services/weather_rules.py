from datetime import date, datetime

from ml.risk_calculator import temp_advice, uv_level, wind_level
from services.time_slot import (
    hourly_window_is_rainy,
    hourly_window_max_temperature,
    hourly_window_max_uv_index,
    hourly_window_max_wind_speed,
    hourly_window_min_temperature,
    hourly_window_min_visibility_km,
    parse_time_slot,
)


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

    def tip(self, forecast_day: dict) -> str:
        """Short traveler-facing advice for a *fixed* activity affected by
        this rule — used instead of reason()+swap when the activity can't
        be substituted (see auto_swap_service.py's fixed-activity tip
        path). Only ever called after day_triggers()/evaluate() has already
        matched. Default falls back to reason() verbatim; override where a
        short concrete tip reads better than the trigger sentence itself."""
        return self.reason(forecast_day)

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
    # Climatology has no continuous-timeline heavy_rain_warning (see
    # climatology_service.py's _summarize_climatology_rows — it's always
    # None there) — rain_chance (% of the last 10 years' days with >=1mm
    # rain around this date) is the closest available substitute for a
    # climatology day, used only by day_triggers()/reason() below (which
    # itinerary_service.py's pre-generation steering calls directly).
    # evaluate() is untouched — auto_swap_service.py never fetches
    # climatology days, so it never sees is_climatology at all.
    # TODO: confirm with team.
    CLIMATOLOGY_RAIN_CHANCE_THRESHOLD = 60

    def day_triggers(self, forecast_day: dict) -> bool:
        if forecast_day.get("is_climatology"):
            rain_chance = forecast_day.get("rain_chance")
            return rain_chance is not None and rain_chance >= self.CLIMATOLOGY_RAIN_CHANCE_THRESHOLD
        return bool(forecast_day.get("heavy_rain_warning")) or forecast_day.get("weather_code") in self.THUNDERSTORM_CODES

    def reason(self, forecast_day: dict) -> str:
        if forecast_day.get("is_climatology"):
            return f"Historically rainy around this time of year ({forecast_day.get('rain_chance')}% of days)"
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

    def tip(self, forecast_day: dict) -> str:
        return "Bring an umbrella and a waterproof layer."


class FogRule(WeatherRiskRule):
    id = "fog"
    activity_tag = "view_dependent"
    avoid_phrase = "viewpoint or scenic-vista activities"
    VISIBILITY_THRESHOLD_KM = 2.0  # TODO: confirm with team

    def day_triggers(self, forecast_day: dict) -> bool:
        visibility = forecast_day.get("visibility_km")
        return visibility is not None and visibility < self.VISIBILITY_THRESHOLD_KM

    def reason(self, forecast_day: dict) -> str:
        return f"Reduced visibility expected ({forecast_day['visibility_km']}km) — the view would be ruined"

    def tip(self, forecast_day: dict) -> str:
        return "Visibility will likely be poor — the view may be disappointing, consider a photo backup plan."


class WindRule(WeatherRiskRule):
    id = "wind"
    activity_tag = "wind_exposed"
    avoid_phrase = "boat tours, cable cars, or other wind-exposed activities"
    STRONG_LEVELS = {"Strong", "Very Strong"}

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("wind_level") in self.STRONG_LEVELS

    def reason(self, forecast_day: dict) -> str:
        return f"{forecast_day['wind_level']} winds expected — unsafe/unpleasant for this activity"

    def tip(self, forecast_day: dict) -> str:
        return "Strong winds expected — dress warmly and hold onto loose belongings."


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

    def tip(self, forecast_day: dict) -> str:
        return temp_advice("Extreme Heat")


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

    def tip(self, forecast_day: dict) -> str:
        return temp_advice("Extreme Cold")


class ExtremeUVRule(WeatherRiskRule):
    id = "extreme_uv"
    activity_tag = "strenuous_outdoor"
    avoid_phrase = "extended sun-exposed activities (long hikes, all-day sightseeing)"
    HIGH_LEVELS = {"Very High", "Extreme"}

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("uv_level") in self.HIGH_LEVELS

    def reason(self, forecast_day: dict) -> str:
        return f"{forecast_day['uv_level']} UV expected — unsafe for extended sun exposure"

    def tip(self, forecast_day: dict) -> str:
        # Static, not threaded through hourly UV data (unlike
        # ml.risk_calculator.uv_advice's "until 3:45 PM" phrasing) — wiring
        # per-hour UV into the auto-swap tip path is disproportionate
        # plumbing for a one-line notification string.
        return "Very high UV expected — wear sunscreen and a hat."


class BeachSafetyRule(WeatherRiskRule):
    id = "beach_safety"
    activity_tag = "beach"
    avoid_phrase = "beach activities"

    def day_triggers(self, forecast_day: dict) -> bool:
        return forecast_day.get("beach_safety_level") == "Poor"

    def reason(self, forecast_day: dict) -> str:
        return "Poor beach safety conditions expected"

    def tip(self, forecast_day: dict) -> str:
        return "Beach conditions may be unsafe for swimming — check local flags/lifeguard signage before going in the water."


# Add new WeatherRiskRule subclasses here as more weather aspects are
# supported — the orchestrator only reads this list, so adding a rule never
# requires changing orchestrator/task code.
#
# NOTE: everything above (WeatherRiskRule, its subclasses, ACTIVE_RULES) is
# used ONLY by itinerary_service.py's pre-generation steering today (day-
# level trigger + avoid_phrase, before any activities exist to score) — see
# generate_itinerary()'s use of ACTIVE_RULES/rule.day_triggers()/
# rule.avoid_phrase, and RainRule.describe_rainy_window(). It is
# deliberately left unchanged; the scoring system below replaces how
# run_auto_swap() decides to swap/advise an *existing* activity, a separate
# question with its own (evidence-based, user-provided) thresholds that
# don't need to match pre-generation steering's simpler day-level checks.
ACTIVE_RULES: list[WeatherRiskRule] = [
    RainRule(),
    FogRule(),
    WindRule(),
    ExtremeHeatRule(),
    ExtremeColdRule(),
    ExtremeUVRule(),
    BeachSafetyRule(),
]


# ---------------------------------------------------------------------------
# Per-metric activity-swap scoring (replaces the old evaluate()/reason()/
# tip() methods above for run_auto_swap()'s actual swap/advisory decision).
#
# Every threshold here reuses an existing forecast field/function — nothing
# below is a new formula. Rain IS part of this scoring system (score_rain()
# below) — its heavy tier reuses RainRule above verbatim (same hourly-
# precision refinement, same 90/100 severity, comfortably clearing
# SWAP_THRESHOLD alone), while moderate/light rain can now stack with other
# moderate risks (e.g. moderate wind + moderate rain — genuinely worse
# together than either alone) the same way any other two moderate scores
# can. Unlike the pre-scoring-engine RainRule path, this is NOT exempt from
# horizon_factor decay below — a heavy-rain forecast still 3+ days out is
# exactly the kind of not-yet-reliable signal decay exists to avoid
# over-committing to, so it now only swaps confidently within the next
# ~2 days and is advisory-only further out, same as every other risk.
#
# Score bands (per metric, 0-100): 0 = fine, ~30-50 = advisory (discomfort,
# not swap-worthy alone — light rain/fog sit lower at 30, everything else's
# advisory tier is 50), ~75-90 = swap-tier on its own. Multiple simultaneous
# non-zero scores combine via `max_score + 0.5 * second_highest_score`
# (score_activity() below) so two moderate (50) risks together reach
# 50 + 0.5*50 = 75, crossing SWAP_THRESHOLD even though neither alone would
# — the advisory tier is deliberately set so two of them stack past it.
# ---------------------------------------------------------------------------

SWAP_THRESHOLD = 70
ADVISORY_THRESHOLD = 40

# Reused by score_rain() below purely for its heavy-tier check (day_triggers
# + evaluate()'s existing hourly time_slot refinement) — not for reason()/
# tip()/id, which _METRIC_REASONS/_METRIC_TIPS/_METRIC_TO_RULE_ID replicate
# separately below so rain's text can vary by severity tier like every
# other metric's does.
_rain_rule = RainRule()


def score_rain(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> float:
    """Blanket (applies to any outdoor activity, like fog_safety above) —
    every outdoor activity gets rained on the same way regardless of what
    it is. Heavy tier reuses RainRule.evaluate() verbatim, including its
    existing hourly time_slot refinement, so a heavy-rain/thunderstorm day
    scores 90 — comfortably >= SWAP_THRESHOLD on its own, same severity
    RainRule always gave it (this score still goes through score_activity()'s
    horizon_factor decay like every other metric, though — see the module
    comment above; 90 is "as certain a signal as rain gets", not "always
    swaps regardless of how far out the day is"). Moderate/light tiers reuse
    flood_risk()'s own rain_today bands (ml/risk_calculator.py) — day-level
    only, no hourly refinement, since hourly data gives per-hour rain_mm,
    not a comparable running total for the activity's window."""
    if _rain_rule.evaluate(forecast_day, activity, hourly=hourly):
        return 90
    rain_mm = forecast_day.get("rain_mm")
    if rain_mm is None:
        return 0
    if rain_mm >= 20:
        return 50
    if rain_mm >= 10:
        return 30
    return 0


def _score_cold_from_temp_min(temp_min: float | None) -> float:
    """temp_min <= -5: Environment Canada-style outdoor-activity discomfort
    guidance (advisory). temp_min <= -10: their stricter "limit/reschedule
    outdoor activity" guidance (swap). Same field ExtremeColdRule already
    uses above — deliberately not feels_like_temp/temperature_level, see
    docs/plan discussion: this metric only ever runs on real-forecast days
    (run_auto_swap()'s window is capped at FORECAST_HORIZON_DAYS), so there's
    no climatology-availability concern, and reusing the raw field avoids
    duplicating temp_level()'s own threshold constants in a second place."""
    if temp_min is None:
        return 0
    if temp_min <= -10:
        return 80
    if temp_min <= -5:
        return 50
    return 0


def _score_heat_from_temp_max(temp_max: float | None) -> float:
    """Mirrors _score_cold_from_temp_min — temp_max >= 30 advisory, >= 35
    swap (the existing ExtremeHeatRule's threshold, now the swap tier with a
    new advisory tier below it)."""
    if temp_max is None:
        return 0
    if temp_max >= 35:
        return 80
    if temp_max >= 30:
        return 50
    return 0


def _score_uv_from_index(uv_index: float | None) -> float:
    """uv_level()'s existing bands (ml/risk_calculator.py: High 6-7, Very
    High 8-10, Extreme 11+) already sit almost exactly on the user's
    researched numeric UV tiers (6/8/11) — reused directly rather than
    re-deriving from the raw uv_index ourselves."""
    if uv_index is None:
        return 0
    level = uv_level(uv_index)
    if level == "Extreme":
        return 90
    if level == "Very High":
        return 80
    if level == "High":
        return 50
    return 0


def _score_wind_from_speed(wind_speed: float | None) -> float:
    """Flat score, at swap-tier alone — restores the existing WindRule's
    behavior (Strong/Very Strong both triggered an immediate swap, no
    advisory tier) now that the scoring engine has replaced it; no new
    tiering within wind. Buckets via wind_level() (same as the day-level
    wind_level field) rather than comparing the raw speed directly, so an
    hourly-refined speed gets scored exactly the same way a day-level one
    would."""
    if wind_speed is None:
        return 0
    return 75 if wind_level(wind_speed) in {"Strong", "Very Strong"} else 0


def score_cold(forecast_day: dict) -> float:
    """Public wrapper around _score_cold_from_temp_min, reading the
    whole-day temp_min — score_activity() below instead calls
    _effective_temp_min()+_score_cold_from_temp_min() directly, so a cold
    activity gets scored against the coldest hour in its own time_slot
    where hourly data allows, not just the day's overall low."""
    return _score_cold_from_temp_min(forecast_day.get("temp_min"))


def score_heat(forecast_day: dict) -> float:
    """Public wrapper around _score_heat_from_temp_max — see score_cold's
    docstring above; score_activity() below refines against the hottest
    hour in the activity's own time_slot the same way."""
    return _score_heat_from_temp_max(forecast_day.get("temp_max"))


def score_uv(forecast_day: dict) -> float:
    """Public wrapper reading the whole-day, already-bucketed uv_level
    field directly (not via _score_uv_from_index, which buckets a raw
    uv_index itself) — score_activity() below instead resolves an
    hourly-refined uv_index and scores that through _score_uv_from_index,
    so a sun-exposed activity is scored against its own time_slot's worst
    UV, not just the day's single uv_level."""
    level = forecast_day.get("uv_level")
    if level == "Extreme":
        return 90
    if level == "Very High":
        return 80
    if level == "High":
        return 50
    return 0


def score_wind(forecast_day: dict) -> float:
    """Public wrapper reading the whole-day, already-bucketed wind_level
    field directly (not via _score_wind_from_speed, which buckets a raw
    speed itself) — score_activity() below instead resolves an
    hourly-refined wind speed and scores that through _score_wind_from_speed,
    so a wind-exposed activity is scored against its own time_slot's worst
    wind, not just the day's single wind_level."""
    return 75 if forecast_day.get("wind_level") in {"Strong", "Very Strong"} else 0


def score_beach(forecast_day: dict) -> float:
    """beach_safety_level's existing bands (ml/risk_calculator.py's
    beach_safety(): Poor <40, Moderate 40-59, Good 60-79, Excellent >=80) —
    Poor already matches the existing BeachSafetyRule's swap trigger;
    Moderate is the new advisory tier."""
    level = forecast_day.get("beach_safety_level")
    if level == "Poor":
        return 90
    if level == "Moderate":
        return 50
    return 0


def _effective_visibility_m(
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
) -> float | None:
    """Worst (lowest) visibility during the activity's own time_slot, when
    hourly data and a parseable time_slot are both available — the same
    refinement RainRule already does for rain (see its evaluate() above),
    applied to visibility instead. Falls back to the whole-day visibility_m
    whenever hourly refinement isn't possible, exactly like RainRule does."""
    daily_visibility_m = forecast_day.get("visibility_m")
    if not hourly or activity is None:
        return daily_visibility_m
    window = parse_time_slot(activity.time_slot)
    if window is None:
        return daily_visibility_m
    hourly_min_km = hourly_window_min_visibility_km(hourly, window)
    if hourly_min_km is None:
        return daily_visibility_m
    return hourly_min_km * 1000


def _effective_wind_speed(
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
) -> float | None:
    """Worst (highest) wind speed during the activity's own time_slot, when
    available — same refinement idea as _effective_visibility_m above,
    applied to wind instead. Falls back to the whole-day wind_speed
    whenever hourly refinement isn't possible."""
    daily_wind_speed = forecast_day.get("wind_speed")
    if not hourly or activity is None:
        return daily_wind_speed
    window = parse_time_slot(activity.time_slot)
    if window is None:
        return daily_wind_speed
    hourly_max = hourly_window_max_wind_speed(hourly, window)
    return hourly_max if hourly_max is not None else daily_wind_speed


def _effective_uv_index(
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
) -> float | None:
    """Worst (highest) UV index during the activity's own time_slot, when
    available — same refinement idea as _effective_visibility_m above,
    applied to UV instead. Falls back to the whole-day uv_index whenever
    hourly refinement isn't possible."""
    daily_uv_index = forecast_day.get("uv_index")
    if not hourly or activity is None:
        return daily_uv_index
    window = parse_time_slot(activity.time_slot)
    if window is None:
        return daily_uv_index
    hourly_max = hourly_window_max_uv_index(hourly, window)
    return hourly_max if hourly_max is not None else daily_uv_index


def _effective_temp_min(
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
) -> float | None:
    """Worst (coldest) temperature during the activity's own time_slot, when
    available — same refinement idea as _effective_visibility_m above,
    applied to cold-risk instead. Falls back to the whole-day temp_min
    whenever hourly refinement isn't possible."""
    daily_temp_min = forecast_day.get("temp_min")
    if not hourly or activity is None:
        return daily_temp_min
    window = parse_time_slot(activity.time_slot)
    if window is None:
        return daily_temp_min
    hourly_min = hourly_window_min_temperature(hourly, window)
    return hourly_min if hourly_min is not None else daily_temp_min


def _effective_temp_max(
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
) -> float | None:
    """Worst (hottest) temperature during the activity's own time_slot, when
    available — same refinement idea as _effective_visibility_m above,
    applied to heat-risk instead. Falls back to the whole-day temp_max
    whenever hourly refinement isn't possible."""
    daily_temp_max = forecast_day.get("temp_max")
    if not hourly or activity is None:
        return daily_temp_max
    window = parse_time_slot(activity.time_slot)
    if window is None:
        return daily_temp_max
    hourly_max = hourly_window_max_temperature(hourly, window)
    return hourly_max if hourly_max is not None else daily_temp_max


def _score_fog_safety_from_visibility(visibility_m: float | None) -> float:
    """Blanket (applies to any outdoor activity, not just view_dependent) —
    dense/severe fog is a real road/travel-safety hazard regardless of what
    the activity actually is, distinct from FogRule's existing scenic-view-
    only check below. Met Office bands: <1000m general fog (advisory),
    <200m dense fog (swap-tier alone, same reasoning as score_wind above —
    a real safety hazard on its own), <50m severe disruption."""
    if visibility_m is None:
        return 0
    if visibility_m < 50:
        return 90
    if visibility_m < 200:
        return 75
    if visibility_m < 1000:
        return 30
    return 0


def _score_fog_scenic_from_visibility(visibility_m: float | None) -> float:
    """Targeted at view_dependent activities specifically — a view can be
    ruined well before fog becomes a general safety hazard, hence the much
    higher visibility thresholds than score_fog_safety above (2km/10km vs
    200m/50m)."""
    if visibility_m is None:
        return 0
    if visibility_m < 2000:
        return 80
    if visibility_m < 10000:
        return 50
    return 0


def score_fog_safety(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> float:
    """Public wrapper around _score_fog_safety_from_visibility — resolves
    the effective (possibly hourly-refined) visibility itself. score_activity()
    below calls _score_fog_safety_from_visibility directly instead, since it
    needs the resolved visibility_m for describe_scores()/describe_tip() too
    and shouldn't resolve it twice."""
    return _score_fog_safety_from_visibility(_effective_visibility_m(forecast_day, activity, hourly))


def score_fog_scenic(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> float:
    """Public wrapper around _score_fog_scenic_from_visibility — see
    score_fog_safety's docstring above; score_activity() below calls
    _score_fog_scenic_from_visibility directly for the same reason."""
    return _score_fog_scenic_from_visibility(_effective_visibility_m(forecast_day, activity, hourly))


# Which metrics apply to which activity — mirrors the existing rules'
# activity_tag gating exactly (heat/cold/UV -> strenuous_outdoor,
# scenic-fog -> view_dependent, wind -> wind_exposed, beach -> beach).
# fog_safety is intentionally absent here — it's blanket, added
# unconditionally in score_activity() below, not gated by any tag.
_TAG_SCORERS = {
    "strenuous_outdoor": ("cold", "heat", "uv"),
    "view_dependent": ("fog_scenic",),
    "wind_exposed": ("wind",),
    "beach": ("beach",),
}

# beach has no hourly refinement (score_activity()'s beach_safety_level
# input isn't available per-hour anywhere in the pipeline — see
# risk_calculator.beach_safety(), which is only ever computed once per day),
# so it's the only tag-gated metric still scored straight off the whole-day
# forecast_day here. cold/heat/uv/wind/fog_scenic are all resolved directly
# in score_activity()'s tag loop instead, via their own _effective_*() +
# _score_*_from_*() pair, so they aren't listed in this dict.
_SCORERS = {
    "beach": score_beach,
}


def _horizon_factor(days_until: int) -> float:
    """Confidence decay for how far out the activity is — the same day's
    forecast is trusted less the further out it is, so a borderline risk far
    in advance shouldn't swap as readily as the identical risk tomorrow."""
    if days_until <= 0:
        return 1.0
    if days_until <= 2:
        return 0.9
    if days_until <= 5:
        return 0.7
    return 0.5


def _combine_scores(scores: dict[str, float]) -> float:
    """max_score + 0.5*second_highest_score, the stacking rule shared by
    score_activity() (combining every currently-applicable metric) and
    should_revert() (recombining the metrics still active after the
    dominant original cause clears) — kept in one place so a revert can't
    silently use different math than the swap decision it's undoing."""
    nonzero = sorted((v for v in scores.values() if v > 0), reverse=True)
    if not nonzero:
        return 0
    return min(nonzero[0] + 0.5 * (nonzero[1] if len(nonzero) > 1 else 0), 100)


def score_activity(
    forecast_day: dict,
    activity,
    hourly: list[dict] | None = None,
    today: date | None = None,
) -> dict:
    """Gather every score whose tag-gate applies to this activity (plus the
    always-on blanket rain/fog-safety checks), combine via
    max + 0.5*second_highest (naturally reduces to just that one score when
    only one metric is non-zero), then apply horizon decay. Returns
    {"scores": {name: score, ...}, "combined": float, "horizon_factor":
    float, "adjusted": float, "effective_values": dict} — `scores` only
    contains metrics that actually applied (its tag matched, or it's
    blanket), not every possible metric. `effective_values` holds whichever
    of visibility_m/wind_speed/uv_index/temp_min/temp_max were actually
    resolved above (hourly-refined against the activity's own time_slot
    where possible, else the whole-day value) — carried through so
    describe_scores()/describe_tip() can quote the same figures that
    triggered each score, not the whole-day forecast, which can look calm
    even when a dip specific to the activity's own time_slot is what
    actually scored it.

    Note: `activity.type` is NOT a reliable "is this fundamentally an
    outdoor activity" signal here — a swapped activity's `type` reflects
    its *current* (alternate) type, which can be "indoor" even though
    weather_sensitivity/scoring still needs to evaluate the *original*
    outdoor activity's conditions (e.g. for should_revert()'s fresh
    re-score). Callers that need an "is this activity genuinely,
    permanently indoor" check (e.g. fixed activities, which are never
    mutated by a swap) must filter on activity.type themselves before
    calling in, rather than this function gating on it internally."""
    effective_visibility_m = _effective_visibility_m(forecast_day, activity, hourly)
    scores: dict[str, float] = {
        "rain": score_rain(forecast_day, activity, hourly),
        "fog_safety": _score_fog_safety_from_visibility(effective_visibility_m),
    }
    effective_values: dict[str, float | None] = {"visibility_m": effective_visibility_m}

    tags = set((activity.weather_sensitivity or "").split(",")) if activity else set()
    for tag, names in _TAG_SCORERS.items():
        if tag not in tags:
            continue
        for name in names:
            if name == "fog_scenic":
                scores[name] = _score_fog_scenic_from_visibility(effective_visibility_m)
            elif name == "wind":
                wind_speed = _effective_wind_speed(forecast_day, activity, hourly)
                effective_values["wind_speed"] = wind_speed
                scores[name] = _score_wind_from_speed(wind_speed)
            elif name == "uv":
                uv_index_value = _effective_uv_index(forecast_day, activity, hourly)
                effective_values["uv_index"] = uv_index_value
                scores[name] = _score_uv_from_index(uv_index_value)
            elif name == "cold":
                temp_min = _effective_temp_min(forecast_day, activity, hourly)
                effective_values["temp_min"] = temp_min
                scores[name] = _score_cold_from_temp_min(temp_min)
            elif name == "heat":
                temp_max = _effective_temp_max(forecast_day, activity, hourly)
                effective_values["temp_max"] = temp_max
                scores[name] = _score_heat_from_temp_max(temp_max)
            else:
                scores[name] = _SCORERS[name](forecast_day)

    combined = _combine_scores(scores)

    today = today or date.today()
    days_until = max(0, (activity.day_date - today).days) if activity else 0
    horizon_factor = _horizon_factor(days_until)

    return {
        "scores": scores,
        "combined": round(combined, 2),
        "horizon_factor": horizon_factor,
        "adjusted": round(combined * horizon_factor, 2),
        "effective_values": effective_values,
    }


def _rain_reason_text(fd: dict) -> str:
    """Heavy tier reuses RainRule.reason() verbatim (same day_triggers()
    condition — heavy_rain_warning or thunderstorm — that score_rain()'s
    heavy tier fires on). Moderate/light phrase around the same rain_mm
    used to pick those tiers in score_rain()."""
    if _rain_rule.day_triggers(fd):
        return _rain_rule.reason(fd)
    rain_mm = fd.get("rain_mm") or 0
    if rain_mm >= 20:
        return f"Moderate rain expected ({rain_mm}mm) — outdoor plans may get wet"
    return f"Light rain expected ({rain_mm}mm) — pack a rain jacket just in case"


_METRIC_REASONS = {
    "rain": _rain_reason_text,
    "cold": lambda fd: f"Extreme cold expected (around {fd.get('temp_min')}°C) — unsafe for extended outdoor exertion",
    "heat": lambda fd: f"Extreme heat expected (around {fd.get('temp_max')}°C) — unsafe for extended outdoor exertion",
    "uv": lambda fd: f"{fd.get('uv_level')} UV expected — unsafe for extended sun exposure",
    "wind": lambda fd: f"{fd.get('wind_level')} winds expected — unsafe/unpleasant for this activity",
    "beach": lambda fd: "Poor beach safety conditions expected" if fd.get("beach_safety_level") == "Poor" else "Beach safety conditions less than ideal",
    "fog_safety": lambda fd: f"Reduced visibility expected ({fd.get('visibility_km')}km) — reduced safety for outdoor activity",
    "fog_scenic": lambda fd: f"Reduced visibility expected ({fd.get('visibility_km')}km) — the view would be ruined",
}

_METRIC_TIPS = {
    "rain": lambda fd: _rain_rule.tip(fd),
    "cold": lambda fd: temp_advice("Extreme Cold"),
    "heat": lambda fd: temp_advice("Extreme Heat"),
    "uv": lambda fd: "High UV expected — wear sunscreen and a hat.",
    "wind": lambda fd: "Strong winds expected — dress warmly and hold onto loose belongings.",
    "beach": lambda fd: "Beach conditions may be less safe for swimming — check local flags/lifeguard signage before going in the water.",
    "fog_safety": lambda fd: "Visibility will likely be poor — take extra care and allow more travel time.",
    "fog_scenic": lambda fd: "Visibility will likely be poor — the view may be disappointing, consider a photo backup plan.",
}


def _contributing_metrics(scores: dict[str, float]) -> list[tuple[str, float]]:
    return sorted(
        ((name, score) for name, score in scores.items() if score > 0),
        key=lambda pair: pair[1],
        reverse=True,
    )


def _forecast_day_for_display(forecast_day: dict, effective_values: dict | None) -> dict:
    """The _METRIC_REASONS/_METRIC_TIPS text above reads visibility_km,
    wind_level, uv_level, temp_min, and temp_max off forecast_day — but
    score_activity() may have scored some of these using a worse,
    hourly-refined value specific to the activity's own time_slot (see the
    _effective_*() functions above), not the whole-day figure. Without
    this, a swap triggered by e.g. a 30m fog dip or a gusty hour during the
    activity's own slot could quote the calm whole-day number instead of
    what actually triggered it. Overriding each field here keeps the
    displayed figure consistent with the score that actually fired."""
    if not effective_values:
        return forecast_day
    overrides: dict = {}
    visibility_m = effective_values.get("visibility_m")
    if visibility_m is not None:
        overrides["visibility_km"] = round(visibility_m / 1000, 2)
    wind_speed = effective_values.get("wind_speed")
    if wind_speed is not None:
        overrides["wind_level"] = wind_level(wind_speed)
    uv_index_value = effective_values.get("uv_index")
    if uv_index_value is not None:
        overrides["uv_level"] = uv_level(uv_index_value)
    temp_min = effective_values.get("temp_min")
    if temp_min is not None:
        overrides["temp_min"] = temp_min
    temp_max = effective_values.get("temp_max")
    if temp_max is not None:
        overrides["temp_max"] = temp_max
    return {**forecast_day, **overrides}


def describe_scores(
    forecast_day: dict,
    scores: dict[str, float],
    effective_values: dict | None = None,
) -> str:
    """Human-readable summary of every metric that actually contributed,
    worst first — used for swap_reason/notification emails. A stacked swap
    (two moderate metrics combining) names both, so the notification
    reflects the real compound cause rather than hiding it behind whichever
    happened to score highest."""
    contributing = _contributing_metrics(scores)
    if not contributing:
        return "Weather conditions flagged for this activity"
    display_day = _forecast_day_for_display(forecast_day, effective_values)
    return "; ".join(_METRIC_REASONS[name](display_day) for name, _ in contributing)


def describe_tip(
    forecast_day: dict,
    scores: dict[str, float],
    effective_values: dict | None = None,
) -> str:
    """Short traveler-facing advice for a *fixed* activity (or an advisory-
    tier, non-fixed activity) — just the single worst contributor, same
    one-line spirit as the old rule.tip() methods above."""
    contributing = _contributing_metrics(scores)
    if not contributing:
        return "Check the forecast before heading out."
    top_name, _ = contributing[0]
    display_day = _forecast_day_for_display(forecast_day, effective_values)
    return _METRIC_TIPS[top_name](display_day)


# Maps the new scoring metric names onto email_templates.py's existing
# RULE_ICONS keys (which still match the old rule ids: "extreme_cold" etc.)
# so swap/tip notification emails keep picking a sensible icon — not
# strictly needed (RULE_ICONS.get() already falls back gracefully), just
# nicer than every new-scoring swap defaulting to the rain icon.
_METRIC_TO_RULE_ID = {
    "rain": "rain",
    "cold": "extreme_cold",
    "heat": "extreme_heat",
    "uv": "extreme_uv",
    "wind": "wind",
    "beach": "beach_safety",
    "fog_safety": "fog",
    "fog_scenic": "fog",
}


def top_rule_id(scores: dict[str, float]) -> str | None:
    """The single worst-contributing metric's email-icon key, or None if
    nothing contributed (shouldn't happen for a swap/tip that fired at
    all, but kept total rather than assuming)."""
    contributing = _contributing_metrics(scores)
    if not contributing:
        return None
    top_name, _ = contributing[0]
    return _METRIC_TO_RULE_ID.get(top_name)


# ---------------------------------------------------------------------------
# Revert thresholds — one "good" check per metric name that can appear in
# Activity.swap_score_trace["scores"], used by should_revert() below (via
# auto_swap_service.py) to decide whether a previously-swapped activity's
# dominant triggering metric has recovered. Deliberately stricter than the
# inverse of the swap tier above (see good_cold/good_heat below) — e.g.
# heat's revert bar is temp_max < 30, not <= 30, since 30 itself still
# scores 50 (advisory). Each check resolves the same hourly-refined
# effective value score_activity() itself would use (via the _effective_*()
# helpers above), not the raw whole-day forecast_day field, so a revert
# decision is checked against the exact same figure the original swap
# decision would be re-run against. should_revert() additionally re-runs
# score_activity() fresh to make sure no OTHER metric — including one that
# had nothing to do with the original swap — has independently become
# strong enough to justify a swap on its own in the meantime.
# ---------------------------------------------------------------------------

def good_rain(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    """Clear of score_rain()'s heavy tier (RainRule no longer fires) AND
    below its light tier (rain_mm < 10) — anything at or above the light
    tier is still a nonzero rain score, not "good"."""
    if _rain_rule.evaluate(forecast_day, activity, hourly=hourly):
        return False
    rain_mm = forecast_day.get("rain_mm")
    return rain_mm is not None and rain_mm < 10


def good_cold(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    """Strictly above _score_cold_from_temp_min's own advisory floor (-5) —
    at exactly -5 it still scores 50 (advisory), so this can't be >=."""
    temp_min = _effective_temp_min(forecast_day, activity, hourly)
    return temp_min is not None and temp_min > -5


def good_heat(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    """Strictly below _score_heat_from_temp_max's own advisory floor (30) —
    at exactly 30 it still scores 50 (advisory), so this can't be <=."""
    temp_max = _effective_temp_max(forecast_day, activity, hourly)
    return temp_max is not None and temp_max < 30


def good_uv(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    uv_index_value = _effective_uv_index(forecast_day, activity, hourly)
    if uv_index_value is None:
        return False
    return uv_level(uv_index_value) not in {"High", "Very High", "Extreme"}


def good_wind(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    wind_speed = _effective_wind_speed(forecast_day, activity, hourly)
    if wind_speed is None:
        return False
    return wind_level(wind_speed) not in {"Strong", "Very Strong"}


def good_beach(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    """No hourly refinement — mirrors score_beach itself, which reads
    beach_safety_level straight off forecast_day (see _SCORERS above)."""
    return forecast_day.get("beach_safety_level") in {"Good", "Excellent"}


def good_fog_safety(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    visibility_m = _effective_visibility_m(forecast_day, activity, hourly)
    return visibility_m is not None and visibility_m >= 1000


def good_fog_scenic(forecast_day: dict, activity=None, hourly: list[dict] | None = None) -> bool:
    visibility_m = _effective_visibility_m(forecast_day, activity, hourly)
    return visibility_m is not None and visibility_m >= 10000


_GOOD_CHECKS = {
    "rain": good_rain,
    "cold": good_cold,
    "heat": good_heat,
    "uv": good_uv,
    "wind": good_wind,
    "beach": good_beach,
    "fog_safety": good_fog_safety,
    "fog_scenic": good_fog_scenic,
}


def should_revert(
    scores_at_swap: dict[str, float] | None,
    forecast_day: dict,
    activity=None,
    hourly: list[dict] | None = None,
    today: date | None = None,
) -> dict | None:
    """Non-None when the swap's dominant (worst-scoring) original cause is
    independently good again AND the OTHER currently-applicable metrics —
    including ones that had nothing to do with the original swap — don't
    still combine (via the same max + 0.5*second_highest stacking rule
    score_activity() itself uses) to a score that's even tip-worthy.
    Compared against ADVISORY_THRESHOLD, not SWAP_THRESHOLD: the tip check
    elsewhere (run_auto_swap) fires on the full combined score reaching
    ADVISORY_THRESHOLD, decayed by horizon_factor (<=1.0) — so a remaining
    score anywhere in [ADVISORY_THRESHOLD, SWAP_THRESHOLD) would pass a
    SWAP_THRESHOLD check here but is still guaranteed to be at or near
    tip-worthy on the very next evaluation, reverting this activity
    straight into an immediate "weather tips" email for itself. Comparing
    against ADVISORY_THRESHOLD closes that gap. Deliberately compares the
    raw combined score, NOT horizon-decayed — this is a "how dangerous is
    it right now" check, not a "how confident are we, this far out" check
    (that's what horizon_factor is for on the original swap decision);
    discounting a currently-severe remaining risk just because the activity
    is a few days out would be exactly backwards for deciding whether it's
    safe to revert today. Since horizon_factor can only ever shrink a score
    (<=1.0), a raw remaining score already below ADVISORY_THRESHOLD stays
    below it once decayed, so this fully prevents the immediate-tip case.

    Recombining (not just re-checking each one individually) matters
    because the stacking rule is exactly what could have gotten this
    activity swapped in the first place: two metrics that were each merely
    advisory at swap time (e.g. heat 50 + UV 50) reach 50 + 0.5*50 = 75,
    over SWAP_THRESHOLD, even though neither alone would. Checking each
    remaining metric only against a threshold in isolation — as if stacking
    didn't exist — would let a revert walk this activity straight into a
    combined risk that's swap-worthy right now, just for a different reason
    than the one it was originally swapped for. Metrics don't change which
    apply to an activity over its lifetime (they're gated by the static
    weather_sensitivity tag), but their SCORES do as the forecast updates —
    a metric that was fine at swap time (score 0, so absent from
    _contributing_metrics below) can have turned dangerous by the time
    revert is checked, which is also why score_activity() is re-run fresh
    here rather than only re-checking the frozen swap-time trace.

    An unknown dominant metric name or an empty contributing set is treated
    conservatively as "not recovered" — never guess a revert.

    Returns None when it should not revert. Returns
    {"dominant_metric": str, "score_trace": dict} when it should — the
    caller persists `score_trace` (this function's own fresh
    score_activity() result, otherwise discarded) as Activity.revert_score,
    and derives a human-readable revert reason from `dominant_metric`."""
    contributing = _contributing_metrics(scores_at_swap or {})
    if not contributing:
        return None
    dominant_metric, _ = contributing[0]

    good_check = _GOOD_CHECKS.get(dominant_metric)
    if good_check is None or not good_check(forecast_day, activity, hourly):
        return None

    fresh = score_activity(forecast_day, activity, hourly, today=today)
    remaining_scores = {
        name: score for name, score in fresh["scores"].items() if name != dominant_metric
    }
    if _combine_scores(remaining_scores) >= ADVISORY_THRESHOLD:
        return None
    return {"dominant_metric": dominant_metric, "score_trace": fresh}
