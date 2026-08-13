import { useState } from 'react'

// Metadata for the 3 clickable "weather info" cards' hourly-trend popup —
// hourlyKey is the field name on each HourlyWeatherOut entry, advice pulls
// the matching daily advice sentence when the backend provides one (only
// UV does today; wind/visibility have no advice field yet).
// WHO UV index scale — matches backend/ml/risk_calculator.py's uv_level()
// bands exactly (Low <3, Moderate <6, High <8, Very High <11, else Extreme),
// so the chart's colors/labels never disagree with the UV Index card's own
// level badge for the same day.
const UV_BANDS = [
  { min: 0, level: 'Low', color: '#22c55e' },
  { min: 3, level: 'Moderate', color: '#eab308' },
  { min: 6, level: 'High', color: '#f97316' },
  { min: 8, level: 'Very High', color: '#ef4444' },
  { min: 11, level: 'Extreme', color: '#9333ea' },
];

const WEATHER_INFO_META = {
  wind: { label: 'Wind', unit: 'km/h', hourlyKey: 'wind_speed', advice: () => null, color: '#0ea5e9' },
  uv: { label: 'UV Index', unit: '', hourlyKey: 'uv_index', advice: (fd) => fd?.uv_advice || null, bands: UV_BANDS },
  visibility: { label: 'Visibility', unit: 'km', hourlyKey: 'visibility_km', advice: () => null, color: '#64748b' },
};

// Which weather-info card ('wind' | 'uv' | 'visibility') has its hourly
// trend popup open, and which risk card (heavy rain/flood/beach/snow/
// extreme temp/hiking/wind/uv/visibility on a climatology day) has its
// detail modal open — extracted together since both are opened from the
// same 9-card risk strip and only one is ever open at a time in practice.
// `weatherInfoCurrentTime` (the "now" marker, which also depends on
// isToday/currentHourPrefix computed elsewhere on the page) stays computed
// in ItineraryPage itself, using this hook's weatherInfoHourly.
export function useWeatherInfoModal({ forecastDay, hourlyForecast }) {
  const [weatherInfoModalMetric, setWeatherInfoModalMetric] = useState(null)
  const [riskInfoModal, setRiskInfoModal] = useState(null)

  const weatherInfoMeta = weatherInfoModalMetric ? WEATHER_INFO_META[weatherInfoModalMetric] : null
  const weatherInfoHourly = weatherInfoMeta && hourlyForecast && forecastDay
    ? hourlyForecast
        .filter(h => h.time.startsWith(forecastDay.date))
        .map(h => ({ time: h.time, value: h[weatherInfoMeta.hourlyKey] }))
    : []

  return {
    weatherInfoModalMetric, setWeatherInfoModalMetric,
    riskInfoModal, setRiskInfoModal,
    weatherInfoMeta, weatherInfoHourly,
  }
}
