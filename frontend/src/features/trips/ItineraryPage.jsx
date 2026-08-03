import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Plane, Building2, MapPin, Calendar, CheckCircle2,
  Briefcase, Thermometer, Sparkles, Sun, Moon, Cloud,
  CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow,
  CloudLightning, AlertTriangle, Waves, Umbrella, Snowflake,
  SunDim, Wind, Eye, Sunrise, Sunset, Palmtree, Clock, Flame, Info,
  Pencil, Lock, Trash2, Plus, Mountain
} from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import Modal from '../../components/Modal'
import HotelSearchInput from '../../components/HotelSearchInput'
import ActivityLocationInput from '../../components/ActivityLocationInput'
import { getTrip, updateTrip } from './tripsApi'
import { getItinerary, generateItinerary, updateActivity, createActivity, deleteActivity } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity, geocodeAddress } from '../../lib/geocode'
import { capitalize } from '../../lib/format'
import { splitTimeSlot, joinTimeSlot } from '../../lib/timeSlot'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'
import { getPendingReview, clearPendingReview } from '../../lib/pendingReview'

// --- SECTION 1: HELPER FUNCTIONS ---

function airlineCode(flightNumber) {
  return (flightNumber || '').split(' ')[0]
}

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

const formatHour = (timeStr) => {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

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

const weatherIcon = (condition, timeStr) => {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  const isNight = hour < 6 || hour >= 20;
  const cond = (condition || '').toLowerCase();
  if (cond.includes('clear')) return isNight ? Moon : Sun;
  if (cond.includes('partly cloudy')) return isNight ? CloudMoon : CloudSun;
  if (cond.includes('overcast')) return Cloud;
  if (cond.includes('fog')) return CloudFog;
  if (cond.includes('snow')) return CloudSnow;
  if (cond.includes('thunder')) return CloudLightning;
  return CloudRain;
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

// Helper: Weather Icon Component
const WeatherIcon = ({ condition, timeStr, className }) => {
  const Icon = weatherIcon(condition, timeStr);
  return <Icon className={className} />;
};

const snowLevel = (pct) => {
  if (pct <= 0) return 'None';
  if (pct <= 50) return 'Low';
  return 'High';
};

// Explicit level -> color mapping for the risk-card badges, rather than an
// inline ternary that only recognizes 'High'/'Poor'/'Moderate'/'Low' — that
// old check treated 'Low' the same as 'Moderate' (both yellow), which was
// wrong for Heavy Rain's "Low" (no-warning/safe) state. Anything not listed
// here (Low, None, Good, Excellent) correctly falls through to green.
// Covers Wind/UV vocabulary too, since those are also shown as color badges.
const LEVEL_COLORS = {
  red: ['High', 'Poor', 'Very High', 'Extreme', 'Strong', 'Very Strong', 'Unsafe', 'Dangerous'],
  yellow: ['Moderate', 'Caution'],
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

// Fixed group identity color (not severity-based) — the badge (levelColorClass)
// remains the only red/yellow/green severity signal. Two groups: the daily
// risk cards (Heavy Rain/Flood/Beach Safety/Snow) share one color, and the
// Wind/UV/Visibility conditions cards share a different one.
const CARD_IDENTITY_BG = {
  heavyRain: 'bg-blue-50 border-blue-100',
  flood: 'bg-blue-50 border-blue-100',
  beachSafety: 'bg-blue-50 border-blue-100',
  snow: 'bg-blue-50 border-blue-100',
  extremeTemp: 'bg-blue-50 border-blue-100',
  hikingSafety: 'bg-blue-50 border-blue-100',
  wind: 'bg-blue-50 border-blue-100',
  uv: 'bg-blue-50 border-blue-100',
  visibility: 'bg-blue-50 border-blue-100',
};

// Shared by all 9 Risks-row cards (risk cards map, Extreme Temp, weather-info
// cards map) — only each card's identity bg/border color varies, appended
// by the caller.
const RISK_CARD_CLASSES = 'shrink-0 w-[160px] p-4 rounded border text-center flex flex-col items-center justify-center gap-1'

// Heavy Rain, Extreme Temp, Hiking Safety, Wind, UV and Visibility all read
// straight off the real forecast/ML path (see _get_forecast_days in
// weather_service.py) — climatology_service.py never sets them, by design,
// so a climatology day always has them null. That's a different situation
// from Flood/Beach Safety/Snow (which climatology *does* compute from
// historical data) and from a genuine "checked and unknown" result, so
// these cards swap their badge for this note instead of a plain 'Unknown'.
// Mirrors the Extreme Temp card's own existing bold-value + small-note-below
// layout (e.g. "High Heat" + "Limit intense outdoor activities...") rather
// than inventing new typography, so the row height/font sizing stays
// consistent with how a real-forecast day's row already looks.
const FORECAST_ONLY_NOTE = 'Only available once this day is within the 14-day forecast'

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

  const [mapCenter, setMapCenter] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('loading')

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
  const hasArrivalFlight = Boolean(trip?.arrival_flight_number)
  const hasDepartureFlight = Boolean(trip?.departure_flight_number)

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
          console.log("GEOCODE FAILED:", trip.destination);
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
            console.error("Destination:", trip.destination);
            console.error("Coordinates:", lat, lon);
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
        <div className="text-center py-16">
          <p className="text-gray-500 italic">Loading trip...</p>
        </div>
      )}

      {tripLoadError && (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500">
            We couldn't load this trip — it may have been deleted, or the link may be incorrect.
          </p>
          <Link to="/dashboard" className="text-indigo-600 font-medium hover:text-indigo-700 inline-block">
            Back to My Trips
          </Link>
        </div>
      )}

      {/* 5A: Hero Header */}
      {trip && (
        <div className="relative left-1/2 -translate-x-1/2 w-screen -mt-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white h-72 flex flex-col justify-between px-4 sm:px-8 py-8">
            <div className="max-w-6xl mx-auto w-full flex justify-end">
              {status && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>{status}</span>}
            </div>
            <div className="max-w-6xl mx-auto w-full">
              <p className="flex items-center gap-1.5 text-sm text-indigo-200"><MapPin size={14} /> {capitalize(destination)}</p>
              <h2 className="text-3xl font-bold mt-1">{capitalize(trip.name || `${destination} Trip`)}</h2>
              {trip.start_date && trip.end_date && (
                <p className="flex items-center gap-1.5 text-sm text-indigo-100 mt-2">
                  <Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}
                  <button type="button" onClick={openDatesModal} className="ml-1 text-indigo-100 underline hover:text-white">Edit Dates</button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5B: Flight Information */}
      {trip && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4"><Plane size={18} className="text-indigo-600" /> Selected Flights</h2>
          <div className="space-y-3">
            {hasArrivalFlight ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{airlineCode(trip.arrival_flight_number)}</div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Outbound · {trip.start_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.arrival_airline} · {trip.arrival_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.arrival_other_time} &rarr; {trip.arrival_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
                <Link to={`/trips/${tripId}/flights/outbound`} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 shrink-0">Change Flight</Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Outbound · {trip.start_date}</p>
                  <p className="text-gray-400 text-sm italic">No outbound flight added yet.</p>
                </div>
                <Link to={`/trips/${tripId}/flights/outbound`} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 shrink-0">Add Flight</Link>
              </div>
            )}
            {hasDepartureFlight ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{airlineCode(trip.departure_flight_number)}</div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Return · {trip.end_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.departure_airline} · {trip.departure_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.departure_time} &rarr; {trip.departure_other_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
                <Link to={`/trips/${tripId}/flights/return`} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 shrink-0">Change Flight</Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Return · {trip.end_date}</p>
                  <p className="text-gray-400 text-sm italic">No return flight added yet.</p>
                </div>
                <Link to={`/trips/${tripId}/flights/return`} className="text-sm text-indigo-600 font-medium hover:text-indigo-700 shrink-0">Add Flight</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5C: Hotel Information */}
      {trip && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            <Building2 size={32} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Hotel</h2>
              <button type="button" onClick={openHotelModal} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                {trip.hotel_address?.trim() ? 'Edit Hotel' : 'Add Hotel'}
              </button>
            </div>
            {hotelParts ? (
              <>
                <p className="text-gray-900 text-sm font-bold">{hotelParts.name}</p>
                {hotelParts.address && <p className="text-gray-700 text-sm">{hotelParts.address}</p>}
              </>
            ) : (
              <p className="text-gray-400 text-sm italic">No hotel added yet.</p>
            )}
          </div>
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
          <button type="button" onClick={() => setHotelModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSaveHotel} disabled={savingTrip} className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingTrip ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal open={datesModalOpen} onClose={() => setDatesModalOpen(false)} title="Edit Dates">
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-start-date" className="block text-sm font-medium text-gray-700 mb-1">Date Depart</label>
            <input
              id="edit-start-date"
              type="date"
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-end-date" className="block text-sm font-medium text-gray-700 mb-1">Date Return</label>
            <input
              id="edit-end-date"
              type="date"
              value={endDraft}
              onChange={(e) => setEndDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          {datesInvalid && <p className="text-sm text-red-600">End date must be after start date.</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={() => setDatesModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSaveDates} disabled={savingTrip || datesInvalid} className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingTrip ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal open={editActivityModalOpen} onClose={() => setEditActivityModalOpen(false)} title="Edit Activity">
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-activity-day" className="block text-sm font-medium text-gray-700 mb-1">Day</label>
            <input
              id="edit-activity-day"
              type="date"
              min={trip?.start_date}
              max={trip?.end_date}
              value={activityDayDraft}
              onChange={(e) => setActivityDayDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="edit-activity-start" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                id="edit-activity-start"
                type="time"
                value={activityStartDraft}
                onChange={(e) => setActivityStartDraft(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="edit-activity-end" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                id="edit-activity-end"
                type="time"
                value={activityEndDraft}
                onChange={(e) => setActivityEndDraft(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-activity-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="edit-activity-name"
              type="text"
              value={activityNameDraft}
              onChange={(e) => setActivityNameDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="edit-activity-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
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
            <label className="flex items-center gap-1.5 text-sm text-gray-700 shrink-0 pb-2">
              <input
                type="checkbox"
                checked={activityFixedDraft}
                onChange={(e) => setActivityFixedDraft(e.target.checked)}
              />
              Fixed
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={() => setEditActivityModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSaveActivity} disabled={savingActivity} className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingActivity ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal open={addActivityModalOpen} onClose={() => setAddActivityModalOpen(false)} title="Add Activity">
        <div className="space-y-3">
          <div>
            <label htmlFor="new-activity-day" className="block text-sm font-medium text-gray-700 mb-1">Day</label>
            <input
              id="new-activity-day"
              type="date"
              min={trip?.start_date}
              max={trip?.end_date}
              value={newActivityDayDraft}
              onChange={(e) => setNewActivityDayDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="new-activity-start" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                id="new-activity-start"
                type="time"
                value={newActivityStartDraft}
                onChange={(e) => setNewActivityStartDraft(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="new-activity-end" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                id="new-activity-end"
                type="time"
                value={newActivityEndDraft}
                onChange={(e) => setNewActivityEndDraft(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-activity-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="new-activity-name"
              type="text"
              value={newActivityNameDraft}
              onChange={(e) => setNewActivityNameDraft(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-activity-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
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
              <span className="block text-sm font-medium text-gray-700 mb-1">Type</span>
              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="new-activity-type"
                    value="outdoor"
                    checked={newActivityTypeDraft === 'outdoor'}
                    onChange={() => setNewActivityTypeDraft('outdoor')}
                  />
                  Outdoor
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="new-activity-type"
                    value="indoor"
                    checked={newActivityTypeDraft === 'indoor'}
                    onChange={() => setNewActivityTypeDraft('indoor')}
                  />
                  Indoor
                </label>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 shrink-0 pt-6">
              <input
                type="checkbox"
                checked={newActivityFixedDraft}
                onChange={(e) => setNewActivityFixedDraft(e.target.checked)}
              />
              Fixed
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={() => setAddActivityModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleCreateActivity} disabled={savingNewActivity || newActivityInvalid} className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingNewActivity ? 'Adding...' : 'Add'}
          </button>
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
            <button type="button" onClick={handleReviewEditDates} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
              Update Dates
            </button>
          )}
          {lastEdited !== 'hotel' && (
            <button type="button" onClick={handleReviewEditHotel} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
              Update Hotel
            </button>
          )}
          {lastEdited !== 'outbound' && (
            <button type="button" onClick={handleReviewEditOutbound} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
              Edit Outbound Flight
            </button>
          )}
          {lastEdited !== 'return' && (
            <button type="button" onClick={handleReviewEditReturn} className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
              Edit Return Flight
            </button>
          )}
          <button type="button" onClick={handleReviewRegenerateNow} disabled={generating} className="w-full px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 mt-2">
            {generating ? 'Regenerating...' : "No, regenerate now"}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(weatherInfoModalMetric)} onClose={() => setWeatherInfoModalMetric(null)} title={weatherInfoMeta ? `${weatherInfoMeta.label} — Hourly Trend` : ''}>
        {weatherInfoMeta && (
          weatherInfoHourly.length > 0 ? (
            <div className="space-y-3">
              <Sparkline
                data={weatherInfoHourly}
                unit={weatherInfoMeta.unit}
                currentTime={weatherInfoCurrentTime}
                color={weatherInfoMeta.color}
                bands={weatherInfoMeta.bands}
              />
              {weatherInfoMeta.advice(forecastDay) && (
                <p className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-md p-3">
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
      <Modal open={Boolean(riskInfoModal)} onClose={() => setRiskInfoModal(null)} title={riskInfoMeta[riskInfoModal]?.label || ""}>
        {riskInfoModal && (
          <div className="space-y-4">
            
            {/* Heavy rain prob ml model info */}
            {riskInfoModal === "heavyRain" ? (

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

            ) : (
              <>
                {/* Score */}
                {riskInfoMeta[riskInfoModal]?.score !== undefined && (
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
                        {item.value} {item.unit}
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

      {/* 5D: Itinerary & Weather Section */}
      {trip && (
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Day Tabs */}
        <div className="flex items-center justify-between mb-6">
          {tripDates.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {tripDates.map((d, index) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors
                    ${d === selectedDate ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300'}`}
                >
                  Day {index + 1} &middot; {d}
                </button>
              ))}
            </div>
          ) : (
             <div className="text-sm font-semibold text-gray-700">Day-by-day Activities</div>
          )}
          
          <button type="button" onClick={handleGenerate} disabled={generating} className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm disabled:opacity-50">
            {generating ? 'Generating...' : itinerary ? 'Regenerate Itinerary' : 'Generate Itinerary'}
          </button>
        </div>

        {itineraryNotice && <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">{itineraryNotice}</div>}

        {/* WEATHER MODULE */}
        {weatherStatus === 'loading' && (
          <div className="text-sm text-gray-500 italic">Loading weather...</div>
        )}

        {weatherStatus === 'failed' && (
          <p className="text-sm text-gray-400 italic">Weather unavailable for this destination.</p>
        )}

        {weatherStatus === 'loaded' && forecastDay && (
          <div className="border border-gray-100 p-4 rounded-lg bg-gray-50/50 space-y-4">

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Thermometer size={16} className="text-indigo-600" /> Weather
                    {forecastDay.is_climatology && (
                      <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                        Typical weather (historical average)
                      </span>
                    )}
                </h3>

                {/* Daily Summary Header — items-start (not items-center): the
                    sunrise/sunset block below gets an explicit top margin matching the
                    date row's height instead, so its icons land exactly level with the
                    condition icon rather than centered against the left block's overall
                    (taller, asymmetric) height. */}
                <div className="flex justify-between items-start gap-4 flex-wrap">
                    {/* shrink-0 (not a fixed w-64) — this block's content (icon/condition
                        column + temp/feels-like/H-L block) is wider than 256px once "Feels
                        like" is showing, and a fixed width smaller than the actual content
                        let it silently overflow its own box and visually collide with the
                        sunrise/sunset block sitting right after it at narrow widths. Sizing
                        to natural content width avoids that; shrink-0 stops the parent flex
                        row from compressing it instead. */}
                    <div className="flex items-end gap-8 shrink-0">
                        {/* Date, icon, and condition all stacked in one left-most column —
                            date on top with breathing room before the icon below it, not
                            crammed right against it. */}
                        <div className="flex flex-col items-center shrink-0">
                            <div className="text-sm font-semibold text-gray-500 mb-2">{forecastDay.date}</div>
                            <WeatherIcon condition={forecastDay.condition} timeStr={forecastDay.date + "T12:00:00"} className="w-10 h-10 text-indigo-500" />
                            <span className="text-sm font-semibold text-gray-700 capitalize whitespace-nowrap mt-1">{forecastDay.condition}</span>
                        </div>

                        {/* items-end on the row above bottom-aligns this block with the
                            condition text instead of a guessed mt-4 offset — the temp/
                            feels-like stack's bottom edge now lines up with "condition". */}
                        <div>
                            {isToday ? (
                              <>
                                {/* Temp + "Feels like" form one centered stack — the big number
                                    sits directly above its own feels-like reading, not offset by
                                    whatever width H/L (a separate, further-out element) happens
                                    to take up. */}
                                {/* No my-1 here — a vertical margin on this row would count
                                    toward its own bottom edge in the parent's items-end
                                    alignment, nudging "Feels like" a few px above (not
                                    level with) "condition". */}
                                <div className="flex items-center gap-10">
                                    <div className="flex flex-col items-center">
                                        <span className="text-4xl font-bold text-gray-900">{getCurrentTemp()}°</span>
                                        {getFeelsLikeTemp() !== null && (
                                          <span className="text-sm font-medium text-gray-400 whitespace-nowrap">Feels like {getFeelsLikeTemp()}°</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                                        H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                                    </span>
                                </div>
                              </>
                            ) : (
                              <div className="text-2xl font-bold text-gray-900 whitespace-nowrap">
                                  H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                              </div>
                            )}
                        </div>
                    </div>
                    {/* Pushed to the far right of the remaining space next to the temp/
                        condition block. mt-[28px] matches the date row's height (its
                        text-sm line ~20px + mb-2 ~8px) so these 40px-tall icon+time pairs
                        (same 40px as the condition WeatherIcon) start exactly where that
                        icon starts, landing them level with it instead of just visually
                        close. min-w is sized to fit both icon+time pairs with their gap —
                        below that width flex-wrap drops this onto its own row (using the
                        parent's gap-4 as row-gap) instead of letting it get squeezed flush
                        against the H/L text on a shrinking single row. flex-wrap + shrink-0
                        + nowrap on the pairs themselves is a second line of defense: if
                        this block's own row is still too narrow (very small viewports),
                        the sunrise and sunset pairs stack onto their own lines instead of
                        compressing into each other. */}
                    <div className="flex-1 flex flex-wrap items-center justify-end gap-x-8 gap-y-2 min-w-[240px] mt-[28px]">
                        {forecastDay.sunrise && forecastDay.sunset ? (
                          <>
                            <div className="flex items-center gap-2 shrink-0">
                                <Sunrise size={40} className="text-amber-400" />
                                <span className="text-xl font-semibold text-gray-800 whitespace-nowrap">{forecastDay.sunrise}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Sunset size={40} className="text-orange-400" />
                                <span className="text-xl font-semibold text-gray-800 whitespace-nowrap">{forecastDay.sunset}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-400">
                              <Sunrise size={18} />
                              <Sunset size={18} />
                              <span className="text-sm">Sunrise / Sunset not available</span>
                          </div>
                        )}
                    </div>
                </div>

                <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-800 pt-5 border-t">
                    <span className="flex items-center gap-2"><AlertTriangle size={16} className="text-indigo-600" /> Risks</span>
                    {/* Deliberately generic, not "Tap Wind, UV, or Visibility" — only those
                        3 cards open a popup today (see WEATHER_INFO_META), but more risk
                        cards are expected to gain the same click-for-details behavior later,
                        and this wording shouldn't need to change when they do. */}
                    <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
                        <Info size={12} /> Tap a card for more details
                    </span>
                </h3>

                {/* 9 cards total (6 risk + 3 weather-info) in a horizontally
                    scrollable strip like the hourly forecast below — each
                    card keeps a natural, comfortable width, so the scrollbar
                    only appears if they don't all fit, rather than forcing a
                    fixed visible count. Extreme Temp renders its own layout
                    (level + advice text, no %/pill) since temperature_level
                    isn't a probability/score like the others. */}
                <div className="flex overflow-x-auto gap-3 pb-2 cursor-grab active:cursor-grabbing">
                  {[
                    {
                      l: 'Heavy Rain',
                      v: forecastDay.heavy_rain_probability == null
                        ? '—'
                        : `${forecastDay.heavy_rain_probability}%`,
                      s: forecastDay.heavy_rain_probability == null
                        ? 'Unknown'
                        : (forecastDay.heavy_rain_warning ? 'High' : 'Low'),
                      i: Umbrella,
                      bg: CARD_IDENTITY_BG.heavyRain,
                      type: 'heavyRain',
                      forecastOnly: true,
                    },
                    {
                      l: 'Flood',
                      v: forecastDay.flood_score == null
                        ? '—'
                        : `${Math.round(forecastDay.flood_score)}%`,
                      s: forecastDay.flood_risk || 'Unknown',
                      i: Waves,
                      bg: CARD_IDENTITY_BG.flood,
                      type: 'flood',
                    },
                    {
                      l: 'Beach Safety',
                      v: forecastDay.beach_safety_score == null
                        ? '—'
                        : `${Math.round(forecastDay.beach_safety_score)}%`,
                      s: forecastDay.beach_safety_level || 'Unknown',
                      i: Palmtree,
                      bg: CARD_IDENTITY_BG.beachSafety,
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
                      bg: CARD_IDENTITY_BG.snow,
                      type: 'snow',
                    },
                  ].map((c) => (
                      // flex-col justify-center: label/value/badge stay a tight cluster
                      // (gap-1, not spread out) while justify-center splits whatever
                      // leftover height the row-stretch adds evenly above and below that
                      // cluster — so every card gets the same top/bottom breathing room
                      // regardless of how tall its neighbors are.
                      <div key={c.l} onClick={() => setRiskInfoModal(c.type)} className={`${RISK_CARD_CLASSES} ${c.bg} cursor-pointer hover:brightness-95 transition`}>
                        <div className="text-xs text-gray-500 uppercase flex items-center justify-center gap-2">
                          <c.i size={22} className="text-indigo-400" /> {c.l}
                        </div>

                        <div className="font-bold text-lg">
                          {forecastDay.is_climatology && c.forecastOnly ? '—' : c.v}
                        </div>

                        {forecastDay.is_climatology && c.forecastOnly ? (
                          <div className="text-[11px] text-gray-500 leading-snug">
                            {FORECAST_ONLY_NOTE}
                          </div>
                        ) : (
                          <span className={`text-xs px-2 rounded-full ${levelColorClass(c.s)}`}>
                            {c.s}
                          </span>
                        )}
                      </div>
                  ))}
                  <div className={`${RISK_CARD_CLASSES} ${CARD_IDENTITY_BG.extremeTemp}`}>
                      <div className="text-xs text-gray-500 uppercase flex items-center justify-center gap-2"><Flame size={22} className="text-indigo-400" /> Extreme Temp</div>
                      <div className="font-bold text-base">
                        {forecastDay.is_climatology ? '—' : (forecastDay.temperature_level ?? '—')}
                      </div>
                      {forecastDay.is_climatology ? (
                        <div className="text-[11px] text-gray-500 leading-snug">{FORECAST_ONLY_NOTE}</div>
                      ) : (
                        forecastDay.temperature_advice && (
                          <div className="text-[11px] text-gray-500 leading-snug">{forecastDay.temperature_advice}</div>
                        )
                      )}
                  </div>
                  {[
                    {
                      l: 'Hiking Safety',
                      v: forecastDay.hiking_safety_score == null ? '—' : `${Math.round(forecastDay.hiking_safety_score)}%`,
                      s: forecastDay.hiking_safety_level || 'Unknown',
                      i: Mountain, bg: CARD_IDENTITY_BG.hikingSafety, forecastOnly: true,
                    },
                    {
                      l: 'Wind',
                      v: forecastDay.wind_speed == null ? '—' : `${Math.round(forecastDay.wind_speed)} km/h`,
                      s: forecastDay.wind_level || 'Unknown',
                      i: Wind, bg: CARD_IDENTITY_BG.wind, metric: 'wind', forecastOnly: true,
                    },
                    {
                      l: 'UV Index',
                      v: forecastDay.uv_index == null ? '—' : Math.round(forecastDay.uv_index),
                      s: forecastDay.uv_level || 'Unknown',
                      i: SunDim, bg: CARD_IDENTITY_BG.uv, metric: 'uv', forecastOnly: true,
                    },
                    {
                      l: 'Visibility',
                      v: forecastDay.visibility_m == null ? '—' : `${(forecastDay.visibility_m / 1000).toFixed(1)} km`,
                      s: forecastDay.visibility_m == null ? 'Unknown' : visibilityLevel(forecastDay.visibility_m),
                      i: Eye, bg: CARD_IDENTITY_BG.visibility, metric: 'visibility', forecastOnly: true,
                    },
                  ].map((c) => {
                      // Only the 3 weather-info cards (metric set) open the hourly-trend
                      // popup on click — the risk cards (heavy rain/flood/etc.) aren't
                      // clickable, so this renders a <button> only for those three. A
                      // climatology day has no hourly data for the popup to show (see
                      // forecastDay.is_climatology), so it falls back to a plain <div>
                      // same as the non-metric cards, instead of opening an empty popup.
                      const showsNote = forecastDay.is_climatology && c.forecastOnly
                      const Tag = c.metric && !showsNote ? 'button' : 'div'
                      return (
                        <Tag key={c.l}
                            type={c.metric && !showsNote ? 'button' : undefined}
                            onClick={c.metric && !showsNote ? () => setWeatherInfoModalMetric(c.metric) : undefined}
                            className={`${RISK_CARD_CLASSES} ${c.bg} ${c.metric && !showsNote ? 'cursor-pointer hover:brightness-95 transition' : ''}`}>
                            <div className="text-xs text-gray-500 uppercase flex items-center justify-center gap-2"><c.i size={22} className="text-indigo-400" /> {c.l}</div>
                            <div className="font-bold text-lg">
                              {showsNote ? '—' : c.v}
                            </div>
                            {showsNote ? (
                              <div className="text-[11px] text-gray-500 leading-snug">{FORECAST_ONLY_NOTE}</div>
                            ) : (
                              <span className={`text-xs px-2 rounded-full ${levelColorClass(c.s)}`}>
                                  {c.s}
                              </span>
                            )}
                        </Tag>
                      )
                  })}
                </div>

                {/* Climatology-fallback days have no hourly data at all (see
                    forecastDay.is_climatology) — the whole section, sunrise/
                    sunset markers included, only makes sense for real forecast
                    days. */}
                {!forecastDay.is_climatology && (
                <>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-5 border-t">
                    <Clock size={16} className="text-indigo-600" /> Hourly Forecast
                </h3>

                {/* Hourly Forecast — pt-1 keeps the "Now" card's ring from
                    getting clipped by this container's own overflow edge. */}
                <div className="flex overflow-x-auto gap-4 pt-1 pb-2 cursor-grab active:cursor-grabbing">
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
                          const color = h.kind === 'sunrise' ? 'text-amber-400' : 'text-orange-400'
                          return (
                            <div key={h.kind} className="flex flex-col items-center min-w-[50px] shrink-0 gap-0.5 rounded-lg py-1">
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
                          <div key={i} className={`flex flex-col items-center min-w-[50px] shrink-0 gap-0.5 rounded-lg py-1 ${isNow ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''}`}>
                              <span className={`text-[10px] ${isNow ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>{isNow ? 'Now' : formatHour(h.time)}</span>

                              <WeatherIcon condition={h.condition} timeStr={h.time} className="w-5 h-5 text-indigo-500" />

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
                              <span className="font-bold text-sm leading-none mt-0.5">{Math.round(h.temperature)}°</span>
                          </div>
                        )
                      })
                  })()}
                </div>
                </>
                )}
            </div>
        )}

        {/* Itinerary List */}
        {itinerary && selectedDate && (
          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Sparkles size={16} className="text-indigo-600" /> Itinerary for Day {selectedDayNumber}
              </h3>
              <button type="button" onClick={openAddActivityModal} className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                <Plus size={14} /> Add Activity
              </button>
            </div>
            {itineraryDay ? (
              <ul className="space-y-2">
                {itineraryDay.activities.map((activity, index) => (
                  <li key={activity.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-gray-900 ${activity.is_swapped ? 'line-through text-gray-400' : ''}`}>
                          {activity.name}
                        </span>
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
                            className="text-gray-400 hover:text-indigo-600"
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
                          <p className="font-medium text-gray-900 text-sm mt-1">{activity.alternate_name}</p>
                          <p className="text-sm text-gray-500">{activity.time_slot}</p>
                          <p className="text-sm text-gray-600">{activity.alternate_location}</p>
                          <p className="text-xs text-amber-700 italic mt-1">{activity.swap_reason}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">{activity.time_slot}</p>
                          <p className="text-sm text-gray-600">{activity.location}</p>
                          <p className="text-sm text-gray-500">{activity.description}</p>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">No activities generated for this day yet.</p>
            )}
          </div>
        )}
        {!itinerary && !itineraryNotice && (
          <Placeholder label="AI-generated itinerary will appear here once generated." />
        )}
      </div>
      )}

      {/* Map */}
      {trip && (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4"><MapPin size={18} className="text-indigo-600" /> {capitalize(destination || 'Trip')} Map</h2>
        <MapView height="h-80"
                 center={mapCenter}
                 stops={stops}
                 hotel={
                  hotelLocation && trip?.hotel_address
                    ? {
                        position: hotelLocation,
                        label: trip.hotel_address,
                      }
                    : null
                }/>
      </div>
      )}

      {trip && (
      <div className="flex justify-center">
        <Link to="/dashboard" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors"><Briefcase size={16} /> Back to My Trips</Link>
      </div>
      )}
    </div>
  )
}