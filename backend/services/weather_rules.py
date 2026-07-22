class WeatherRiskRule:
    id: str

    def evaluate(self, forecast_day: dict) -> str | None:
        """Return a human-readable trigger reason, or None if this rule doesn't fire for this day."""
        raise NotImplementedError


class RainRule(WeatherRiskRule):
    id = "rain"

    def evaluate(self, forecast_day: dict) -> str | None:
        if forecast_day["heavy_rain_warning"]:
            return f"Heavy rain expected ({forecast_day['heavy_rain_probability']}% chance)"
        return None


# Add new WeatherRiskRule subclasses here as more weather aspects are supported
# (snow, extreme heat, high wind, ...) — the orchestrator only reads this list,
# so adding a rule never requires changing orchestrator/task code.
ACTIVE_RULES: list[WeatherRiskRule] = [RainRule()]
