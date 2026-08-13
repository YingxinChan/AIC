// Only uppercase the first letter of each comma-separated part, leave the rest as-is
// (preserves "UK", "USA", etc.)
export const capitalize = (str) => {
  if (!str) return ''
  return str.split(',').map(part => {
    const trimmed = part.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }).join(', ')
}

// A decorative airport-style code for the boarding-pass stub — not a real
// IATA lookup, just the destination's first three letters, styled the same
// way a real boarding pass would show one.
export const cityCode = (destination) => {
  const city = (destination || '').split(',')[0].trim()
  return city.slice(0, 3).toUpperCase()
}
