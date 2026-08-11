import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, Calendar,
  Briefcase, CloudRain,
  AlertTriangle, Waves, Umbrella, Snowflake,
  SunDim, Wind, Eye, Sunrise, Sunset, Palmtree, Clock, Flame, Info,
  Pencil, Lock, Trash2, Plus, Mountain, CloudOff,
  CalendarPlus, ListChecks, ArrowRight, ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import Modal from '../../components/Modal'
import HotelSearchInput from '../../components/HotelSearchInput'
import ActivityLocationInput from '../../components/ActivityLocationInput'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Input from '../../components/Input'
import EmptyState from '../../components/EmptyState'
import Skeleton, { SkeletonTripPage, SkeletonWeatherPanel } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useDragScroll } from '../../lib/useDragScroll'
import { WeatherIcon, formatHour } from '../../lib/weatherDisplay'
import { STRIP_VARIANTS, ITEM_VARIANTS, SPRING_SOFT } from '../../lib/motion'
import { getTrip, updateTrip } from './tripsApi'
import { getItinerary, generateItinerary, updateActivity, createActivity, deleteActivity } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity, geocodeAddress } from '../../lib/geocode'
import { capitalize } from '../../lib/format'
import { splitTimeSlot, joinTimeSlot } from '../../lib/timeSlot'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'
import { getPendingReview, clearPendingReview } from '../../lib/pendingReview'
import { findDestinationImage } from './destinationImages'
import TripSidebar from './TripSidebar'

// --- SECTION 1: HELPER FUNCTIONS ---

// weather_sensitivity is stored as a comma-separated string (see
// backend/models/activity.py) and otherwise never surfaced in the UI —
// these badges are the only visible sign an activity is specifically
// vulnerable to fog/wind/heat-or-cold/beach conditions, beyond the
// blanket indoor/outdoor type.
const WEATHER_TAG_STYLES = {
  view_dependent: { label: 'Scenic View', icon: Eye, className: 'bg-sky-100 text-sky-800' },
  wind_exposed: { label: 'Wind Exposed', icon: Wind, className: 'bg-teal-100 text-teal-800' },
  strenuous_outdoor: { label: 'Strenuous', icon: Mountain, className: 'bg-orange-100 text-orange-800' },
  beach: { label: 'Beach', icon: Waves, className: 'bg-cyan-100 text-cyan-800' },
}

function weatherTags(weatherSensitivity) {
  return (weatherSensitivity || '').split(',').map(t => t.trim()).filter(t => WEATHER_TAG_STYLES[t])
}

// formatHour lives in ../../lib/weatherDisplay now (see import above) —
// shared with DashboardPage rather than redefined per page.

// Backend formats sunrise/sunset as "%I:%M %p" (e.g. "06:34 AM") — parsed
// into minutes-since-midnight so a sunrise/sunset marker can be inserted into
// the hourly forecast strip at its exact sorted position between two
// on-the-hour cards (Apple Weather-style inline "06:02 · Sunrise" card),
// rather than just tagging the nearest hour's existing card.
const parseSunEventMinutes = (timeStr) => {
  const match = (timeStr || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
};

// True when the icon weatherIcon() would pick actually depicts rain/drizzle/
// showers/thunder — used to avoid pairing a rain % with a sun/cloud icon.
const isRainyCondition = (condition) => {
  const cond = (condition || '').toLowerCase();
  return !cond.includes('clear')
    && !cond.includes('partly cloudy')
    && !cond.includes('overcast')
    && !cond.includes('fog')
    && !cond.includes('snow');
};

// weatherIcon/WeatherIcon live in ../../lib/weatherDisplay now (see import
// above) — shared with DashboardPage rather than redefined per page.

const snowLevel = (pct) => {
  if (pct <= 0) return 'None';
  if (pct <= 50) return 'Low';
  return 'High';
};

// Climatology days have no heavy_rain_probability (that's a live ML
// prediction, see weather_service.py) — rain_chance (% of the last 10
// years' matching dates with >=1mm rain, climatology_service.py) stands in
// for it on the Heavy Rain card instead. Different signal, same rough
// tiers as flood_risk()'s score bands so the badge coloring reads the same
// way a user already expects.
const rainChanceLevel = (pct) => {
  if (pct == null) return 'Unknown';
  if (pct < 30) return 'Low';
  if (pct < 60) return 'Moderate';
  return 'High';
};

// Explicit level -> color mapping for the risk-card badges, rather than an
// inline ternary that only recognizes 'High'/'Poor'/'Moderate'/'Low' — that
// old check treated 'Low' the same as 'Moderate' (both yellow), which was
// wrong for Heavy Rain's "Low" (no-warning/safe) state. Anything not listed
// here (Low, None, Good, Excellent, Safe) correctly falls through to green.
// Covers Wind/UV vocabulary too, since those are also shown as color badges.
// Also covers Extreme Temp's own 'Extreme Heat'/'Extreme Cold'/'High Heat'/
// 'Cold Conditions' vocabulary — without these, a real "High Heat"/"Extreme
// Heat" reading fell through to the same green as a genuinely safe day,
// which is actively misleading, not just an off color.
const LEVEL_COLORS = {
  red: ['High', 'Poor', 'Very High', 'Extreme', 'Strong', 'Very Strong', 'Unsafe', 'Dangerous', 'Extreme Heat', 'Extreme Cold'],
  yellow: ['Moderate', 'Caution', 'High Heat', 'Cold Conditions'],
};
function levelColorClass(level) {
  // Climatology-fallback days (see forecastDay.is_climatology) report
  // 'Unknown' for scores they can't compute — that's a genuinely different
  // state from "checked and it's fine", so it gets its own neutral gray
  // rather than falling through to the same green as a real Good/Low result.
  if (level === 'Unknown') return 'bg-gray-100 text-gray-700';
  if (LEVEL_COLORS.red.includes(level)) return 'bg-red-100 text-red-800';
  if (LEVEL_COLORS.yellow.includes(level)) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

// Card "family" identity — WHAT kind of hazard the metric measures, never
// HOW severe it is. Severity stays exclusively levelColorClass()'s badge
// (see LEVEL_COLORS above) — these two signals must stay visually and
// structurally separate. Deliberately 3 families, not 9 individual tints:
// nine near-identical colors would read as confetti and still encode
// nothing; three families group cards by what they measure. accent-* (amber)
// is intentionally not used here — it sits too close to the yellow
// levelColorClass owns for Moderate/Caution severity.
const RISK_FAMILY = {
  water: 'bg-sky-50 text-sky-600 ring-sky-100',
  thermal: 'bg-orange-50 text-orange-600 ring-orange-100',
  terrain: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const CARD_IDENTITY = {
  heavyRain: RISK_FAMILY.water,
  flood: RISK_FAMILY.water,
  beachSafety: RISK_FAMILY.water,
  snow: RISK_FAMILY.water,
  extremeTemp: RISK_FAMILY.thermal,
  uv: RISK_FAMILY.thermal,
  hikingSafety: RISK_FAMILY.terrain,
  wind: RISK_FAMILY.terrain,
  visibility: RISK_FAMILY.terrain,
}

// Same 3 families as RISK_FAMILY/CARD_IDENTITY above, but as a bottom-border
// accent rather than an icon-chip fill — keyed by the exact CARD_IDENTITY
// string value (not by family name) so callers can look it up straight off
// a card's own `bg` field with no extra plumbing. Gives the grouping a
// second, always-visible cue that survives horizontal scrolling past the
// icon chips themselves.
const RISK_FAMILY_BORDER = {
  [RISK_FAMILY.water]: 'border-b-sky-300',
  [RISK_FAMILY.thermal]: 'border-b-orange-300',
  [RISK_FAMILY.terrain]: 'border-b-slate-300',
}

// Shared by all 9 Risks-row cards (risk cards map, Extreme Temp, weather-info
// cards map) — only each card's family identity chip color varies, appended
// by the caller.
const RISK_CARD_CLASSES = 'shrink-0 snap-start w-[168px] p-4 rounded-2xl bg-white border border-gray-200/80 border-b-2 shadow-bento-sm text-center flex flex-col items-center gap-2 transition-shadow hover:shadow-bento-hover hover:border-brand-200'

// Flood, Snow, Hiking Safety, Wind, UV and Visibility are all null on a
// climatology (>14-day) day with no historical substitute standing in for
// them — Flood/Snow need real-time inputs (today/tomorrow rainfall, peak
// hourly rain, snowfall) a pooled multi-year window can't reconstruct
// (see climatology_service.py), and Hiking Safety/Wind/UV/Visibility read
// straight off the real forecast/ML path with no historical equivalent at
// all (confirmed against Open-Meteo's Archive API — no historical
// visibility data exists). That's different from Heavy Rain/Extreme Temp,
// which climatology *does* approximate (via rain_chance/temp_max — real
// values, just less precise), and from Beach Safety, which climatology
// computes directly with no gaps. Every card face just shows its normal
// value+badge either way (null renders as '—'/'Unknown', same shape as a
// real value) — the explanation for *why* lives in the risk-info modal
// (see riskInfoModal), not on the card.
const FORECAST_ONLY_NOTE = "We'll have this once your trip is within 14 days away"
const CLIMATOLOGY_UNAVAILABLE_TYPES = ['flood', 'snow', 'hiking', 'uv', 'visibility']

// Risk-info modal breakdown values (ItineraryPage's risk-detail Modal) —
// climatology's statistics.mean() results come back unrounded (e.g.
// 22.4546875), and Heavy Rain Probability wants more precision than the
// others. Factors not listed here render as-is (e.g. Flood's "Today's/
// Tomorrow Rainfall", Snow's "Precipitation").
const RISK_BREAKDOWN_DECIMALS = {
  'Feels Like Temperature': 1,
  'Wind Speed': 1,
  'Rainfall': 1,
  'Heavy Rain Probability': 2,
}

// Hero header photo backgrounds (see Hero Header below) — see
// destinationImages.js for the shared map/lookup (also used by
// MyTripsPage and DashboardPage's trip cards). An optional `fit: 'contain'`
// is supported (see Hero Header below) for a photo whose subject can't
// survive any crop at all (e.g. a tight close-up of one tall structure) —
// not currently used by any of the 25 supported cities.

// Visibility has no backend-supplied level (unlike UV/wind), so it's
// classified here using the same Good/Moderate/Poor vocabulary Beach Safety
// already uses — no changes needed to levelColorClass to support it.
const visibilityLevel = (meters) => {
  if (meters >= 10000) return 'Good';
  if (meters >= 1000) return 'Moderate';
  return 'Poor';
};

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

const getRiskInfoMeta = (forecastDay) => ({
  heavyRain: {
    label: "Heavy Rain Prediction Calculation",
    score: forecastDay.heavy_rain_probability,
    level: forecastDay.heavy_rain_warning ? "High" : "Low",
    breakdown: []
  },

  flood: {
    label: "Flood Risk Calculation",
    score: forecastDay.flood_score,
    level: forecastDay.flood_risk,
    breakdown: forecastDay.flood_breakdown
  },

  beach: {
    label: "Beach Safety Calculation",
    score: forecastDay.beach_safety_score,
    level: forecastDay.beach_safety_level,
    breakdown: forecastDay.beach_safety_breakdown
  },

  snow: {
    label: "Snow Probability Calculation",
    score: forecastDay.snow_probability,
    level: snowLevel(forecastDay.snow_probability),
    breakdown: forecastDay.snow_breakdown
  },

  hiking: {
    label: "Hiking Safety Calculation",
    score: forecastDay.hiking_safety_score,
    level: forecastDay.hiking_safety_level,
    breakdown: forecastDay.hiking_safety_breakdown
  },

  // Wind/UV/Visibility only ever reach this modal on a climatology day (see
  // CLIMATOLOGY_UNAVAILABLE_TYPES) — the real-forecast path opens the
  // hourly-trend popup (setWeatherInfoModalMetric) instead, never this one.
  // So these just need a label for the modal title; no score/breakdown is
  // ever read for them here.
  wind: {
    label: "Wind Speed",
  },

  uv: {
    label: "UV Index",
  },

  visibility: {
    label: "Visibility",
  },

  temperature: {
    label: "Extreme Temperature Calculation",
    level: forecastDay.temperature_level,
    advice: forecastDay.temperature_advice,
    breakdown: forecastDay.temperature_breakdown
  }
})

// Hand-rolled SVG sparkline rather than pulling in a charting library for
// one simple hourly-trend line — points are normalized into the viewBox,
// flat-lining at the vertical center if every value is identical (avoids a
// divide-by-zero when max === min).
// Catmull-Rom-to-Bezier smoothing — draws a natural curve through every
// point (rather than the sharp polyline segments a plain <polyline> gives),
// matching how weather-app hourly graphs typically render. Missing
// neighbors at the ends just reuse the nearest real point.
const smoothPath = (points) => {
  const d = [`M ${points[0][0]},${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(' ');
};

// Standard "nice numbers" tick step (Heckbert's algorithm): picks a step of
// 1/2/5 × a power of 10 so ticks land on clean values — 1,2,3.../2,4,6...
// for small ranges, 10,20,30... for larger ones — instead of just dividing
// the max into equal fractions (which gives ugly numbers like 3.33, 6.67).
const niceTickStep = (roughStep) => {
  if (roughStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
};

// Ticks always start at 0 (these metrics are never negative) and climb by
// the nice step until they cover the data max, e.g. max=8 -> step=2 ->
// [0,2,4,6,8]; max=35 -> step=10 -> [0,10,20,30,40].
const niceTicks = (max, targetCount = 4) => {
  const safeMax = max > 0 ? max : 1;
  const step = niceTickStep(safeMax / targetCount);
  const axisMax = Math.ceil(safeMax / step) * step;
  const ticks = [];
  for (let t = 0; t <= axisMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 1000) / 1000); // guards against float drift like 9.999999998
  }
  return ticks;
};

const formatAxisTick = (v) => (Math.round(v * 10) / 10).toString();

// Fixed clock-time labels (not evenly-spaced array positions) — matched to
// whichever hourly entries actually land on these hours, so the labels read
// as real times of day like the reference charts, not just "1/3 and 2/3
// of whatever data happened to be fetched".
const CANONICAL_HOUR_LABELS = [
  { hour: 0, label: '12 AM' },
  { hour: 6, label: '6 AM' },
  { hour: 12, label: '12 PM' },
  { hour: 18, label: '6 PM' },
];

// Looks up which severity band a value falls in (bands sorted ascending by
// `min`) — used both for the graded line color and the y-axis level labels.
const bandForValue = (bands, v) => {
  let match = bands[0];
  for (const b of bands) { if (v >= b.min) match = b; }
  return match;
};

const Sparkline = ({ data, unit = '', currentTime = null, color = '#6366f1', bands = null, width = 280, height = 90 }) => {
  const areaGradientId = useId();
  const lineGradientId = useId();
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  if (!data.length) return null;

  const values = data.map(d => d.value);
  // Baseline is always 0, not the data min — these metrics (wind/UV/
  // visibility) are never negative, and a fixed 0 baseline is what makes
  // the axis scale/gridlines below meaningful to read at a glance. A banded
  // metric (UV) uses the WHO scale's own bands as ticks instead of numeric
  // ones, and always shows up to at least the last band (e.g. "Extreme"),
  // not just whatever the day's actual max happens to be.
  const ticks = bands ? bands.map(b => b.min) : niceTicks(Math.max(...values));
  const axisMax = bands ? Math.max(bands[bands.length - 1].min, ...values) : ticks[ticks.length - 1];
  const top = 6; // headroom so the curve's peak/stroke never clips the viewBox edge
  const usableHeight = height - top;
  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = top + usableHeight - (d.value / axisMax) * usableHeight;
    return [x, y];
  });
  const linePath = points.length > 1 ? smoothPath(points) : `M ${points[0][0]},${points[0][1]}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const colorForIndex = (i) => bands ? bandForValue(bands, values[i]).color : color;

  const currentIndex = currentTime ? data.findIndex(d => d.time === currentTime) : -1;
  // While hovering/dragging, the pointer's position wins over the "now"
  // marker; released, it falls back to marking "now" (if viewing today).
  const activeIndex = hoverIndex !== null ? hoverIndex : (currentIndex !== -1 ? currentIndex : null);

  const updateHoverFromClientX = (clientX) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let minDist = Infinity;
    points.forEach(([x], i) => {
      const dist = Math.abs(x - relX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    setHoverIndex(nearest);
  };

  const axisLabels = CANONICAL_HOUR_LABELS
    .map(({ hour, label }) => {
      const idx = data.findIndex(d => parseInt(d.time.split('T')[1].split(':')[0], 10) === hour);
      return idx === -1 ? null : { idx, label };
    })
    .filter(Boolean);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="flex-1 h-24 touch-none cursor-crosshair"
          onMouseMove={(e) => updateHoverFromClientX(e.clientX)}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchStart={(e) => e.touches[0] && updateHoverFromClientX(e.touches[0].clientX)}
          onTouchMove={(e) => e.touches[0] && updateHoverFromClientX(e.touches[0].clientX)}
          onTouchEnd={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            {/* Only needed for banded metrics (UV) — a horizontal gradient
                whose stops are colored by each point's own severity band,
                giving the line a graded green-to-red look along its length
                instead of one flat color. */}
            {bands && (
              <linearGradient id={lineGradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
                {points.map(([x], i) => (
                  <stop key={i} offset={`${(x / width) * 100}%`} stopColor={colorForIndex(i)} />
                ))}
              </linearGradient>
            )}
          </defs>
          {ticks.map((t) => {
            const y = top + usableHeight - (t / axisMax) * usableHeight;
            return <line key={t} x1="0" y1={y} x2={width} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-gray-200" />;
          })}
          {!bands && <path d={areaPath} fill={`url(#${areaGradientId})`} />}
          <path d={linePath} fill="none" stroke={bands ? `url(#${lineGradientId})` : color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {activeIndex !== null && (
            <>
              <line
                x1={points[activeIndex][0]} y1={0} x2={points[activeIndex][0]} y2={height}
                stroke={hoverIndex !== null ? '#9ca3af' : colorForIndex(activeIndex)} strokeWidth="1"
                strokeDasharray={hoverIndex !== null ? undefined : '3 3'}
              />
              <circle
                cx={points[activeIndex][0]} cy={points[activeIndex][1]} r="4"
                fill={hoverIndex !== null ? '#374151' : colorForIndex(activeIndex)}
                stroke="white" strokeWidth="1.5"
              />
            </>
          )}
        </svg>
        {/* Banded metrics (UV) show WHO level names here instead of numbers —
            unit shown once on the top tick otherwise, matching how the
            reference charts label their y-axis. */}
        <div className="h-24 flex flex-col justify-between text-[10px] text-gray-400 py-1 text-right">
          {[...ticks].reverse().map((t, i) => (
            <span key={t} style={bands ? { color: bandForValue(bands, t).color } : undefined}>
              {bands ? bandForValue(bands, t).level : `${formatAxisTick(t)}${i === 0 && unit ? ` ${unit}` : ''}`}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-4 text-xs text-gray-400">
        {axisLabels.map(({ idx, label }) => (
          <span key={label} className="absolute -translate-x-1/2" style={{ left: `${(points[idx][0] / width) * 100}%` }}>
            {label}
          </span>
        ))}
      </div>
      {activeIndex !== null && (
        <div className="text-xs font-medium" style={{ color: hoverIndex !== null ? '#374151' : colorForIndex(activeIndex) }}>
          {hoverIndex !== null ? formatHour(data[activeIndex].time) : 'Now'} · {formatAxisTick(data[activeIndex].value)}{unit ? ` ${unit}` : ''}
        </div>
      )}
    </div>
  );
};

// There's no separate "hotel name" field — hotel_address is a single string
// that (when picked from the search dropdown) already comes formatted as
// "Name, Street, City, ..." from Nominatim, so split on the first comma to
// show the name and address on their own lines. A manually-typed value with
// no comma just shows entirely as the name, with no second line.
const splitHotelAddress = (hotelAddress) => {
  const commaIndex = hotelAddress.indexOf(',');
  if (commaIndex === -1) return { name: hotelAddress, address: '' };
  return {
    name: hotelAddress.slice(0, commaIndex).trim(),
    address: hotelAddress.slice(commaIndex + 1).trim(),
  };
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// start/end are plain "YYYY-MM-DD" calendar dates with no timezone meaning of
// their own, so this parses/advances/formats entirely in UTC — anchoring to
// the runner's local midnight (via `new Date(start + 'T00:00:00')`) would
// shift the date backward whenever the local timezone is ahead of UTC.
const datesBetween = (start, end) => {
  if (!start || !end) return []
  const dates = []
  const startMs = new Date(start + 'T00:00:00Z').getTime()
  const endMs = new Date(end + 'T00:00:00Z').getTime()
  for (let t = startMs; t <= endMs; t += ONE_DAY_MS) {
    dates.push(new Date(t).toISOString().split('T')[0])
  }
  return dates
}

export default function ItineraryPage() {
  // --- SECTION 2: STATE VARIABLES ---
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  // Mirrors weatherStatus's loading/failed/loaded pattern elsewhere in this
  // file — without it, a deleted/mistyped/tampered tripId or a transient
  // network failure all looked identical to "still loading": trip just
  // stayed null forever and every section (all gated behind {trip && ...})
  // silently rendered nothing, with no way to tell the states apart and no
  // way back to the app short of editing the URL by hand.
  const [tripLoadError, setTripLoadError] = useState(false)
  const [itinerary, setItinerary] = useState(null)
  const [itineraryNotice, setItineraryNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [hotelLocation, setHotelLocation] = useState(null)
  const riskStripDrag = useDragScroll()
  const hourlyStripDrag = useDragScroll()
  const toast = useToast()

  const [mapCenter, setMapCenter] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('loading')
  // Activities are the primary content of the main pane now; the 9-card risk
  // strip and the hourly strip are supporting detail behind this toggle. The
  // condensed day header above them always shows temp/condition and the day's
  // single worst risk, so collapsing hides detail, never the headline.
  const [forecastExpanded, setForecastExpanded] = useState(false)

  const [hotelModalOpen, setHotelModalOpen] = useState(false)
  const [hotelDraft, setHotelDraft] = useState('')
  // {lat, lon} from an explicit dropdown pick, or null — set alongside
  // hotelDraft by handleHotelChange below, and dropped back to null the
  // moment the user types (HotelSearchInput's onChange omits the second
  // argument for freehand keystrokes), so a stale selection's coordinates
  // never get saved against a since-edited address string.
  const [hotelDraftCoords, setHotelDraftCoords] = useState(null)
  const [datesModalOpen, setDatesModalOpen] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [savingTrip, setSavingTrip] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  // Which of dates/hotel/outbound/return was just saved — the review prompt
  // excludes this one and only offers the others, so it never re-suggests
  // editing the thing the user just finished editing.
  const [lastEdited, setLastEdited] = useState(null)

  // Which weather-info card ('wind' | 'uv' | 'visibility') has its hourly
  // trend popup open, or null if none — only these 3 cards are clickable,
  // not the risk cards (heavy rain/flood/beach/snow/extreme temp/hiking).
  const [weatherInfoModalMetric, setWeatherInfoModalMetric] = useState(null)
  const [riskInfoModal, setRiskInfoModal] = useState(null);

  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState(null)
  const [activityDayDraft, setActivityDayDraft] = useState('')
  const [activityStartDraft, setActivityStartDraft] = useState('')
  const [activityEndDraft, setActivityEndDraft] = useState('')
  const [activityNameDraft, setActivityNameDraft] = useState('')
  const [activityLocationDraft, setActivityLocationDraft] = useState('')
  // {label, lat, lon} once the user picks a place, or null if the location
  // hasn't been touched this session — only sent in the patch when set, so
  // an untouched location never gets re-saved with stale/absent coordinates.
  const [activityLatLngDraft, setActivityLatLngDraft] = useState(null)
  const [activityFixedDraft, setActivityFixedDraft] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)

  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false)
  const [newActivityDayDraft, setNewActivityDayDraft] = useState('')
  const [newActivityStartDraft, setNewActivityStartDraft] = useState('')
  const [newActivityEndDraft, setNewActivityEndDraft] = useState('')
  const [newActivityNameDraft, setNewActivityNameDraft] = useState('')
  const [newActivityLocationDraft, setNewActivityLocationDraft] = useState('')
  // Same {label, lat, lon}-only-on-selection contract as activityLatLngDraft
  // above — the backend requires lat/lng on create, so Save stays disabled
  // until this is actually set (see the disabled check on the Add button).
  const [newActivityLatLngDraft, setNewActivityLatLngDraft] = useState(null)
  const [newActivityTypeDraft, setNewActivityTypeDraft] = useState('outdoor')
  const [newActivityFixedDraft, setNewActivityFixedDraft] = useState(false)
  const [savingNewActivity, setSavingNewActivity] = useState(false)

  const destination = trip?.destination || ''

  // The big headline temperature only makes sense for today (a real, current
  // reading) — a future day's "big number" would just be an arbitrarily
  // chosen stat (max? mean?) implying more precision than a forecast has.
  // Shared by getCurrentTemp/getFeelsLikeTemp below — both read off the same
  // current-hour entry, so this only does the lookup once.
  const getCurrentHourData = () => {
    if (!forecastDay || !hourlyForecast) return null;
    // Hourly/daily data is fetched with &timezone=auto (see openmeteo.py),
    // so timestamps are the destination's own local time — convert the
    // real current instant into that same local time using the offset the
    // backend returns, rather than the browser's local hour or raw UTC
    // (neither matches the destination unless it happens to share that
    // exact offset).
    const destNow = new Date(Date.now() + (forecastDay.utc_offset_seconds ?? 0) * 1000);
    const currentHour = destNow.getUTCHours();
    const timeString = `${selectedDate}T${currentHour.toString().padStart(2, '0')}:00`;
    return hourlyForecast.find(h => h.time === timeString) ?? null;
  };

  const getCurrentTemp = () => {
    if (!forecastDay) return '';
    const currentData = getCurrentHourData();
    return Math.round(currentData ? currentData.temperature : forecastDay.temp_max);
  };

  // Only meaningful for today — a "feels like" for a future/past day would
  // just be re-deriving from the same max/min already shown, not a real
  // apparent-temperature reading, so callers should only use this when
  // isToday is true (same convention as getCurrentTemp's big-number display).
  const getFeelsLikeTemp = () => {
    const currentData = getCurrentHourData();
    return currentData ? Math.round(currentData.feels_like_temp) : null;
  };

  // --- SECTION 3: DATA FETCHING LOGIC ---
  useEffect(() => {
    let cancelled = false;
    setTripLoadError(false);

    Promise.all([getTrip(tripId), getItinerary(tripId)])
      .then(([tripData, itinData]) => {
        if (cancelled) return;
        setTrip(tripData);
        if (itinData?.days) {
          setItinerary(itinData);
        }

        // selectedDate default + geocode/forecast fetch both moved into
        // their own effect below, keyed on trip destination/dates instead of
        // just tripId — so editing dates in-place (see saveTripDetails)
        // re-fetches weather for the new range instead of leaving it stale.

        // Covers returning from FlightSelectPage (a full navigation, so this
        // effect re-runs) right after a leg was saved there — see
        // saveTripDetails below for the in-page Dates/Hotel case, which opens
        // this directly instead. Cleared immediately after showing it once,
        // so simply reopening/reloading this trip later doesn't keep
        // re-surfacing the same prompt.
        const pendingSource = getPendingReview(tripId);
        if (pendingSource) {
          setLastEdited(pendingSource);
          setReviewModalOpen(true);
          clearPendingReview(tripId);
        }
      })
      .catch((err) => {
        console.error("Failed to load trip:", err);
        if (!cancelled) setTripLoadError(true);
      });

    return () => { cancelled = true };
  }, [tripId]);

  // Re-fetches weather and re-clamps the selected day whenever the trip's
  // own destination/dates change, not just once on initial load — otherwise
  // editing dates in-place (see saveTripDetails) leaves forecast/mapCenter
  // pointing at the old range, and selectedDate can end up outside the new
  // tripDates range entirely.
  useEffect(() => {
    let cancelled = false;
    if (!trip) return;

    if (trip.start_date && trip.end_date) {
      // GMT-based best-effort default for which day tab to open — the
      // destination's actual UTC offset isn't known yet at this point
      // (forecast data, which carries it, hasn't loaded). This can be off by
      // up to a day right at the destination's local midnight; isToday /
      // getCurrentTemp elsewhere correct themselves once the real offset
      // arrives, since they run on every render, not just here.
      const todayStr = new Date().toISOString().split('T')[0];
      const inRange = todayStr >= trip.start_date && todayStr <= trip.end_date;
      setSelectedDate((prev) => {
        // Keep the current selection if it's still valid in the (possibly
        // new) range, rather than always jumping back to today/start on
        // every trip update — only reclamp when it no longer fits.
        if (prev && prev >= trip.start_date && prev <= trip.end_date) return prev;
        return inRange ? todayStr : trip.start_date;
      });
    }

    // Geocoding/weather doesn't require dates to be set — only the forecast
    // fetch below uses them, and gracefully gets undefined if absent, same
    // as before this was split into its own effect.
    if (trip.destination) {
      geocodeCity(trip.destination).then(coords => {
        if (cancelled || !coords) {
          setWeatherStatus('failed');
          return;
        }

        const lat = parseFloat(coords[0]);
        const lon = parseFloat(coords[1]);
        setMapCenter([lat, lon]);

        Promise.all([
            getForecast(lat, lon, trip.start_date, trip.end_date),
            getHourlyForecast(lat, lon, trip.start_date, trip.end_date)
        ])
          .then(([days, hours]) => {
            if (!cancelled) {
              setForecast(days);
              setHourlyForecast(hours);
              setWeatherStatus('loaded');
            }
          })
          .catch((err) => {
            console.error("Weather fetch error:", err);
            if (!cancelled) setWeatherStatus('failed');
          });
      });
    }

    return () => { cancelled = true };
  }, [trip?.destination, trip?.start_date, trip?.end_date]);
  useEffect(() => {
    if (!trip?.hotel_address) {
      setHotelLocation(null)
      return
    }
    // Prefer the coordinates saved at selection time (see handleSaveHotel) —
    // re-geocoding the address string here isn't guaranteed to resolve back
    // to the exact building the user picked (chain hotels, reused street
    // names, Nominatim ranking differently on a second query). Only fall
    // back to re-geocoding for trips saved before this field existed, or a
    // freehand-typed address that was never geocoded at selection time.
    if (trip.hotel_lat != null && trip.hotel_lng != null) {
      setHotelLocation([trip.hotel_lat, trip.hotel_lng])
      return
    }
    let cancelled = false
    geocodeAddress(trip.hotel_address).then(coords => {
      if (!cancelled) {
        setHotelLocation(coords)
      }
    })
    return () => {
      cancelled = true
    }
  }, [trip?.hotel_address, trip?.hotel_lat, trip?.hotel_lng])

  // --- SECTION 4: ACTIONS ---
  const handleGenerate = async () => {
    setGenerating(true)
    setItineraryNotice('')
    try {
      const data = await generateItinerary(tripId)
      if (data.days) {
        setItinerary(data)
        const swappedCount = data.days.flatMap(d => d.activities).filter(a => a.is_swapped).length
        toast.show(
          swappedCount > 0
            ? `Itinerary regenerated — ${swappedCount} ${swappedCount === 1 ? 'activity' : 'activities'} adjusted for weather`
            : 'Itinerary regenerated'
        )
      } else {
        setItineraryNotice(data.message || 'Could not generate the itinerary.')
      }
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Something went wrong while generating the itinerary.')
    }
    setGenerating(false)
  }

  // Dates and hotel are baked into itinerary generation (day-1/last-day
  // scheduling, routing anchor), so editing either no longer regenerates
  // immediately — PATCH /api/trips/{id} just saves the field and returns
  // the plain trip. Instead, saving here opens the review prompt so the
  // user can batch in the other one before we regenerate once, via
  // handleReviewRegenerateNow below. Each flight leg (see FlightSelectPage)
  // is edited independently and marks pendingReview itself once saved,
  // reopening this same prompt on return.
  const openHotelModal = () => {
    setHotelDraft(trip.hotel_address || '')
    // Seed with the trip's existing coordinates (if any) so re-opening the
    // modal and saving without touching the input doesn't wipe out a
    // previously-good selection — the first real keystroke (handleChange,
    // via handleHotelChange below) still drops these back to null.
    setHotelDraftCoords(
      trip.hotel_lat != null && trip.hotel_lng != null
        ? { lat: trip.hotel_lat, lon: trip.hotel_lng }
        : null
    )
    setHotelModalOpen(true)
  }

  // HotelSearchInput's onChange(value, coords?) — coords is only present on
  // an explicit dropdown pick; every other call (freehand typing) omits it,
  // which correctly clears any stale coordinates from a prior selection.
  const handleHotelChange = (value, coords) => {
    setHotelDraft(value)
    setHotelDraftCoords(coords || null)
  }

  const openDatesModal = () => {
    setStartDraft(trip.start_date || '')
    setEndDraft(trip.end_date || '')
    setDatesModalOpen(true)
  }

  const datesInvalid = !startDraft || !endDraft || endDraft <= startDraft

  const saveTripDetails = async (patch, { closeModal, source }) => {
    setSavingTrip(true)
    try {
      const updatedTrip = await updateTrip(tripId, patch)
      setTrip(updatedTrip)
      closeModal()
      setLastEdited(source)
      setReviewModalOpen(true)
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Saving your trip details failed — try again.')
    }
    setSavingTrip(false)
  }

  const handleSaveHotel = () => saveTripDetails(
    {
      hotel_address: hotelDraft,
      hotel_lat: hotelDraftCoords?.lat ?? null,
      hotel_lng: hotelDraftCoords?.lon ?? null,
    },
    { closeModal: () => setHotelModalOpen(false), source: 'hotel' }
  )

  const handleSaveDates = () => {
    if (datesInvalid) return
    return saveTripDetails(
      { start_date: startDraft, end_date: endDraft },
      { closeModal: () => setDatesModalOpen(false), source: 'dates' }
    )
  }

  const handleReviewEditHotel = () => {
    setReviewModalOpen(false)
    openHotelModal()
  }

  const handleReviewEditDates = () => {
    setReviewModalOpen(false)
    openDatesModal()
  }

  const handleReviewEditOutbound = () => {
    setReviewModalOpen(false)
    navigate(`/trips/${tripId}/flights/outbound`)
  }

  const handleReviewEditReturn = () => {
    setReviewModalOpen(false)
    navigate(`/trips/${tripId}/flights/return`)
  }

  const handleReviewRegenerateNow = async () => {
    await handleGenerate()
    clearPendingReview(tripId)
    setReviewModalOpen(false)
  }

  const openEditActivityModal = (activity) => {
    setEditingActivityId(activity.id)
    setActivityDayDraft(activity.day_date)
    const [start, end] = splitTimeSlot(activity.time_slot)
    setActivityStartDraft(start)
    setActivityEndDraft(end)
    setActivityNameDraft(activity.is_swapped ? activity.alternate_name : activity.name)
    setActivityLocationDraft(activity.is_swapped ? activity.alternate_location : activity.location)
    setActivityLatLngDraft({ lat: activity.lat, lon: activity.lng })
    setActivityFixedDraft(activity.is_fixed)
    setEditActivityModalOpen(true)
  }

  const handleSaveActivity = async () => {
    setSavingActivity(true)
    try {
      const updated = await updateActivity(tripId, editingActivityId, {
        day_date: activityDayDraft,
        time_slot: joinTimeSlot(activityStartDraft, activityEndDraft),
        name: activityNameDraft,
        location: activityLocationDraft,
        lat: activityLatLngDraft.lat,
        lng: activityLatLngDraft.lon,
        is_fixed: activityFixedDraft,
      })
      setItinerary(updated)
      setEditActivityModalOpen(false)
      toast.show('Activity updated')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Saving this activity failed — try again.')
    }
    setSavingActivity(false)
  }

  const openAddActivityModal = () => {
    setNewActivityDayDraft(selectedDate || trip?.start_date || '')
    setNewActivityStartDraft('')
    setNewActivityEndDraft('')
    setNewActivityNameDraft('')
    setNewActivityLocationDraft('')
    setNewActivityLatLngDraft(null)
    setNewActivityTypeDraft('outdoor')
    setNewActivityFixedDraft(false)
    setAddActivityModalOpen(true)
  }

  const newActivityInvalid =
    !newActivityDayDraft || !newActivityStartDraft || !newActivityEndDraft ||
    !newActivityNameDraft.trim() || !newActivityLatLngDraft

  const handleCreateActivity = async () => {
    setSavingNewActivity(true)
    try {
      const updated = await createActivity(tripId, {
        day_date: newActivityDayDraft,
        time_slot: joinTimeSlot(newActivityStartDraft, newActivityEndDraft),
        name: newActivityNameDraft,
        location: newActivityLocationDraft,
        lat: newActivityLatLngDraft.lat,
        lng: newActivityLatLngDraft.lon,
        type: newActivityTypeDraft,
        is_fixed: newActivityFixedDraft,
      })
      setItinerary(updated)
      setAddActivityModalOpen(false)
      toast.show('Activity added')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Adding this activity failed — try again.')
    }
    setSavingNewActivity(false)
  }

  const handleDeleteActivity = async (activity) => {
    const label = activity.is_swapped ? activity.alternate_name : activity.name
    if (!window.confirm(`Remove "${label}" from this day?`)) return
    try {
      const updated = await deleteActivity(tripId, activity.id)
      setItinerary(updated.days ? updated : { days: [] })
      toast.show('Activity removed')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Removing this activity failed — try again.')
    }
  }

  const status = trip?.start_date && trip?.end_date ? tripStatus(trip) : null
  const hotelParts = trip?.hotel_address?.trim() ? splitHotelAddress(trip.hotel_address) : null

  // Day tabs are driven by the trip's own date range (see tripDates below),
  // not by itinerary.days or forecast — so both are looked up by date here,
  // independently of each other and of the tab source.
  const tripDates = trip?.start_date && trip?.end_date ? datesBetween(trip.start_date, trip.end_date) : []
  const forecastDay = forecast?.find(d => d.date === selectedDate)
  const riskInfoMeta = forecastDay ? getRiskInfoMeta(forecastDay) : {}

  // Simple practical nudge, replacing the old "worst of 9 risk cards"
  // summary — just whether today's condition itself is rain (or storm,
  // which implies rain too), read straight from the same condition text
  // already shown next to it. The full 9-card breakdown is still available
  // via "View full forecast" for anyone who wants the detailed severity read.
  const isRainyDay = Boolean(forecastDay?.condition?.toLowerCase().match(/rain|storm/))

  const itineraryDay = itinerary?.days?.find(d => d.date === selectedDate)
  const selectedDayNumber = tripDates.indexOf(selectedDate) + 1

  const weatherInfoMeta = weatherInfoModalMetric ? WEATHER_INFO_META[weatherInfoModalMetric] : null
  const weatherInfoHourly = weatherInfoMeta && hourlyForecast && forecastDay
    ? hourlyForecast
        .filter(h => h.time.startsWith(forecastDay.date))
        .map(h => ({ time: h.time, value: h[weatherInfoMeta.hourlyKey] }))
    : []

  // Forecast/hourly data is fetched with &timezone=auto (see openmeteo.py),
  // so its date/time fields are the destination's own local time — shift the
  // real current instant by the destination's UTC offset (once known) so
  // "today"/"now" are judged against Edinburgh's clock when viewing an
  // Edinburgh trip, not the browser's local calendar date.
  const destNow = new Date(Date.now() + (forecastDay?.utc_offset_seconds ?? 0) * 1000)
  const todayStr = destNow.toISOString().split('T')[0]
  const isToday = selectedDate === todayStr

  // "YYYY-MM-DDTHH" prefix for the destination's current local hour, used to
  // highlight the matching card in the hourly strip below.
  const currentHourPrefix = destNow.toISOString().slice(0, 13)

  // Only meaningful when the popup is showing today's data — a "now" marker
  // on a future/past day's chart wouldn't correspond to anything real.
  const weatherInfoCurrentTime = isToday
    ? weatherInfoHourly.find(h => h.time.startsWith(currentHourPrefix))?.time ?? null
    : null

  // Map pins for the currently-selected day only, not the whole trip — one
  // marker per activity. activity.lat/lng already reflect the current plan
  // regardless of is_swapped (apply_swap overwrites them to the alternate's
  // coordinates on swap), so only the label needs the is_swapped branch, not
  // position. The route line itself (bracketed with the hotel at both ends
  // when one's set) is computed inside MapView from `stops`/`hotel` — no
  // separate routeStops here, it'd just be unused dead state.
  const stops = itineraryDay?.activities
    ?.filter(activity => activity.lat !== 0 && activity.lng !== 0)
    .map(activity => ({
      position: [activity.lat, activity.lng],
      label: activity.is_swapped ? activity.alternate_name : activity.name,
    })) || []

  // --- SECTION 5: UI RENDERING ---
  return (
    <div className="space-y-6">

      {/* Fires independently of every {trip && ...} section below — those
          stay blank forever if trip never loads, so this is the only thing
          that renders in the loading/failed cases. Loading and failed are
          otherwise visually identical (both a blank page), which is exactly
          the ambiguity this is meant to resolve. */}
      {!trip && !tripLoadError && (
        <div>
          <span className="sr-only">Loading trip...</span>
          <SkeletonTripPage />
        </div>
      )}

      {tripLoadError && (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500">
            We couldn't load this trip — it may have been deleted, or the link may be incorrect.
          </p>
          <Link to="/dashboard" className="text-brand-600 font-medium hover:text-brand-700 inline-block">
            Back to My Trips
          </Link>
        </div>
      )}

      {/* 5A: Hero Header */}
      {trip && (
        // Contained to max-w-6xl (matching every section below) instead of
        // the previous edge-to-edge w-screen breakout — full-bleed made the
        // banner's aspect ratio so wide/short relative to the source photo
        // that bg-cover had to zoom in drastically, leaving almost nothing
        // of the skyline visible regardless of vertical crop position.
        <div className="max-w-6xl mx-auto">
          {(() => {
            const heroImage = findDestinationImage(destination)
            return (
          <div
            // h-96 (not h-72) when there's a photo — a taller banner needs
            // less bg-cover zoom to fill its width, so more of the photo's
            // height survives the crop. Each photo has its own tuned
            // backgroundPosition (see destinationImages.js).
            // fit:'contain' photos (see above) layer the photo over the
            // same indigo/purple gradient as the no-photo fallback, so the
            // letterboxed gap reads as intentional, not a rendering bug.
            className={`relative text-white flex flex-col justify-between px-4 sm:px-8 py-8 rounded-3xl shadow-bento overflow-hidden ${heroImage ? 'h-96' : 'h-72 bg-gradient-to-br from-brand-600 to-purple-600'} ${heroImage && heroImage.fit !== 'contain' ? 'bg-cover' : ''}`}
            style={
              heroImage
                ? heroImage.fit === 'contain'
                  ? {
                      backgroundImage: `url(${heroImage.url}), linear-gradient(to bottom right, #4f46e5, #9333ea)`,
                      backgroundSize: 'contain, cover',
                      backgroundPosition: `${heroImage.position}, center`,
                      backgroundRepeat: 'no-repeat, no-repeat',
                    }
                  : { backgroundImage: `url(${heroImage.url})`, backgroundPosition: heroImage.position }
                : undefined
            }
          >
            {/* Scrim so the white text stays legible over a photo, tinted
                indigo/purple (not flat black) to stay tonally consistent with
                the gradient this replaces, rather than looking like an
                unrelated photo dropped on top of the app. */}
            {heroImage && (
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-900/40 to-purple-900/20" />
            )}
            <div className="relative w-full flex justify-end">
              {status && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>{status}</span>}
            </div>
            <div className="relative w-full">
              <p className="flex items-center gap-1.5 text-sm text-brand-200"><MapPin size={14} /> {capitalize(destination)}</p>
              <h2 className="text-3xl font-bold mt-1">{capitalize(trip.name || `${destination} Trip`)}</h2>
              {trip.start_date && trip.end_date && (
                <p className="flex items-center gap-1.5 text-sm text-brand-100 mt-2">
                  <Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}
                  <button type="button" onClick={openDatesModal} className="ml-1 text-brand-100 underline hover:text-white">Edit Dates</button>
                </p>
              )}
            </div>
          </div>
            )
          })()}
        </div>
      )}

      <Modal open={hotelModalOpen} onClose={() => setHotelModalOpen(false)} title={trip?.hotel_address ? 'Edit Hotel' : 'Add Hotel'}>
        <HotelSearchInput
          id="hotel-edit"
          value={hotelDraft}
          onChange={handleHotelChange}
          cityContext={trip?.destination}
          placeholder="e.g. The Ritz Paris"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setHotelModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveHotel} disabled={savingTrip}>
            {savingTrip ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal open={datesModalOpen} onClose={() => setDatesModalOpen(false)} title="Edit Dates">
        <div className="space-y-3">
          <Input
            id="edit-start-date"
            label="Date Depart"
            type="date"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
          />
          <Input
            id="edit-end-date"
            label="Date Return"
            type="date"
            value={endDraft}
            onChange={(e) => setEndDraft(e.target.value)}
          />
          {datesInvalid && <p className="text-sm text-red-600">End date must be after start date.</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setDatesModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveDates} disabled={savingTrip || datesInvalid}>
            {savingTrip ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal open={editActivityModalOpen} onClose={() => setEditActivityModalOpen(false)} title="Edit Activity">
        <div className="space-y-3">
          <Input
            id="edit-activity-day"
            label="Day"
            type="date"
            min={trip?.start_date}
            max={trip?.end_date}
            value={activityDayDraft}
            onChange={(e) => setActivityDayDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              id="edit-activity-start"
              label="Start Time"
              type="time"
              className="flex-1"
              value={activityStartDraft}
              onChange={(e) => setActivityStartDraft(e.target.value)}
            />
            <Input
              id="edit-activity-end"
              label="End Time"
              type="time"
              className="flex-1"
              value={activityEndDraft}
              onChange={(e) => setActivityEndDraft(e.target.value)}
            />
          </div>
          <Input
            id="edit-activity-name"
            label="Name"
            type="text"
            value={activityNameDraft}
            onChange={(e) => setActivityNameDraft(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="edit-activity-location" className="field-label">Location</label>
              <ActivityLocationInput
                id="edit-activity-location"
                value={activityLocationDraft}
                onChange={({ label, lat, lon }) => {
                  setActivityLocationDraft(label)
                  setActivityLatLngDraft({ lat, lon })
                }}
                cityContext={trip?.destination}
                cityCenter={mapCenter}
                placeholder="Search for a place"
              />
            </div>
            {/* Fixed checkbox lives to the right of the location field —
                the field most relevant to "is this still the same booked
                thing" is the natural pairing for this toggle. */}
            <label className="flex items-center gap-1.5 text-sm text-gray-700 shrink-0 pb-2.5 px-3 rounded-xl bg-surface ring-1 ring-gray-200/70 h-[42px]">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={activityFixedDraft}
                onChange={(e) => setActivityFixedDraft(e.target.checked)}
              />
              Fixed
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setEditActivityModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveActivity} disabled={savingActivity}>
            {savingActivity ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal open={addActivityModalOpen} onClose={() => setAddActivityModalOpen(false)} title="Add Activity">
        <div className="space-y-3">
          <Input
            id="new-activity-day"
            label="Day"
            type="date"
            min={trip?.start_date}
            max={trip?.end_date}
            value={newActivityDayDraft}
            onChange={(e) => setNewActivityDayDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              id="new-activity-start"
              label="Start Time"
              type="time"
              className="flex-1"
              value={newActivityStartDraft}
              onChange={(e) => setNewActivityStartDraft(e.target.value)}
            />
            <Input
              id="new-activity-end"
              label="End Time"
              type="time"
              className="flex-1"
              value={newActivityEndDraft}
              onChange={(e) => setNewActivityEndDraft(e.target.value)}
            />
          </div>
          <Input
            id="new-activity-name"
            label="Name"
            type="text"
            value={newActivityNameDraft}
            onChange={(e) => setNewActivityNameDraft(e.target.value)}
          />
          <div>
            <label htmlFor="new-activity-location" className="field-label">Location</label>
            <ActivityLocationInput
              id="new-activity-location"
              value={newActivityLocationDraft}
              onChange={({ label, lat, lon }) => {
                setNewActivityLocationDraft(label)
                setNewActivityLatLngDraft({ lat, lon })
              }}
              cityContext={trip?.destination}
              cityCenter={mapCenter}
              placeholder="Search for a place"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="field-label mb-1">Type</span>
              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-sm text-gray-700 px-3 py-2 rounded-xl bg-surface ring-1 ring-gray-200/70">
                  <input
                    type="radio"
                    name="new-activity-type"
                    value="outdoor"
                    className="accent-brand-600"
                    checked={newActivityTypeDraft === 'outdoor'}
                    onChange={() => setNewActivityTypeDraft('outdoor')}
                  />
                  Outdoor
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 px-3 py-2 rounded-xl bg-surface ring-1 ring-gray-200/70">
                  <input
                    type="radio"
                    name="new-activity-type"
                    value="indoor"
                    className="accent-brand-600"
                    checked={newActivityTypeDraft === 'indoor'}
                    onChange={() => setNewActivityTypeDraft('indoor')}
                  />
                  Indoor
                </label>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 shrink-0 px-3 py-2 rounded-xl bg-surface ring-1 ring-gray-200/70 mt-6">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={newActivityFixedDraft}
                onChange={(e) => setNewActivityFixedDraft(e.target.checked)}
              />
              Fixed
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setAddActivityModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreateActivity} disabled={savingNewActivity || newActivityInvalid}>
            {savingNewActivity ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </Modal>

      <Modal open={reviewModalOpen} onClose={() => setReviewModalOpen(false)} title="Update anything else first?">
        <p className="text-sm text-gray-600 mb-4">
          Your itinerary is generated from your dates, hotel, and flights together — want to update anything else before we regenerate it?
        </p>
        <div className="flex flex-col gap-2">
          {lastEdited !== 'dates' && (
            // "Update Dates", not "Edit Dates" — the hero card above already
            // has its own "Edit Dates" button, and this modal renders as an
            // overlay on top of it rather than replacing it, so reusing the
            // same label would make both ambiguous to find/click.
            <Button type="button" variant="secondary" onClick={handleReviewEditDates} className="w-full justify-start">
              Update Dates
            </Button>
          )}
          {lastEdited !== 'hotel' && (
            <Button type="button" variant="secondary" onClick={handleReviewEditHotel} className="w-full justify-start">
              Update Hotel
            </Button>
          )}
          {lastEdited !== 'outbound' && (
            <Button type="button" variant="secondary" onClick={handleReviewEditOutbound} className="w-full justify-start">
              Edit Outbound Flight
            </Button>
          )}
          {lastEdited !== 'return' && (
            <Button type="button" variant="secondary" onClick={handleReviewEditReturn} className="w-full justify-start">
              Edit Return Flight
            </Button>
          )}
          <Button type="button" onClick={handleReviewRegenerateNow} disabled={generating} className="w-full mt-2">
            {generating ? 'Regenerating...' : "No, regenerate now"}
          </Button>
        </div>
      </Modal>

      <Modal size="lg" open={Boolean(weatherInfoModalMetric)} onClose={() => setWeatherInfoModalMetric(null)} title={weatherInfoMeta ? `${weatherInfoMeta.label} — Hourly Trend` : ''}>
        {weatherInfoMeta && (
          weatherInfoHourly.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface p-4 ring-1 ring-gray-200/60">
                <Sparkline
                  data={weatherInfoHourly}
                  unit={weatherInfoMeta.unit}
                  currentTime={weatherInfoCurrentTime}
                  color={weatherInfoMeta.color}
                  bands={weatherInfoMeta.bands}
                />
              </div>
              {weatherInfoMeta.advice(forecastDay) && (
                <p className="flex items-start gap-2 text-sm text-gray-700 bg-brand-50 ring-1 ring-brand-100 rounded-xl p-3.5">
                  <Info size={15} className="text-brand-500 shrink-0 mt-0.5" />
                  {weatherInfoMeta.advice(forecastDay)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No hourly data available for this day.</p>
          )
        )}
      </Modal>

      {/*RISK MODAL*/}
      <Modal size="lg" open={Boolean(riskInfoModal)} onClose={() => setRiskInfoModal(null)} title={riskInfoMeta[riskInfoModal]?.label || ""}>
        {riskInfoModal && (
          <div className="space-y-4">

            {forecastDay.is_climatology && CLIMATOLOGY_UNAVAILABLE_TYPES.includes(riskInfoModal) ? (
              // Flood, Snow, Hiking Safety, UV, Visibility — no historical
              // substitute exists for these (see FORECAST_ONLY_NOTE above), so
              // there's no score/breakdown to show, just the explanation.
              <p className="text-sm text-gray-600">{FORECAST_ONLY_NOTE}</p>

            ) : riskInfoModal === "heavyRain" ? (
              forecastDay.is_climatology ? (
                forecastDay.rain_chance == null ? (
                  // rain_chance is normally always real on a climatology day —
                  // null here means the historical archive fetch itself failed
                  // (e.g. an API outage/quota limit), not that this destination
                  // genuinely has no rain data. Same caveat Flood/Snow show for
                  // their own "nothing to report" case, rather than rendering
                  // a bare "%" with no number.
                  <p className="text-sm text-gray-600">{FORECAST_ONLY_NOTE}</p>
                ) : (
                  // rain_chance stands in for heavy_rain_probability on climatology
                  // days (see rainChanceLevel above) — a real historical stat, but a
                  // different one, so this skips the ML-model writeup entirely
                  // rather than describing a model that didn't run.
                  <div className="space-y-4 text-sm">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{forecastDay.rain_chance}%</div>
                      <div className="text-gray-500">Historical rain frequency</div>
                    </div>
                    <p className="text-xs text-gray-500 border-t pt-4">
                      Based on this destination's 10-year historical rain frequency, not a live forecast.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-4 text-sm">

                  {/* Probability */}
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {forecastDay.heavy_rain_probability}%
                    </div>

                    <div className="text-gray-500">
                      Heavy rain probability
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">

                    <h3 className="font-semibold">
                      About this prediction
                    </h3>

                    <div>
                      <span className="font-medium">
                        Model:
                      </span>
                      <p>
                        LightGBM Classifier
                      </p>
                    </div>

                    <div>
                      <span className="font-medium">
                        Purpose:
                      </span>
                      <p>
                        Predict the probability of heavy rainfall
                        based on weather forecast conditions.
                      </p>
                    </div>

                    <div>
                      <span className="font-medium">
                        Features analysed:
                      </span>
                      <p>
                        17 weather and seasonal features
                      </p>
                    </div>

                    <div>
                      <span className="font-medium">
                        Includes:
                      </span>

                      <ul className="list-disc ml-5">
                        <li>Rainfall</li>
                        <li>Temperature</li>
                        <li>Humidity</li>
                        <li>Pressure</li>
                        <li>Wind</li>
                        <li>Solar radiation</li>
                        <li>Location</li>
                        <li>Seasonal patterns</li>
                      </ul>
                    </div>

                    <p className="text-xs text-gray-500">
                      The prediction is generated using historical
                      weather patterns and current forecast data.
                    </p>

                  </div>
                </div>
              )

            ) : riskInfoModal === "wind" ? (
              // Wind only ever reaches this modal on a climatology day (see
              // CLIMATOLOGY_UNAVAILABLE_TYPES, which no longer includes it) —
              // a real-forecast day opens the hourly-trend popup instead.
              // wind_speed here is a real 10-year historical average
              // (climatology_service.py), not a computed 0-100 risk score,
              // so this shows the value/level directly rather than the
              // generic score block below.
              forecastDay.wind_speed == null ? (
                // wind_speed is normally always real on a climatology day —
                // null means the historical archive fetch itself failed (e.g.
                // an API outage/quota limit). Math.round(null) is 0 in JS, so
                // without this guard it would silently show "0 km/h" — a real-
                // looking number for a day with no actual data.
                <p className="text-sm text-gray-600">{FORECAST_ONLY_NOTE}</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{Math.round(forecastDay.wind_speed)} km/h</div>
                    <div className="text-gray-500">{forecastDay.wind_level}</div>
                  </div>
                  <p className="text-xs text-gray-500 border-t pt-4">
                    Based on this destination's 10-year historical average wind speed, not a live forecast.
                  </p>
                </div>
              )

            ) : (
              <>
                {/* Extreme Temp and Beach Safety both compute a real score on
                    climatology days from historical averages standing in for
                    live inputs (temp_max for feels_like_temp; rain_chance/
                    average_rain/historical wind for their real-forecast
                    counterparts — see climatology_service.py). Score/advice/
                    breakdown below are still real values from that
                    substitution, just with this one extra line making the
                    source clear. */}
                {forecastDay.is_climatology && (riskInfoModal === "temperature" || riskInfoModal === "beach") && (
                  <p className="text-xs text-gray-500">
                    {riskInfoModal === "temperature"
                      ? "Based on this destination's 10-year historical average temperature, not a live forecast."
                      : "Based on this destination's 10-year historical weather averages, not a live forecast."}
                  </p>
                )}

                {/* Score */}
                {riskInfoMeta[riskInfoModal]?.score != null && (
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {Math.round(riskInfoMeta[riskInfoModal].score)}%
                    </div>

                    <div className="text-sm text-gray-500">
                      {riskInfoMeta[riskInfoModal].level}
                    </div>
                  </div>
                )}

                {/* Temperature advice */}
                {riskInfoModal === "temperature" && (
                  <div className="text-sm text-gray-600">
                    {riskInfoMeta.temperature.advice}
                  </div>
                )}

                {/* Breakdown */}
                {riskInfoMeta[riskInfoModal]?.breakdown?.map((item) => (
                  <div
                    key={item.factor}
                    className="flex justify-between items-center border-b pb-2"
                  >
                    <div>
                      <div className="font-medium">
                        {item.factor}
                      </div>

                      <div className="text-xs text-gray-500">
                        {typeof item.value === "number" && item.factor in RISK_BREAKDOWN_DECIMALS
                          ? item.value.toFixed(RISK_BREAKDOWN_DECIMALS[item.factor])
                          : item.value} {item.unit}
                      </div>
                    </div>

                    <div
                      className={
                        item.impact > 0
                          ? "text-green-600"
                          : item.impact < 0
                          ? "text-red-600"
                          : "text-gray-400"
                      }
                    >
                      {item.impact > 0 ? "+" : ""}
                      {item.impact}
                    </div>

                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 5D: Trip rail (left) + day/forecast/activities pane (right) */}
      {trip && (
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">

        <TripSidebar
          trip={trip}
          tripId={tripId}
          hasHotel={Boolean(trip.hotel_address?.trim())}
          hotelParts={hotelParts}
          onEditHotel={openHotelModal}
          tripDates={tripDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          generating={generating}
          hasItinerary={Boolean(itinerary)}
          onGenerate={handleGenerate}
        />

      {/* min-w-0 so the horizontally-scrollable strips inside can never widen
          this grid column past its share of the row. */}
      <Card className="lg:col-span-2 min-w-0 p-5 sm:p-6 space-y-5">
        {/* Day header — the selected day's identity on the left, its weather
            headline (temp + condition + the single worst risk) condensed onto
            the same row on the right. The full 9-card risk strip and hourly
            strip live behind the toggle below, so the activity timeline (the
            actual plan) is what fills this pane by default. */}
        <div className="flex flex-col gap-3 pb-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="heading-3 whitespace-nowrap">
              {selectedDayNumber > 0 ? `Day ${selectedDayNumber} · ${selectedDate}` : 'Day-by-day Activities'}
            </h2>
            {weatherStatus === 'loaded' && forecastDay?.is_climatology && (
              <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                Typical weather (historical average)
              </span>
            )}
          </div>

          {weatherStatus === 'loaded' && forecastDay && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {/* Weather at a glance — same values the old full-height daily
                  summary showed (current temp + feels-like for today, H/L,
                  condition icon + text), on one line. Sunrise/sunset moved
                  into the expandable panel below. */}
              <div className="flex items-center gap-3">
                {/* Grouped and bottom-aligned so "Clear" and "Feels like"
                    land on the same row — the icon (32px) and the big
                    leading-none temp number aren't quite the same height,
                    so items-center on the outer row alone left them a
                    couple pixels off from each other. */}
                <div className="flex items-end gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <WeatherIcon condition={forecastDay.condition} timeStr={forecastDay.date + "T12:00:00"} className="w-8 h-8 text-brand-500" />
                    <span className="text-xs font-semibold text-gray-700 capitalize whitespace-nowrap">{forecastDay.condition}</span>
                  </div>
                  {isToday && (
                    <div className="flex flex-col">
                      <span className="font-display text-3xl font-bold text-gray-900 leading-none">{getCurrentTemp()}°</span>
                      {getFeelsLikeTemp() !== null && (
                        <span className="text-xs font-medium text-gray-400 whitespace-nowrap">Feels like {getFeelsLikeTemp()}°</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {isToday ? (
                    <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                      H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                    </span>
                  ) : (
                    <span className="font-display text-2xl font-bold text-gray-900 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-500">H:</span> {Math.round(forecastDay.temp_max)}&deg;
                      <span className="text-sm font-medium text-gray-500 ml-2">L:</span> {Math.round(forecastDay.temp_min)}&deg;
                    </span>
                  )}
                  {/* Moved up from the collapsible panel — the condensed
                      row had room to spare once "Feels like" stopped
                      stacking under H/L, and sunrise/sunset is small enough
                      to earn a permanent spot rather than staying hidden
                      behind a tap. */}
                  {forecastDay.sunrise && forecastDay.sunset && (
                    <div className="flex items-center gap-4 pl-3 border-l border-gray-200">
                      <span className="flex items-center gap-1.5 text-base font-medium text-gray-900 whitespace-nowrap">
                        <Sunrise size={20} className="text-amber-500" /> {forecastDay.sunrise}
                      </span>
                      <span className="flex items-center gap-1.5 text-base font-medium text-gray-900 whitespace-nowrap">
                        <Sunset size={20} className="text-orange-600" /> {forecastDay.sunset}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Simple rain/not-rain suggestion, replacing the old
                  worst-risk summary — the full risk breakdown is still one
                  tap away via "View full forecast" below, so this is a quick
                  practical nudge, not a severity readout. ml-auto keeps it
                  pinned to the right of this row rather than sitting flush
                  against the temperature text on the left. */}
              {isRainyDay && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-blue-800 bg-blue-50 ring-1 ring-blue-100 rounded-lg px-2.5 py-1.5 ml-auto shrink-0">
                  <Lightbulb size={14} className="text-blue-500 shrink-0" />
                  <span className="whitespace-nowrap"><span className="font-semibold">Tip:</span> Bring an umbrella today</span>
                </p>
              )}
            </div>
          )}

          {/* Always its own row, never sharing one with the temp/condition/
              risk line above — that line's total width varies day to day
              (e.g. "Extreme Heat" vs "High Heat"), so letting this share it
              meant the button's position shifted depending on today's exact
              wording. A dedicated row keeps it in the same place every time. */}
          {weatherStatus === 'loaded' && forecastDay && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForecastExpanded((open) => !open)}
                aria-expanded={forecastExpanded}
                aria-controls="full-forecast-panel"
                className="flex items-center gap-1 shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                {forecastExpanded ? 'Hide full forecast' : 'View full forecast'}
                {forecastExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          )}
        </div>

        {itineraryNotice && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">{itineraryNotice}</div>}

        {/* WEATHER MODULE */}
        {weatherStatus === 'loading' && (
          <div>
            <span className="sr-only">Loading weather...</span>
            <SkeletonWeatherPanel />
          </div>
        )}

        {weatherStatus === 'failed' && (
          <EmptyState
            compact
            icon={CloudOff}
            title="Weather unavailable for this destination."
            description="We couldn't reach the forecast — try refreshing this page in a moment."
          />
        )}

        {weatherStatus === 'loaded' && forecastDay && forecastExpanded && (
          <div id="full-forecast-panel" className="border border-gray-100 p-4 rounded-lg bg-gray-50/50 space-y-4">

                <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-800">
                    <span className="flex items-center gap-2"><AlertTriangle size={16} className="text-brand-600" /> Risks</span>
                    {/* Deliberately generic, not "Tap Wind, UV, or Visibility" — only those
                        3 cards open a popup today (see WEATHER_INFO_META), but more risk
                        cards are expected to gain the same click-for-details behavior later,
                        and this wording shouldn't need to change when they do. */}
                    <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                        <Info size={12} /> Tap a card for more details
                    </span>
                </h3>

                {/* The "today's main risk" at-a-glance line lives in the day
                    header above now (always visible, whether or not this panel
                    is expanded) rather than being repeated here. */}

                {/* 9 cards total (6 risk + 3 weather-info) in a horizontally
                    scrollable strip like the hourly forecast below — each
                    card keeps a natural, comfortable width, so the scrollbar
                    only appears if they don't all fit, rather than forcing a
                    fixed visible count. Extreme Temp renders its own layout
                    (level + advice text, no %/pill) since temperature_level
                    isn't a probability/score like the others. relative +
                    the two gradient divs below are a purely visual "there's
                    more to scroll" affordance, not part of the strip itself. */}
                <div className="relative">
                <motion.div
                  ref={riskStripDrag.ref}
                  onPointerDown={riskStripDrag.onPointerDown}
                  onPointerMove={riskStripDrag.onPointerMove}
                  onPointerUp={riskStripDrag.onPointerUp}
                  onPointerLeave={riskStripDrag.onPointerLeave}
                  onClickCapture={riskStripDrag.onClickCapture}
                  key={selectedDate}
                  className="scroll-strip gap-3 pb-2 -mx-1 px-1 cursor-grab active:cursor-grabbing"
                  variants={STRIP_VARIANTS}
                  initial="hidden"
                  animate="show"
                >
                  {[
                    {
                      // Climatology days have no live heavy_rain_probability, so this
                      // falls back to rain_chance (10-year historical rain frequency,
                      // see rainChanceLevel above) — a different signal standing in for
                      // the real one, same as Flood/Beach Safety/Snow already do.
                      l: 'Heavy Rain',
                      v: forecastDay.is_climatology
                        ? (forecastDay.rain_chance == null ? '—' : `${forecastDay.rain_chance}%`)
                        : (forecastDay.heavy_rain_probability == null ? '—' : `${forecastDay.heavy_rain_probability}%`),
                      s: forecastDay.is_climatology
                        ? rainChanceLevel(forecastDay.rain_chance)
                        : (forecastDay.heavy_rain_probability == null ? 'Unknown' : (forecastDay.heavy_rain_warning ? 'High' : 'Low')),
                      i: Umbrella,
                      bg: CARD_IDENTITY.heavyRain,
                      type: 'heavyRain',
                    },
                    {
                      l: 'Flood',
                      v: forecastDay.flood_score == null
                        ? '—'
                        : `${Math.round(forecastDay.flood_score)}%`,
                      s: forecastDay.flood_risk || 'Unknown',
                      i: Waves,
                      bg: CARD_IDENTITY.flood,
                      type: 'flood',
                    },
                    {
                      l: 'Beach Safety',
                      v: forecastDay.beach_safety_score == null
                        ? '—'
                        : `${Math.round(forecastDay.beach_safety_score)}%`,
                      s: forecastDay.beach_safety_level || 'Unknown',
                      i: Palmtree,
                      bg: CARD_IDENTITY.beachSafety,
                      type: 'beach',
                    },
                    {
                      l: 'Snow',
                      v: forecastDay.snow_probability == null
                        ? '—'
                        : `${forecastDay.snow_probability}%`,
                      s: forecastDay.snow_probability == null
                        ? 'Unknown'
                        : snowLevel(forecastDay.snow_probability),
                      i: Snowflake,
                      bg: CARD_IDENTITY.snow,
                      type: 'snow',
                    },
                  ].map((c) => (
                      // flex-col: icon chip, then label/value/badge as a tight cluster.
                      // The icon chip carries the family identity color (what kind of
                      // hazard); the badge below is the ONLY severity signal
                      // (levelColorClass), kept visually and structurally separate.
                      <motion.div
                        key={c.l}
                        variants={ITEM_VARIANTS}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING_SOFT}
                        onClick={() => setRiskInfoModal(c.type)}
                        className={`${RISK_CARD_CLASSES} ${RISK_FAMILY_BORDER[c.bg] || ''} cursor-pointer`}
                      >
                        <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center ${c.bg}`}>
                          <c.i size={18} />
                        </span>
                        <div className="text-label font-semibold uppercase text-ink-muted">{c.l}</div>
                        <div className="font-display text-2xl font-bold text-ink tabular-nums">{c.v}</div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelColorClass(c.s)}`}>
                          {c.s}
                        </span>
                      </motion.div>
                  ))}
                  {/* Explanations (climatology caveats, forecast-only notices, the
                      real ML/formula writeups) all live in the risk-info modal now
                      (see riskInfoModal below) — every card face just shows label,
                      value, badge, same shape whether the day is climatology or a
                      real forecast, tap for detail. */}
                  <motion.div
                      variants={ITEM_VARIANTS}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_SOFT}
                      onClick={() => setRiskInfoModal("temperature")}
                      className={`${RISK_CARD_CLASSES} ${RISK_FAMILY_BORDER[CARD_IDENTITY.extremeTemp] || ''} cursor-pointer`}
                    >
                      <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center ${CARD_IDENTITY.extremeTemp}`}>
                        <Flame size={18} />
                      </span>
                      <div className="text-label font-semibold uppercase text-ink-muted">Extreme Temp</div>

                      <div className="font-display text-lg font-bold text-ink">
                        {forecastDay.temperature_level ?? '—'}
                      </div>

                      {forecastDay.temperature_advice && (
                        <div className="text-[11px] text-gray-500 leading-snug">{forecastDay.temperature_advice}</div>
                      )}
                    </motion.div>
                  {[
                    {
                      l: 'Hiking Safety',
                      v: forecastDay.hiking_safety_score == null ? '—' : `${Math.round(forecastDay.hiking_safety_score)}%`,
                      s: forecastDay.hiking_safety_level || 'Unknown',
                      i: Mountain, bg: CARD_IDENTITY.hikingSafety,
                      type: 'hiking',
                    },
                    {
                      l: 'Wind',
                      v: forecastDay.wind_speed == null ? '—' : `${Math.round(forecastDay.wind_speed)} km/h`,
                      s: forecastDay.wind_level || 'Unknown',
                      i: Wind, bg: CARD_IDENTITY.wind, metric: 'wind', type: 'wind',
                    },
                    {
                      l: 'UV Index',
                      v: forecastDay.uv_index == null ? '—' : Math.round(forecastDay.uv_index),
                      s: forecastDay.uv_level || 'Unknown',
                      i: SunDim, bg: CARD_IDENTITY.uv, metric: 'uv', type: 'uv',
                    },
                    {
                      l: 'Visibility',
                      v: forecastDay.visibility_m == null ? '—' : `${(forecastDay.visibility_m / 1000).toFixed(1)} km`,
                      s: forecastDay.visibility_m == null ? 'Unknown' : visibilityLevel(forecastDay.visibility_m),
                      i: Eye, bg: CARD_IDENTITY.visibility, metric: 'visibility', type: 'visibility',
                    },
                  ].map((c) => {
                       // Weather-info cards (metric set) open the hourly-trend popup on a
                       // real-forecast day — climatology days have no hourly data for it
                       // to show, so they open the risk-detail modal instead (same modal
                       // Hiking Safety, which has no hourly popup at all, always uses).
                      return (
                        <motion.button key={c.l}
                            type="button"
                            variants={ITEM_VARIANTS}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            transition={SPRING_SOFT}
                            onClick={forecastDay.is_climatology || !c.metric ? () => setRiskInfoModal(c.type) : () => setWeatherInfoModalMetric(c.metric)}
                            className={`${RISK_CARD_CLASSES} ${RISK_FAMILY_BORDER[c.bg] || ''} cursor-pointer`}>
                            <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center ${c.bg}`}>
                              <c.i size={18} />
                            </span>
                            <div className="text-label font-semibold uppercase text-ink-muted">{c.l}</div>
                            <div className="font-display text-2xl font-bold text-ink tabular-nums">{c.v}</div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelColorClass(c.s)}`}>
                                {c.s}
                            </span>
                        </motion.button>
                      )
                  })}
                </motion.div>
                {/* Edge fades — always-on hint that the strip scrolls, rather than
                    tracking scroll position for a "only show once scrolled" version.
                    Matches the strip's own bg-gray-50/50 wrapper background so the
                    fade reads as a soft vignette, not a mismatched color block. */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-50 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-50 to-transparent" />
                </div>

                {/* Climatology-fallback days have no hourly data at all (see
                    forecastDay.is_climatology) — the whole section, sunrise/
                    sunset markers included, only makes sense for real forecast
                    days. */}
                {!forecastDay.is_climatology && (
                <>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-5 border-t">
                    <Clock size={16} className="text-brand-600" /> Hourly Forecast
                </h3>

                {/* Hourly Forecast — pt-1 keeps the "Now" card's ring from
                    getting clipped by this container's own overflow edge. */}
                <div
                  ref={hourlyStripDrag.ref}
                  onPointerDown={hourlyStripDrag.onPointerDown}
                  onPointerMove={hourlyStripDrag.onPointerMove}
                  onPointerUp={hourlyStripDrag.onPointerUp}
                  onPointerLeave={hourlyStripDrag.onPointerLeave}
                  className="scroll-strip gap-2 pt-1 pb-2 cursor-grab active:cursor-grabbing"
                >
                  {(() => {
                    // Sunrise/sunset get their own inserted card at their exact time
                    // (Apple Weather-style), sorted in alongside the on-the-hour cards,
                    // rather than just tagging the nearest hour's existing card.
                    const dayHours = hourlyForecast
                      .filter(h => h.time.startsWith(forecastDay.date))
                      .map(h => ({
                          kind: 'hour',
                          time: h.time,
                          condition: h.condition,
                          rain_probability: h.rain_probability,
                          temperature: h.temperature,
                          sortMinutes: parseInt(h.time.split('T')[1].split(':')[0], 10) * 60,
                      }))

                    const sunEvents = [
                      { kind: 'sunrise', label: forecastDay.sunrise },
                      { kind: 'sunset', label: forecastDay.sunset },
                    ]
                      .map(e => {
                          const sortMinutes = parseSunEventMinutes(e.label)
                          if (sortMinutes === null) return null
                          // Drop the backend's zero-padded hour ("06:34 AM" -> "6:34 AM")
                          // to match formatHour's un-padded "6 AM" style on other cards.
                          return { ...e, sortMinutes, label: e.label.replace(/^0/, '') }
                      })
                      .filter(Boolean)

                    return [...dayHours, ...sunEvents]
                      .sort((a, b) => a.sortMinutes - b.sortMinutes)
                      .map((h, i) => {
                        if (h.kind !== 'hour') {
                          const Icon = h.kind === 'sunrise' ? Sunrise : Sunset
                          const color = h.kind === 'sunrise' ? 'text-accent-500' : 'text-orange-500'
                          return (
                            <div key={h.kind} className="flex flex-col items-center min-w-[68px] shrink-0 snap-start gap-0.5 rounded-2xl px-2 py-3 transition-colors hover:bg-white">
                                <span className={`text-[10px] font-semibold ${color} whitespace-nowrap`}>{h.label}</span>
                                <Icon size={20} className={color} />
                                {/* Empty h-4 slot mirrors the rain-% slot on hour cards, so
                                    this card's height/rows line up with its neighbors. */}
                                <div className="h-4" />
                                <span className="text-[10px] font-bold text-gray-500 leading-none mt-0.5 capitalize">{h.kind}</span>
                            </div>
                          )
                        }

                        const isNow = h.time.startsWith(currentHourPrefix)
                        return (
                          <div key={i} className={`flex flex-col items-center min-w-[68px] shrink-0 snap-start gap-0.5 rounded-2xl px-2 py-3 transition-colors ${isNow ? 'bg-brand-50 ring-1 ring-brand-300 shadow-bento-sm' : 'hover:bg-white'}`}>
                              <span className={`text-[10px] ${isNow ? 'text-brand-600 font-bold' : 'text-gray-500'}`}>{isNow ? 'Now' : formatHour(h.time)}</span>

                              <WeatherIcon condition={h.condition} timeStr={h.time} className="w-5 h-5 text-brand-500" />

                              {/* Fixed-height container (h-4) that holds rain OR empty space.
                                  Only surfaced when the icon itself shows rain/thunder and the
                                  probability clears a threshold — otherwise a sunny/cloudy icon
                                  could still show a rain %, which reads as contradictory. */}
                              <div className="h-4 flex items-center justify-center">
                                  {isRainyCondition(h.condition) && h.rain_probability != null && h.rain_probability >= 30 && (
                                      <span className="text-[9px] font-bold text-blue-600 leading-none">
                                          {Math.round(h.rain_probability)}%
                                      </span>
                                  )}
                              </div>

                              {/* Temperature stays in the exact same spot regardless of rain */}
                              <span className="font-display font-bold text-sm leading-none mt-0.5">{Math.round(h.temperature)}°</span>
                          </div>
                        )
                      })
                  })()}
                </div>
                </>
                )}
            </div>
        )}

        {/* Itinerary List — the primary content of this pane now, so no
            border-t/heavy top spacing pushing it below a weather block. */}
        {itinerary && selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <ListChecks size={16} className="text-brand-600" /> Itinerary for Day {selectedDayNumber}
              </h3>
              <Button type="button" onClick={openAddActivityModal} variant="secondary" shape="pill" size="sm">
                <Plus size={14} /> Add Activity
              </Button>
            </div>
            {/* relative wrapper + the dimmed/skeleton overlay below only apply
                once there's already a plan on screen (generating && itinerary) —
                a first-time generate has nothing stale to dim, so it just shows
                the normal empty state underneath while `generating` is true. */}
            <div className="relative">
            <div className={generating && itinerary ? 'opacity-40 pointer-events-none' : ''}>
            {itineraryDay ? (
              <motion.ul
                key={selectedDate}
                className="space-y-0"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                initial="hidden"
                animate="show"
              >
                {itineraryDay.activities.map((activity, index) => {
                  const isLast = index === itineraryDay.activities.length - 1
                  const [startTime] = splitTimeSlot(activity.time_slot)
                  return (
                  <motion.li
                    key={activity.id}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    className="relative flex gap-4"
                  >
                    {/* Time-anchored rail: a dot per activity connected by a
                        running vertical line, like a real day itinerary rather
                        than a flat numbered list. */}
                    <div className="flex flex-col items-center w-14 shrink-0 pt-1">
                      <span className="text-xs font-semibold text-ink tabular-nums whitespace-nowrap">{startTime}</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-brand-100 shrink-0 mt-2" />
                      {!isLast && <span className="w-px flex-1 bg-gray-200 mt-1.5 mb-1.5" />}
                    </div>
                    <div className={`flex-1 rounded-2xl p-4 ${activity.is_swapped ? 'bg-amber-50/60 ring-1 ring-amber-100' : 'bg-surface'} ${isLast ? 'mb-0' : 'mb-4'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Swapped: explicit before/after comparison (struck-through
                            original -> alternate) instead of just striking the name
                            and burying the replacement in the details below. */}
                        {activity.is_swapped ? (
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-gray-400 line-through">{activity.name}</span>
                            <ArrowRight size={14} className="text-amber-500 shrink-0" />
                            <span className="font-semibold text-gray-900">{activity.alternate_name}</span>
                          </span>
                        ) : (
                          <span className="font-medium text-gray-900">{activity.name}</span>
                        )}
                        {/* activity.type already reflects the current plan regardless of
                            is_swapped (apply_swap overwrites it to the alternate's real
                            indoor/outdoor value, same as lat/lng) — Claude can swap to a
                            different outdoor spot, not just indoor, so this must read the
                            real value rather than assuming indoor whenever swapped. */}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${activity.type === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {activity.type}
                        </span>
                        {activity.is_swapped && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <CloudRain size={12} /> Swapped
                          </span>
                        )}
                        {activity.is_fixed && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            <Lock size={12} /> Fixed
                          </span>
                        )}
                        {weatherTags(activity.weather_sensitivity).map((tag) => {
                          const { label, icon: Icon, className } = WEATHER_TAG_STYLES[tag]
                          return (
                            <span key={tag} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${className}`}>
                              <Icon size={12} /> {label}
                            </span>
                          )
                        })}
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditActivityModal(activity)}
                            className="text-gray-400 hover:text-brand-600"
                            aria-label={`Edit ${activity.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(activity)}
                            className="text-gray-400 hover:text-red-600"
                            aria-label={`Delete ${activity.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {activity.is_swapped ? (
                        <>
                          <p className="text-sm text-gray-500">{activity.time_slot}</p>
                          <p className="text-sm text-gray-600">{activity.alternate_location}</p>
                          {/* Promoted out of a small italic caption into the same
                              Info-prefixed note treatment used for the weather-info
                              popup's advice text above (see weatherInfoMeta.advice),
                              just retinted amber for the swap context. */}
                          <p className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 ring-1 ring-amber-100 rounded-xl p-3.5 mt-2">
                            <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
                            {activity.swap_reason}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">{activity.time_slot}</p>
                          <p className="text-sm text-gray-600">{activity.location}</p>
                          <p className="text-sm text-gray-500">{activity.description}</p>
                        </>
                      )}
                    </div>
                  </motion.li>
                  )
                })}
              </motion.ul>
            ) : (
              <EmptyState
                compact
                icon={CalendarPlus}
                title="No activities generated for this day yet."
                description="Generate the itinerary and Navia will fill this day around the forecast."
              />
            )}
            </div>
            {/* Dimmed-list overlay while a regenerate is in flight — stale cards
                stay visible-but-inert (opacity-40 pointer-events-none above)
                rather than being replaced by a jarring full loading state. */}
            {generating && itinerary && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
                <Skeleton className="h-14 w-full max-w-md rounded-2xl" />
                <Skeleton className="h-14 w-full max-w-md rounded-2xl" />
                <Skeleton className="h-14 w-3/4 max-w-md rounded-2xl" />
              </div>
            )}
            </div>
          </div>
        )}
        {!itinerary && !itineraryNotice && (
          <Placeholder label="Your day-by-day plan will appear here once generated." />
        )}
      </Card>
      </div>
      )}

      {/* Full-width below the sidebar/main grid rather than squeezed into
          the narrow rail — a map that's too small to read isn't "low effort",
          it's just not useful. Still explicitly low-priority (see CLAUDE.md):
          internals untouched, just given room to actually work. */}
      {trip && (
      <Card className="p-5 sm:p-6">
        <h2 className="eyebrow flex items-center gap-1.5 mb-3">
          <MapPin size={12} className="text-brand-600" /> {capitalize(destination || 'Trip')} Map
        </h2>
        <MapView
          height="h-80"
          center={mapCenter}
          stops={stops}
          hotel={
            hotelLocation && trip.hotel_address
              ? { position: hotelLocation, label: trip.hotel_address }
              : null
          }
        />
      </Card>
      )}

      {trip && (
      <div className="flex justify-center">
        <Button to="/dashboard" shape="pill"><Briefcase size={16} /> Back to My Trips</Button>
      </div>
      )}
    </div>
  )
}