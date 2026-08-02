// Test: npm test itinerarypage

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

const mockMapView = vi.hoisted(() => vi.fn(() => <div>Map</div>))

vi.mock('../../components/MapView', () => ({
  default: mockMapView,
}))

import ItineraryPage from './ItineraryPage'
import { getTrip, updateTrip } from './tripsApi'
import { getItinerary, generateItinerary, updateActivity, createActivity, deleteActivity } from './itineraryApi'
import { geocodeCity, geocodeAddress } from '../../lib/geocode'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'
import { searchPlaces } from '../../lib/nominatim'

beforeEach(() => {
  mockMapView.mockClear()
  updateTrip.mockReset()
  generateItinerary.mockReset()
  updateActivity.mockReset()
  createActivity.mockReset()
  deleteActivity.mockReset()
  sessionStorage.clear()
  getTrip.mockResolvedValue({ destination: 'London' })
  getItinerary.mockResolvedValue({ status: 'not_generated' })
})

vi.mock('./tripsApi', () => ({
  getTrip: vi.fn(),
  updateTrip: vi.fn(),
}))

vi.mock('./itineraryApi', () => ({
  getItinerary: vi.fn(),
  generateItinerary: vi.fn(),
  updateActivity: vi.fn(),
  createActivity: vi.fn(),
  deleteActivity: vi.fn(),
}))

vi.mock('../../lib/geocode', () => ({
  geocodeCity: vi.fn().mockResolvedValue(null),
  geocodeAddress: vi.fn().mockResolvedValue(null),
}))

vi.mock('../weather/weatherApi', () => ({
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
}))

// HotelSearchInput (used inside the Edit/Add Hotel modal) calls this — mock
// it so opening the modal never fires a real network request in tests.
vi.mock('../../lib/nominatim', () => ({
  searchPlaces: vi.fn().mockResolvedValue([]),
}))

function renderAt(tripId) {
  return render(
    <MemoryRouter initialEntries={[`/trips/${tripId}`]}>
      <Routes>
        <Route path="/trips/:tripId" element={<ItineraryPage />} />
        <Route path="/trips/:tripId/flights/:leg" element={<div>Flight search page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

test('renders itinerary sections', async () => {
  renderAt(1)

  expect(screen.getAllByText(/map/i).length).toBeGreaterThan(0)
  await waitFor(() => expect(getItinerary).toHaveBeenCalledWith('1'))
  expect(await screen.findByText(/weather unavailable for this destination/i)).toBeInTheDocument()
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
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
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
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-02' })
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

test('shows day tabs from the trip dates even before an itinerary is generated', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-03' })
  // getItinerary defaults to { status: 'not_generated' } via beforeEach
  renderAt(1)

  expect(await screen.findByRole('button', { name: /day 1.*2026-08-01/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /day 2.*2026-08-02/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /day 3.*2026-08-03/i })).toBeInTheDocument()
})

test('day tabs render and remain clickable even when weather fails to load', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-02' })
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
  // geocodeCity resolves null by default (see mock above) -> weatherStatus becomes 'failed'
  renderAt(1)

  expect(await screen.findByText(/weather unavailable for this destination/i)).toBeInTheDocument()
  expect(await screen.findByText('British Museum')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /day 2.*2026-08-02/i }))
  expect(await screen.findByText('Hyde Park')).toBeInTheDocument()
})

test('shows a per-day placeholder when the itinerary has no activities for the selected day', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-02' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /day 2.*2026-08-02/i }))

  expect(await screen.findByText(/no activities generated for this day yet/i)).toBeInTheDocument()
})

test('activities keep showing indoor/outdoor type and description within the combined card', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
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

test('shows an honest unavailable message and no fake weather data when geocoding fails', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1) // geocodeCity resolves null by default (see mock above)

  await screen.findByText('British Museum')
  expect(await screen.findByText(/weather unavailable for this destination/i)).toBeInTheDocument()
  expect(screen.queryByText(/heavy rain/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/loading weather/i)).not.toBeInTheDocument()
})

test('renders the real weather summary and hourly strip once forecast data resolves', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Partly Cloudy',
    heavy_rain_probability: 65,
    heavy_rain_warning: true,
    flood_score: 40,
    flood_risk: 'Moderate',
    beach_safety_score: 80,
    beach_safety_level: 'Good',
    snow_probability: 0,
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T09:00', temperature: 15, rain_mm: 0, rain_probability: null, condition: 'Partly Cloudy' },
    { time: '2026-08-01T14:00', temperature: 20, rain_mm: 2.4, rain_probability: 62, condition: 'Rain' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  expect(await screen.findByText('Partly Cloudy')).toBeInTheDocument()
  expect(screen.getByText('65%')).toBeInTheDocument()
  expect(screen.getByText('Moderate')).toBeInTheDocument()
  expect(screen.getByText('Good')).toBeInTheDocument()
  expect(screen.getByText('62%')).toBeInTheDocument()
})

test('risk cards use red/yellow/green styling based on severity level', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 80,
    heavy_rain_warning: true, // -> 'High' -> red
    flood_score: 30,
    flood_risk: 'Moderate', // -> yellow
    beach_safety_score: 90,
    beach_safety_level: 'Good', // -> green
    snow_probability: 0, // -> 'None' -> green
  }])
  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  expect(await screen.findByText('High')).toHaveClass('bg-red-100')
  expect(screen.getByText('Moderate')).toHaveClass('bg-yellow-100')
  expect(screen.getByText('Good')).toHaveClass('bg-green-100')
  expect(screen.getByText('None')).toHaveClass('bg-green-100')
})

test('editing dates in-place re-fetches weather for the new range instead of leaving it stale', async () => {
  // Regression test: forecast/hourlyForecast/selectedDate used to only ever
  // be set once, inside the initial [tripId]-keyed effect — saving new dates
  // via the modal updated trip.start_date/end_date but never re-ran that
  // fetch, so the weather section silently kept showing the old range (or
  // disappeared entirely if the new range fell outside what was fetched).
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-02' })
  updateTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-05', end_date: '2026-08-06' })
  geocodeCity.mockResolvedValue([51.5074, -0.1278])
  getForecast.mockResolvedValue([{
    date: '2026-08-05', temp_max: 22, temp_min: 14, condition: 'Clear',
    heavy_rain_probability: 0, heavy_rain_warning: false, flood_score: 0, flood_risk: 'Low',
    beach_safety_score: 90, beach_safety_level: 'Good', snow_probability: 0,
  }])
  getHourlyForecast.mockResolvedValue([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await waitFor(() => expect(getForecast).toHaveBeenCalledWith(51.5074, -0.1278, '2026-08-01', '2026-08-02'))

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-05' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-06' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(getForecast).toHaveBeenCalledWith(51.5074, -0.1278, '2026-08-05', '2026-08-06'))
  expect(await screen.findByRole('button', { name: /day 1.*2026-08-05/i })).toBeInTheDocument()
})

test('clicking "Generate itinerary" calls the API and renders the result', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
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

test('shows an honest empty state in the Selected Flights section when no flight has been picked', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByText(/selected flights/i)).toBeInTheDocument()
  expect(screen.getByText(/no outbound flight added yet/i)).toBeInTheDocument()
  expect(screen.getByText(/no return flight added yet/i)).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /add flight/i })).toHaveLength(2)
})

test('shows a per-leg empty state when only one flight has been picked', async () => {
  getTrip.mockResolvedValue({
    destination: 'London', start_date: '2026-08-01', end_date: '2026-08-10',
    arrival_flight_number: 'JL 712', arrival_airline: 'Japan Airlines', arrival_time: '14:15', arrival_other_time: '08:30',
  })
  renderAt(1)

  await screen.findByText(/japan airlines.*jl 712/i)
  expect(screen.getByText(/no return flight added yet/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /add flight/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /change flight/i })).toBeInTheDocument()
})

test('shows real Hotel info when the trip has a hotel address saved', async () => {
  getTrip.mockResolvedValue({ destination: 'Tokyo', hotel_address: 'Park Hyatt Tokyo' })
  renderAt(1)

  await screen.findByText('Park Hyatt Tokyo')
  expect(screen.getByRole('heading', { name: /^hotel$/i })).toBeInTheDocument()
})

test('shows an honest empty state in the Hotel section when hotel_address is empty', async () => {
  getTrip.mockResolvedValue({ destination: 'London', hotel_address: '' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByText(/^hotel$/i)).toBeInTheDocument()
  expect(screen.getByText(/no hotel added yet/i)).toBeInTheDocument()
})

test('shows an honest empty state in the Hotel section when hotel_address is omitted entirely', async () => {
  getTrip.mockResolvedValue({ destination: 'London' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByText(/^hotel$/i)).toBeInTheDocument()
  expect(screen.getByText(/no hotel added yet/i)).toBeInTheDocument()
})

test('shows an honest empty state in the Hotel section when hotel_address is whitespace-only', async () => {
  getTrip.mockResolvedValue({ destination: 'London', hotel_address: '   ' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByText(/^hotel$/i)).toBeInTheDocument()
  expect(screen.getByText(/no hotel added yet/i)).toBeInTheDocument()
})

test('"Add Hotel" opens the hotel modal pre-filled with the current (empty) value', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))

  expect(screen.getByRole('heading', { name: /add hotel/i })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/ritz paris/i)).toHaveValue('')
})

test('"Edit Hotel" opens the modal pre-filled with the existing hotel address', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit hotel$/i }))

  expect(screen.getByRole('heading', { name: /edit hotel/i })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/ritz paris/i)).toHaveValue('Hotel Plaza Athenee')
})

test('confirming the hotel save calls updateTrip and the page reflects the new value', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  // Freehand typing (no dropdown pick) has no coordinates to save.
  await waitFor(() => expect(updateTrip).toHaveBeenCalledWith('1', {
    hotel_address: 'Hotel Plaza Athenee', hotel_lat: null, hotel_lng: null,
  }))
  expect(await screen.findByText('Hotel Plaza Athenee')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /add hotel/i })).not.toBeInTheDocument()
})

test('picking a hotel from the search dropdown saves its exact coordinates, not just the address', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee, Paris' })
  searchPlaces.mockResolvedValueOnce([
    { label: 'Hotel Plaza Athenee, Paris', lat: 48.8661, lon: 2.3033, isLodging: true },
  ])
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })

  fireEvent.click(await screen.findByRole('button', { name: /hotel plaza athenee, paris/i }))
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateTrip).toHaveBeenCalledWith('1', {
    hotel_address: 'Hotel Plaza Athenee, Paris', hotel_lat: 48.8661, hotel_lng: 2.3033,
  }))
})

test('editing a hotel address after picking it from the dropdown drops the now-stale coordinates', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee X' })
  searchPlaces.mockResolvedValueOnce([
    { label: 'Hotel Plaza Athenee, Paris', lat: 48.8661, lon: 2.3033, isLodging: true },
  ])
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(await screen.findByRole('button', { name: /hotel plaza athenee, paris/i }))

  // Now edit the picked text by hand — no longer guaranteed to match those coordinates.
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee X' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateTrip).toHaveBeenCalledWith('1', {
    hotel_address: 'Hotel Plaza Athenee X', hotel_lat: null, hotel_lng: null,
  }))
})

test('saving the hotel does not regenerate immediately — it opens the review prompt instead', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByRole('heading', { name: /update anything else first/i })).toBeInTheDocument()
  expect(generateItinerary).not.toHaveBeenCalled()
})

test('Cancel in the hotel modal closes without saving', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(updateTrip).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: /add hotel/i })).not.toBeInTheDocument()
})

test('a rejected hotel updateTrip shows a saving-failed message instead of crashing', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockRejectedValue(new Error('server error'))
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(/saving your trip details failed/i)).toBeInTheDocument()
})

test('"Edit Dates" opens the modal pre-filled with the trip\'s current dates', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))

  expect(screen.getByRole('heading', { name: /edit dates/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/date depart/i)).toHaveValue('2026-08-01')
  expect(screen.getByLabelText(/date return/i)).toHaveValue('2026-08-10')
})

test('confirming the dates save calls updateTrip and the page reflects the new values', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  updateTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-02', end_date: '2026-08-11' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-02' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-11' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateTrip).toHaveBeenCalledWith('1', { start_date: '2026-08-02', end_date: '2026-08-11' }))
  expect(await screen.findByText(/2026-08-02.*2026-08-11/)).toBeInTheDocument()
})

test('saving the dates does not regenerate immediately — it opens the review prompt instead', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  updateTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-02', end_date: '2026-08-11' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-02' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-11' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByRole('heading', { name: /update anything else first/i })).toBeInTheDocument()
  expect(generateItinerary).not.toHaveBeenCalled()
})

test('Cancel in the dates modal closes without saving', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-02' } })
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(updateTrip).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: /edit dates/i })).not.toBeInTheDocument()
})

test('a rejected dates updateTrip shows a saving-failed message instead of crashing', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  updateTrip.mockRejectedValue(new Error('server error'))
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-02' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(/saving your trip details failed/i)).toBeInTheDocument()
})

test('an invalid date range (end before/equal to start) disables Save and never calls updateTrip', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-10' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-01' } })

  expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(updateTrip).not.toHaveBeenCalled()
})

test('clearing the start (or end) date field disables Save instead of allowing an incomplete draft through', async () => {
  // Regression test: datesInvalid used to only check ordering when both
  // fields were non-empty, so backspacing one date entirely left Save
  // enabled and would have submitted an empty date string.
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^edit dates$/i }))
  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '' } })

  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(updateTrip).not.toHaveBeenCalled()
})

test('"No, regenerate now" in the review prompt regenerates the itinerary exactly once and closes the prompt', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  generateItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  fireEvent.click(await screen.findByRole('button', { name: /no, regenerate now/i }))

  await waitFor(() => expect(generateItinerary).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('heading', { name: /update anything else first/i })).not.toBeInTheDocument()
})

test('the review prompt offers Dates/Outbound/Return but not Hotel again, right after a hotel save', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await screen.findByRole('heading', { name: /update anything else first/i })
  expect(screen.queryByRole('button', { name: /^update hotel$/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^update dates$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /edit outbound flight/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /edit return flight/i })).toBeInTheDocument()
})

test('"Edit Outbound Flight" and "Edit Return Flight" in the review prompt navigate to the right leg', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  fireEvent.click(await screen.findByRole('button', { name: /edit outbound flight/i }))

  expect(await screen.findByText('Flight search page')).toBeInTheDocument()
  expect(generateItinerary).not.toHaveBeenCalled()
})

test('"Update Dates" in the review prompt (triggered by a hotel save) opens the dates modal', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '', start_date: '2026-08-01', end_date: '2026-08-10' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  fireEvent.click(await screen.findByRole('button', { name: /^update dates$/i }))

  expect(screen.getByRole('heading', { name: /edit dates/i })).toBeInTheDocument()
})

test('reopens the review prompt on load if a flight edit left a pending review flag set, excludes that leg, then consumes the flag', async () => {
  sessionStorage.setItem('pendingReview:1', 'outbound')
  getTrip.mockResolvedValue({ destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10' })
  renderAt(1)

  expect(await screen.findByRole('heading', { name: /update anything else first/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /edit outbound flight/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /edit return flight/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^update dates$/i })).toBeInTheDocument()
  // Regression guard: the flag must be cleared once shown, not left set —
  // otherwise simply reopening the trip later re-triggers the same prompt
  // even with no new edit pending.
  expect(sessionStorage.getItem('pendingReview:1')).toBeNull()
})

test('does not reopen the review prompt on a plain reload with no pending review flag set', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris' })
  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.queryByRole('heading', { name: /update anything else first/i })).not.toBeInTheDocument()
})

test('saving hotel/dates in-page never writes a pending-review flag, so leaving and reopening the trip does not resurface the prompt', async () => {
  getTrip.mockResolvedValue({ destination: 'Paris', hotel_address: '' })
  updateTrip.mockResolvedValue({ destination: 'Paris', hotel_address: 'Hotel Plaza Athenee' })
  const { unmount } = renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /add hotel/i }))
  fireEvent.change(screen.getByPlaceholderText(/ritz paris/i), { target: { value: 'Hotel Plaza Athenee' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
  await screen.findByRole('heading', { name: /update anything else first/i })

  // Simulate leaving without clicking "No, regenerate now", then reopening
  // the same trip later (e.g. a fresh page load).
  expect(sessionStorage.getItem('pendingReview:1')).toBeNull()
  const callsBeforeReopen = getTrip.mock.calls.length
  unmount()

  renderAt(1)
  await waitFor(() => expect(getTrip.mock.calls.length).toBe(callsBeforeReopen + 1))
  expect(screen.queryByRole('heading', { name: /update anything else first/i })).not.toBeInTheDocument()
})

test('the hero "Edit Dates" and hotel card "Edit Hotel" buttons have distinct accessible names when both dates and hotel are set', async () => {
  // Regression test: both used to render as a bare "Edit" button, making
  // them ambiguous to screen readers and to any getByRole('button', { name:
  // /^edit$/i }) lookup once a trip had both fields set.
  getTrip.mockResolvedValue({
    destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10', hotel_address: 'Hotel Plaza Athenee',
  })
  renderAt(1)

  expect(await screen.findByRole('button', { name: /^edit dates$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^edit hotel$/i })).toBeInTheDocument()
})

test('hero card shows the real trip name, destination, dates, and a status derived from real dates', async () => {
  getTrip.mockResolvedValue({
    name: 'Tokyo Trip', destination: 'Tokyo', start_date: '2099-01-01', end_date: '2099-01-10',
  })
  renderAt(1)

  await screen.findByText('Tokyo Trip')
  // Match the combined "start -> end" text so this only finds the hero's own
  // date-range line, not one of the day tabs (which now also render a single
  // date each, e.g. "Day 1 - 2099-01-01").
  expect(screen.getByText(/2099-01-01.*2099-01-10/)).toBeInTheDocument()
  expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
})

test('renders a Back to My Trips link to /dashboard', async () => {
  renderAt(1)
  await waitFor(() => expect(getTrip).toHaveBeenCalled())
  expect(screen.getByRole('link', { name: /back to my trips/i })).toHaveAttribute('href', '/dashboard')
})

// Test itinerary data
const mockItinerary = {
  days: [
    {
      date: "2026-07-26",
      activities: [
        {
          id: 1,
          name: "British Museum",
          lat: 51.5194,
          lng: -0.127,
          type: "indoor",
          time_slot: "10:00"
        }
      ]
    },
    {
      date: "2026-07-27",
      activities: [
        {
          id: 2,
          name: "Big Ben",
          lat: 51.5007,
          lng: -0.1246,
          type: "outdoor",
          time_slot: "10:00"
        }
      ]
    }
  ]
}

// test first day stop
test('passes selected day activities to MapView as stops', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-07-26',
    end_date: '2026-07-27',
  })

  getItinerary.mockResolvedValue(mockItinerary)

  renderAt(1)

  await screen.findByRole('button', { name: /day 1.*2026-07-26/i })

  fireEvent.click(
    screen.getByRole('button', { name: /day 1.*2026-07-26/i })
  )

  await screen.findByText("British Museum")

  expect(mockMapView).toHaveBeenLastCalledWith(
    expect.objectContaining({
      stops: [
        {
          position: [51.5194, -0.127],
          label: "British Museum"
        }
      ]
    }),
    expect.anything()
  )
})

// test changing day
test('updates MapView stops when switching days', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-07-26',
    end_date: '2026-07-27',
  })

  getItinerary.mockResolvedValue({
    days: [
      {
        date: "2026-07-26",
        activities: [
          {
            id: 1,
            name: "British Museum",
            lat: 51.5194,
            lng: -0.127,
            type: "indoor",
            time_slot: "10:00"
          }
        ]
      },
      {
        date: "2026-07-27",
        activities: [
          {
            id: 2,
            name: "Big Ben",
            lat: 51.5007,
            lng: -0.1246,
            type: "outdoor",
            time_slot: "10:00"
          }
        ]
      }
    ]
  })

  renderAt(1)

  await screen.findByRole('button', { name: /day 1.*2026-07-26/i })

  fireEvent.click(
    screen.getByRole('button', { name: /day 1.*2026-07-26/i })
  )

  await screen.findByText('British Museum')

  fireEvent.click(
    screen.getByRole('button', { name: /day 2.*2026-07-27/i })
  )

  await screen.findByText("Big Ben")

  expect(mockMapView).toHaveBeenLastCalledWith(
    expect.objectContaining({
      stops: [
        {
          position: [51.5007, -0.1246],
          label: "Big Ben"
        }
      ]
    }),
    expect.anything()
  )
})

// test hotel pin
test('passes hotel location to MapView when hotel address exists', async () => {
  getTrip.mockResolvedValue({
    destination: 'Tokyo',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
    hotel_address: 'Park Hyatt Tokyo',
  })

  geocodeAddress.mockResolvedValue([35.6852, 139.6917])

  getItinerary.mockResolvedValue({
    days: [
      {
        date: "2026-08-01",
        activities: [
          {
            id: 1,
            name: "Tokyo Tower",
            lat: 35.6586,
            lng: 139.7454,
            type: "outdoor",
            time_slot: "10:00"
          }
        ]
      }
    ]
  })

  renderAt(1)

  await screen.findByText("Park Hyatt Tokyo")

  expect(mockMapView).toHaveBeenLastCalledWith(
    expect.objectContaining({
      hotel: {
        position: [35.6852, 139.6917],
        label: "Park Hyatt Tokyo",
      }
    }),
    expect.anything()
  )
})

test('does not pass hotel to MapView when hotel address is missing', async () => {
  getTrip.mockResolvedValue({
    destination: 'Tokyo',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
    hotel_address: '',
  })

  renderAt(1)

  await waitFor(() => expect(getTrip).toHaveBeenCalled())

  expect(mockMapView).toHaveBeenLastCalledWith(
    expect.objectContaining({
      hotel: null,
    }),
    expect.anything()
  )
})
function mockGeneratedActivity(overrides = {}) {
  return {
    id: 1, day_date: '2026-08-01', name: 'British Museum', type: 'indoor',
    time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'Free museum.',
    lat: 51.5194, lng: -0.127, is_swapped: false, alternate_name: '', alternate_location: '',
    swap_reason: '', weather_sensitivity: '', is_fixed: false,
    ...overrides,
  }
}

test('shows a Fixed pill on activities marked is_fixed, and not on others', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      mockGeneratedActivity({ id: 1, name: 'British Museum', is_fixed: true }),
      mockGeneratedActivity({ id: 2, name: 'Hyde Park', is_fixed: false }),
    ] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  expect(screen.getByText('Fixed')).toBeInTheDocument()
  // Only one activity is fixed, so exactly one pill should render.
  expect(screen.getAllByText('Fixed')).toHaveLength(1)
})

test('shows a badge per weather_sensitivity tag, and none for an untagged activity', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      mockGeneratedActivity({ id: 1, name: 'Seven Sisters', weather_sensitivity: 'view_dependent,wind_exposed' }),
      mockGeneratedActivity({ id: 2, name: 'Brighton Beach', weather_sensitivity: 'beach' }),
      mockGeneratedActivity({ id: 3, name: 'Hyde Park', weather_sensitivity: '' }),
    ] }],
  })
  renderAt(1)

  await screen.findByText('Seven Sisters')
  expect(screen.getByText('Scenic View')).toBeInTheDocument()
  expect(screen.getByText('Wind Exposed')).toBeInTheDocument()
  expect(screen.getByText('Beach')).toBeInTheDocument()
  expect(screen.queryByText('Strenuous')).not.toBeInTheDocument()
})

test('clicking the edit icon opens the modal pre-filled with the activity\'s current values', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))

  expect(screen.getByRole('heading', { name: /edit activity/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/^day$/i)).toHaveValue('2026-08-01')
  expect(screen.getByLabelText(/start time/i)).toHaveValue('09:00')
  expect(screen.getByLabelText(/end time/i)).toHaveValue('11:00')
  expect(screen.getByLabelText(/^name$/i)).toHaveValue('British Museum')
  expect(screen.getByPlaceholderText(/search for a place/i)).toHaveValue('Great Russell St')
  expect(screen.getByRole('checkbox', { name: /fixed/i })).not.toBeChecked()
})

test('saving an activity edit calls updateActivity with the full patch and updates the list from the response', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  updateActivity.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity({ name: 'National Gallery' })] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'National Gallery' } })
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('1', 1, {
    day_date: '2026-08-01',
    time_slot: '09:00 - 11:00',
    name: 'National Gallery',
    location: 'Great Russell St',
    lat: 51.5194,
    lng: -0.127,
    is_fixed: false,
  }))
  expect(await screen.findByText('National Gallery')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /edit activity/i })).not.toBeInTheDocument()
})

test('checking Fixed and saving includes is_fixed: true in the patch', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  updateActivity.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity({ is_fixed: true })] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /fixed/i }))
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateActivity).toHaveBeenCalledWith(
    '1', 1, expect.objectContaining({ is_fixed: true }),
  ))
})

test('selecting a new location from the dropdown updates both the address field and the coordinates sent on save', async () => {
  searchPlaces.mockResolvedValue([
    { label: 'Tower Bridge, London', lat: 51.5055, lon: -0.0754, isLodging: false },
  ])
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  updateActivity.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity({
      location: 'Tower Bridge, London', lat: 51.5055, lng: -0.0754,
    })] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))

  const locationInput = screen.getByPlaceholderText(/search for a place/i)
  fireEvent.change(locationInput, { target: { value: 'Tower Bridge' } })

  const option = await screen.findByText('Tower Bridge, London')
  fireEvent.click(option)
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('1', 1, expect.objectContaining({
    location: 'Tower Bridge, London', lat: 51.5055, lng: -0.0754,
  })))
})

test('Cancel in the edit-activity modal closes without saving', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Something Else' } })
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(updateActivity).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: /edit activity/i })).not.toBeInTheDocument()
  expect(screen.getByText('British Museum')).toBeInTheDocument()
})

test('a rejected activity save shows a saving-failed message instead of crashing', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  updateActivity.mockRejectedValue(new Error('server error'))
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /edit british museum/i }))
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(/saving this activity failed/i)).toBeInTheDocument()
})

test('"Add Activity" is available even when no activities exist yet for the selected day', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  expect(await screen.findByText(/no activities generated for this day yet/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /add activity/i })).toBeInTheDocument()
})

test('clicking "Add Activity" opens the modal pre-filled with the selected day and empty fields', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /add activity/i }))

  expect(screen.getByRole('heading', { name: /add activity/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/^day$/i)).toHaveValue('2026-08-01')
  expect(screen.getByLabelText(/start time/i)).toHaveValue('')
  expect(screen.getByLabelText(/^name$/i)).toHaveValue('')
  expect(screen.getByRole('radio', { name: /outdoor/i })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: /fixed/i })).not.toBeChecked()
  expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
})

test('Add stays disabled until a location is actually picked from the dropdown', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  await screen.findByRole('button', { name: /add activity/i })
  fireEvent.click(screen.getByRole('button', { name: /add activity/i }))
  fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '11:00' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Tate Modern' } })

  // Typing a location without selecting a dropdown option never fires
  // onChange (see ActivityLocationInput) — Add must stay disabled since
  // there's no lat/lng yet to send.
  fireEvent.change(screen.getByPlaceholderText(/search for a place/i), { target: { value: 'Tate Modern' } })
  expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
})

test('saving a new activity calls createActivity with the full payload and updates the list from the response', async () => {
  searchPlaces.mockResolvedValue([
    { label: 'Tate Modern, London', lat: 51.5076, lon: -0.0994, isLodging: false },
  ])
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [] })
  createActivity.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity({
      id: 2, name: 'Tate Modern', location: 'Tate Modern, London', lat: 51.5076, lng: -0.0994, type: 'indoor',
    })] }],
  })
  renderAt(1)

  await screen.findByRole('button', { name: /add activity/i })
  fireEvent.click(screen.getByRole('button', { name: /add activity/i }))
  fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '11:00' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Tate Modern' } })
  fireEvent.click(screen.getByRole('radio', { name: /indoor/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /fixed/i }))

  const locationInput = screen.getByPlaceholderText(/search for a place/i)
  fireEvent.change(locationInput, { target: { value: 'Tate Modern' } })
  fireEvent.click(await screen.findByText('Tate Modern, London'))

  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

  await waitFor(() => expect(createActivity).toHaveBeenCalledWith('1', {
    day_date: '2026-08-01',
    time_slot: '09:00 - 11:00',
    name: 'Tate Modern',
    location: 'Tate Modern, London',
    lat: 51.5076,
    lng: -0.0994,
    type: 'indoor',
    is_fixed: true,
  }))
  expect(await screen.findByText('Tate Modern')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /add activity/i })).not.toBeInTheDocument()
})

test('Cancel in the add-activity modal closes without saving', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  await screen.findByRole('button', { name: /add activity/i })
  fireEvent.click(screen.getByRole('button', { name: /add activity/i }))
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Something' } })
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(createActivity).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: /add activity/i })).not.toBeInTheDocument()
})

test('a rejected activity add shows an adding-failed message instead of crashing', async () => {
  searchPlaces.mockResolvedValue([
    { label: 'Tate Modern, London', lat: 51.5076, lon: -0.0994, isLodging: false },
  ])
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [] })
  createActivity.mockRejectedValue(new Error('server error'))
  renderAt(1)

  await screen.findByRole('button', { name: /add activity/i })
  fireEvent.click(screen.getByRole('button', { name: /add activity/i }))
  fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '11:00' } })
  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Tate Modern' } })
  const locationInput = screen.getByPlaceholderText(/search for a place/i)
  fireEvent.change(locationInput, { target: { value: 'Tate Modern' } })
  fireEvent.click(await screen.findByText('Tate Modern, London'))
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

  expect(await screen.findByText(/adding this activity failed/i)).toBeInTheDocument()
})

test('deleting an activity asks for confirmation, then calls deleteActivity and updates the list from the response', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  deleteActivity.mockResolvedValue({ status: 'not_generated' })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))

  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('British Museum'))
  await waitFor(() => expect(deleteActivity).toHaveBeenCalledWith('1', 1))
  expect(await screen.findByText(/no activities generated for this day yet/i)).toBeInTheDocument()

  window.confirm.mockRestore()
})

test('declining the delete confirmation does not call deleteActivity', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))

  expect(deleteActivity).not.toHaveBeenCalled()
  expect(screen.getByText('British Museum')).toBeInTheDocument()

  window.confirm.mockRestore()
})

test('a rejected delete shows a removal-failed message instead of crashing', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  deleteActivity.mockRejectedValue(new Error('server error'))
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))

  expect(await screen.findByText(/removing this activity failed/i)).toBeInTheDocument()

  window.confirm.mockRestore()
})
