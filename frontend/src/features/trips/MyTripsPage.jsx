import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plane, Compass, FilterX } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import PageLoader from '../../components/PageLoader'
import { Select } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { useTrips } from './useTrips'
import { deleteTrip } from './tripsApi'
import { tripStatus } from './tripStatus'
import TripTicketCard from './TripTicketCard'
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
  // Which trip is pending a delete confirmation, or null — holds the trip
  // object (not just an id) so the confirmation modal can show its name.
  const [tripPendingDelete, setTripPendingDelete] = useState(null)
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

  const handleDeleteClick = (trip) => {
    setTripPendingDelete(trip)
  }

  const handleConfirmDelete = async () => {
    const trip = tripPendingDelete
    setTripPendingDelete(null)
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

      {/* Full-page takeover while trips load, not a shape-preview list —
          this is the first thing anyone sees on this page, same treatment
          as Dashboard's initial load. */}
      {loading ? (
        <PageLoader label="Loading your trips…" />
      ) : (
      <>
      {error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!error && trips.length === 0 && (
        <EmptyState
          icon={Compass}
          title="No trips yet"
          description="Plan your first weather-perfect trip and Navia will build the day-by-day plan for you."
          action={<Button to="/trips/new">Plan your first trip</Button>}
        />
      )}

      {!error && trips.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                aria-pressed={statusFilter === filter}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  statusFilter === filter
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-sunken text-ink-muted hover:bg-brand-100'
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

      {!error && trips.length > 0 && visibleTrips.length === 0 && (
        <EmptyState
          icon={FilterX}
          title="No trips match this filter"
          description={`You have trips, just none in the "${statusFilter}" view right now.`}
          action={<Button variant="secondary" onClick={() => setStatusFilter('All')}>Clear filter</Button>}
        />
      )}

      {/* Impeccable relayout: a 3-col grid of square photo cards used to be
          the whole page. It's a grid of the same landscape boarding-pass
          cards Dashboard's "Recent Trips" strip uses now (TripTicketCard) —
          this page is just the full grid version of that same card, rather
          than each page inventing its own. */}
      {!error && visibleTrips.length > 0 && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={GRID_VARIANTS}
          initial="hidden"
          animate="show"
        >
          {visibleTrips.map((trip) => {
            const status = tripStatus(trip)
            return (
              <motion.div key={trip.id} variants={ITEM_VARIANTS}>
                <TripTicketCard
                  trip={trip}
                  onDelete={handleDeleteClick}
                  deleting={deletingId === trip.id}
                  daysUntilLabel={status === 'Upcoming' ? `in ${daysUntil(trip.start_date)} day${daysUntil(trip.start_date) === 1 ? '' : 's'}` : null}
                />
              </motion.div>
            )
          })}
        </motion.div>
      )}
      </>
      )}

      <Modal open={Boolean(tripPendingDelete)} onClose={() => setTripPendingDelete(null)} title="Delete this trip?">
        <p className="text-sm text-ink-muted mb-4">
          {tripPendingDelete && `Delete "${tripPendingDelete.name}"? This can't be undone.`}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setTripPendingDelete(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
