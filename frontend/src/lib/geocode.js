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

export async function geocodeAddress(address) {
  if (!address) return null
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    )
    if (!response.ok) return null
    const data = await response.json()
    if (!data.length) return null
    return [
      parseFloat(data[0].lat),
      parseFloat(data[0].lon),
    ]
  } catch (error) {
    return null
  }
}