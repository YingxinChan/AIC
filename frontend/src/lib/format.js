// Only uppercase the first letter of each comma-separated part, leave the rest as-is
// (preserves "UK", "USA", etc.)
export const capitalize = (str) => {
  if (!str) return ''
  return str.split(',').map(part => {
    const trimmed = part.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }).join(', ')
}
