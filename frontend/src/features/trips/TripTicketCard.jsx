import { Link } from 'react-router-dom'
import { Plane, Trash2 } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize, cityCode } from '../../lib/format'
import { findDestinationImage } from './destinationImages'

// A landscape boarding-pass card (photo + torn-off code stub side by side,
// like a real ticket) — used both for Dashboard's horizontal-scroll "Recent
// Trips" strip and MyTripsPage's grid (which also needs onDelete/
// daysUntilLabel). Photo carries the identity (status stamp + name); the
// stub carries the route code and the trip's one date line — nothing is
// stated on both sides.
export default function TripTicketCard({ trip, onDelete, deleting, daysUntilLabel, className = '' }) {
  const status = tripStatus(trip)
  const cardImage = findDestinationImage(trip.destination)

  return (
    <Card
      as={Link}
      to={`/trips/${trip.id}`}
      hoverable
      className={`group relative flex h-48 max-w-xs mx-auto overflow-hidden !border-brand-100 !shadow-ticket hover:!border-brand-300 ${className}`}
    >
      <div className="relative flex-1 min-w-0 overflow-hidden">
        <div
          className={`absolute inset-0 ${cardImage ? '' : 'bg-gradient-to-br from-brand-400 to-brand-700'} ${cardImage && cardImage.fit !== 'contain' ? 'bg-cover' : ''} bg-center transition-transform duration-500 group-hover:scale-105`}
          style={
            cardImage
              ? cardImage.fit === 'contain'
                ? {
                    backgroundImage: `url(${cardImage.url}), linear-gradient(to bottom right, #2C4066, #0F1729)`,
                    backgroundSize: 'contain, cover',
                    backgroundPosition: `${cardImage.position}, center`,
                    backgroundRepeat: 'no-repeat, no-repeat',
                  }
                : { backgroundImage: `url(${cardImage.url})`, backgroundPosition: cardImage.position }
              : undefined
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-8">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`-rotate-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
              {status}
            </span>
            {daysUntilLabel && (
              <span className="text-[11px] font-medium text-white/80 whitespace-nowrap">{daysUntilLabel}</span>
            )}
          </div>
          <p className="font-display font-semibold text-white text-lg leading-tight truncate">{capitalize(trip.name)}</p>
        </div>

        {onDelete && (
          <Button
            variant="overlay"
            shape="icon"
            aria-label={`Delete ${trip.name}`}
            disabled={deleting}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(trip) }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity !bg-black/40 !text-white hover:!text-red-300"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      {/* Torn code stub — same ticket-divider anatomy (punched notches) as
          the Dashboard/Itinerary hero stubs, so every ticket in the app
          shares one visual grammar. */}
      <div className="ticket-divider flex flex-col items-center justify-center gap-1.5 w-[76px] sm:w-24 shrink-0 bg-surface px-2 text-center">
        <Plane size={14} className="text-brand-300" />
        <p className="font-display font-bold text-lg text-brand-700 leading-none">{cityCode(trip.destination)}</p>
        <p className="font-mono text-[10px] text-ink-muted leading-tight">
          {trip.start_date}<br />&darr;<br />{trip.end_date}
        </p>
      </div>
    </Card>
  )
}
