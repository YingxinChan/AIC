import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Plane, Building2, MapPin, Calendar, CheckCircle2,
  Briefcase, Thermometer, Sparkles, Sun, Moon, Cloud,
  CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow,
  CloudLightning, AlertTriangle, Waves, Umbrella, Snowflake,
  SunDim, Wind, Eye, Sunrise, Sunset, Palmtree, Clock,
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
  const [datesModalOpen, setDatesModalOpen] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [savingTrip, setSavingTrip] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  // Which of dates/hotel/outbound/return was just saved — the review prompt
  // excludes this one and only offers the others, so it never re-suggests
  // editing the thing the user just finished editing.
  const [lastEdited, setLastEdited] = useState(null)

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
    let cancelled = false
    geocodeAddress(trip.hotel_address).then(coords => {
      if (!cancelled) {
        setHotelLocation(coords)
      }
    })
    return () => {
      cancelled = true
    }
  }, [trip?.hotel_address])

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
    setHotelModalOpen(true)
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
    { hotel_address: hotelDraft },
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
          onChange={setHotelDraft}
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

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Thermometer size={16} className="text-indigo-600" /> Weather
                </h3>

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
                    {/* Sits in the remaining space next to the temp/condition block */}
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
                </div>

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-5 border-t">
                    <AlertTriangle size={16} className="text-indigo-600" /> Conditions & Risks
                </h3>

                {/* Risk Cards + Wind/UV/Visibility — a horizontally scrollable
                    strip like the hourly forecast below, rather than a grid,
                    since 7 cards don't fit one row on most screens. Each
                    card's basis is 1/6 of the row (minus its share of the
                    gaps) so exactly 6 show before scrolling reveals the 7th. */}
                <div className="flex overflow-x-auto gap-3 pb-2 cursor-grab active:cursor-grabbing">
                  {[
                    { l: 'Heavy Rain', v: forecastDay.heavy_rain_probability + '%', s: forecastDay.heavy_rain_warning ? 'High' : 'Low', i: Umbrella, bg: CARD_IDENTITY_BG.heavyRain },
                    { l: 'Flood', v: Math.round(forecastDay.flood_score) + '%', s: forecastDay.flood_risk, i: Waves, bg: CARD_IDENTITY_BG.flood },
                    { l: 'Beach Safety', v: Math.round(forecastDay.beach_safety_score) + '%', s: forecastDay.beach_safety_level, i: Palmtree, bg: CARD_IDENTITY_BG.beachSafety },
                    { l: 'Snow', v: forecastDay.snow_probability + '%', s: snowLevel(forecastDay.snow_probability), i: Snowflake, bg: CARD_IDENTITY_BG.snow },
                    { l: 'Wind', v: Math.round(forecastDay.wind_speed) + ' km/h', s: forecastDay.wind_level, i: Wind, bg: CARD_IDENTITY_BG.wind },
                    { l: 'UV Index', v: Math.round(forecastDay.uv_index), s: forecastDay.uv_level, i: SunDim, bg: CARD_IDENTITY_BG.uv },
                    { l: 'Visibility', v: (forecastDay.visibility_m / 1000).toFixed(1) + ' km', s: visibilityLevel(forecastDay.visibility_m), i: Eye, bg: CARD_IDENTITY_BG.visibility },
                  ].map((c, i) => (
                      <div key={i} className={`shrink-0 basis-[calc((100%-3.75rem)/6)] p-3 rounded border text-center ${c.bg}`}>
                          <div className="text-xs text-gray-500 uppercase flex items-center justify-center gap-2"><c.i size={22} className="text-indigo-400" /> {c.l}</div>
                          <div className="font-bold my-1 text-lg">{c.v}</div>
                          <span className={`text-xs px-2 rounded-full ${levelColorClass(c.s)}`}>
                              {c.s}
                          </span>
                      </div>
                  ))}
                </div>

                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-5 border-t">
                    <Clock size={16} className="text-indigo-600" /> Hourly Forecast
                </h3>

                {/* Hourly Forecast — pt-1 keeps the "Now" card's ring from
                    getting clipped by this container's own overflow edge. */}
                <div className="flex overflow-x-auto gap-4 pt-1 pb-2 cursor-grab active:cursor-grabbing">
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${(activity.is_swapped ? 'indoor' : activity.type) === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {activity.is_swapped ? 'indoor' : activity.type}
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

      {/* Map */}
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

      <div className="flex justify-center">
        <Link to="/dashboard" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors"><Briefcase size={16} /> Back to My Trips</Link>
      </div>
    </div>
  )
}