import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Calendar, Building2, Camera, Plane, Search } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import HotelSearchInput from '../../components/HotelSearchInput'
import Input, { Textarea } from '../../components/Input'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { useToast } from '../../components/Toast'
import { createTrip, selectFlight } from './tripsApi'
import { useTripDraft } from './useTripDraft'

export default function NewTripPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { draft, updateDraft, clearDraft } = useTripDraft()

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showFlightNumber, setShowFlightNumber] = useState(Boolean(draft.flightNumber))

  const bothFlightsPicked = Boolean(draft.outboundFlight && draft.returnFlight)

  // Same end-after-start threshold as ItineraryPage's datesInvalid check
  // (endDraft <= startDraft) — kept consistent so "invalid dates" means the
  // same thing everywhere in the app.
  const datesInvalid = Boolean(draft.startDate && draft.endDate && draft.endDate <= draft.startDate)

  const findFlightDisabled = !draft.origin || !draft.destination || !draft.startDate || !draft.endDate || datesInvalid

  const handleFindFlight = () => {
    navigate('/trips/new/flights/outbound')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      toast.show('Trip created')
      navigate(`/trips/${trip.id}`)
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Something went wrong while planning your trip.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="heading-1">Plan Your Trip!</h1>
      <p className="text-body-sm text-ink-muted mt-1 mb-6">Fill in the details below and we'll find the best options for you.</p>

      <Card as="form" onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="space-y-5">
          <p className="eyebrow">Where &amp; When</p>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="origin"
              label="Departure"
              labelIcon={<Plane size={16} className="text-brand-600" />}
              type="text"
              value={draft.origin || ''}
              onChange={(e) => updateDraft({ origin: e.target.value })}
              placeholder="e.g. London, UK"
              required
            />
            <Input
              id="destination"
              label="Destination"
              labelIcon={<MapPin size={16} className="text-brand-600" />}
              type="text"
              value={draft.destination || ''}
              onChange={(e) => updateDraft({ destination: e.target.value })}
              placeholder="e.g. Berlin, Germany"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="date-depart"
              label="Date Depart"
              labelIcon={<Calendar size={16} className="text-brand-600" />}
              type="date"
              value={draft.startDate || ''}
              onChange={(e) => updateDraft({ startDate: e.target.value })}
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

        <div className="border-t pt-5 space-y-3">
          <p className="eyebrow">Flights</p>

          {!bothFlightsPicked && (
            showFlightNumber ? (
              <Input
                id="flight-number"
                label={
                  <>
                    Flight Number <span className="text-gray-400 font-normal">(Optional)</span>
                  </>
                }
                labelIcon={<Plane size={16} className="text-brand-600" />}
                type="text"
                value={draft.flightNumber || ''}
                onChange={(e) => updateDraft({ flightNumber: e.target.value })}
                placeholder="e.g. JL 712"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowFlightNumber(true)}
                className="text-sm text-brand-600 font-medium hover:text-brand-700"
              >
                Already know your flight number?
              </button>
            )
          )}

          <motion.div layout className="space-y-3">
            {bothFlightsPicked ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-brand-600 mb-0.5">Outbound Flight</p>
                  <p className="font-semibold text-ink text-sm">
                    {draft.outboundFlight.airline} · {draft.outboundFlight.flight_number}
                  </p>
                  <p className="text-xs text-gray-500">{draft.outboundFlight.departure_time} &rarr; {draft.outboundFlight.arrival_time}</p>
                </div>
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-brand-600 mb-0.5">Return Flight</p>
                  <p className="font-semibold text-ink text-sm">
                    {draft.returnFlight.airline} · {draft.returnFlight.flight_number}
                  </p>
                  <p className="text-xs text-gray-500">{draft.returnFlight.departure_time} &rarr; {draft.returnFlight.arrival_time}</p>
                </div>
                <Button type="button" variant="secondary" onClick={handleFindFlight} className="w-full">
                  Change Flights
                </Button>
              </motion.div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleFindFlight}
                  disabled={findFlightDisabled}
                  className="w-full border border-brand-600"
                >
                  <Plane size={16} /> Find Flight
                </Button>
                {findFlightDisabled && (
                  <p className="text-body-sm text-ink-muted mt-1.5">
                    {datesInvalid
                      ? 'Return date must be after the departure date.'
                      : 'Fill in origin, destination, and both dates to search flights.'}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>

        <div className="border-t pt-5 space-y-5">
          <p className="eyebrow">Stay &amp; Plans</p>

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

          <Textarea
            id="places-to-visit"
            label="Places to Visit"
            labelIcon={<Camera size={16} className="text-brand-600" />}
            value={draft.placesToVisit || ''}
            onChange={(e) => updateDraft({ placesToVisit: e.target.value })}
            placeholder="e.g. Eiffel Tower, Louvre Museum..."
            rows={3}
          />
        </div>

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <Button type="submit" disabled={submitting || datesInvalid} className="w-full">
          <Search size={16} /> {submitting ? 'Planning...' : 'Plan My Trip'}
        </Button>
      </Card>
    </div>
  )
}
