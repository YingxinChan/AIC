import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plane,
  Calendar,
  ChevronRight,
  Trash2,
} from 'lucide-react'

import ErrorMessage from '../../components/ErrorMessage'
import { useTrips } from './useTrips'
import { deleteTrip } from './tripsApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'

export default function MyTripsPage() {
  const { trips, loading, error, removeTrip } = useTrips()
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (event, trip) => {
    event.preventDefault()
    event.stopPropagation()

    const confirmed = window.confirm(
      `Delete "${trip.name}"? This cannot be undone.`,
    )

    if (!confirmed) return

    setDeletingId(trip.id)

    try {
      await deleteTrip(trip.id)
      removeTrip(trip.id)
    } catch {
      // Leave the card visible if deletion fails.
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Current Trips
          </h1>

          <p className="text-sm text-gray-500">
            All your planned and past trips
          </p>
        </div>

        <Link
          to="/trips/new"
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plane size={16} />
          New Trip
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">
          Loading your trips...
        </p>
      )}

      {!loading && error && (
        <ErrorMessage message="Something went wrong while loading your trips." />
      )}

      {!loading && !error && trips.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">
            No trips yet — plan your first one to get started.
          </p>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => {
            const status = tripStatus(trip)
            const isDeleting = deletingId === trip.id

            return (
              <div
                key={trip.id}
                className="relative"
              >
                <Link
                  to={`/trips/${trip.id}`}
                  className="block overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-indigo-300"
                >
                  <div className="h-36 bg-gradient-to-br from-indigo-400 to-purple-400" />

                  <div className="p-4">
                    <p className="font-semibold text-gray-900">
                      {trip.name}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar size={14} />
                      {trip.start_date} &rarr; {trip.end_date}
                    </p>

                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                    >
                      {status}
                    </span>

                    <p className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600">
                      View Details
                      <ChevronRight size={14} />
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label={`Delete ${trip.name}`}
                  disabled={isDeleting}
                  onClick={(event) => handleDelete(event, trip)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}