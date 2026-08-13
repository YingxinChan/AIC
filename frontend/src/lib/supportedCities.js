// The MVP's 25 supported cities, "City, Country" — matches
// backend/services/mock_flights.csv's departure_city/destination_city
// values exactly, since that's what mock flight search actually looks up
// against. Keep in sync if that CSV's city list ever changes.
export const SUPPORTED_CITIES = [
  'Amsterdam, Netherlands',
  'Athens, Greece',
  'Barcelona, Spain',
  'Berlin, Germany',
  'Bruges, Belgium',
  'Brussels, Belgium',
  'Budapest, Hungary',
  'Copenhagen, Denmark',
  'Dublin, Ireland',
  'Edinburgh, UK',
  'Florence, Italy',
  'Istanbul, Turkey',
  'Krakow, Poland',
  'Lisbon, Portugal',
  'London, UK',
  'Madrid, Spain',
  'Milan, Italy',
  'Munich, Germany',
  'Oslo, Norway',
  'Paris, France',
  'Prague, Czech Republic',
  'Rome, Italy',
  'Venice, Italy',
  'Vienna, Austria',
  'Zurich, Switzerland',
]

export function searchSupportedCities(query) {
  const q = query.trim().toLowerCase()
  if (!q) return SUPPORTED_CITIES
  return SUPPORTED_CITIES.filter((city) => city.toLowerCase().includes(q))
}
