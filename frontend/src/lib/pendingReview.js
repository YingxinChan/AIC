// Tracks, per trip, whether the user has an edit (dates/hotel/flight) that's
// saved but not yet folded into a itinerary regeneration. Backed by
// sessionStorage rather than React state alone because saving a flight leg
// navigates away to FlightSelectPage and back, which remounts ItineraryPage.
const key = (tripId) => `pendingReview:${tripId}`

export function markPendingReview(tripId) {
  sessionStorage.setItem(key(tripId), '1')
}

export function hasPendingReview(tripId) {
  return sessionStorage.getItem(key(tripId)) === '1'
}

export function clearPendingReview(tripId) {
  sessionStorage.removeItem(key(tripId))
}
