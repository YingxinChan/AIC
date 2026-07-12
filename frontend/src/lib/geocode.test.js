import { vi } from 'vitest'
import { geocodeCity } from './geocode'

beforeEach(() => {
  global.fetch = vi.fn()
})

test('returns [lat, lon] parsed from Nominatim\'s response', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => [{ lat: '35.6762', lon: '139.6503' }],
  })

  const result = await geocodeCity('Tokyo, Japan')

  expect(result).toEqual([35.6762, 139.6503])
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nominatim.openstreetmap.org'))
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Tokyo, Japan')))
})

test('returns null when there is no match', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => [] })
  expect(await geocodeCity('Nowhereville')).toBeNull()
})

test('returns null on a non-ok response instead of throwing', async () => {
  global.fetch.mockResolvedValue({ ok: false })
  expect(await geocodeCity('Paris')).toBeNull()
})

test('returns null when fetch itself rejects, instead of crashing the map', async () => {
  global.fetch.mockRejectedValue(new Error('network down'))
  expect(await geocodeCity('Paris')).toBeNull()
})

test('returns null for an empty query without calling fetch', async () => {
  expect(await geocodeCity('')).toBeNull()
  expect(global.fetch).not.toHaveBeenCalled()
})
