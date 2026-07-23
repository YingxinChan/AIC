import parisImg from '../../assets/paris.jpg'

// The 25 MVP cities (see backend/services/mock_flights.csv and CLAUDE.md).
// Add an entry here as a photo gets sourced for that city; anything missing
// falls back to the gradient placeholder in the trip card.
export const DESTINATION_CITIES = [
  'Amsterdam', 'Athens', 'Barcelona', 'Berlin', 'Bruges', 'Brussels', 'Budapest',
  'Copenhagen', 'Dublin', 'Edinburgh', 'Florence', 'Istanbul', 'Krakow', 'Lisbon',
  'London', 'Madrid', 'Milan', 'Munich', 'Oslo', 'Paris', 'Prague', 'Rome',
  'Venice', 'Vienna', 'Zurich',
]

const cityImages = {
  Paris: parisImg,
  // Edinburgh: edinburghImg,
}

export function getDestinationImage(destination) {
  if (!destination) return null
  const city = DESTINATION_CITIES.find((name) => destination.toLowerCase().includes(name.toLowerCase()))
  return city ? cityImages[city] ?? null : null
}
