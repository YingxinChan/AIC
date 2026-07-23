export async function getPlaceDetails(name, cityContext) {
  if (!name) return null
  try {
    const query = cityContext ? `${name}, ${cityContext}` : name
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&extratags=1&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return null
    const results = await response.json()
    if (!results.length) return null
    const tags = results[0].extratags || {}
    return {
      website: tags.website || tags['contact:website'] || null,
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
    }
  } catch {
    return null
  }
}
