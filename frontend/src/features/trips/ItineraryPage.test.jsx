import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import ItineraryPage from './ItineraryPage'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { geocodeCity } from '../../lib/geocode'

vi.mock('../../components/MapView', () => ({
  default: () => <div>Map</div>,
}))

vi.mock('./tripsApi', () => ({
  getTrip: vi.fn(),
}))

vi.mock('./itineraryApi', () => ({
  getItinerary: vi.fn(),
  generateItinerary: vi.fn(),
}))

vi.mock('../../lib/geocode', () => ({
  geocodeCity: vi.fn().mockResolvedValue(null),
}))

function renderAt(tripId) {
  return render(
    <MemoryRouter initialEntries={[`/trips/${tripId}`]}>
      <Routes>
        <Route path="/trips/:tripId" element={<ItineraryPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  getTrip.mockResolvedValue({ destination: 'London' })
  getItinerary.mockResolvedValue({ status: 'not_generated' })
})

test('renders itinerary sections', async () => {
  renderAt(1)

  expect(screen.getByText(/weather forecast will appear here/i)).toBeInTheDocument()
  expect(screen.getAllByText(/map/i).length).toBeGreaterThan(0)
  await waitFor(() => expect(getItinerary).toHaveBeenCalledWith('1'))
})

test('shows the trip\'s own destination in the map heading, not a hardcoded city', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris' })
  renderAt(1)

  await waitFor(() => expect(screen.getByRole('heading', { name: /paris map/i })).toBeInTheDocument())
})

test('geocodes the trip\'s own destination for the map, not a hardcoded city', async () => {
  getTrip.mockResolvedValue({ destination: 'Tokyo' })
  renderAt(1)

  await waitFor(() => expect(geocodeCity).toHaveBeenCalledWith('Tokyo'))
})

test('shows placeholder and "Generate itinerary" button before anything is generated', async () => {
  renderAt(1)

  await waitFor(() => expect(getItinerary).toHaveBeenCalled())
  expect(screen.getByText(/ai-generated itinerary will appear here/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^generate itinerary$/i })).toBeInTheDocument()
})

test('renders an already-generated itinerary on load without needing to click generate', async () => {
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await waitFor(() => expect(screen.getByText('British Museum')).toBeInTheDocument())
  expect(screen.getByText(/day 1.*2026-08-01/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /regenerate itinerary/i })).toBeInTheDocument()
})

test('shows a day tab per generated day, and clicking a different day switches the shown activities', async () => {
  getItinerary.mockResolvedValue({
    days: [
      { date: '2026-08-01', activities: [
        { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
      ] },
      { date: '2026-08-02', activities: [
        { id: 2, name: 'Hyde Park', type: 'outdoor', time_slot: '10:00 - 12:00', location: 'West London', description: 'Walk.', is_swapped: false },
      ] },
    ],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  expect(screen.queryByText('Hyde Park')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /day 2.*2026-08-02/i }))

  expect(await screen.findByText('Hyde Park')).toBeInTheDocument()
  expect(screen.queryByText('British Museum')).not.toBeInTheDocument()
})

test('activities keep showing indoor/outdoor type and description within the combined card', async () => {
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'Free museum.', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  expect(screen.getByText('indoor')).toBeInTheDocument()
  expect(screen.getByText('Free museum.')).toBeInTheDocument()
  expect(screen.getByText('Great Russell St')).toBeInTheDocument()
})

test('weather forecast stays an honest placeholder inside the combined card, no fake hourly data', async () => {
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  expect(screen.getByText(/weather forecast will appear here/i)).toBeInTheDocument()
})

test('clicking "Generate itinerary" calls the API and renders the result', async () => {
  generateItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'Hyde Park', type: 'outdoor', time_slot: '10:00 - 12:00', location: 'West London', description: 'Walk.', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await waitFor(() => expect(getItinerary).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: /^generate itinerary$/i }))

  await waitFor(() => expect(generateItinerary).toHaveBeenCalledWith('1'))
  expect(await screen.findByText('Hyde Park')).toBeInTheDocument()
})

test('shows a notice instead of crashing when generation is not configured', async () => {
  generateItinerary.mockResolvedValue({ status: 'not_configured', message: 'AI itinerary generation requires ANTHROPIC_API_KEY in backend/.env.' })
  renderAt(1)

  await waitFor(() => expect(getItinerary).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: /^generate itinerary$/i }))

  expect(await screen.findByText(/requires anthropic_api_key/i)).toBeInTheDocument()
})

test('shows real Selected Flights when the trip has arrival and/or departure flights saved', async () => {
  getTrip.mockResolvedValue({
    destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-10',
    arrival_flight_number: 'JL 712', arrival_airline: 'Japan Airlines', arrival_time: '14:15', arrival_other_time: '08:30',
    departure_flight_number: 'NH 206', departure_airline: 'ANA', departure_time: '11:00', departure_other_time: '17:20',
  })
  renderAt(1)

  await screen.findByText(/japan airlines.*jl 712/i)
  expect(screen.getByText(/ana.*nh 206/i)).toBeInTheDocument()

  // Airline-code badges derived from the real flight numbers.
  expect(screen.getByText('JL')).toBeInTheDocument()
  expect(screen.getByText('NH')).toBeInTheDocument()

  // Full departure -> arrival range using the real second timestamp, and the
  // trip's own start/end dates (not fabricated flight-specific dates).
  expect(screen.getByText(/outbound.*2026-08-01/i)).toBeInTheDocument()
  expect(screen.getByText(/08:30.*14:15/)).toBeInTheDocument()
  expect(screen.getByText(/return.*2026-08-10/i)).toBeInTheDocument()
  expect(screen.getByText(/11:00.*17:20/)).toBeInTheDocument()
})

test('does not show a Selected Flights section when no flight has been picked', async () => {
  getTrip.mockResolvedValue({ destination: 'London' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.queryByText(/selected flights/i)).not.toBeInTheDocument()
})

test('shows real Hotel info when the trip has a hotel address saved', async () => {
  getTrip.mockResolvedValue({ destination: 'Tokyo', hotel_address: 'Park Hyatt Tokyo' })
  renderAt(1)

  await screen.findByText('Park Hyatt Tokyo')
  expect(screen.getByText(/hotel/i)).toBeInTheDocument()
})

test('does not show a Hotel section when no hotel address is saved', async () => {
  getTrip.mockResolvedValue({ destination: 'London', hotel_address: '' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.queryByText(/^hotel$/i)).not.toBeInTheDocument()
})

test('hero card shows the real trip name, destination, dates, and a status derived from real dates', async () => {
  getTrip.mockResolvedValue({
    name: 'Tokyo Trip', destination: 'Tokyo', start_date: '2099-01-01', end_date: '2099-01-10',
  })
  renderAt(1)

  await screen.findByText('Tokyo Trip')
  expect(screen.getByText(/2099-01-01/)).toBeInTheDocument()
  expect(screen.getByText(/2099-01-10/)).toBeInTheDocument()
  expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
})

test('renders a Back to My Trips link to /dashboard', async () => {
  renderAt(1)
  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByRole('link', { name: /back to my trips/i })).toHaveAttribute('href', '/dashboard')
})
