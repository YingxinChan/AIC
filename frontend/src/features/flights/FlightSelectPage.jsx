import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plane, ArrowLeft } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { searchFlights } from './flightsApi'
import { useTripDraft } from '../trips/useTripDraft'
import { getTrip, selectFlight } from '../trips/tripsApi'
import { capitalize } from '../../lib/format'
import { markPendingReview } from '../../lib/pendingReview'

function airlineCode(flightNumber) {
  // P0 Fix: Works for "BA 112" or "KL346" by just matching letters
  return (flightNumber || '').match(/^[A-Za-z]+/)?.[0] ?? ''
}

export default function FlightSelectPage() {
  const { leg, tripId } = useParams()
  const navigate = useNavigate()
  const { draft, updateDraft } = useTripDraft()

  // Present when this page is reached via /trips/:tripId/flights/:leg (an
  // existing saved trip being edited) rather than /trips/new/flights/:leg
  // (the creation draft flow).
  const isEditMode = Boolean(tripId)
  const [trip, setTrip] = useState(null)

  useEffect(() => {
    if (!isEditMode) return
    let cancelled = false
    getTrip(tripId).then((data) => { if (!cancelled) setTrip(data) })
    return () => { cancelled = true }
  }, [tripId])

  const isOutbound = leg === 'outbound'
  const direction = isOutbound ? 'arrival' : 'departure'
  const origin = isEditMode ? trip?.origin : draft.origin
  const destination = isEditMode ? trip?.destination : draft.destination
  const date = isEditMode
    ? (isOutbound ? trip?.start_date : trip?.end_date)
    : (isOutbound ? draft.startDate : draft.endDate)
  // No prior flight-number filter exists to carry over in edit mode —
  // search unfiltered, same as draft.flightNumber being blank today.
  const flightNumber = isEditMode ? '' : draft.flightNumber

  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selectError, setSelectError] = useState('')

  useEffect(() => {
    if (isEditMode && !trip) return // wait for the trip to load in edit mode
    let cancelled = false
    setLoading(true)
    setErrorMessage('')
    searchFlights(origin, date, date, direction, destination, flightNumber)
      .then((data) => { if (!cancelled) setFlights(data.flights || []) })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.response?.data?.detail || 'Something went wrong while fetching flights.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leg, isEditMode, trip])

  const handleSelect = async (flight) => {
    if (isEditMode) {
      setSelecting(true)
      setSelectError('')
      try {
        await selectFlight(tripId, {
          leg: direction,
          flight_number: flight.flight_number,
          airline: flight.airline,
          time: isOutbound ? flight.arrival_time : flight.departure_time,
          other_time: isOutbound ? flight.departure_time : flight.arrival_time,
        })
        // Each leg is independent here — no forced chain into the other
        // one, matching the two separate Change Flight links on the trip
        // page. Doesn't regenerate the itinerary itself — dates/hotel edits
        // and this flight change are batched, and ItineraryPage's review
        // prompt (triggered by the pendingReview flag) is what actually
        // fires the regenerate, once the user is done editing everything.
        markPendingReview(tripId, leg)
        navigate(`/trips/${tripId}`)
      } catch (err) {
        // A separate error state from the search's errorMessage, which
        // gates the whole flights list below — reusing it would hide the
        // Select button the user needs to retry right after a failed save.
        setSelectError(err.response?.data?.detail || 'Something went wrong while saving this flight — try again.')
        setSelecting(false)
      }
      return
    }
    if (isOutbound) {
      updateDraft({ outboundFlight: flight })
      navigate('/trips/new/flights/return')
    } else {
      updateDraft({ returnFlight: flight })
      navigate('/trips/new')
    }
  }

  return (
    <div className="space-y-6">
      <Link to={isEditMode ? `/trips/${tripId}` : '/trips/new'} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Edit Trip
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isOutbound
            ? `${capitalize(origin)} → ${capitalize(destination)}`
            : `${capitalize(destination)} → ${capitalize(origin)}`}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isOutbound ? 'Outbound Flight' : 'Return Flight'} &middot; {date || 'No date selected'}
        </p>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {selectError && <ErrorMessage message={selectError} />}

      {loading && <p className="text-sm text-gray-500">Searching for flights...</p>}

      {!loading && !errorMessage && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{flights.length} flight{flights.length === 1 ? '' : 's'} found</p>
          {flights.map((flight, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {airlineCode(flight.flight_number)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{flight.airline}</p>
                <p className="text-sm text-gray-500">{flight.flight_number}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">{flight.departure_time}</p>
                <p className="text-xs text-gray-500">Departure</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-400">{flight.duration}</p>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-8 border-t border-gray-300" />
                  <Plane size={14} />
                  <span className="w-8 border-t border-gray-300" />
                </div>
                <p className="text-xs font-medium text-green-600">Nonstop</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">{flight.arrival_time}</p>
                <p className="text-xs text-gray-500">Arrival</p>
              </div>
              <button
                type="button"
                onClick={() => handleSelect(flight)}
                disabled={selecting}
                className="bg-indigo-600 text-white px-5 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {selecting ? 'Saving...' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}