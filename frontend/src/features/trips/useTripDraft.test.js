import { renderHook, act } from '@testing-library/react'
import { useTripDraft } from './useTripDraft'

beforeEach(() => {
  sessionStorage.clear()
})

test('starts with default draft values', () => {
  const { result } = renderHook(() => useTripDraft())
  expect(result.current.draft).toEqual({
    destination: 'London',
    origin: '',
    startDate: '',
    endDate: '',
    flightNumber: '',
    hotelAddress: '',
    placesToVisit: '',
    outboundFlight: null,
    returnFlight: null,
  })
})

test('updateDraft merges partial updates', () => {
  const { result } = renderHook(() => useTripDraft())

  act(() => {
    result.current.updateDraft({ destination: 'Paris', startDate: '2026-08-01' })
  })

  expect(result.current.draft.destination).toBe('Paris')
  expect(result.current.draft.startDate).toBe('2026-08-01')
  expect(result.current.draft.endDate).toBe('')
})

test('updateDraft writes to sessionStorage synchronously, not deferred inside a state updater', () => {
  // sessionStorage.setItem must happen as a plain statement in updateDraft, not
  // inside the setDraft functional updater — a caller that navigates away right
  // after updateDraft() (select flight -> navigate to next page) can unmount
  // before a deferred updater runs, silently dropping the write.
  const { result } = renderHook(() => useTripDraft())

  act(() => {
    result.current.updateDraft({ destination: 'Tokyo' })
    expect(JSON.parse(sessionStorage.getItem('tripDraft')).destination).toBe('Tokyo')
  })
})

test('draft persists across separate hook instances via sessionStorage', () => {
  const { result: first } = renderHook(() => useTripDraft())
  act(() => {
    first.current.updateDraft({ destination: 'Tokyo' })
  })

  const { result: second } = renderHook(() => useTripDraft())
  expect(second.current.draft.destination).toBe('Tokyo')
})

test('clearDraft resets to defaults and clears storage', () => {
  const { result } = renderHook(() => useTripDraft())
  act(() => {
    result.current.updateDraft({ destination: 'Tokyo' })
  })
  act(() => {
    result.current.clearDraft()
  })

  expect(result.current.draft.destination).toBe('London')
  expect(sessionStorage.getItem('tripDraft')).toBeNull()
})
