import { useState } from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ActivityLocationInput from './ActivityLocationInput'
import { searchPlaces } from '../lib/nominatim'

vi.mock('../lib/nominatim', () => ({
  searchPlaces: vi.fn(),
}))

function ControlledActivityLocationInput({ cityContext = 'Paris' }) {
  const [value, setValue] = useState('')
  return (
    <ActivityLocationInput
      id="activity-location"
      value={value}
      onChange={({ label }) => setValue(label)}
      cityContext={cityContext}
      placeholder="Search for a place"
    />
  )
}

function getInput() {
  return screen.getByPlaceholderText(/search for a place/i)
}

beforeEach(() => {
  searchPlaces.mockReset()
  searchPlaces.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

test('typing does NOT call onChange — only an explicit selection does', () => {
  const handleChange = vi.fn()
  render(
    <ActivityLocationInput
      id="activity-location"
      value=""
      onChange={handleChange}
      cityContext="Paris"
      placeholder="Search for a place"
    />
  )

  fireEvent.change(getInput(), { target: { value: 'Eiffel' } })

  // The whole point of this component vs. HotelSearchInput: keystrokes
  // must never reach the parent, since a keystroke has no coordinate yet.
  expect(handleChange).not.toHaveBeenCalled()
  expect(getInput()).toHaveValue('Eiffel')
})

test('selecting a result calls onChange once with {label, lat, lon} together', async () => {
  searchPlaces.mockResolvedValue([
    { label: 'Eiffel Tower, Paris', lat: 48.8584, lon: 2.2945, isLodging: false },
  ])
  const handleChange = vi.fn()

  vi.useFakeTimers()
  render(
    <ActivityLocationInput
      id="activity-location"
      value=""
      onChange={handleChange}
      cityContext="Paris"
      placeholder="Search for a place"
    />
  )

  fireEvent.change(getInput(), { target: { value: 'Eiffel' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  const option = await screen.findByText('Eiffel Tower, Paris')
  fireEvent.click(option)

  expect(handleChange).toHaveBeenCalledTimes(1)
  expect(handleChange).toHaveBeenCalledWith({ label: 'Eiffel Tower, Paris', lat: 48.8584, lon: 2.2945 })
  expect(getInput()).toHaveValue('Eiffel Tower, Paris')
})

test('typing 3+ characters still calls searchPlaces after the debounce delay', async () => {
  vi.useFakeTimers()
  render(<ControlledActivityLocationInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Eif' } })
  expect(searchPlaces).not.toHaveBeenCalled()

  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  await waitFor(() => expect(searchPlaces).toHaveBeenCalledWith('Eif, Paris'))
})

test('does not search when cityContext is empty, and shows the "enter a destination" hint', () => {
  vi.useFakeTimers()
  render(<ControlledActivityLocationInput cityContext="" />)

  fireEvent.change(getInput(), { target: { value: 'Eiffel' } })
  act(() => { vi.advanceTimersByTime(1000) })

  expect(searchPlaces).not.toHaveBeenCalled()
  expect(screen.getByText(/enter a destination above/i)).toBeInTheDocument()
})

test('zero results after a search shows the "No matches" hint, not an empty dropdown', async () => {
  searchPlaces.mockResolvedValue([])

  vi.useFakeTimers()
  render(<ControlledActivityLocationInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Zzznomatch' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
})

test('a rejected searchPlaces call does not crash the component and just shows no results', async () => {
  searchPlaces.mockRejectedValue(new Error('network error'))

  vi.useFakeTimers()
  render(<ControlledActivityLocationInput cityContext="Paris" />)

  fireEvent.change(getInput(), { target: { value: 'Eiffel' } })
  act(() => { vi.advanceTimersByTime(400) })
  vi.useRealTimers()

  expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
})

test('parent value prop change (e.g. opening the modal for a different activity) resets the visible draft', () => {
  const { rerender } = render(
    <ActivityLocationInput
      id="activity-location"
      value="British Museum, London"
      onChange={() => {}}
      cityContext="London"
      placeholder="Search for a place"
    />
  )
  expect(getInput()).toHaveValue('British Museum, London')

  rerender(
    <ActivityLocationInput
      id="activity-location"
      value="Tower Bridge, London"
      onChange={() => {}}
      cityContext="London"
      placeholder="Search for a place"
    />
  )
  expect(getInput()).toHaveValue('Tower Bridge, London')
})

test('selecting a result does not trigger a redundant follow-up search for that same value', async () => {
  const fullLabel = 'Eiffel Tower, Paris'
  searchPlaces.mockResolvedValueOnce([{ label: fullLabel, lat: 48.8584, lon: 2.2945, isLodging: false }])

  vi.useFakeTimers()
  try {
    render(<ControlledActivityLocationInput cityContext="Paris" />)

    fireEvent.change(getInput(), { target: { value: 'Eiffel' } })
    act(() => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() })

    const option = screen.getByText(fullLabel)
    fireEvent.click(option)

    expect(getInput()).toHaveValue(fullLabel)
    expect(searchPlaces).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(1000) })
    await act(async () => { await Promise.resolve() })

    expect(searchPlaces).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})
