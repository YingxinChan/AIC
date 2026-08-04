from datetime import date, timedelta

from models.activity import Activity
from services.weather_rules import (
    ACTIVE_RULES,
    ADVISORY_THRESHOLD,
    RainRule,
    FogRule,
    WindRule,
    ExtremeHeatRule,
    ExtremeColdRule,
    ExtremeUVRule,
    BeachSafetyRule,
    SWAP_THRESHOLD,
    describe_scores,
    describe_tip,
    score_activity,
    score_beach,
    score_cold,
    score_fog_safety,
    score_fog_scenic,
    score_heat,
    score_uv,
    score_wind,
    top_rule_id,
)


def _activity(weather_sensitivity="", time_slot="10:00 - 12:00"):
    return Activity(
        trip_id=1, day_date=None, name="Test Activity", type="outdoor",
        time_slot=time_slot, location="Somewhere", weather_sensitivity=weather_sensitivity,
    )


_RAINY_MORNING_DAY = {"heavy_rain_warning": True, "heavy_rain_probability": 80.0}
_RAINY_MORNING_HOURLY = [
    {"time": "2026-08-01T08:00", "rain_probability": 20},
    {"time": "2026-08-01T09:00", "rain_probability": 85},
    {"time": "2026-08-01T10:00", "rain_probability": 90},
    {"time": "2026-08-01T11:00", "rain_probability": 70},
    {"time": "2026-08-01T14:00", "rain_probability": 5},
    {"time": "2026-08-01T15:00", "rain_probability": 10},
]


def test_rain_rule_fires_on_warning():
    rule = RainRule()
    reason = rule.evaluate({"heavy_rain_warning": True, "heavy_rain_probability": 72.5})
    assert reason is not None
    assert "72.5" in reason


def test_rain_rule_does_not_fire_without_warning():
    rule = RainRule()
    assert rule.evaluate({"heavy_rain_warning": False, "heavy_rain_probability": 10.0}) is None


def test_rain_rule_fires_on_thunderstorm_code_even_without_heavy_rain_warning():
    rule = RainRule()
    reason = rule.evaluate({"heavy_rain_warning": False, "heavy_rain_probability": 10.0, "weather_code": 95})
    assert reason == "Thunderstorm expected"


def test_rain_rule_hourly_fires_for_activity_overlapping_a_rainy_hour():
    rule = RainRule()
    morning_activity = _activity(time_slot="09:00 - 11:00")
    reason = rule.evaluate(_RAINY_MORNING_DAY, morning_activity, hourly=_RAINY_MORNING_HOURLY)
    assert reason is not None
    assert "80.0" in reason


def test_rain_rule_hourly_does_not_fire_for_activity_in_the_clear_afternoon():
    """The core new behavior: same rainy day, but an activity scheduled in
    hours that are actually clear should NOT be swapped, even though the
    day-level heavy_rain_warning is True."""
    rule = RainRule()
    afternoon_activity = _activity(time_slot="14:00 - 16:00")
    assert rule.evaluate(_RAINY_MORNING_DAY, afternoon_activity, hourly=_RAINY_MORNING_HOURLY) is None


def test_rain_rule_hourly_falls_back_to_blanket_when_time_slot_unparseable():
    rule = RainRule()
    activity = _activity(time_slot="Flexible")
    reason = rule.evaluate(_RAINY_MORNING_DAY, activity, hourly=_RAINY_MORNING_HOURLY)
    assert reason is not None


def test_rain_rule_falls_back_to_blanket_when_hourly_is_none():
    rule = RainRule()
    afternoon_activity = _activity(time_slot="14:00 - 16:00")
    # No hourly data at all -> same as today's pre-hourly behavior: fires
    # for any outdoor activity on a day-level rainy warning, afternoon or not.
    reason = rule.evaluate(_RAINY_MORNING_DAY, afternoon_activity, hourly=None)
    assert reason is not None


def test_rain_rule_falls_back_to_blanket_when_hourly_is_empty_list():
    rule = RainRule()
    afternoon_activity = _activity(time_slot="14:00 - 16:00")
    reason = rule.evaluate(_RAINY_MORNING_DAY, afternoon_activity, hourly=[])
    assert reason is not None


def test_rain_rule_thunderstorm_stays_blanket_regardless_of_hourly_data():
    """Thunderstorm is a whole-day safety signal — hourly data showing all
    hours clear must not suppress it, unlike the plain heavy-rain case."""
    rule = RainRule()
    all_clear_hourly = [{"time": "2026-08-01T09:00", "rain_probability": 0}]
    thunderstorm_day = {"heavy_rain_warning": False, "weather_code": 95}
    afternoon_activity = _activity(time_slot="14:00 - 16:00")
    reason = rule.evaluate(thunderstorm_day, afternoon_activity, hourly=all_clear_hourly)
    assert reason == "Thunderstorm expected"


def test_rain_rule_describe_rainy_window_reports_earliest_to_latest_rainy_hour():
    rule = RainRule()
    assert rule.describe_rainy_window(_RAINY_MORNING_HOURLY) == "between 09:00 and 12:00"


def test_rain_rule_describe_rainy_window_none_when_no_hour_meets_threshold():
    rule = RainRule()
    all_clear_hourly = [{"time": "2026-08-01T09:00", "rain_probability": 10}]
    assert rule.describe_rainy_window(all_clear_hourly) is None


def test_rain_rule_is_blanket_ignores_activity_tags():
    rule = RainRule()
    untagged = _activity(weather_sensitivity="")
    tagged = _activity(weather_sensitivity="beach")
    day = {"heavy_rain_warning": True, "heavy_rain_probability": 72.5}
    assert rule.evaluate(day, untagged) is not None
    assert rule.evaluate(day, tagged) is not None


def test_active_rules_includes_rain_rule():
    assert any(isinstance(rule, RainRule) for rule in ACTIVE_RULES)


def test_fog_rule_only_fires_for_view_dependent_activities():
    rule = FogRule()
    day = {"visibility_km": 0.9}
    assert rule.evaluate(day, _activity("view_dependent")) is not None
    assert rule.evaluate(day, _activity("wind_exposed")) is None
    assert rule.evaluate(day, _activity("")) is None


def test_fog_rule_does_not_fire_above_threshold():
    rule = FogRule()
    day = {"visibility_km": 5.0}
    assert rule.evaluate(day, _activity("view_dependent")) is None


def test_fog_rule_day_triggers_ignores_activity_entirely():
    rule = FogRule()
    assert rule.day_triggers({"visibility_km": 0.9}) is True
    assert rule.day_triggers({"visibility_km": 5.0}) is False
    assert rule.day_triggers({"visibility_km": None}) is False


def test_wind_rule_only_fires_for_wind_exposed_activities_on_strong_wind():
    rule = WindRule()
    assert rule.evaluate({"wind_level": "Strong"}, _activity("wind_exposed")) is not None
    assert rule.evaluate({"wind_level": "Very Strong"}, _activity("wind_exposed")) is not None
    assert rule.evaluate({"wind_level": "Moderate"}, _activity("wind_exposed")) is None
    assert rule.evaluate({"wind_level": "Strong"}, _activity("view_dependent")) is None


def test_extreme_heat_rule_only_fires_for_strenuous_outdoor_above_threshold():
    rule = ExtremeHeatRule()
    assert rule.evaluate({"temp_max": 36}, _activity("strenuous_outdoor")) is not None
    assert rule.evaluate({"temp_max": 30}, _activity("strenuous_outdoor")) is None
    assert rule.evaluate({"temp_max": 36}, _activity("beach")) is None


def test_extreme_cold_rule_only_fires_for_strenuous_outdoor_below_threshold():
    rule = ExtremeColdRule()
    assert rule.evaluate({"temp_min": -10}, _activity("strenuous_outdoor")) is not None
    assert rule.evaluate({"temp_min": 2}, _activity("strenuous_outdoor")) is None


def test_extreme_uv_rule_only_fires_for_strenuous_outdoor_on_high_uv():
    rule = ExtremeUVRule()
    assert rule.evaluate({"uv_level": "Extreme"}, _activity("strenuous_outdoor")) is not None
    assert rule.evaluate({"uv_level": "Very High"}, _activity("strenuous_outdoor")) is not None
    assert rule.evaluate({"uv_level": "Moderate"}, _activity("strenuous_outdoor")) is None


def test_beach_safety_rule_only_fires_for_beach_activities_when_poor():
    rule = BeachSafetyRule()
    assert rule.evaluate({"beach_safety_level": "Poor"}, _activity("beach")) is not None
    assert rule.evaluate({"beach_safety_level": "Good"}, _activity("beach")) is None
    assert rule.evaluate({"beach_safety_level": "Poor"}, _activity("view_dependent")) is None


def test_targeted_rule_fires_for_activity_with_multiple_tags():
    """An activity can carry more than one tag — a rule should still fire
    off just its own matching tag being present among others."""
    rule = FogRule()
    activity = _activity("strenuous_outdoor,view_dependent")
    assert rule.evaluate({"visibility_km": 0.9}, activity) is not None


def test_active_rules_includes_all_expected_rule_types():
    rule_types = {type(rule) for rule in ACTIVE_RULES}
    assert rule_types == {
        RainRule, FogRule, WindRule, ExtremeHeatRule, ExtremeColdRule, ExtremeUVRule, BeachSafetyRule,
    }


# tip() — used instead of a swap for a "fixed" activity that can't be
# substituted; each rule should give a short, non-empty, concrete tip.
def test_rain_rule_tip_mentions_umbrella():
    assert "umbrella" in RainRule().tip({"heavy_rain_warning": True, "heavy_rain_probability": 72.5}).lower()


def test_fog_rule_tip_mentions_view():
    assert "view" in FogRule().tip({"visibility_km": 0.9}).lower()


def test_wind_rule_tip_mentions_wind():
    assert "wind" in WindRule().tip({"wind_level": "Strong"}).lower()


def test_extreme_heat_rule_tip_reuses_temp_advice():
    from ml.risk_calculator import temp_advice
    assert ExtremeHeatRule().tip({"temp_max": 36}) == temp_advice("Extreme Heat")


def test_extreme_cold_rule_tip_reuses_temp_advice():
    from ml.risk_calculator import temp_advice
    assert ExtremeColdRule().tip({"temp_min": -10}) == temp_advice("Extreme Cold")


def test_extreme_uv_rule_tip_mentions_sunscreen():
    assert "sunscreen" in ExtremeUVRule().tip({"uv_level": "Extreme"}).lower()


def test_beach_safety_rule_tip_mentions_swimming():
    assert "swim" in BeachSafetyRule().tip({"beach_safety_level": "Poor"}).lower()


def test_default_tip_falls_back_to_reason():
    # WindRule doesn't need this (it overrides tip()), but the base-class
    # fallback itself is worth a direct test independent of any subclass.
    class _NoTipOverride(WindRule):
        def tip(self, forecast_day):
            return super(WindRule, self).tip(forecast_day)  # calls the base class's tip()

    rule = _NoTipOverride()
    day = {"wind_level": "Strong"}
    assert rule.tip(day) == rule.reason(day)


# ---------------------------------------------------------------------------
# New scoring engine (score_cold/heat/uv/wind/beach/fog_*, score_activity) —
# replaces the class-based rules above for run_auto_swap()'s actual
# swap/advisory decision. The classes above stay in active use for
# itinerary_service.py's pre-generation steering, unrelated to this.
# ---------------------------------------------------------------------------

def test_score_cold_boundaries():
    assert score_cold({"temp_min": -4.9}) == 0
    assert score_cold({"temp_min": -5}) == 50
    assert score_cold({"temp_min": -9.9}) == 50
    assert score_cold({"temp_min": -10}) == 80
    assert score_cold({"temp_min": -10.1}) == 80
    assert score_cold({"temp_min": None}) == 0
    assert score_cold({}) == 0


def test_score_heat_boundaries():
    assert score_heat({"temp_max": 29.9}) == 0
    assert score_heat({"temp_max": 30}) == 50
    assert score_heat({"temp_max": 34.9}) == 50
    assert score_heat({"temp_max": 35}) == 80
    assert score_heat({"temp_max": None}) == 0


def test_score_uv_bands():
    assert score_uv({"uv_level": "Low"}) == 0
    assert score_uv({"uv_level": "Moderate"}) == 0
    assert score_uv({"uv_level": "High"}) == 50
    assert score_uv({"uv_level": "Very High"}) == 80
    assert score_uv({"uv_level": "Extreme"}) == 90
    assert score_uv({"uv_level": "Unknown"}) == 0
    assert score_uv({}) == 0


def test_score_wind_is_flat_matching_existing_wind_rule():
    assert score_wind({"wind_level": "Calm"}) == 0
    assert score_wind({"wind_level": "Moderate"}) == 0
    assert score_wind({"wind_level": "Strong"}) == 75
    assert score_wind({"wind_level": "Very Strong"}) == 75


def test_score_beach_bands():
    assert score_beach({"beach_safety_level": "Excellent"}) == 0
    assert score_beach({"beach_safety_level": "Good"}) == 0
    assert score_beach({"beach_safety_level": "Moderate"}) == 50
    assert score_beach({"beach_safety_level": "Poor"}) == 90


def test_score_fog_safety_boundaries_use_meters_not_km():
    assert score_fog_safety({"visibility_m": 1000}) == 0
    assert score_fog_safety({"visibility_m": 999}) == 30
    assert score_fog_safety({"visibility_m": 200}) == 30
    assert score_fog_safety({"visibility_m": 199}) == 75
    assert score_fog_safety({"visibility_m": 50}) == 75
    assert score_fog_safety({"visibility_m": 49}) == 90
    assert score_fog_safety({"visibility_m": None}) == 0


def test_score_fog_scenic_boundaries_are_looser_than_fog_safety():
    assert score_fog_scenic({"visibility_m": 10000}) == 0
    assert score_fog_scenic({"visibility_m": 9999}) == 50
    assert score_fog_scenic({"visibility_m": 2000}) == 50
    assert score_fog_scenic({"visibility_m": 1999}) == 80
    assert score_fog_scenic({"visibility_m": None}) == 0


def test_score_fog_safety_and_scenic_use_the_activitys_own_hourly_window():
    """Same hourly-refinement idea as RainRule — worst visibility within
    the activity's own time_slot, not just the whole-day value."""
    hourly = [
        {"time": "2026-08-01T09:00", "visibility_km": 10.0},
        {"time": "2026-08-01T10:00", "visibility_km": 0.03},  # 30m — severe fog
        {"time": "2026-08-01T14:00", "visibility_km": 10.0},
    ]
    morning_activity = _activity(time_slot="09:00 - 11:00")
    afternoon_activity = _activity(time_slot="14:00 - 16:00")
    day = {"visibility_m": 10000}  # whole-day value looks clear

    assert score_fog_safety(day, morning_activity, hourly) == 90  # catches the 30m dip
    assert score_fog_safety(day, afternoon_activity, hourly) == 0  # afternoon really is clear


def test_score_activity_single_metric_reduces_to_just_that_score():
    activity = Activity(
        trip_id=1, day_date=date.today(), name="Kayaking", type="outdoor",
        time_slot="10:00 - 12:00", weather_sensitivity="wind_exposed",
    )
    result = score_activity(
        {"wind_level": "Strong", "wind_speed": 25, "visibility_m": 10000}, activity, today=date.today()
    )
    assert result["scores"]["wind"] == 75
    assert result["combined"] == 75.0
    assert result["adjusted"] == 75.0


def test_score_activity_stacks_two_moderate_scores_across_swap_threshold():
    """Neither extreme cold (50, the -5..-10 advisory tier) nor Moderate
    beach safety (50) alone reaches SWAP_THRESHOLD (70), but combined via
    max + 0.5*second_highest they do: 50 + 0.5*50 = 75. (Wind used to be
    this test's example, but wind is now swap-tier alone at 75 — see
    score_wind — so it no longer demonstrates two moderates stacking.)"""
    activity = Activity(
        trip_id=1, day_date=date.today(), name="Beach walk", type="outdoor",
        time_slot="10:00 - 12:00", weather_sensitivity="strenuous_outdoor,beach",
    )
    forecast_day = {"temp_min": -7, "beach_safety_level": "Moderate", "visibility_m": 10000}
    result = score_activity(forecast_day, activity, today=date.today())
    assert result["scores"]["cold"] == 50
    assert result["scores"]["beach"] == 50
    assert result["combined"] == 75.0
    assert result["adjusted"] >= SWAP_THRESHOLD


def test_score_activity_untagged_activity_only_gets_blanket_fog_safety():
    activity = Activity(
        trip_id=1, day_date=date.today(), name="Walking tour", type="outdoor",
        time_slot="10:00 - 12:00", weather_sensitivity="",
    )
    forecast_day = {"wind_level": "Strong", "beach_safety_level": "Poor", "temp_max": 40, "visibility_m": 10000}
    result = score_activity(forecast_day, activity, today=date.today())
    # wind/beach/heat all score high on this forecast, but none apply without
    # the matching tag — only the always-on blanket fog-safety check runs.
    assert result["scores"] == {"fog_safety": 0}
    assert result["combined"] == 0
    assert result["adjusted"] == 0


def test_score_activity_horizon_decay_matches_each_band():
    activity_tags = "wind_exposed"
    forecast_day = {"wind_level": "Strong", "wind_speed": 25, "visibility_m": 10000}
    today = date.today()

    for days_out, expected_factor in [(0, 1.0), (1, 0.9), (2, 0.9), (3, 0.7), (5, 0.7), (6, 0.5), (14, 0.5)]:
        activity = Activity(
            trip_id=1, day_date=today + timedelta(days=days_out), name="Kayaking",
            type="outdoor", time_slot="10:00 - 12:00", weather_sensitivity=activity_tags,
        )
        result = score_activity(forecast_day, activity, today=today)
        assert result["horizon_factor"] == expected_factor, f"days_out={days_out}"
        assert result["adjusted"] == 75.0 * expected_factor


def test_score_activity_wind_uses_the_activitys_own_hourly_window():
    """Same hourly-refinement idea as fog — worst (highest) wind_speed
    within the activity's own time_slot, not just the whole-day value."""
    hourly = [
        {"time": "2026-08-01T09:00", "wind_speed": 5},
        {"time": "2026-08-01T10:00", "wind_speed": 45},  # Very Strong gust
        {"time": "2026-08-01T14:00", "wind_speed": 5},
    ]
    day = {"wind_level": "Calm", "wind_speed": 5, "visibility_m": 10000}  # whole-day looks calm
    morning_activity = Activity(
        trip_id=1, day_date=date.today(), name="Sailing", type="outdoor",
        time_slot="09:00 - 11:00", weather_sensitivity="wind_exposed",
    )
    afternoon_activity = Activity(
        trip_id=1, day_date=date.today(), name="Sailing", type="outdoor",
        time_slot="14:00 - 16:00", weather_sensitivity="wind_exposed",
    )

    morning = score_activity(day, morning_activity, hourly=hourly, today=date.today())
    afternoon = score_activity(day, afternoon_activity, hourly=hourly, today=date.today())

    assert morning["scores"]["wind"] == 75  # catches the 45 km/h gust -> Very Strong
    assert afternoon["scores"]["wind"] == 0  # afternoon really is calm


def test_score_activity_uv_uses_the_activitys_own_hourly_window():
    """Same hourly-refinement idea as fog — worst (highest) uv_index within
    the activity's own time_slot, not just the whole-day value."""
    hourly = [
        {"time": "2026-08-01T09:00", "uv_index": 2},
        {"time": "2026-08-01T12:00", "uv_index": 9},  # Very High midday UV
        {"time": "2026-08-01T16:00", "uv_index": 2},
    ]
    day = {"uv_level": "Low", "uv_index": 2, "visibility_m": 10000}  # whole-day looks low
    midday_activity = Activity(
        trip_id=1, day_date=date.today(), name="Hike", type="outdoor",
        time_slot="11:00 - 13:00", weather_sensitivity="strenuous_outdoor",
    )
    morning_activity = Activity(
        trip_id=1, day_date=date.today(), name="Hike", type="outdoor",
        time_slot="09:00 - 10:00", weather_sensitivity="strenuous_outdoor",
    )

    midday = score_activity(day, midday_activity, hourly=hourly, today=date.today())
    morning = score_activity(day, morning_activity, hourly=hourly, today=date.today())

    assert midday["scores"]["uv"] == 80  # catches uv_index 9 -> Very High
    assert morning["scores"]["uv"] == 0  # morning really is low UV


def test_score_activity_cold_and_heat_use_the_activitys_own_hourly_window():
    """Same hourly-refinement idea as fog — coldest/hottest hour within the
    activity's own time_slot, not just the whole-day temp_min/temp_max."""
    hourly = [
        {"time": "2026-08-01T06:00", "temperature": -12},  # early cold snap
        {"time": "2026-08-01T14:00", "temperature": 20},
    ]
    day = {"temp_min": 5, "temp_max": 20, "visibility_m": 10000}  # whole-day min looks mild
    early_activity = Activity(
        trip_id=1, day_date=date.today(), name="Sunrise Hike", type="outdoor",
        time_slot="06:00 - 07:00", weather_sensitivity="strenuous_outdoor",
    )
    afternoon_activity = Activity(
        trip_id=1, day_date=date.today(), name="Afternoon Hike", type="outdoor",
        time_slot="14:00 - 15:00", weather_sensitivity="strenuous_outdoor",
    )

    early = score_activity(day, early_activity, hourly=hourly, today=date.today())
    afternoon = score_activity(day, afternoon_activity, hourly=hourly, today=date.today())

    assert early["scores"]["cold"] == 80  # catches the -12°C cold snap
    assert afternoon["scores"]["cold"] == 0  # afternoon isn't cold


def test_describe_scores_uses_hourly_refined_wind_and_uv_in_reason_text():
    """Mirrors the fog display fix — the reason text must quote the same
    (possibly hourly-refined) wind_level/uv_level that the score actually
    used, not the calm whole-day category."""
    reason = describe_scores(
        {"wind_level": "Calm", "uv_level": "Low"},
        {"wind": 75, "uv": 80},
        {"wind_speed": 45, "uv_index": 9},
    )
    lowered = reason.lower()
    assert "very strong" in lowered  # wind_level(45) == "Very Strong", not "Calm"
    assert "very high" in lowered  # uv_level(9) == "Very High", not "Low"


def test_describe_scores_joins_every_contributing_metric_worst_first():
    reason = describe_scores(
        {"wind_level": "Strong", "beach_safety_level": "Moderate"},
        {"fog_safety": 0, "wind": 50, "beach": 40},
    )
    lowered = reason.lower()
    assert "wind" in lowered
    assert "beach" in lowered
    assert lowered.index("wind") < lowered.index("beach")  # worst (wind, 50) listed first


def test_describe_scores_handles_no_contributing_metrics():
    assert describe_scores({}, {"fog_safety": 0}) == "Weather conditions flagged for this activity"


def test_describe_tip_uses_only_the_single_worst_contributor():
    tip = describe_tip(
        {"temp_min": -12},
        {"cold": 80, "wind": 50},
    )
    from ml.risk_calculator import temp_advice
    assert tip == temp_advice("Extreme Cold")


def test_top_rule_id_maps_metric_names_to_email_icon_keys():
    assert top_rule_id({"cold": 80, "wind": 50}) == "extreme_cold"
    assert top_rule_id({"beach": 90}) == "beach_safety"
    assert top_rule_id({"fog_scenic": 80}) == "fog"
    assert top_rule_id({"fog_safety": 0}) is None
