import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Plane, ArrowLeft } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { searchFlights } from './flightsApi'
import { useTripDraft } from '../trips/useTripDraft'

function airlineCode(flightNumber) {
  return (flightNumber || '').split(' ')[0]
}

export default function FlightSelectPage() {
  const { leg } = useParams()
  const navigate = useNavigate()
  const { draft, updateDraft } = useTripDraft()

  const isOutbound = leg === 'outbound'
  const direction = isOutbound ? 'arrival' : 'departure'
  const date = isOutbound ? draft.startDate : draft.endDate
  const flightNumber = isOutbound ? draft.flightNumber : ''

  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMessage('')
    searchFlights(draft.origin, date, date, direction, draft.destination, flightNumber)
      .then((data) => { if (!cancelled) setFlights(data.flights || []) })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.response?.data?.detail || 'Something went wrong while fetching flights.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg])

  const handleSelect = (flight) => {
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
      <Link to="/trips/new" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Edit Trip
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isOutbound ? 'Departure → Destination' : 'Destination → Departure'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isOutbound ? 'Outbound Flight' : 'Return Flight'} &middot; {date || 'No date selected'}
        </p>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}

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
                className="bg-indigo-600 text-white px-5 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
