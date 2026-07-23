import { Link } from 'react-router-dom'
import { Plane, Calendar, ChevronRight } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { useTrips } from './useTrips'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize } from '../../lib/format'

export default function MyTripsPage() {
  const { trips, loading, error } = useTrips()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Current Trips</h1>
          <p className="text-sm text-gray-500">All your planned and past trips</p>
        </div>
        <Link
          to="/trips/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plane size={16} /> New Trip
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your trips...</p>}

      {!loading && error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!loading && !error && trips.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No trips yet — plan your first one to get started.</p>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => {
            const status = tripStatus(trip)
            return (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors"
              >
                <div className="h-36 bg-gradient-to-br from-indigo-400 to-purple-400" />
                <div className="p-4">
                  <p className="font-semibold text-gray-900">{capitalize(trip.name)}</p>
                  <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}
                  </p>
                  <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                  <p className="flex items-center gap-1 text-sm text-indigo-600 font-medium mt-3">
                    View Details <ChevronRight size={14} />
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
