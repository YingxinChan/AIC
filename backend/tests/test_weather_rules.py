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


def _activity(weather_sensitivity=""):
    return Activity(
        trip_id=1, day_date=None, name="Test Activity", type="outdoor",
        time_slot="10:00 - 12:00", location="Somewhere", weather_sensitivity=weather_sensitivity,
    )


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
    day = {"visibility_m": 900}
    assert rule.evaluate(day, _activity("view_dependent")) is not None
    assert rule.evaluate(day, _activity("wind_exposed")) is None
    assert rule.evaluate(day, _activity("")) is None


def test_fog_rule_does_not_fire_above_threshold():
    rule = FogRule()
    day = {"visibility_m": 5000}
    assert rule.evaluate(day, _activity("view_dependent")) is None


def test_fog_rule_day_triggers_ignores_activity_entirely():
    rule = FogRule()
    assert rule.day_triggers({"visibility_m": 900}) is True
    assert rule.day_triggers({"visibility_m": 5000}) is False
    assert rule.day_triggers({"visibility_m": None}) is False


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
    assert rule.evaluate({"visibility_m": 900}, activity) is not None


def test_active_rules_includes_all_expected_rule_types():
    rule_types = {type(rule) for rule in ACTIVE_RULES}
    assert rule_types == {
        RainRule, FogRule, WindRule, ExtremeHeatRule, ExtremeColdRule, ExtremeUVRule, BeachSafetyRule,
    }
