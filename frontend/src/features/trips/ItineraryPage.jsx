import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Plane, Building2, MapPin, Calendar, CheckCircle2,
  Briefcase, Thermometer, Sparkles, Sun, Moon, Cloud,
  CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow,
  CloudLightning, AlertTriangle, Waves, Umbrella, Snowflake,
  SunDim, Wind, Eye, Sunrise, Sunset, Palmtree
} from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity } from '../../lib/geocode'
import { capitalize } from '../../lib/format'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'

// --- SECTION 1: HELPER FUNCTIONS ---

function airlineCode(flightNumber) {
  return (flightNumber || '').split(' ')[0]
}

const formatHour = (timeStr) => {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
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
  red: ['High', 'Poor', 'Very High', 'Extreme', 'Strong', 'Very Strong'],
  yellow: ['Moderate'],
};
function levelColorClass(level) {
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
  wind: 'bg-blue-50 border-blue-100',
  uv: 'bg-blue-50 border-blue-100',
  visibility: 'bg-blue-50 border-blue-100',
};

// Visibility has no backend-supplied level (unlike UV/wind), so it's
// classified here using the same Good/Moderate/Poor vocabulary Beach Safety
// already uses — no changes needed to levelColorClass to support it.
const visibilityLevel = (meters) => {
  if (meters >= 10000) return 'Good';
  if (meters >= 1000) return 'Moderate';
  return 'Poor';
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
  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [itineraryNotice, setItineraryNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  const [mapCenter, setMapCenter] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('loading')

  const destination = trip?.destination || ''
  const hasArrivalFlight = Boolean(trip?.arrival_flight_number)
  const hasDepartureFlight = Boolean(trip?.departure_flight_number)

  // The big headline temperature only makes sense for today (a real, current
  // reading) — a future day's "big number" would just be an arbitrarily
  // chosen stat (max? mean?) implying more precision than a forecast has.
  const getCurrentTemp = () => {
    if (!forecastDay) return '';

    if (hourlyForecast) {
      // Hourly/daily data is fetched with &timezone=auto (see openmeteo.py),
      // so timestamps are the destination's own local time — convert the
      // real current instant into that same local time using the offset the
      // backend returns, rather than the browser's local hour or raw UTC
      // (neither matches the destination unless it happens to share that
      // exact offset).
      const destNow = new Date(Date.now() + (forecastDay.utc_offset_seconds ?? 0) * 1000);
      const currentHour = destNow.getUTCHours();
      const timeString = `${selectedDate}T${currentHour.toString().padStart(2, '0')}:00`;
      const currentData = hourlyForecast.find(h => h.time === timeString);
      if (currentData) {
        return Math.round(currentData.temperature);
      }
    }

    return Math.round(forecastDay.temp_max);
  };

  // --- SECTION 3: DATA FETCHING LOGIC ---
  useEffect(() => {
    let cancelled = false;

    Promise.all([getTrip(tripId), getItinerary(tripId)])
      .then(([tripData, itinData]) => {
        if (cancelled) return;
        setTrip(tripData);
        if (itinData?.days) {
          setItinerary(itinData);
        }

        if (tripData?.start_date && tripData?.end_date) {
          // GMT-based best-effort default for which day tab to open — the
          // destination's actual UTC offset isn't known yet at this point
          // (forecast data, which carries it, hasn't loaded). This can be
          // off by up to a day right at the destination's local midnight;
          // isToday/getCurrentTemp below correct themselves once the real
          // offset arrives, since they run on every render, not just here.
          const todayStr = new Date().toISOString().split('T')[0];
          const inRange = todayStr >= tripData.start_date && todayStr <= tripData.end_date;
          setSelectedDate(inRange ? todayStr : tripData.start_date);
        }

        if (tripData?.destination) {
          geocodeCity(tripData.destination).then(coords => {
            if (cancelled || !coords) {
              setWeatherStatus('failed');
              return;
            }

            const lat = parseFloat(coords[0]);
            const lon = parseFloat(coords[1]);
            setMapCenter([lat, lon]);

            // FIX: Access tripData.start_date directly instead of a missing startDate variable
            const tripStartDate = tripData.start_date; 
            const tripEndDate = tripData.end_date;

            Promise.all([
                getForecast(lat, lon, tripStartDate, tripEndDate), 
                getHourlyForecast(lat, lon, tripStartDate, tripEndDate)
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
      })
      .catch((err) => {
        console.error("Failed to load trip:", err);
      });

    return () => { cancelled = true };
  }, [tripId]);

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

  const status = trip?.start_date && trip?.end_date ? tripStatus(trip) : null

  // Day tabs are driven by the trip's own date range (see tripDates below),
  // not by itinerary.days or forecast — so both are looked up by date here,
  // independently of each other and of the tab source.
  const tripDates = trip?.start_date && trip?.end_date ? datesBetween(trip.start_date, trip.end_date) : []
  const forecastDay = forecast?.find(d => d.date === selectedDate)
  const itineraryDay = itinerary?.days?.find(d => d.date === selectedDate)
  const selectedDayNumber = tripDates.indexOf(selectedDate) + 1

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

  // --- SECTION 5: UI RENDERING ---
  return (
    <div className="space-y-6">
      
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
                <p className="flex items-center gap-1.5 text-sm text-indigo-100 mt-2"><Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5B: Flight Information */}
      {(hasArrivalFlight || hasDepartureFlight) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4"><Plane size={18} className="text-indigo-600" /> Selected Flights</h2>
          <div className="space-y-3">
            {hasArrivalFlight && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{airlineCode(trip.arrival_flight_number)}</div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Outbound · {trip.start_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.arrival_airline} · {trip.arrival_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.arrival_other_time} &rarr; {trip.arrival_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
            )}
            {hasDepartureFlight && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{airlineCode(trip.departure_flight_number)}</div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Return · {trip.end_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.departure_airline} · {trip.departure_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.departure_time} &rarr; {trip.departure_other_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5C: Hotel Information */}
      {trip?.hotel_address && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400" />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-1"><Building2 size={18} className="text-indigo-600" /> Hotel</h2>
            <p className="text-gray-700 text-sm">{trip.hotel_address}</p>
          </div>
        </div>
      )}

      {/* 5D: Itinerary & Weather Section */}
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

                {/* Daily Summary Header */}
                <div className="flex justify-between items-center gap-4 flex-wrap">
                    {/* Fixed width so the condition text's length (e.g. "Overcast" vs
                        "Partly Cloudy") never shifts the sunrise card's centered position */}
                    <div className="flex items-center gap-3 w-64 shrink-0">
                        <WeatherIcon condition={forecastDay.condition} timeStr={forecastDay.date + "T12:00:00"} className="w-10 h-10 text-indigo-500 shrink-0" />
                        <div>
                            {/* Date sits directly above the big current-temp number */}
                            <div className="text-sm font-semibold text-gray-500 -mt-3 mb-2">{forecastDay.date}</div>
                            {isToday ? (
                              <>
                                <div className="flex items-baseline gap-2 my-1">
                                    <span className="text-4xl font-bold text-gray-900">{getCurrentTemp()}°</span>
                                    <span className="text-sm font-medium text-gray-500 ml-1">
                                        H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                                    </span>
                                </div>
                                <div className="text-md font-medium text-gray-700 capitalize">{forecastDay.condition}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-2xl font-bold text-gray-900 mt-1 capitalize">{forecastDay.condition}</div>
                                <div className="text-sm font-medium text-gray-500 mt-1">
                                    H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                                </div>
                              </>
                            )}
                        </div>
                    </div>
                    {/* Sits in the middle space, away from the Wind/UV/Visibility group */}
                    <div className="flex-1 flex items-center justify-center min-w-[160px]">
                        <div className="bg-white p-3 rounded-lg border flex items-center gap-4 min-w-[180px]">
                            {forecastDay.sunrise && forecastDay.sunset ? (
                              <>
                                <div className="text-center">
                                    <Sunrise size={20} className="text-amber-400 mx-auto mb-1" />
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Sunrise</div>
                                    <div className="text-sm font-semibold text-gray-800 my-1">{forecastDay.sunrise}</div>
                                    <div className="h-4" />
                                </div>
                                <div className="text-center">
                                    <Sunset size={20} className="text-orange-400 mx-auto mb-1" />
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">Sunset</div>
                                    <div className="text-sm font-semibold text-gray-800 my-1">{forecastDay.sunset}</div>
                                    <div className="h-4" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full text-center">
                                  <div className="flex items-center justify-center gap-1 text-gray-400">
                                      <Sunrise size={18} />
                                      <Sunset size={18} />
                                  </div>
                                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">Sunrise / Sunset</div>
                                  <div className="text-sm font-semibold text-gray-400 my-1">Not available</div>
                                  <div className="h-4" />
                              </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className={`p-3 rounded-lg border text-center min-w-[130px] ${CARD_IDENTITY_BG.wind}`}>
                            <Wind size={22} className="text-indigo-400 mx-auto mb-1" />
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Wind</div>
                            <div className="font-bold text-lg my-1">{Math.round(forecastDay.wind_speed)} km/h</div>
                            <span className={`text-xs px-2 rounded-full ${levelColorClass(forecastDay.wind_level)}`}>{forecastDay.wind_level}</span>
                        </div>
                        <div className={`p-3 rounded-lg border text-center min-w-[130px] ${CARD_IDENTITY_BG.uv}`}>
                            <SunDim size={22} className="text-indigo-400 mx-auto mb-1" />
                            <div className="text-xs text-gray-500 uppercase tracking-wide">UV Index</div>
                            <div className="font-bold text-lg my-1">{Math.round(forecastDay.uv_index)}</div>
                            <span className={`text-xs px-2 rounded-full ${levelColorClass(forecastDay.uv_level)}`}>{forecastDay.uv_level}</span>
                        </div>
                        <div className={`p-3 rounded-lg border text-center min-w-[130px] ${CARD_IDENTITY_BG.visibility}`}>
                            <Eye size={22} className="text-indigo-400 mx-auto mb-1" />
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Visibility</div>
                            <div className="font-bold text-lg my-1">{(forecastDay.visibility_m / 1000).toFixed(1)} km</div>
                            <span className={`text-xs px-2 rounded-full ${levelColorClass(visibilityLevel(forecastDay.visibility_m))}`}>{visibilityLevel(forecastDay.visibility_m)}</span>
                        </div>
                    </div>
                </div>

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-2 border-t">
                    <Thermometer size={16} className="text-indigo-600" /> Weather
                </h3>

                {/* Risk Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: 'Heavy Rain', v: forecastDay.heavy_rain_probability + '%', s: forecastDay.heavy_rain_warning ? 'High' : 'Low', i: Umbrella, bg: CARD_IDENTITY_BG.heavyRain },
                    { l: 'Flood', v: Math.round(forecastDay.flood_score) + '%', s: forecastDay.flood_risk, i: Waves, bg: CARD_IDENTITY_BG.flood },
                    { l: 'Beach Safety', v: Math.round(forecastDay.beach_safety_score) + '%', s: forecastDay.beach_safety_level, i: Palmtree, bg: CARD_IDENTITY_BG.beachSafety },
                    { l: 'Snow', v: forecastDay.snow_probability + '%', s: snowLevel(forecastDay.snow_probability), i: Snowflake, bg: CARD_IDENTITY_BG.snow }
                  ].map((c, i) => (
                      <div key={i} className={`p-3 rounded border text-center ${c.bg}`}>
                          <div className="text-xs text-gray-500 uppercase flex items-center justify-center gap-1"><c.i size={14} className="text-indigo-400" /> {c.l}</div>
                          <div className="font-bold my-1 text-lg">{c.v}</div>
                          <span className={`text-xs px-2 rounded-full ${levelColorClass(c.s)}`}>
                              {c.s}
                          </span>
                      </div>
                  ))}
                </div>

                {/* Hourly Forecast */}
                <div className="flex overflow-x-auto gap-4 pt-2 pb-2 cursor-grab active:cursor-grabbing">
                  {hourlyForecast
                      .filter(h => h.time.startsWith(forecastDay.date))
                      .map((h, i) => {
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
                      })}
              </div>
            </div>
        )}

        {/* Itinerary List */}
        {itineraryDay && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <Sparkles size={16} className="text-indigo-600" /> Itinerary for Day {selectedDayNumber}
            </h3>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${(activity.is_swapped ? 'indoor' : activity.type) === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {activity.is_swapped ? 'indoor' : activity.type}
                      </span>
                      {activity.is_swapped && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <CloudRain size={12} /> Swapped
                        </span>
                      )}
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
          </div>
        )}
        {itinerary && !itineraryDay && selectedDate && (
          <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-6">No activities generated for this day yet.</p>
        )}
        {!itinerary && !itineraryNotice && (
          <Placeholder label="AI-generated itinerary will appear here once generated." />
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4"><MapPin size={18} className="text-indigo-600" /> {capitalize(destination || 'Trip')} Map</h2>
        <MapView height="h-80" center={mapCenter} />
      </div>

      <div className="flex justify-center">
        <Link to="/dashboard" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors"><Briefcase size={16} /> Back to My Trips</Link>
      </div>
    </div>
  )
}