// Only uppercase the first letter of each comma-separated part, leave the rest as-is
// (preserves "UK", "USA", etc.)
export const capitalize = (str) => {
  if (!str) return ''
  return str.split(',').map(part => {
    const trimmed = part.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }).join(', ')
}

// Real IATA codes for the MVP's 25 supported cities (see
// backend/services/mock_flights.csv) — airport code for single-airport
// cities, the standard multi-airport metro code for the rest (PAR/LON/ROM/
// MIL, same codes airlines and GDS systems use), so this isn't just a
// decorative label, it's the actual code. Bruges has no airport or real
// IATA code of its own; BGS is a made-up placeholder chosen only to avoid
// colliding with Brussels' real BRU.
const CITY_CODES = {
  amsterdam: 'AMS',
  athens: 'ATH',
  barcelona: 'BCN',
  berlin: 'BER',
  bruges: 'BGS',
  brussels: 'BRU',
  budapest: 'BUD',
  copenhagen: 'CPH',
  dublin: 'DUB',
  edinburgh: 'EDI',
  florence: 'FLR',
  istanbul: 'IST',
  krakow: 'KRK',
  lisbon: 'LIS',
  london: 'LON',
  madrid: 'MAD',
  milan: 'MIL',
  munich: 'MUC',
  oslo: 'OSL',
  paris: 'PAR',
  prague: 'PRG',
  rome: 'ROM',
  venice: 'VCE',
  vienna: 'VIE',
  zurich: 'ZRH',
}

// Just the city, dropping ", Country" — for headings/titles where the city
// name alone reads better ("Paris Trip", not "Paris, France Trip"). Full
// "City, Country" (via capitalize) is reserved for the one spot that's
// meant to spell it out (the boarding-pass stub's small caption).
export const cityOnly = (destination) => {
  if (!destination) return ''
  return capitalize(destination.split(',')[0].trim())
}

// A boarding-pass-stub airport code. Looks up the real IATA code for the 25
// supported cities above; falls back to the destination's first three
// letters for anything else (a free-text destination outside the MVP list),
// so this never blanks out, it just stops being a real code in that case.
export const cityCode = (destination) => {
  const city = (destination || '').split(',')[0].trim()
  const known = CITY_CODES[city.toLowerCase()]
  if (known) return known
  return city.slice(0, 3).toUpperCase()
}
