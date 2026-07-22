from services.weather_rules import ACTIVE_RULES, RainRule


def test_rain_rule_fires_on_warning():
    rule = RainRule()
    reason = rule.evaluate({"heavy_rain_warning": True, "heavy_rain_probability": 72.5})
    assert reason is not None
    assert "72.5" in reason


def test_rain_rule_does_not_fire_without_warning():
    rule = RainRule()
    assert rule.evaluate({"heavy_rain_warning": False, "heavy_rain_probability": 10.0}) is None


def test_active_rules_includes_rain_rule():
    assert any(isinstance(rule, RainRule) for rule in ACTIVE_RULES)
