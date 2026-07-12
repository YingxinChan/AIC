export async function geocodeCity(query) {
  if (!query) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return null
    const results = await response.json()
    if (!results.length) return null
    return [parseFloat(results[0].lat), parseFloat(results[0].lon)]
  } catch {
    return null
  }
}
