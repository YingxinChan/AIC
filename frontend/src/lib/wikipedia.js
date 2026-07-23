const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary'
const SEARCH_URL = 'https://en.wikipedia.org/w/api.php'

async function fetchSummary(title) {
  const response = await fetch(`${SUMMARY_URL}/${encodeURIComponent(title)}`)
  if (!response.ok) return null
  return response.json()
}

async function searchTitle(query) {
  const url = `${SEARCH_URL}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&origin=*`
  const response = await fetch(url)
  if (!response.ok) return null
  const data = await response.json()
  return data.query?.search?.[0]?.title || null
}

export async function getActivityPhoto(name) {
  if (!name) return null
  try {
    let summary = await fetchSummary(name)

    // Claude's activity names are often descriptive/compound ("Big Ben and
    // Houses of Parliament", "... Walking Tour") rather than exact Wikipedia
    // article titles, so an exact-title miss (or a hit with no photo) falls
    // back to a relevance search instead of giving up.
    if (!summary?.thumbnail || !summary?.coordinates) {
      const searchedTitle = await searchTitle(name)
      if (searchedTitle) {
        const searched = await fetchSummary(searchedTitle)
        // Only trust a search-based match if it's a real geographic place —
        // rejects false positives (e.g. "Final Tapas & Shopping" matching an
        // unrelated novel with no coordinates) rather than showing a
        // confidently wrong photo.
        if (searched?.coordinates) {
          summary = searched
        }
      }
    }

    return summary?.coordinates ? (summary.thumbnail?.source || null) : null
  } catch {
    return null
  }
}
