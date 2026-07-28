// Tracks, per trip, which field (dates/hotel/outbound/return) was just saved
// but not yet folded into an itinerary regeneration. Backed by sessionStorage
// rather than React state alone because saving a flight leg navigates away to
// FlightSelectPage and back, which remounts ItineraryPage. The stored source
// lets the review prompt exclude whatever was just edited and only offer the
// others.
const key = (tripId) => `pendingReview:${tripId}`

export function markPendingReview(tripId, source) {
  sessionStorage.setItem(key(tripId), source)
}

export function getPendingReview(tripId) {
  return sessionStorage.getItem(key(tripId))
}

export function clearPendingReview(tripId) {
  sessionStorage.removeItem(key(tripId))
}
