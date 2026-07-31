export async function searchPlaces(query) {
  if (!query) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return []
    const results = await response.json()
    return results.map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      isLodging: r.type === 'hotel' || r.type === 'hostel' || r.type === 'guest_house' || r.type === 'motel',
    }))
  } catch {
    return []
  }
}
