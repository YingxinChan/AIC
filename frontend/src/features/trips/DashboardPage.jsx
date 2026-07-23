import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Plane, ArrowRight, Calendar, ChevronRight } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import { useTrips } from './useTrips'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize } from '../../lib/format'
import planeWing from '../../assets/dashboard-plane-wing.jpg'

const RECENT_TRIPS_PREVIEW_COUNT = 2

export default function DashboardPage() {
  const { trips, loading, error } = useTrips()
  const destinationCount = new Set(trips.map((t) => t.destination).filter(Boolean)).size
  const recentTrips = trips.slice(0, RECENT_TRIPS_PREVIEW_COUNT)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500">Where are you heading next?</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl text-white grid sm:grid-cols-2 overflow-hidden">
        <div className="p-8 flex flex-col justify-center">
          <p className="text-xs font-medium text-indigo-200 mb-1">Ready for your next adventure?</p>
          <h2 className="text-2xl font-bold">Let AI plan your perfect trip</h2>
          <p className="text-sm text-indigo-100 mt-2 max-w-md">
            Tell us your destination, and our AI will craft a perfect daily itinerary smartly synced with hourly weather forecasts—so rain never ruins your plans.
          </p>
          <Link
            to="/trips/new"
            className="mt-4 inline-flex items-center gap-2 bg-white text-indigo-700 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-50 transition-colors w-fit"
          >
            <Plane size={16} /> Plan a Trip <ArrowRight size={14} />
          </Link>
        </div>
        <div className="relative hidden sm:block min-h-[220px]">
          <div
            className="absolute inset-0 bg-cover"
            style={{ backgroundImage: `url(${planeWing})`, backgroundPosition: 'center 68%' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/95 via-purple-600/60 to-purple-600/40" />
        </div>
      </div>

      {!loading && !error && trips.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
              <Briefcase size={18} className="text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{trips.length}</p>
            <p className="text-sm text-gray-500">Trips Planned</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <MapPin size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{destinationCount}</p>
            <p className="text-sm text-gray-500">Destinations</p>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading your trips...</p>}

      {!loading && error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!loading && !error && trips.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No trips yet — plan your first one to get started.</p>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Recent Trips</h3>
            <Link to="/trips" className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentTrips.map((trip) => {
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
        </div>
      )}
    </div>
  )
}
