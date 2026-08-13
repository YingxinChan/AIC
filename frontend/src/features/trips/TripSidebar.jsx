import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plane, Building2, CheckCircle2, CalendarPlus, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { SPRING_SOFT } from '../../lib/motion'

// Cap the collapsed day strip so a long trip doesn't push the rest of the
// rail down before anyone's even picked a day — "Show all" reveals the rest.
const DAY_PREVIEW_COUNT = 4

function airlineCode(flightNumber) {
  return (flightNumber || '').split(' ')[0]
}

// One flight leg, condensed for the narrow rail: the same data the old
// full-width flight card showed (leg + date, airline + number, both times,
// Change/Add link), just stacked into two tight rows with smaller icons
// instead of one wide row.
function FlightRow({ label, dateStr, airline, flightNumber, timeFrom, timeTo, href, emptyText, linkLabel }) {
  const hasFlight = Boolean(flightNumber)
  return (
    <div className="rounded-xl bg-surface ring-1 ring-brand-100 p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        {hasFlight && (
          <div className="w-7 h-7 shrink-0 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-[10px]">
            {airlineCode(flightNumber)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-ink-muted truncate">{label} &middot; {dateStr}</p>
          {hasFlight ? (
            <p className="font-medium text-ink text-xs truncate">{airline} &middot; {flightNumber}</p>
          ) : (
            <p className="text-ink-muted text-xs italic">{emptyText}</p>
          )}
        </div>
        {hasFlight && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
      </div>
      <div className="flex items-center justify-between gap-2">
        {hasFlight ? (
          <p className="text-[11px] text-ink-muted truncate">{timeFrom} &rarr; {timeTo}</p>
        ) : (
          <span />
        )}
        <Link to={href} className="text-xs text-brand-600 font-medium hover:text-brand-700 shrink-0">
          {linkLabel}
        </Link>
      </div>
    </div>
  )
}

// Left rail on lg+ (sticky): a Days card (when the trip has dates) followed
// by Generate + Flights + Hotel.
export default function TripSidebar({
  trip,
  tripId,
  hasHotel,
  hotelParts,
  onEditHotel,
  generating,
  hasItinerary,
  onGenerate,
  tripDates = [],
  selectedDate,
  onSelectDate,
}) {
  const [daysExpanded, setDaysExpanded] = useState(false)
  const showAllDays = daysExpanded || tripDates.indexOf(selectedDate) >= DAY_PREVIEW_COUNT
  const visibleDates = showAllDays ? tripDates : tripDates.slice(0, DAY_PREVIEW_COUNT)

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 space-y-4">
      {tripDates.length > 0 && (
        <Card className="p-4 space-y-2 min-w-0">
          <p className="font-mono text-[11px] tracking-wide uppercase text-ink-muted">Days</p>
          <div className="scroll-strip gap-2 pb-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:gap-1.5">
            {visibleDates.map((d) => {
              const index = tripDates.indexOf(d)
              const isActive = d === selectedDate
              return (
                <motion.button
                  key={d}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectDate(d)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`relative shrink-0 snap-start lg:w-full lg:text-left overflow-hidden px-4 py-2 rounded-full lg:rounded-lg text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${isActive ? 'border-brand-600' : 'border-brand-200 hover:border-brand-300'}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="dayTabPill"
                      transition={SPRING_SOFT}
                      className="absolute inset-0 rounded-full lg:rounded-lg bg-brand-600"
                    />
                  )}
                  <span className={`relative z-10 whitespace-nowrap ${isActive ? 'text-white' : 'text-ink-muted'}`}>
                    Day {index + 1} &middot; {d}
                  </span>
                </motion.button>
              )
            })}
          </div>
          {tripDates.length > DAY_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setDaysExpanded((open) => !open)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 pt-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {showAllDays ? 'Show less' : `Show all ${tripDates.length} days`}
              {showAllDays ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 space-y-4">
          {/* Applies to the whole trip, not one day, so it sits at the top of
              this card rather than beside the day list. Icon-by-state and the
              success toast are unchanged (see handleGenerate). */}
          <Button type="button" onClick={onGenerate} disabled={generating} className="w-full">
            {generating ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : hasItinerary ? (
              <RefreshCw size={16} />
            ) : (
              <CalendarPlus size={16} />
            )}
            {generating ? 'Generating...' : hasItinerary ? 'Regenerate Itinerary' : 'Generate Itinerary'}
          </Button>

          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-wide uppercase text-ink-muted flex items-center gap-1.5">
              <Plane size={12} className="text-brand-600" /> Selected Flights
            </p>
            <FlightRow
              label="Outbound"
              dateStr={trip.start_date}
              airline={trip.arrival_airline}
              flightNumber={trip.arrival_flight_number}
              timeFrom={trip.arrival_other_time}
              timeTo={trip.arrival_time}
              href={`/trips/${tripId}/flights/outbound`}
              emptyText="No outbound flight added yet."
              linkLabel={trip.arrival_flight_number ? 'Change Flight' : 'Add Flight'}
            />
            <FlightRow
              label="Return"
              dateStr={trip.end_date}
              airline={trip.departure_airline}
              flightNumber={trip.departure_flight_number}
              timeFrom={trip.departure_time}
              timeTo={trip.departure_other_time}
              href={`/trips/${tripId}/flights/return`}
              emptyText="No return flight added yet."
              linkLabel={trip.departure_flight_number ? 'Change Flight' : 'Add Flight'}
            />
          </div>

          <div className="space-y-1.5 pt-3 border-t border-brand-100">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono text-[11px] tracking-wide uppercase text-ink-muted flex items-center gap-1.5">
                <Building2 size={12} className="text-brand-600" /> Hotel
              </h3>
              <button type="button" onClick={onEditHotel} className="text-xs text-brand-600 font-medium hover:text-brand-700">
                {hasHotel ? 'Edit Hotel' : 'Add Hotel'}
              </button>
            </div>
            {hotelParts ? (
              <div className="rounded-xl bg-surface ring-1 ring-brand-100 p-2.5">
                <p className="text-ink text-xs font-bold">{hotelParts.name}</p>
                {hotelParts.address && <p className="text-ink-muted text-[11px] leading-snug">{hotelParts.address}</p>}
              </div>
            ) : (
              <p className="text-ink-muted text-xs italic">No hotel added yet.</p>
            )}
          </div>
        </div>
      </Card>
    </aside>
  )
}
