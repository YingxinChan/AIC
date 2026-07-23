import { vi } from 'vitest'
import { getActivityPhoto } from './wikipedia'

beforeEach(() => {
  global.fetch = vi.fn()
})

function summaryResponse({ thumbnail, coordinates } = {}) {
  return {
    ok: true,
    json: async () => ({
      ...(thumbnail ? { thumbnail: { source: thumbnail } } : {}),
      ...(coordinates ? { coordinates } : {}),
    }),
  }
}

test('returns the thumbnail directly on an exact-title match with coordinates, without searching', async () => {
  global.fetch.mockResolvedValueOnce(
    summaryResponse({ thumbnail: 'https://example.com/gallery.jpg', coordinates: { lat: 51.5, lon: -0.1 } })
  )

  const result = await getActivityPhoto('National Gallery')

  expect(result).toBe('https://example.com/gallery.jpg')
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

test('falls back to search when the exact title has no page, and accepts a search result that has coordinates', async () => {
  global.fetch
    .mockResolvedValueOnce({ ok: false }) // exact match: no page
    .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { search: [{ title: 'Big Ben' }] } }) }) // search
    .mockResolvedValueOnce(
      summaryResponse({ thumbnail: 'https://example.com/bigben.jpg', coordinates: { lat: 51.5, lon: -0.12 } })
    ) // summary of the searched title

  const result = await getActivityPhoto('Big Ben and Houses of Parliament')

  expect(result).toBe('https://example.com/bigben.jpg')
  expect(global.fetch).toHaveBeenCalledTimes(3)
})

test('rejects a search result with no coordinates instead of showing an unrelated photo', async () => {
  global.fetch
    .mockResolvedValueOnce({ ok: false }) // exact match: no page
    .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { search: [{ title: 'The Beginning After the End' }] } }) })
    .mockResolvedValueOnce(summaryResponse({ thumbnail: 'https://example.com/novel-cover.jpg' })) // no coordinates -> not a real place

  const result = await getActivityPhoto('Final Tapas & Shopping')

  expect(result).toBeNull()
})

test('returns null when the search itself finds nothing', async () => {
  global.fetch
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { search: [] } }) })

  expect(await getActivityPhoto('Gothic Quarter (Barri Gòtic) Walking Tour')).toBeNull()
})

test('falls back to search when the exact match has coordinates but no thumbnail', async () => {
  global.fetch
    .mockResolvedValueOnce(summaryResponse({ coordinates: { lat: 1, lon: 2 } })) // exact match, no photo
    .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { search: [{ title: 'Better Match' }] } }) })
    .mockResolvedValueOnce(summaryResponse({ thumbnail: 'https://example.com/better.jpg', coordinates: { lat: 1, lon: 2 } }))

  const result = await getActivityPhoto('Some Activity')

  expect(result).toBe('https://example.com/better.jpg')
})

test('returns null for an empty name without calling fetch', async () => {
  expect(await getActivityPhoto('')).toBeNull()
  expect(global.fetch).not.toHaveBeenCalled()
})

test('returns null when fetch rejects at any step, instead of crashing', async () => {
  global.fetch.mockRejectedValue(new Error('network down'))
  expect(await getActivityPhoto('Big Ben')).toBeNull()
})
