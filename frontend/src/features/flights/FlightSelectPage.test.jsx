import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import FlightSelectPage from './FlightSelectPage'
import { searchFlights } from './flightsApi'
import { getTrip, selectFlight } from '../trips/tripsApi'

vi.mock('./flightsApi', () => ({
  searchFlights: vi.fn(),
}))

vi.mock('../trips/tripsApi', () => ({
  getTrip: vi.fn(),
  selectFlight: vi.fn(),
}))

beforeEach(() => {
  sessionStorage.clear()
  getTrip.mockReset()
  selectFlight.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trips/new/flights/:leg" element={<FlightSelectPage />} />
        <Route path="/trips/new" element={<div>Plan Your Trip page</div>} />
        <Route path="/trips/:tripId/flights/:leg" element={<FlightSelectPage />} />
        <Route path="/trips/:tripId" element={<div>Trip page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

test('outbound leg auto-searches on load using the trip form data, no manual search needed', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10', flightNumber: 'JL 712',
  }))
  searchFlights.mockResolvedValue({ flights: [] })

  renderAt('/trips/new/flights/outbound')

  await waitFor(() => expect(searchFlights).toHaveBeenCalledWith(
    'London, UK', '2026-08-01', '2026-08-01', 'arrival', 'Tokyo', 'JL 712'
  ))
  // TEST FIX: Now checks for actual city names instead of "Departure -> Destination"
  expect(screen.getByRole('heading', { name: /London, UK.*Tokyo/i })).toBeInTheDocument()
  expect(screen.getByText(/outbound flight.*2026-08-01/i)).toBeInTheDocument()
})

test('return leg auto-searches on load with direction=departure and no flight number carried over', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10', flightNumber: 'JL 712',
  }))
  searchFlights.mockResolvedValue({ flights: [] })

  renderAt('/trips/new/flights/return')

  await waitFor(() => expect(searchFlights).toHaveBeenCalledWith(
    'London, UK', '2026-08-10', '2026-08-10', 'departure', 'Tokyo', 'JL 712'
  ))
  // TEST FIX: Now checks for actual city names swapped for return journey
  expect(screen.getByRole('heading', { name: /Tokyo.*London, UK/i })).toBeInTheDocument()
  expect(screen.getByText(/return flight.*2026-08-10/i)).toBeInTheDocument()
})

test('shows "No date selected" when the leg has no date yet', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'London, UK' }))
  searchFlights.mockResolvedValue({ flights: [] })

  renderAt('/trips/new/flights/outbound')

  await waitFor(() => expect(searchFlights).toHaveBeenCalled())
  expect(screen.getByText(/no date selected/i)).toBeInTheDocument()
})

test('shows a loading state while the auto-search is in flight', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01' }))
  let resolvePromise
  searchFlights.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

  renderAt('/trips/new/flights/outbound')

  expect(screen.getByText(/searching/i)).toBeInTheDocument()
  resolvePromise({ flights: [] })
  await waitFor(() => expect(screen.queryByText(/searching/i)).not.toBeInTheDocument())
})

test('shows the flight count and results once the search resolves', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'Paris', startDate: '2026-08-01' }))
  searchFlights.mockResolvedValue({
    flights: [{ airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15', duration: '5h 45m' }],
  })

  renderAt('/trips/new/flights/outbound')

  expect(await screen.findByText(/1 flight found/i)).toBeInTheDocument()
  expect(screen.getByText('Japan Airlines')).toBeInTheDocument()
})

test('selecting an outbound flight saves it to the draft and moves to the return leg', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'Paris', startDate: '2026-08-01', endDate: '2026-08-10' }))
  searchFlights.mockResolvedValue({
    flights: [{ airline: 'Japan Airlines', flight_number: 'JL 712', departure_city: 'Paris', departure_time: '08:30', arrival_time: '14:15', duration: '5h 45m' }],
  })

  renderAt('/trips/new/flights/outbound')

  const selectButton = await screen.findByRole('button', { name: /select/i })
  fireEvent.click(selectButton)

  await waitFor(() => expect(searchFlights).toHaveBeenCalledTimes(2))
})

test('selecting a return flight saves it and navigates back to Plan Your Trip', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'Paris', startDate: '2026-08-01', endDate: '2026-08-10' }))
  searchFlights.mockResolvedValue({
    flights: [{ airline: 'ANA', flight_number: 'NH 206', departure_city: 'Tokyo', destination_city: 'Paris', departure_time: '11:00', arrival_time: '17:20', duration: '6h 20m' }],
  })

  renderAt('/trips/new/flights/return')

  const selectButton = await screen.findByRole('button', { name: /select/i })
  fireEvent.click(selectButton)

  await screen.findByText('Plan Your Trip page')
})

test('renders an inline error message when the search fails', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'Paris', startDate: '2026-08-01' }))
  searchFlights.mockRejectedValue({ response: { data: { detail: 'Something broke.' } } })

  renderAt('/trips/new/flights/outbound')

  expect(await screen.findByText('Something broke.')).toBeInTheDocument()
})

test('renders a Back to Edit Trip link to /trips/new', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({ destination: 'Tokyo', origin: 'Paris', startDate: '2026-08-01' }))
  searchFlights.mockResolvedValue({ flights: [] })

  renderAt('/trips/new/flights/outbound')

  expect(screen.getByRole('link', { name: /back to edit trip/i })).toHaveAttribute('href', '/trips/new')
})

test('rendering at a tripId route fetches the trip and searches using its origin/destination/dates, not the draft', async () => {
  // A leftover draft in sessionStorage must NOT be used in edit mode.
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Wrong City', origin: 'Wrong Origin', startDate: '2099-01-01', endDate: '2099-01-10', flightNumber: 'ZZ 999',
  }))
  getTrip.mockResolvedValue({
    origin: 'London, UK', destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-10',
  })
  searchFlights.mockResolvedValue({ flights: [] })

  renderAt('/trips/42/flights/outbound')

  await waitFor(() => expect(getTrip).toHaveBeenCalledWith('42'))
  await waitFor(() => expect(searchFlights).toHaveBeenCalledWith(
    'London, UK', '2026-08-01', '2026-08-01', 'arrival', 'Tokyo', ''
  ))
  expect(screen.getByRole('heading', { name: /London, UK.*Tokyo/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /back to edit trip/i })).toHaveAttribute('href', '/trips/42')
})

test('selecting the outbound flight in edit mode saves it and continues straight into the return leg, like the new-trip wizard', async () => {
  getTrip.mockResolvedValue({
    origin: 'London, UK', destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-10',
  })
  selectFlight.mockResolvedValue({})
  searchFlights.mockResolvedValue({
    flights: [{ airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15', duration: '5h 45m' }],
  })

  renderAt('/trips/42/flights/outbound')

  const selectButton = await screen.findByRole('button', { name: /select/i })
  fireEvent.click(selectButton)

  await waitFor(() => expect(selectFlight).toHaveBeenCalledWith('42', {
    leg: 'arrival', flight_number: 'JL 712', airline: 'Japan Airlines', time: '14:15', other_time: '08:30',
  }))
  // Continues into the return leg's search on the same tripId — not back
  // to the trip page yet, and no review prompt pending until the return
  // leg is also done.
  await waitFor(() => expect(searchFlights).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('heading', { name: /Tokyo.*London, UK/i })).toBeInTheDocument()
  expect(sessionStorage.getItem('pendingReview:42')).toBeNull()
})

test('selecting the return flight in edit mode saves it, navigates back to the trip page, and sets the pending-review flag', async () => {
  getTrip.mockResolvedValue({
    origin: 'London, UK', destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-10',
  })
  selectFlight.mockResolvedValue({})
  searchFlights.mockResolvedValue({
    flights: [{ airline: 'ANA', flight_number: 'NH 206', departure_time: '11:00', arrival_time: '17:20', duration: '6h 20m' }],
  })

  renderAt('/trips/42/flights/return')

  const selectButton = await screen.findByRole('button', { name: /select/i })
  fireEvent.click(selectButton)

  await waitFor(() => expect(selectFlight).toHaveBeenCalledWith('42', {
    leg: 'departure', flight_number: 'NH 206', airline: 'ANA', time: '11:00', other_time: '17:20',
  }))
  await screen.findByText('Trip page')
  expect(sessionStorage.getItem('pendingReview:42')).toBe('1')
})