import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { 
  Plane, Building2, MapPin, Calendar, CheckCircle2, 
  Briefcase, Thermometer, Sparkles, Sun, Moon, Cloud, 
  CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow, 
  CloudLightning, AlertTriangle, Waves, Umbrella, Snowflake 
} from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity } from '../../lib/geocode'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'

// --- SECTION 1: HELPER FUNCTIONS ---
const capitalize = (str) => {
  if (!str) return '';
  return str.split(',').map(part => {
    const trimmed = part.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }).join(', ');
};

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

export default function ItineraryPage() {
  // --- SECTION 2: STATE VARIABLES ---
  const { tripId } = useParams()
  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [itineraryNotice, setItineraryNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  
  const [mapCenter, setMapCenter] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('loading')

  const destination = trip?.destination || ''
  const hasArrivalFlight = Boolean(trip?.arrival_flight_number)
  const hasDepartureFlight = Boolean(trip?.departure_flight_number)

  // --- NEW Helper: Get Current or Max Temp ---
  const getDisplayTemp = () => {
    if (!forecastDay) return '';

    // Get user's local date and hour
    const now = new Date();
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const selectedDate = forecastDay.date;

    // If viewing TODAY'S itinerary, show the current hour's temperature
    if (selectedDate === today && hourlyForecast) {
      const currentHour = now.getHours();
      const timeString = `${selectedDate}T${currentHour.toString().padStart(2, '0')}:00`;
      const currentData = hourlyForecast.find(h => h.time === timeString);

      if (currentData) {
        return Math.round(currentData.temperature);
      }
    }

    // If viewing a future/past day, fallback to the daily Max temperature
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
          // Day index will be set intelligently once weather loads
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

                  // Auto-select the current day if the user is currently on the trip
                  const now = new Date();
                  const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                  const todayIdx = days.findIndex(d => d.date === todayStr);
                  
                  if (todayIdx !== -1) {
                      setSelectedDayIndex(todayIdx);
                  } else {
                      setSelectedDayIndex(0);
                  }
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
        setSelectedDayIndex(0)
      } else {
        setItineraryNotice(data.message || 'Could not generate the itinerary.')
      }
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Something went wrong while generating the itinerary.')
    }
    setGenerating(false)
  }

  const status = trip?.start_date && trip?.end_date ? tripStatus(trip) : null

  // Match the selected itinerary day to its forecast entry by date, rather than
  // assuming itinerary.days and forecast are the same length/order.
  const selectedItineraryDay = itinerary?.days?.[selectedDayIndex]
  const forecastDay = selectedItineraryDay
    ? forecast?.find(d => d.date === selectedItineraryDay.date)
    : forecast?.[selectedDayIndex]

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
          {itinerary?.days ? (
            <div className="flex gap-2 flex-wrap">
              {itinerary.days.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIndex(index)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors
                    ${index === selectedDayIndex ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300'}`}
                >
                  Day {index + 1} &middot; {day.date}
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
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-sm font-semibold text-gray-500">{forecastDay.date}</div>
                        <div className="flex items-baseline gap-2 my-1">
                            {/* Big number shows current temp if today, or max temp if future */}
                            <span className="text-4xl font-bold text-gray-900">{getDisplayTemp()}°</span>
                            {/* Smaller text shows High and Low */}
                            <span className="text-sm font-medium text-gray-500 ml-1">
                                H: {Math.round(forecastDay.temp_max)}° &nbsp; L: {Math.round(forecastDay.temp_min)}°
                            </span>
                        </div>
                        <div className="text-md font-medium text-gray-700 capitalize">{forecastDay.condition}</div>
                    </div>
                    <WeatherIcon condition={forecastDay.condition} timeStr={forecastDay.date + "T12:00:00"} className="w-10 h-10 text-indigo-500" />
                </div>

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-2 border-t">
                    <Thermometer size={16} className="text-indigo-600" /> Weather
                </h3>

                {/* Risk Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: 'Heavy Rain', v: forecastDay.heavy_rain_probability + '%', s: forecastDay.heavy_rain_warning ? 'High' : 'Low', i: Umbrella },
                    { l: 'Flood', v: Math.round(forecastDay.flood_score) + '%', s: forecastDay.flood_risk, i: Waves },
                    { l: 'Beach Safety', v: Math.round(forecastDay.beach_safety_score) + '%', s: forecastDay.beach_safety_level, i: Sun },
                    { l: 'Snow', v: forecastDay.snow_probability + '%', s: snowLevel(forecastDay.snow_probability), i: Snowflake }
                  ].map((c, i) => (
                      <div key={i} className="bg-white p-3 rounded border text-center">
                          <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center gap-1"><c.i size={12} /> {c.l}</div>
                          <div className="font-bold my-1 text-sm">{c.v}</div>
                          <span className={`text-[10px] px-2 rounded-full ${c.s === 'High' || c.s === 'Poor' ? 'bg-red-100 text-red-800' : c.s === 'Moderate' || c.s === 'Low' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {c.s}
                          </span>
                      </div>
                  ))}
                </div>

                {/* Hourly Forecast */}
                <div className="flex overflow-x-auto gap-4 pb-2 cursor-grab active:cursor-grabbing">
                  {hourlyForecast
                      .filter(h => h.time.startsWith(forecastDay.date))
                      .map((h, i) => (
                          <div key={i} className="flex flex-col items-center min-w-[50px] shrink-0 gap-0.5">
                              <span className="text-[10px] text-gray-500">{formatHour(h.time)}</span>
                              
                              <WeatherIcon condition={h.condition} timeStr={h.time} className="w-5 h-5 text-indigo-500" />
                              
                              {/* Fixed-height container (h-4) that holds rain OR empty space */}
                              <div className="h-4 flex items-center justify-center">
                                  {h.rain_probability != null && (
                                      <span className="text-[9px] font-bold text-blue-600 leading-none">
                                          {Math.round(h.rain_probability)}%
                                      </span>
                                  )}
                              </div>
                              
                              {/* Temperature stays in the exact same spot regardless of rain */}
                              <span className="font-bold text-sm leading-none mt-0.5">{Math.round(h.temperature)}°</span>
                          </div>
                      ))}
              </div>
            </div>
        )}

        {/* Itinerary List */}
        {itinerary && itinerary.days && itinerary.days[selectedDayIndex] && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <Sparkles size={16} className="text-indigo-600" /> Itinerary for Day {selectedDayIndex + 1}
            </h3>
            <ul className="space-y-2">
              {itinerary.days[selectedDayIndex].activities.map((activity, index) => (
                <li key={activity.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{activity.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${activity.type === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {activity.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{activity.time_slot}</p>
                    <p className="text-sm text-gray-600">{activity.location}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
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