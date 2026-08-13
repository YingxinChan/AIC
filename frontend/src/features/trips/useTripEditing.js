import { useState } from 'react'
import { updateTrip } from './tripsApi'
import { generateItinerary } from './itineraryApi'
import { clearPendingReview } from '../../lib/pendingReview'

// Everything for editing the trip's own details (hotel, dates) and
// regenerating the itinerary from them — kept as one hook because they're
// all part of the same flow: editing dates/hotel opens the "update anything
// else first?" review prompt (reviewModalOpen/lastEdited), which leads back
// into the same handleGenerate a direct Regenerate click does (gated by its
// own regenerateConfirmOpen warning first). `trip`/`itinerary`/`generating`
// stay owned by ItineraryPage itself (read directly in many places outside
// this hook's scope) and are passed in rather than owned here.
export function useTripEditing({ tripId, trip, setTrip, itinerary, setItinerary, generating, setGenerating, toast, setItineraryNotice, navigate, tripIdRef }) {
  const [hotelModalOpen, setHotelModalOpen] = useState(false)
  const [hotelDraft, setHotelDraft] = useState('')
  // {lat, lon} from an explicit dropdown pick, or null — set alongside
  // hotelDraft by handleHotelChange below, and dropped back to null the
  // moment the user types (HotelSearchInput's onChange omits the second
  // argument for freehand keystrokes), so a stale selection's coordinates
  // never get saved against a since-edited address string.
  const [hotelDraftCoords, setHotelDraftCoords] = useState(null)
  const [datesModalOpen, setDatesModalOpen] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [savingTrip, setSavingTrip] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  // Confirms before a regenerate overwrites the current day-by-day plan —
  // only shown when there's an existing itinerary to lose (see
  // handleRegenerateClick); a first-time generate has nothing to overwrite.
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  // Which of dates/hotel/outbound/return was just saved — the review prompt
  // excludes this one and only offers the others, so it never re-suggests
  // editing the thing the user just finished editing.
  const [lastEdited, setLastEdited] = useState(null)

  const handleGenerate = async () => {
    // Navigating to a different trip while this request is still in flight
    // doesn't unmount/remount ItineraryPage (see tripIdRef, owned by the
    // caller), so by the time this resolves the page could already be
    // showing a different trip. Capture which trip this request was
    // actually for, and skip applying its result if that trip is no longer
    // the one on screen.
    const requestedTripId = tripId
    setGenerating(true)
    setItineraryNotice('')
    try {
      const data = await generateItinerary(requestedTripId)
      // Only apply the result if this is still the trip on screen — but
      // still clear `generating` below regardless, so a stale response
      // doesn't leave the spinner stuck on whatever trip is now showing.
      if (tripIdRef.current === requestedTripId) {
        if (data.days) {
          setItinerary(data)
          const swappedCount = data.days.flatMap(d => d.activities).filter(a => a.is_swapped).length
          // The 'swap' toast variant is the one moment besides the REBOOKED
          // stamp itself that earns the reserved amber treatment — this is
          // the product's actual premise happening, not a routine save, so
          // it shouldn't look like "Flight saved" in a slightly different
          // font.
          toast.show(
            swappedCount > 0
              ? `Itinerary regenerated — ${swappedCount} ${swappedCount === 1 ? 'activity' : 'activities'} adjusted for weather`
              : 'Itinerary regenerated',
            swappedCount > 0 ? 'swap' : 'success'
          )
        } else {
          setItineraryNotice(data.message || 'Could not generate the itinerary.')
        }
      }
    } catch (err) {
      if (tripIdRef.current === requestedTripId) {
        setItineraryNotice(err.response?.data?.detail || 'Something went wrong while generating the itinerary.')
      }
    }
    setGenerating(false)
  }

  // The sidebar's Regenerate button used to call handleGenerate directly,
  // silently overwriting the whole day-by-day plan (including anything
  // manually added or edited) with no warning. Only gate on a confirmation
  // when there's an existing itinerary to actually lose — a first-time
  // Generate has nothing to overwrite. (The review-prompt's own "No,
  // regenerate now" button, in handleReviewRegenerateNow below, already
  // serves as its own explicit confirmation step, so it stays wired
  // directly to handleGenerate rather than stacking a second confirm on
  // top of it.)
  const handleRegenerateClick = () => {
    if (itinerary) {
      setRegenerateConfirmOpen(true)
    } else {
      handleGenerate()
    }
  }

  const handleConfirmRegenerate = () => {
    setRegenerateConfirmOpen(false)
    handleGenerate()
  }

  // Dates and hotel are baked into itinerary generation (day-1/last-day
  // scheduling, routing anchor), so editing either no longer regenerates
  // immediately — PATCH /api/trips/{id} just saves the field and returns
  // the plain trip. Instead, saving here opens the review prompt so the
  // user can batch in the other one before we regenerate once, via
  // handleReviewRegenerateNow below. Each flight leg (see FlightSelectPage)
  // is edited independently and marks pendingReview itself once saved,
  // reopening this same prompt on return.
  const openHotelModal = () => {
    setHotelDraft(trip.hotel_address || '')
    // Seed with the trip's existing coordinates (if any) so re-opening the
    // modal and saving without touching the input doesn't wipe out a
    // previously-good selection — the first real keystroke (handleChange,
    // via handleHotelChange below) still drops these back to null.
    setHotelDraftCoords(
      trip.hotel_lat != null && trip.hotel_lng != null
        ? { lat: trip.hotel_lat, lon: trip.hotel_lng }
        : null
    )
    setHotelModalOpen(true)
  }

  // HotelSearchInput's onChange(value, coords?) — coords is only present on
  // an explicit dropdown pick; every other call (freehand typing) omits it,
  // which correctly clears any stale coordinates from a prior selection.
  const handleHotelChange = (value, coords) => {
    setHotelDraft(value)
    setHotelDraftCoords(coords || null)
  }

  const openDatesModal = () => {
    setStartDraft(trip.start_date || '')
    setEndDraft(trip.end_date || '')
    setDatesModalOpen(true)
  }

  const datesInvalid = !startDraft || !endDraft || endDraft <= startDraft

  const saveTripDetails = async (patch, { closeModal, source }) => {
    setSavingTrip(true)
    try {
      const updatedTrip = await updateTrip(tripId, patch)
      setTrip(updatedTrip)
      closeModal()
      setLastEdited(source)
      setReviewModalOpen(true)
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Saving your trip details failed — try again.')
    }
    setSavingTrip(false)
  }

  const handleSaveHotel = () => saveTripDetails(
    {
      hotel_address: hotelDraft,
      hotel_lat: hotelDraftCoords?.lat ?? null,
      hotel_lng: hotelDraftCoords?.lon ?? null,
    },
    { closeModal: () => setHotelModalOpen(false), source: 'hotel' }
  )

  const handleSaveDates = () => {
    if (datesInvalid) return
    return saveTripDetails(
      { start_date: startDraft, end_date: endDraft },
      { closeModal: () => setDatesModalOpen(false), source: 'dates' }
    )
  }

  const handleReviewEditHotel = () => {
    setReviewModalOpen(false)
    openHotelModal()
  }

  const handleReviewEditDates = () => {
    setReviewModalOpen(false)
    openDatesModal()
  }

  const handleReviewEditOutbound = () => {
    setReviewModalOpen(false)
    navigate(`/trips/${tripId}/flights/outbound`)
  }

  const handleReviewEditReturn = () => {
    setReviewModalOpen(false)
    navigate(`/trips/${tripId}/flights/return`)
  }

  const handleReviewRegenerateNow = async () => {
    await handleGenerate()
    clearPendingReview(tripId)
    setReviewModalOpen(false)
  }

  return {
    hotelModalOpen, setHotelModalOpen,
    hotelDraft, hotelDraftCoords,
    datesModalOpen, setDatesModalOpen,
    startDraft, setStartDraft,
    endDraft, setEndDraft,
    savingTrip,
    reviewModalOpen, setReviewModalOpen,
    regenerateConfirmOpen, setRegenerateConfirmOpen,
    lastEdited, setLastEdited,
    datesInvalid,
    handleGenerate,
    handleRegenerateClick,
    handleConfirmRegenerate,
    openHotelModal,
    handleHotelChange,
    openDatesModal,
    handleSaveHotel,
    handleSaveDates,
    handleReviewEditHotel,
    handleReviewEditDates,
    handleReviewEditOutbound,
    handleReviewEditReturn,
    handleReviewRegenerateNow,
  }
}
