import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plane, Calendar, Trash2, Compass, FilterX } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import { SkeletonTripCard } from '../../components/Skeleton'
import { Select } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { useTrips } from './useTrips'
import { deleteTrip } from './tripsApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize } from '../../lib/format'
import { findDestinationImage } from './destinationImages'
const STATUS_FILTERS = ['All', 'Upcoming', 'Ongoing', 'Completed']

// Both sides parsed as UTC midnight from "YYYY-MM-DD" strings, so this stays a
// clean whole-day diff regardless of the viewer's local timezone.
function daysUntil(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(dateStr) - new Date(today)) / msPerDay)
}

export default function MyTripsPage() {
  const { trips, loading, error, removeTrip } = useTrips()
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('soonest')
  const toast = useToast()

  const visibleTrips = useMemo(() => {
    const filtered =
      statusFilter === 'All' ? trips : trips.filter((trip) => tripStatus(trip) === statusFilter)

    const sorted = [...filtered]
    if (sortBy === 'soonest') {
      sorted.sort((a, b) => a.start_date.localeCompare(b.start_date))
    } else if (sortBy === 'created') {
      // No created-at timestamp on the trip payload — id order is a reliable
      // stand-in since ids are assigned sequentially at creation.
      sorted.sort((a, b) => b.id - a.id)
    }
    return sorted
  }, [trips, statusFilter, sortBy])

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
      toast.show('Trip deleted')
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
          <h1 className="heading-1">My Current Trips</h1>
          <p className="text-body-sm text-ink-muted">All your planned and past trips</p>
        </div>
        <Button to="/trips/new" shape="pill">
          <Plane size={16} /> New Trip
        </Button>
      </div>

      {deleteError && <ErrorMessage message={deleteError} />}

      {/* Default guess, same reasoning as the Dashboard hero: we don't know
          the real count until the fetch resolves, so this assumes the more
          common case (an account with trips already). A brand-new account
          briefly shows this before flipping to the empty state below. */}
      {loading && (
        <div>
          <span className="sr-only">Loading your trips...</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonTripCard />
            <SkeletonTripCard />
            <SkeletonTripCard />
          </div>
        </div>
      )}

      {!loading && error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!loading && !error && trips.length === 0 && (
        <EmptyState
          icon={Compass}
          title="No trips yet"
          description="Plan your first weather-perfect trip and Navia will build the day-by-day plan for you."
          action={<Button to="/trips/new">Plan your first trip</Button>}
        />
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  statusFilter === filter
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-ink-muted hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <Select
            aria-label="Sort trips"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="w-56"
          >
            <option value="soonest">Soonest departure first</option>
            <option value="created">Recently created</option>
          </Select>
        </div>
      )}

      {!loading && !error && trips.length > 0 && visibleTrips.length === 0 && (
        <EmptyState
          icon={FilterX}
          title="No trips match this filter"
          description={`You have trips, just none in the "${statusFilter}" view right now.`}
          action={<Button variant="secondary" onClick={() => setStatusFilter('All')}>Clear filter</Button>}
        />
      )}

      {!loading && !error && visibleTrips.length > 0 && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={GRID_VARIANTS}
          initial="hidden"
          animate="show"
        >
          {visibleTrips.map((trip) => {
            const status = tripStatus(trip)
            const cardImage = findDestinationImage(trip.destination)
            return (
              <Card
                key={trip.id}
                as={Link}
                to={`/trips/${trip.id}`}
                hoverable
                variants={ITEM_VARIANTS}
                className="group relative block h-64 overflow-hidden hover:border-brand-300"
              >
                <div
                  className={`h-full overflow-hidden ${cardImage ? '' : 'bg-gradient-to-br from-brand-400 to-purple-400'} ${cardImage && cardImage.fit !== 'contain' ? 'bg-cover' : ''} bg-center transition-transform duration-500 group-hover:scale-105`}
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

                <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                  {status === 'Upcoming' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm text-ink-muted">
                      in {daysUntil(trip.start_date)} day{daysUntil(trip.start_date) === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                <Button
                  variant="overlay"
                  shape="icon"
                  aria-label={`Delete ${trip.name}`}
                  disabled={deletingId === trip.id}
                  onClick={(event) => handleDelete(event, trip)}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </Button>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 pb-4 pt-12">
                  <p className="font-display font-semibold text-white text-xl leading-tight">{capitalize(trip.name)}</p>
                  <p className="flex items-center gap-1.5 text-xs text-white/80 mt-1.5">
                    <Calendar size={12} /> {trip.start_date} &rarr; {trip.end_date}
                  </p>
                </div>
              </Card>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
