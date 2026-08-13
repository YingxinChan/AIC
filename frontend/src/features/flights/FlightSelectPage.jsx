import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plane, ArrowLeft, SearchX } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import PlaneLoader from '../../components/PlaneLoader'
import { useToast } from '../../components/Toast'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
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
  const toast = useToast()
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
        toast.show('Flight saved')
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
      <Link to={isEditMode ? `/trips/${tripId}` : '/trips/new'} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={16} /> Back to Edit Trip
      </Link>

      <div>
        <h1 className="heading-1">
          {isOutbound
            ? `${capitalize(origin)} → ${capitalize(destination)}`
            : `${capitalize(destination)} → ${capitalize(origin)}`}
        </h1>
        <p className="text-body-sm text-ink-muted mt-1">
          {isOutbound ? 'Outbound Flight' : 'Return Flight'} &middot; {date || 'No date selected'}
        </p>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {selectError && <ErrorMessage message={selectError} />}

      {loading && <PlaneLoader label="Searching for flights…" className="py-10" />}

      {!loading && !errorMessage && flights.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No flights found"
          description="No flights matched this route and date. Try a different date or double-check the trip's origin and destination."
        />
      )}

      {!loading && !errorMessage && flights.length > 0 && (
        <motion.div className="space-y-3" variants={GRID_VARIANTS} initial="hidden" animate="show">
          <p className="text-sm text-ink-muted">{flights.length} flight{flights.length === 1 ? '' : 's'} found</p>
          {flights.map((flight, index) => (
            <Card
              key={index}
              hoverable
              variants={ITEM_VARIANTS}
              className="group p-4 flex items-center gap-4 !shadow-ticket hover:!border-brand-300"
            >
              <div className="w-14 h-14 shrink-0 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm transition-transform group-hover:scale-105">
                {airlineCode(flight.flight_number)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink group-hover:text-brand-700 transition-colors">{flight.airline}</p>
                <p className="text-sm text-ink-muted">{flight.flight_number}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-ink">{flight.departure_time}</p>
                <p className="text-xs text-ink-muted">Departure</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-medium text-ink-muted">{flight.duration}</p>
                <div className="flex items-center gap-2 text-brand-300">
                  <span className="w-8 border-t-2 border-dashed border-brand-200" />
                  <Plane size={14} className="text-brand-500" />
                  <span className="w-8 border-t-2 border-dashed border-brand-200" />
                </div>
                <p className="text-xs font-medium text-green-600">Nonstop</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-ink">{flight.arrival_time}</p>
                <p className="text-xs text-ink-muted">Arrival</p>
              </div>
              <Button onClick={() => handleSelect(flight)} disabled={selecting}>
                {selecting ? 'Saving...' : 'Select'}
              </Button>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  )
}
