import { useState } from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import HotelSearchInput from './HotelSearchInput'
import { searchPlaces } from '../lib/nominatim'

vi.mock('../lib/nominatim', () => ({
  searchPlaces: vi.fn(),
}))

function ControlledHotelInput({ cityContext = 'Paris' }) {
  const [value, setValue] = useState('')
  return (
    <HotelSearchInput
      id="hotel"
      value={value}
      onChange={setValue}
      cityContext={cityContext}
      placeholder="e.g. The Ritz Paris"
    />
  )
}

function getInput() {
  return screen.getByPlaceholderText(/ritz paris/i)
}

beforeEach(() => {
  searchPlaces.mockReset()
  searchPlaces.mockResolvedValue([])
})

afterEach(() => {
  // Guard against a test failing mid-fake-timers and leaking that state into
  // later tests/files (fake setTimeout breaks findBy*/waitFor's polling).
  vi.useRealTimers()
})

test('typing fewer than 3 characters never calls searchPlaces', () => {
  vi.useFakeTimers()
  render(<ControlledHotelInput />)

  fireEvent.change(getInput(), { target: { value: 'Ri' } })
  act(() => { vi.advanceTimersByTime(1000) })

  expect(searchPlaces).not.toHaveBeenCalled()
})

test('typing 3+ characters calls searchPlaces with "<value>, <cityContext>" after the debounce delay', async () => {
  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Ritz' } })
  expect(searchPlaces).not.toHaveBeenCalled()

  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  await waitFor(() => expect(searchPlaces).toHaveBeenCalledWith('Ritz, Paris'))
})

test('does not search when cityContext is empty, and shows the "enter a destination" hint', () => {
  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="" />)

  fireEvent.change(getInput(), { target: { value: 'Ritz' } })
  act(() => { vi.advanceTimersByTime(1000) })

  expect(searchPlaces).not.toHaveBeenCalled()
  expect(screen.getByText(/enter a destination above/i)).toBeInTheDocument()
})

test('every keystroke calls onChange with the raw typed value immediately, independent of the debounced search', () => {
  const handleChange = vi.fn()
  render(
    <HotelSearchInput
      id="hotel"
      value=""
      onChange={handleChange}
      cityContext="Paris"
      placeholder="e.g. The Ritz Paris"
    />
  )

  fireEvent.change(getInput(), { target: { value: 'R' } })

  expect(handleChange).toHaveBeenCalledWith('R')
})

test('clicking a result calls onChange with that result\'s full label and closes the dropdown', async () => {
  const fullLabel = 'The Ritz London, 150 Piccadilly, St. James\'s, London'
  searchPlaces.mockResolvedValue([{ label: fullLabel, isLodging: true }])

  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="London" />)

  fireEvent.change(getInput(), { target: { value: 'Ritz' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  const option = await screen.findByText(fullLabel)
  fireEvent.click(option)

  expect(getInput()).toHaveValue(fullLabel)
  expect(screen.queryByText(fullLabel)).not.toBeInTheDocument()
})

test('zero results after a search shows the "No matches" hint, not an empty dropdown', async () => {
  searchPlaces.mockResolvedValue([])

  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Zzznomatch' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
})

test('a rejected searchPlaces call does not crash the component and just shows no results', async () => {
  searchPlaces.mockRejectedValue(new Error('network error'))

  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Ritz' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
})

test('a stale out-of-order response never overwrites fresher results', async () => {
  // Two in-flight requests: the one fired for "Rit" resolves AFTER the one
  // fired for "Ritz", even though "Rit" was typed first — reproduces the
  // reported race exactly (Nominatim's latency isn't guaranteed in order).
  let resolveStale, resolveFresh
  searchPlaces
    .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFresh = resolve }))

  vi.useFakeTimers()
  render(<ControlledHotelInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Rit' } })
  act(() => { vi.advanceTimersByTime(400) }) // fires the "Rit, Paris" search

  fireEvent.change(getInput(), { target: { value: 'Ritz' } })
  act(() => { vi.advanceTimersByTime(400) }) // fires the "Ritz, Paris" search
  vi.useRealTimers()

  expect(searchPlaces).toHaveBeenCalledTimes(2)

  // Resolve the fresh (second) request first, then the stale (first) one —
  // out of order, exactly as reproduced in the review.
  resolveFresh([{ label: 'The Ritz London', isLodging: true }])
  await screen.findByText('The Ritz London')

  resolveStale([{ label: 'Stale Rit Result', isLodging: true }])
  await act(async () => { await Promise.resolve() }) // let the stale .then() settle, if it were going to

  expect(screen.getByText('The Ritz London')).toBeInTheDocument()
  expect(screen.queryByText('Stale Rit Result')).not.toBeInTheDocument()
})

test('selecting a result does not trigger a redundant follow-up search for that same value', async () => {
  // Fake timers stay active for the whole test (never switched to real
  // mid-test) — mixing them can leave a real setTimeout still pending when
  // the final assertion runs, silently passing regardless of the actual fix.
  const fullLabel = 'The Ritz London, 150 Piccadilly, London'
  searchPlaces.mockResolvedValueOnce([{ label: fullLabel, isLodging: true }])

  vi.useFakeTimers()
  try {
    render(<ControlledHotelInput cityContext="London" />)

    fireEvent.change(getInput(), { target: { value: 'Ritz' } })
    act(() => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() }) // flush the resolved searchPlaces promise

    const option = screen.getByText(fullLabel)
    fireEvent.click(option)

    expect(getInput()).toHaveValue(fullLabel)
    expect(searchPlaces).toHaveBeenCalledTimes(1)

    // Selecting the result set `value` to that same full label — without the
    // fix, this alone re-triggers the debounced search effect.
    act(() => { vi.advanceTimersByTime(1000) })
    await act(async () => { await Promise.resolve() })

    expect(searchPlaces).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})
