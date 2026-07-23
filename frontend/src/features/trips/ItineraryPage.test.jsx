import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import ItineraryPage from './ItineraryPage'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { geocodeCity } from '../../lib/geocode'
import { getForecast, getHourlyForecast } from '../weather/weatherApi'
import { getActivityPhoto } from '../../lib/wikipedia'
import { getPlaceDetails } from '../../lib/nominatim'
import { getWalkingDistance } from './activitiesApi'

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

vi.mock('../weather/weatherApi', () => ({
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
}))

vi.mock('../../lib/wikipedia', () => ({
  getActivityPhoto: vi.fn(),
}))

vi.mock('../../lib/nominatim', () => ({
  getPlaceDetails: vi.fn(),
}))

vi.mock('./activitiesApi', () => ({
  getWalkingDistance: vi.fn(),
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
  vi.clearAllMocks()
  getTrip.mockResolvedValue({ destination: 'London' })
  getItinerary.mockResolvedValue({ status: 'not_generated' })
  getActivityPhoto.mockResolvedValue(null)
  getPlaceDetails.mockResolvedValue(null)
  getWalkingDistance.mockResolvedValue({ distance_m: null, duration_min: null })
})

const TWO_ACTIVITIES_DAY = {
  date: '2026-08-01',
  activities: [
    { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false, lat: 51.5194, lng: -0.127 },
    { id: 2, name: 'Hyde Park', type: 'outdoor', time_slot: '12:00 - 14:00', location: 'West London', description: 'Walk.', is_swapped: false, lat: 51.5073, lng: -0.1657 },
  ],
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

test('clicking an activity expands it and fetches its photo, its own place details, and the next activity\'s place details', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('British Museum'))

  await waitFor(() => expect(getActivityPhoto).toHaveBeenCalledWith('British Museum'))
  expect(getPlaceDetails).toHaveBeenCalledWith('British Museum', 'London')
  expect(getPlaceDetails).toHaveBeenCalledWith('Hyde Park', 'London')
})

test('clicking an expanded activity again collapses it without re-fetching', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('British Museum'))
  await waitFor(() => expect(getActivityPhoto).toHaveBeenCalledTimes(1))

  fireEvent.click(screen.getByText('British Museum'))
  fireEvent.click(screen.getByText('British Museum'))

  expect(getActivityPhoto).toHaveBeenCalledTimes(1)
  expect(getPlaceDetails).toHaveBeenCalledTimes(2) // once for itself, once for the next activity
})

test('clicking a different activity while one is expanded collapses the first and expands the second', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('British Museum'))
  await waitFor(() => expect(getActivityPhoto).toHaveBeenCalledWith('British Museum'))

  fireEvent.click(screen.getByText('Hyde Park'))
  await waitFor(() => expect(getActivityPhoto).toHaveBeenCalledWith('Hyde Park'))

  expect(getActivityPhoto).toHaveBeenCalledTimes(2)
})

test('the last activity of a day never looks up a "next" activity or walking distance', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('Hyde Park')) // last activity in the day

  await waitFor(() => expect(getActivityPhoto).toHaveBeenCalledWith('Hyde Park'))
  expect(getPlaceDetails).toHaveBeenCalledTimes(1) // only for itself, no "next"
  expect(getPlaceDetails).toHaveBeenCalledWith('Hyde Park', 'London')
  expect(getWalkingDistance).not.toHaveBeenCalled()
})

test('falls back to activity.lat/activity.lng for walking distance when a place lookup finds no match', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  getPlaceDetails.mockResolvedValue(null) // no match for either activity
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('British Museum'))

  await waitFor(() => expect(getWalkingDistance).toHaveBeenCalledWith(51.5194, -0.127, 51.5073, -0.1657))
})

test('omits the photo, website, and walking-distance sections when each comes back unavailable', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({ days: [TWO_ACTIVITIES_DAY] })
  getActivityPhoto.mockResolvedValue(null)
  getPlaceDetails.mockResolvedValue(null)
  getWalkingDistance.mockResolvedValue({ distance_m: null, duration_min: null })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByText('British Museum'))

  await waitFor(() => expect(getWalkingDistance).toHaveBeenCalled())
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /official website/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/min walk/i)).not.toBeInTheDocument()
})
