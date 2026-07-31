export async function searchPlaces(query, viewbox) {
  if (!query) return []
  try {
    const params = new URLSearchParams({ format: 'json', limit: '5', q: query })
    // viewbox is a soft geographic preference (bounded=0), not a hard filter
    // — a genuinely better match outside the box (e.g. a day-trip
    // destination outside the trip's home city) can still win, unlike
    // baking the city name into the query text, which silently excludes
    // anything not describable as "in <city>".
    if (viewbox) {
      params.set('viewbox', viewbox.join(','))
      params.set('bounded', '0')
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
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
