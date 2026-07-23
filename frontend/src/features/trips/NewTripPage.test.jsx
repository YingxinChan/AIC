import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import NewTripPage from './NewTripPage'
import { createTrip, selectFlight } from './tripsApi'

vi.mock('./tripsApi', () => ({
  createTrip: vi.fn(),
  selectFlight: vi.fn(),
}))

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trips/new']}>
      <Routes>
        <Route path="/trips/new" element={<NewTripPage />} />
        <Route path="/trips/new/flights/outbound" element={<div>Outbound flight page</div>} />
        <Route path="/trips/:tripId" element={<div>Itinerary page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'Tokyo' } })
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-01' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-10' } })
}

test('renders the Plan Your Trip heading', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /plan your trip!/i })).toBeInTheDocument()
})

test('renders departure, destination, dates, flight number, hotel, and places to visit fields', () => {
  renderPage()
  expect(screen.getByLabelText(/departure/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/destination/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/date depart/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/date return/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/flight number/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/hotel/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/places to visit/i)).toBeInTheDocument()
})

test('typing a departure city and flight number saves them to the draft', () => {
  renderPage()
  fillRequiredFields()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.change(screen.getByLabelText(/flight number/i), { target: { value: 'JL 712' } })

  fireEvent.click(screen.getByRole('button', { name: /find flight/i }))

  expect(JSON.parse(sessionStorage.getItem('tripDraft'))).toMatchObject({
    origin: 'London, UK', flightNumber: 'JL 712',
  })
})

test('clicking Find Flight saves the current fields to the draft and navigates to outbound flight search', () => {
  renderPage()
  fillRequiredFields()

  fireEvent.click(screen.getByRole('button', { name: /find flight/i }))

  expect(screen.getByText('Outbound flight page')).toBeInTheDocument()
  expect(JSON.parse(sessionStorage.getItem('tripDraft'))).toMatchObject({
    destination: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10',
  })
})

test('shows selected flights and a Change Flights option once both legs are picked, instead of Find Flight', () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10',
    outboundFlight: { airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15' },
    returnFlight: { airline: 'ANA', flight_number: 'NH 206', departure_time: '11:00', arrival_time: '17:20' },
  }))
  renderPage()

  expect(screen.queryByRole('button', { name: /find flight/i })).not.toBeInTheDocument()
  expect(screen.getByText(/japan airlines.*jl 712/i)).toBeInTheDocument()
  expect(screen.getByText(/ana.*nh 206/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /change flights/i })).toBeInTheDocument()
})

test('submitting Plan My Trip creates the trip, attaches both flights, and goes to the itinerary page', async () => {
  createTrip.mockResolvedValue({ id: 99 })
  selectFlight.mockResolvedValue({})
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10',
    hotelAddress: 'Park Hyatt Tokyo', placesToVisit: 'Senso-ji Temple',
    outboundFlight: { airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15' },
    returnFlight: { airline: 'ANA', flight_number: 'NH 206', departure_time: '11:00', arrival_time: '17:20' },
  }))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  await waitFor(() => expect(createTrip).toHaveBeenCalledWith({
    name: 'Tokyo Trip',
    destination: 'Tokyo',
    origin: 'London, UK',
    start_date: '2026-08-01',
    end_date: '2026-08-10',
    hotel_address: 'Park Hyatt Tokyo',
    original_plan: 'Senso-ji Temple',
  }))
  await waitFor(() => expect(selectFlight).toHaveBeenCalledWith('99', {
    leg: 'arrival', flight_number: 'JL 712', airline: 'Japan Airlines', time: '14:15', other_time: '08:30',
  }))
  await waitFor(() => expect(selectFlight).toHaveBeenCalledWith('99', {
    leg: 'departure', flight_number: 'NH 206', airline: 'ANA', time: '11:00', other_time: '17:20',
  }))
  await screen.findByText('Itinerary page')
})

test('submitting without any flights picked still creates the trip', async () => {
  createTrip.mockResolvedValue({ id: 5 })
  renderPage()
  fillRequiredFields()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  await waitFor(() => expect(createTrip).toHaveBeenCalled())
  expect(selectFlight).not.toHaveBeenCalled()
  await screen.findByText('Itinerary page')
})

test('shows an inline error message when trip creation fails', async () => {
  createTrip.mockRejectedValue({ response: { data: { detail: 'Something went wrong.' } } })
  renderPage()
  fillRequiredFields()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
})

test('shows a loading state while submitting', async () => {
  let resolvePromise
  createTrip.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))
  renderPage()
  fillRequiredFields()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  expect(await screen.findByRole('button', { name: /planning/i })).toBeDisabled()
  resolvePromise({ id: 1 })
  await screen.findByText('Itinerary page')
})
