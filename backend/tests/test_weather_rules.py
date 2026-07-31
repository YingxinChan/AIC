from models.activity import Activity
from services.weather_rules import (
    ACTIVE_RULES,
    RainRule,
    FogRule,
    WindRule,
    ExtremeHeatRule,
    ExtremeColdRule,
    ExtremeUVRule,
    BeachSafetyRule,
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
