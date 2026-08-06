import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plane, Calendar, ChevronRight, Trash2 } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { useTrips } from './useTrips'
import { deleteTrip } from './tripsApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize } from '../../lib/format'
import { findDestinationImage } from './destinationImages'

export default function MyTripsPage() {
  const { trips, loading, error, removeTrip } = useTrips()
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async (event, trip) => {
  event.preventDefault()
  event.stopPropagation()

  const confirmed = window.confirm(
    `Delete "${trip.name}"? This cannot be undone.`
  )

  if (!confirmed) return

  setDeleteError('')
  setDeletingId(trip.id)

  try {
    await deleteTrip(trip.id)
    removeTrip(trip.id)
  } catch {
    setDeleteError(`Couldn't delete "${trip.name}" — try again.`)
  } finally {
    setDeletingId(null)
  }
}
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

      {deleteError && <ErrorMessage message={deleteError} />}
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
            const cardImage = findDestinationImage(trip.destination)
            return (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors"
              >
                <div
                  className={`h-36 ${cardImage ? '' : 'bg-gradient-to-br from-indigo-400 to-purple-400'} ${cardImage && cardImage.fit !== 'contain' ? 'bg-cover' : ''}`}
                  style={
                    cardImage
                      ? cardImage.fit === 'contain'
                        ? {
                            backgroundImage: `url(${cardImage.url}), linear-gradient(to bottom right, #818cf8, #c084fc)`,
                            backgroundSize: 'contain, cover',
                            backgroundPosition: `${cardImage.position}, center`,
                            backgroundRepeat: 'no-repeat, no-repeat',
                          }
                        : { backgroundImage: `url(${cardImage.url})`, backgroundPosition: cardImage.position }
                      : undefined
                  }
                />
                <div className="p-4">
                  <p className="font-semibold text-gray-900">{capitalize(trip.name)}</p>
                  <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}
                  </p>
                  <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                  <div className="flex items-center justify-between mt-3">
                  <p className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                    View Details <ChevronRight size={14} />
                  </p>

                  <button
                    type="button"
                    aria-label={`Delete ${trip.name}`}
                    disabled={deletingId === trip.id}
                    onClick={(event) => handleDelete(event, trip)}
                    className="p-2 rounded-md text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                   > 
                   <Trash2 size={16} />
                   </button>
                </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
