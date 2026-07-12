import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, Building2, Camera, Plane, Search } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { createTrip, selectFlight } from './tripsApi'
import { useTripDraft } from './useTripDraft'

export default function NewTripPage() {
  const navigate = useNavigate()
  const { draft, updateDraft, clearDraft } = useTripDraft()

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const bothFlightsPicked = Boolean(draft.outboundFlight && draft.returnFlight)

  const handleFindFlight = () => {
    navigate('/trips/new/flights/outbound')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    try {
      const trip = await createTrip({
        name: `${draft.destination} Trip`,
        destination: draft.destination,
        start_date: draft.startDate,
        end_date: draft.endDate,
        hotel_address: draft.hotelAddress,
        original_plan: draft.placesToVisit,
      })

      if (draft.outboundFlight) {
        await selectFlight(String(trip.id), {
          leg: 'arrival',
          flight_number: draft.outboundFlight.flight_number,
          airline: draft.outboundFlight.airline,
          time: draft.outboundFlight.arrival_time,
          other_time: draft.outboundFlight.departure_time,
        })
      }
      if (draft.returnFlight) {
        await selectFlight(String(trip.id), {
          leg: 'departure',
          flight_number: draft.returnFlight.flight_number,
          airline: draft.returnFlight.airline,
          time: draft.returnFlight.departure_time,
          other_time: draft.returnFlight.arrival_time,
        })
      }

      clearDraft()
      navigate(`/trips/${trip.id}`)
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Something went wrong while planning your trip.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Plan Your Trip!</h1>
      <p className="text-gray-500 text-sm mt-1 mb-6">Fill in the details below and we'll find the best options for you.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="origin" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Plane size={16} className="text-indigo-600" /> Departure
            </label>
            <input
              id="origin"
              type="text"
              value={draft.origin}
              onChange={(e) => updateDraft({ origin: e.target.value })}
              placeholder="e.g. London, UK"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="destination" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <MapPin size={16} className="text-indigo-600" /> Destination
            </label>
            <input
              id="destination"
              type="text"
              value={draft.destination}
              onChange={(e) => updateDraft({ destination: e.target.value })}
              placeholder="e.g. Tokyo, Japan"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date-depart" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="text-indigo-600" /> Date Depart
            </label>
            <input
              id="date-depart"
              type="date"
              value={draft.startDate}
              onChange={(e) => updateDraft({ startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="date-return" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="text-indigo-600" /> Date Return
            </label>
            <input
              id="date-return"
              type="date"
              value={draft.endDate}
              onChange={(e) => updateDraft({ endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>
        </div>

        {!bothFlightsPicked && (
          <div>
            <label htmlFor="flight-number" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Plane size={16} className="text-indigo-600" /> Flight Number <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              id="flight-number"
              type="text"
              value={draft.flightNumber}
              onChange={(e) => updateDraft({ flightNumber: e.target.value })}
              placeholder="e.g. JL 712"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {bothFlightsPicked ? (
          <div className="space-y-3">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <p className="text-xs font-medium text-indigo-600 mb-0.5">Outbound Flight</p>
              <p className="font-semibold text-gray-900 text-sm">
                {draft.outboundFlight.airline} · {draft.outboundFlight.flight_number}
              </p>
              <p className="text-xs text-gray-500">{draft.outboundFlight.departure_time} &rarr; {draft.outboundFlight.arrival_time}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <p className="text-xs font-medium text-indigo-600 mb-0.5">Return Flight</p>
              <p className="font-semibold text-gray-900 text-sm">
                {draft.returnFlight.airline} · {draft.returnFlight.flight_number}
              </p>
              <p className="text-xs text-gray-500">{draft.returnFlight.departure_time} &rarr; {draft.returnFlight.arrival_time}</p>
            </div>
            <button
              type="button"
              onClick={handleFindFlight}
              className="w-full border border-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors"
            >
              Change Flights
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleFindFlight}
            disabled={!draft.origin || !draft.destination || !draft.startDate || !draft.endDate}
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-600 text-indigo-600 px-6 py-2 rounded-md font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <Plane size={16} /> Find Flight
          </button>
        )}

        <div>
          <label htmlFor="hotel" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <Building2 size={16} className="text-indigo-600" /> Hotel
          </label>
          <input
            id="hotel"
            type="text"
            value={draft.hotelAddress}
            onChange={(e) => updateDraft({ hotelAddress: e.target.value })}
            placeholder="e.g. Park Hyatt Tokyo"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="places-to-visit" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <Camera size={16} className="text-indigo-600" /> Places to Visit
          </label>
          <textarea
            id="places-to-visit"
            value={draft.placesToVisit}
            onChange={(e) => updateDraft({ placesToVisit: e.target.value })}
            placeholder="e.g. Eiffel Tower, Louvre Museum..."
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Search size={16} /> {submitting ? 'Planning...' : 'Plan My Trip'}
        </button>
      </form>
    </div>
  )
}
