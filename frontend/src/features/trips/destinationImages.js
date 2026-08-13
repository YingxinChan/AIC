// Shared destination photo backgrounds — used by ItineraryPage's hero header,
// MyTripsPage's card thumbnails, and DashboardPage's Recent Trips cards.
// All 25 supported cities (see CLAUDE.md) now have one. All local assets
// (public/images/destinations/) — AI-generated, provided by the project
// owner, as wide aerial/panorama establishing shots (landmark prominent but
// with margin around it, not a tight close-up) at various wide aspect ratios
// (~1.8:1 up to ~5.6:1) — all wider than a standard photo and close to or
// wider than a typical banner/card shape, so 'center' needs little to no
// vertical crop for any of them. An optional `fit: 'contain'` is supported by
// consumers (see ItineraryPage's Hero Header) for a photo whose subject can't
// survive any crop at all (e.g. a tight close-up of one tall structure) —
// not needed by any of these.
export const DESTINATION_IMAGES = {
  Amsterdam: { url: '/images/destinations/amsterdam.jpg', position: 'center' },
  Athens: { url: '/images/destinations/athens.jpg', position: 'center' },
  Barcelona: { url: '/images/destinations/barcelona.jpg', position: 'center' },
  Berlin: { url: '/images/destinations/berlin.jpg', position: 'center' },
  Bruges: { url: '/images/destinations/bruges.jpg', position: 'center' },
  Brussels: { url: '/images/destinations/brussels.jpg', position: 'center' },
  Budapest: { url: '/images/destinations/budapest.jpg', position: 'center' },
  Copenhagen: { url: '/images/destinations/copenhagen.jpg', position: 'center' },
  Dublin: { url: '/images/destinations/dublin.jpg', position: 'center' },
  Edinburgh: { url: '/images/destinations/edinburgh.jpg', position: 'center' },
  Florence: { url: '/images/destinations/florence.jpg', position: 'center' },
  Istanbul: { url: '/images/destinations/istanbul.jpg', position: 'center' },
  Krakow: { url: '/images/destinations/krakow.jpg', position: 'center' },
  Lisbon: { url: '/images/destinations/lisbon.jpg', position: 'center' },
  London: { url: '/images/destinations/london.jpg', position: 'center' },
  Madrid: { url: '/images/destinations/madrid.jpg', position: 'center' },
  Milan: { url: '/images/destinations/milan.jpg', position: 'center' },
  Munich: { url: '/images/destinations/munich.jpg', position: 'center' },
  Oslo: { url: '/images/destinations/oslo.jpg', position: 'center' },
  Paris: { url: '/images/destinations/paris.jpg', position: 'center' },
  Prague: { url: '/images/destinations/prague.jpg', position: 'center' },
  Rome: { url: '/images/destinations/rome.jpg', position: 'center' },
  Venice: { url: '/images/destinations/venice.jpg', position: 'center' },
  Vienna: { url: '/images/destinations/vienna.jpg', position: 'center' },
  Zurich: { url: '/images/destinations/zurich.jpg', position: 'center' },
}

// trip.destination can be free-typed text (older trips, before
// CitySearchInput existed) or "City, Country" (from CitySearchInput's
// 25-city list) — a straight DESTINATION_IMAGES[destination] lookup would
// miss "Oslo, Norway" even though "Oslo" has an image, and also misses any
// trip saved with different casing than the object keys above. Matching on
// just the part before the first comma, case-insensitively, covers both.
export const findDestinationImage = (destination) => {
  if (!destination) return null
  const normalized = destination.split(',')[0].trim().toLowerCase()
  const key = Object.keys(DESTINATION_IMAGES).find(k => k.toLowerCase() === normalized)
  return key ? DESTINATION_IMAGES[key] : null
}
