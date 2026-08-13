import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MapPin, Calendar, Building2, Camera, Plane, CalendarPlus, ArrowLeft, ArrowRight, Pencil,
  ClipboardCheck, Check,
} from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import HotelSearchInput from '../../components/HotelSearchInput'
import Input, { Textarea } from '../../components/Input'
import Button from '../../components/Button'
import { useToast } from '../../components/Toast'
import { SPRING_SOFT, SPRING_POP, GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { createTrip, selectFlight } from './tripsApi'
import { useTripDraft } from './useTripDraft'

// One question at a time rather than one long form. Required steps
// (origin/destination/dates) gate Continue on stepValid; optional steps
// (flight/hotel/places) get one adaptive button that reads "Skip for now"
// until there's something worth keeping, then "Continue" (see stepHasValue).
// FLIGHT_STEP is referenced directly by handleFindFlight so the round-trip
// to /trips/new/flights/outbound resumes here, not at 0.
const STEPS = ['origin', 'destination', 'dates', 'flight', 'hotel', 'places', 'review']
const FLIGHT_STEP = STEPS.indexOf('flight')
const HOTEL_STEP = STEPS.indexOf('hotel')
const PLACES_STEP = STEPS.indexOf('places')

const STEP_ICONS = {
  origin: Plane, destination: MapPin, dates: Calendar,
  flight: Plane, hotel: Building2, places: Camera, review: ClipboardCheck,
}

// Short mono gate labels for the gate-sequence tracker — replaces the plain
// "Step X of Y" progress bar with a legible row of named stops, like an
// airport gate sequence (A1 -> A2 -> A3).
const GATE_LABELS = {
  origin: 'From', destination: 'To', dates: 'Dates',
  flight: 'Flight', hotel: 'Hotel', places: 'Places', review: 'Review',
}

export default function NewTripPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { draft, updateDraft, clearDraft } = useTripDraft()

  // Persisted on the same sessionStorage draft as everything else (see
  // useTripDraft) via updateDraft, rather than local component state — a
  // trip to /trips/new/flights/outbound and back remounts this component
  // from scratch, and only the draft survives that round-trip.
  const step = draft._step ?? 0
  const goTo = (index) => updateDraft({ _step: index })
  const back = () => goTo(Math.max(0, step - 1))
  const next = () => goTo(Math.min(STEPS.length - 1, step + 1))

  const bothFlightsPicked = Boolean(draft.outboundFlight && draft.returnFlight)

  // Same end-after-start threshold as ItineraryPage's datesInvalid check
  // (endDraft <= startDraft) — kept consistent so "invalid dates" means the
  // same thing everywhere in the app.
  const datesInvalid = Boolean(draft.startDate && draft.endDate && draft.endDate <= draft.startDate)

  const stepValid = {
    origin: Boolean(draft.origin?.trim()),
    destination: Boolean(draft.destination?.trim()),
    dates: Boolean(draft.startDate && draft.endDate && !datesInvalid),
    flight: true,
    hotel: true,
    places: true,
    review: true,
  }[STEPS[step]]

  // Optional steps (flight/hotel/places) get one adaptive button instead of
  // a redundant "Continue" (always enabled) next to a "Skip for now" that'd
  // do the exact same thing — it reads as "Skip for now" while the field is
  // empty, and switches to "Continue" the moment there's something to keep.
  const stepHasValue = {
    flight: Boolean(draft.flightNumber?.trim()) || bothFlightsPicked,
    hotel: Boolean(draft.hotelAddress?.trim()),
    places: Boolean(draft.placesToVisit?.trim()),
  }[STEPS[step]]

  // Drives the little checkmark badge on the step icon — stepHasValue only
  // covers the optional steps, so required steps (and review) fall back to
  // stepValid.
  const stepSatisfied = stepHasValue ?? stepValid

  // Same satisfied logic as stepValid/stepHasValue above, but keyed by every
  // step at once (not just the current one) — purely derived from the draft,
  // no new state — so the gate-sequence tracker below can show a checkmark
  // on every gate already passed, not only the one currently open.
  const stepSatisfiedByKey = {
    origin: Boolean(draft.origin?.trim()),
    destination: Boolean(draft.destination?.trim()),
    dates: Boolean(draft.startDate && draft.endDate && !datesInvalid),
    flight: Boolean(draft.flightNumber?.trim()) || bothFlightsPicked,
    hotel: Boolean(draft.hotelAddress?.trim()),
    places: Boolean(draft.placesToVisit?.trim()),
    review: true,
  }

  // Enter-to-continue only actually fires on these — single plain-text-input
  // steps where the browser's native implicit form submission applies (see
  // the guard in handleSubmit). Dates has two inputs and hotel/places use
  // richer widgets, so hinting there would promise a shortcut that may not
  // work.
  const showEnterHint = (STEPS[step] === 'origin' || STEPS[step] === 'destination') && stepValid

  const handleFindFlight = () => {
    goTo(FLIGHT_STEP)
    navigate('/trips/new/flights/outbound')
  }

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Pressing Enter in an input can trigger the form's submit natively
    // even when the actual submit button isn't the one currently shown
    // (it only renders on the review step) — treat that as "go to the next
    // step" instead of prematurely creating the trip from an early step.
    // Still respects the same validity gate as the Continue button, so
    // Enter can't skip past a required field left empty.
    if (STEPS[step] !== 'review') {
      if (stepValid) next()
      return
    }
    if (datesInvalid) {
      setErrorMessage('Return date must be after the departure date.')
      return
    }
    setSubmitting(true)
    setErrorMessage('')
    try {
      const trip = await createTrip({
        name: `${draft.destination} Trip`,
        destination: draft.destination,
        origin: draft.origin,
        start_date: draft.startDate,
        end_date: draft.endDate,
        hotel_address: (draft.hotelAddress || '').trim(),
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
      toast.show('Trip created — let\'s check the forecast', 'celebration')
      navigate(`/trips/${trip.id}`)
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Something went wrong while planning your trip.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="heading-1">Plan Your Trip!</h1>
      <p className="text-body-sm text-ink-muted mt-1 mb-6">Just a few quick questions and we'll set up your trip.</p>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-surface shadow-ticket overflow-hidden flex">
      <div className="p-6 sm:p-8 flex-1 min-w-0">
        {step > 0 && (
          <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink font-medium mb-3">
            <ArrowLeft size={15} /> Back
          </button>
        )}

        {/* Impeccable relayout: replaces the plain gradient progress bar +
            "Step X of Y" text with a row of named gates, like an airport
            gate sequence — you can tap back to any gate already reached,
            but not skip ahead of one that hasn't been validated yet
            (goTo() has no validity guard of its own, so future gates stay
            disabled rather than opening a way to reach Review with a
            required field still empty). */}
        <div
          role="tablist"
          aria-label="Trip setup steps"
          className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STEPS.map((key, index) => {
            const isCurrent = index === step
            const isDone = stepSatisfiedByKey[key] && index < step
            const isFuture = index > step
            return (
              <div key={key} className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  role="tab"
                  onClick={() => goTo(index)}
                  disabled={isFuture}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-selected={isCurrent}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] tracking-wide uppercase transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    isCurrent
                      ? 'bg-brand-600 text-white'
                      : isDone
                        ? 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                        : 'bg-surface-sunken text-ink-muted/60'
                  }`}
                >
                  {isDone && <Check size={10} strokeWidth={3} />}
                  {GATE_LABELS[key]}
                </button>
                {index < STEPS.length - 1 && (
                  <span className="text-ink-muted/40" aria-hidden="true">&middot;</span>
                )}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_SOFT}
          >
            <StepIcon icon={STEP_ICONS[STEPS[step]]} satisfied={stepSatisfied} />

            {STEPS[step] === 'origin' && (
              <div className="space-y-4">
                <p className="heading-3">Where are you flying from?</p>
                <Input
                  id="origin"
                  label="Departure"
                  labelIcon={<Plane size={16} className="text-brand-600" />}
                  type="text"
                  value={draft.origin || ''}
                  onChange={(e) => updateDraft({ origin: e.target.value })}
                  placeholder="e.g. London, UK"
                  autoFocus
                  required
                />
              </div>
            )}

            {STEPS[step] === 'destination' && (
              <div className="space-y-4">
                <p className="heading-3">Where are you headed?</p>
                <Input
                  id="destination"
                  label="Destination"
                  labelIcon={<MapPin size={16} className="text-brand-600" />}
                  type="text"
                  value={draft.destination || ''}
                  onChange={(e) => updateDraft({ destination: e.target.value })}
                  placeholder="e.g. Berlin, Germany"
                  autoFocus
                  required
                />
              </div>
            )}

            {STEPS[step] === 'dates' && (
              <div className="space-y-4">
                <p className="heading-3">When are you traveling?</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="date-depart"
                    label="Date Depart"
                    labelIcon={<Calendar size={16} className="text-brand-600" />}
                    type="date"
                    value={draft.startDate || ''}
                    onChange={(e) => updateDraft({ startDate: e.target.value })}
                    autoFocus
                    required
                  />
                  <Input
                    id="date-return"
                    label="Date Return"
                    labelIcon={<Calendar size={16} className="text-brand-600" />}
                    type="date"
                    value={draft.endDate || ''}
                    onChange={(e) => updateDraft({ endDate: e.target.value })}
                    error={datesInvalid ? 'Return date must be after the departure date.' : undefined}
                    required
                  />
                </div>
              </div>
            )}

            {STEPS[step] === 'flight' && (
              <div className="space-y-4">
                <p className="heading-3">Got a flight? <span className="text-ink-muted font-normal">(Optional)</span></p>
                {bothFlightsPicked ? (
                  <div className="space-y-3">
                    <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-brand-600 mb-0.5">Outbound Flight</p>
                      <p className="font-semibold text-ink text-sm">
                        {draft.outboundFlight.airline} · {draft.outboundFlight.flight_number}
                      </p>
                      <p className="text-xs text-ink-muted">{draft.outboundFlight.departure_time} &rarr; {draft.outboundFlight.arrival_time}</p>
                    </div>
                    <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-brand-600 mb-0.5">Return Flight</p>
                      <p className="font-semibold text-ink text-sm">
                        {draft.returnFlight.airline} · {draft.returnFlight.flight_number}
                      </p>
                      <p className="text-xs text-ink-muted">{draft.returnFlight.departure_time} &rarr; {draft.returnFlight.arrival_time}</p>
                    </div>
                    <Button type="button" variant="secondary" onClick={handleFindFlight} className="w-full">
                      Change Flights
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      id="flight-number"
                      label="Flight Number"
                      labelIcon={<Plane size={16} className="text-brand-600" />}
                      type="text"
                      value={draft.flightNumber || ''}
                      onChange={(e) => updateDraft({ flightNumber: e.target.value })}
                      placeholder="e.g. JL 712"
                      autoFocus
                    />
                    <p className="text-center text-xs text-ink-muted">or</p>
                    <Button type="button" variant="ghost" onClick={handleFindFlight} className="w-full border border-brand-600">
                      <Plane size={16} /> Find Flight For Me
                    </Button>
                  </div>
                )}
              </div>
            )}

            {STEPS[step] === 'hotel' && (
              <div className="space-y-4">
                <p className="heading-3">Where are you staying? <span className="text-ink-muted font-normal">(Optional)</span></p>
                <div>
                  <label htmlFor="hotel" className="field-label">
                    <Building2 size={16} className="text-brand-600" /> Hotel
                  </label>
                  <HotelSearchInput
                    id="hotel"
                    value={draft.hotelAddress || ''}
                    onChange={(v) => updateDraft({ hotelAddress: v })}
                    cityContext={draft.destination}
                    placeholder="e.g. The Ritz Paris"
                  />
                </div>
              </div>
            )}

            {STEPS[step] === 'places' && (
              <div className="space-y-4">
                <p className="heading-3">Anywhere you want to visit? <span className="text-ink-muted font-normal">(Optional)</span></p>
                <Textarea
                  id="places-to-visit"
                  label="Places to Visit"
                  labelIcon={<Camera size={16} className="text-brand-600" />}
                  value={draft.placesToVisit || ''}
                  onChange={(e) => updateDraft({ placesToVisit: e.target.value })}
                  placeholder="e.g. Eiffel Tower, Louvre Museum..."
                  rows={3}
                  autoFocus
                />
              </div>
            )}

            {STEPS[step] === 'review' && (
              <div className="space-y-4">
                <p className="heading-3">Ready to go?</p>
                <motion.div
                  variants={GRID_VARIANTS}
                  initial="hidden"
                  animate="show"
                  className="rounded-xl bg-surface-sunken ring-1 ring-brand-100 divide-y divide-brand-100"
                >
                  <ReviewRow label={`${draft.origin} → ${draft.destination}`} sub={`${draft.startDate} → ${draft.endDate}`} onEdit={() => goTo(0)} />
                  <ReviewRow
                    label={bothFlightsPicked ? `${draft.outboundFlight.airline} · ${draft.outboundFlight.flight_number}` : (draft.flightNumber || 'No flight added')}
                    onEdit={() => goTo(FLIGHT_STEP)}
                  />
                  <ReviewRow label={draft.hotelAddress || 'No hotel added'} onEdit={() => goTo(HOTEL_STEP)} />
                  <ReviewRow label={draft.placesToVisit || 'No places added yet'} onEdit={() => goTo(PLACES_STEP)} />
                </motion.div>
              </div>
            )}

            {/* Lives inside the same keyed block as the question above, so
                it exits/enters together with it — otherwise this button's
                label swaps to the next step's action the instant `step`
                changes, ahead of the content's own fade transition, and a
                fast click meant for one step's button can land on the next
                step's (e.g. skip through hotel/places and hit "Plan My
                Trip" before the review content has even appeared). */}
            <div className="mt-6">
              {STEPS[step] === 'review' ? (
                <Button type="submit" disabled={submitting || datesInvalid} className="w-full">
                  <CalendarPlus size={16} /> {submitting ? 'Planning...' : 'Plan My Trip'}
                </Button>
              ) : STEPS[step] === 'flight' || STEPS[step] === 'hotel' || STEPS[step] === 'places' ? (
                <Button type="button" variant={stepHasValue ? 'primary' : 'secondary'} onClick={next} className="w-full">
                  {stepHasValue ? <>Continue <ArrowRight size={16} /></> : 'Skip for now'}
                </Button>
              ) : (
                <Button type="button" onClick={next} disabled={!stepValid} className="w-full">
                  Continue <ArrowRight size={16} />
                </Button>
              )}
              {showEnterHint && (
                <p className="text-center text-xs text-ink-muted mt-2.5">
                  Press <kbd className="px-1.5 py-0.5 rounded border border-brand-200 bg-surface-sunken font-mono text-[10px]">Enter ↵</kbd> to continue
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {errorMessage && <div className="mt-4"><ErrorMessage message={errorMessage} /></div>}
      </div>
      {/* Barcode on its own solid-backed side strip, like a real boarding
          pass, rather than a horizontal band across the bottom. */}
      <div className="w-6 sm:w-7 shrink-0 barcode-strip-v text-brand-900/60 bg-surface-sunken" aria-hidden="true" />
      </form>
    </div>
  )
}

function StepIcon({ icon: Icon, satisfied }) {
  return (
    <div className="relative w-12 h-12 mb-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
        <Icon size={22} className="text-brand-600" />
      </div>
      <AnimatePresence>
        {satisfied && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING_POP}
            className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center"
          >
            <Check size={12} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ReviewRow({ label, sub, onEdit }) {
  return (
    <motion.div variants={ITEM_VARIANTS} className="flex items-center justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <p className="font-medium text-ink text-sm truncate">{label}</p>
        {sub && <p className="text-xs text-ink-muted truncate">{sub}</p>}
      </div>
      <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700 shrink-0">
        <Pencil size={12} /> Edit
      </button>
    </motion.div>
  )
}
