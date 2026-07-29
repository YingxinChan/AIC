import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { 
  Plane, Building2, MapPin, Calendar, CheckCircle2, 
  Briefcase, Thermometer, Sparkles, Sun, Moon, Cloud, 
  CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow, 
  CloudLightning, AlertTriangle, Waves, Umbrella, Snowflake 
} from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import Modal from '../../components/Modal'
import HotelSearchInput from '../../components/HotelSearchInput'
import { getTrip, updateTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity, geocodeAddress } from '../../lib/geocode'
import { capitalize } from '../../lib/format'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'
import { getPendingReview, clearPendingReview } from '../../lib/pendingReview'

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

  const destination = trip?.destination || ''
  const hasArrivalFlight = Boolean(trip?.arrival_flight_number)
  const hasDepartureFlight = Boolean(trip?.departure_flight_number)

  // --- NEW Helper: Get Current or Max Temp ---
  const getDisplayTemp = () => {
    if (!forecastDay) return '';

    // Get user's local date and hour
    const now = new Date();
    const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

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
        }

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
      const now = new Date();
      const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
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
    async function geocodeHotel() {
      if (!trip?.hotel_address) return;

      const coords = await geocodeAddress(trip.hotel_address);

      if (coords) {
        setHotelLocation(coords);
      }
    }

    geocodeHotel();
  }, [trip?.hotel_address]);

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

  const status = trip?.start_date && trip?.end_date ? tripStatus(trip) : null
  const hotelParts = trip?.hotel_address?.trim() ? splitHotelAddress(trip.hotel_address) : null

  // Day tabs are driven by the trip's own date range (see tripDates below),
  // not by itinerary.days or forecast — so both are looked up by date here,
  // independently of each other and of the tab source.
  const tripDates = trip?.start_date && trip?.end_date ? datesBetween(trip.start_date, trip.end_date) : []
  const forecastDay = forecast?.find(d => d.date === selectedDate)
  const itineraryDay = itinerary?.days?.find(d => d.date === selectedDate)
  const selectedDayNumber = tripDates.indexOf(selectedDate) + 1

  // Build map stops for selected day's itinerary
  const stops = itineraryDay?.activities
    ?.filter(
      activity =>
        activity.lat !== null &&
        activity.lng !== null
    )
    .map(activity => ({
      position: [activity.lat, activity.lng],
      label: activity.name
    })) || []

  const routeStops = hotelLocation
  ? [
      {
        position: hotelLocation,
        label: trip.hotel_address,
      },
      ...stops,
      {
        position: hotelLocation,
        label: trip.hotel_address,
      },
    ]
  : stops

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

      {/* Map */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4"><MapPin size={18} className="text-indigo-600" /> {capitalize(destination || 'Trip')} Map</h2>
        <MapView height="h-80" 
                 center={mapCenter} 
                 stops={stops}
                 routeStops={routeStops}
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