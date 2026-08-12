// Test: npm test itinerarypage
// Risk model meta data

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
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
  getForecast.mockResolvedValue([
    {
      date: "2026-07-22",
      condition: "Rain Showers",

      temp_min: 15,
      temp_max: 22,

      sunrise: "05:10 AM",
      sunset: "09:15 PM",

      heavy_rain_probability: 20,
      heavy_rain_warning: false,

      flood_score: 10,
      flood_risk: "Low",
      flood_breakdown: [
        {
          factor: "Heavy Rain Probability",
          value: 20,
          unit: "%",
          impact: 10
        }
      ],

      beach_safety_score: 90,
      beach_safety_level: "Excellent",

      snow_probability: 0,
      snow_breakdown: [
        {
          factor: "Temperature",
          value: 18,
          unit: "°C",
          impact: 0
        },
        {
          factor: "Precipitation",
          value: 0,
          unit: "mm",
          impact: 0
        }
      ],

      temperature_level: "Safe",
      temperature_advice:
        "Temperature conditions are comfortable for outdoor activities.",

      temperature_breakdown: [
        {
          factor: "Feels Like Temperature",
          value: 18,
          unit: "°C",
          impact: 0
        }
      ],

      hiking_safety_score: 100,
      hiking_safety_level: "Safe",

      wind_speed: 10,
      wind_level: "Calm",

      uv_index: 4,
      uv_level: "Moderate",

      visibility_m: 10000,
    }
  ])

  getHourlyForecast.mockResolvedValue([
    {
      time: "2026-07-22T12:00",
      wind_speed: 10,
      uv_index: 4,
      visibility_m: 10000
    }
  ])
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

// The 9-card risk strip and the hourly forecast strip now sit behind the day
// header's "View full forecast" disclosure, collapsed by default (the activity
// timeline is the main pane's primary content; the condensed day header still
// always shows temp/condition and the day's single worst risk). Any assertion
// about the strips' own contents therefore has to open it first.
const expandForecast = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /view full forecast/i }))
}

const renderItineraryPage = () => {
  return render(
    <MemoryRouter initialEntries={["/trips/571"]}>
      <Routes>
        <Route
          path="/trips/:tripId"
          element={<ItineraryPage />}
        />
      </Routes>
    </MemoryRouter>
  )
}


test('renders itinerary sections', async () => {
  renderAt(1)

  // Map (and every other trip-dependent section) only renders once the
  // trip fetch resolves — see the trip-load loading/error state tests below.
  await waitFor(() => expect(screen.getAllByText(/map/i).length).toBeGreaterThan(0))
  await waitFor(() => expect(getItinerary).toHaveBeenCalledWith('1'))
  expect(await screen.findByText(/weather unavailable for this destination/i)).toBeInTheDocument()
})

test('shows a loading message while the trip is still being fetched', async () => {
  // A promise that never resolves during this test keeps the component in
  // its genuine loading state, instead of racing a real resolution.
  getTrip.mockReturnValue(new Promise(() => {}))
  renderAt(1)

  expect(await screen.findByText(/loading trip/i)).toBeInTheDocument()
})

test('shows an error message with a way back, instead of a blank page, when the trip fails to load', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  getTrip.mockRejectedValue(new Error('not found'))
  renderAt(1)

  expect(await screen.findByText(/couldn't load this trip/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /back to my trips/i })).toHaveAttribute('href', '/dashboard')
  // None of the {trip && ...}-gated sections should render either.
  expect(screen.queryByText(/loading trip/i)).not.toBeInTheDocument()
  // The previously-ungated 5D/Map sections must not render either — otherwise
  // this is a half-broken page (error banner + stale empty weather/map
  // content underneath), not the clean error state this PR is meant to give.
  expect(screen.queryByText(/weather unavailable/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /map/i })).not.toBeInTheDocument()

  consoleError.mockRestore()
})

test('an itinerary-fetch failure (same Promise.all as the trip fetch) also shows the trip-load error state', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  getItinerary.mockRejectedValue(new Error('server error'))
  renderAt(1)

  expect(await screen.findByText(/couldn't load this trip/i)).toBeInTheDocument()

  consoleError.mockRestore()
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
  expect(screen.getByText(/your day-by-day plan will appear here/i)).toBeInTheDocument()
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
  // "Day 1 · <date>" now appears in exactly two places by design: the sidebar
  // day-list row that selects it, and the main pane's own day header.
  expect(screen.getAllByText(/day 1.*2026-08-01/i)).toHaveLength(2)
  expect(screen.getByRole('button', { name: /regenerate itinerary/i })).toBeInTheDocument()
})

test('shows a day tab per generated day, and clicking a different day switches the shown activities', async () => {
  // Dates fixed safely in the future (not just "next week") — the default
  // selected day is "today if it's in this range, else start_date" (see
  // ItineraryPage's date-clamping effect), so a near-term range risks the
  // real wall-clock date silently drifting into it as this project goes on,
  // flipping which day/activity is selected by default out from under this
  // test with no code change involved.
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2099-01-01', end_date: '2099-01-02' })
  getItinerary.mockResolvedValue({
    days: [
      { date: '2099-01-01', activities: [
        { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
      ] },
      { date: '2099-01-02', activities: [
        { id: 2, name: 'Hyde Park', type: 'outdoor', time_slot: '10:00 - 12:00', location: 'West London', description: 'Walk.', is_swapped: false },
      ] },
    ],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  expect(screen.queryByText('Hyde Park')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /day 2.*2099-01-02/i }))

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
  // See the dates comment on the "shows a day tab per generated day" test
  // above — fixed safely in the future so the default-selected day/activity
  // can't silently flip as real time passes.
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2099-01-01', end_date: '2099-01-02' })
  getItinerary.mockResolvedValue({
    days: [
      { date: '2099-01-01', activities: [
        { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
      ] },
      { date: '2099-01-02', activities: [
        { id: 2, name: 'Hyde Park', type: 'outdoor', time_slot: '10:00 - 12:00', location: 'West London', description: 'Walk.', is_swapped: false },
      ] },
    ],
  })
  // geocodeCity resolves null by default (see mock above) -> weatherStatus becomes 'failed'
  renderAt(1)

  expect(await screen.findByText(/weather unavailable for this destination/i)).toBeInTheDocument()
  expect(await screen.findByText('British Museum')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /day 2.*2099-01-02/i }))
  expect(await screen.findByText('Hyde Park')).toBeInTheDocument()
})

test('shows a per-day placeholder when the itinerary has no activities for the selected day', async () => {
  // See the dates comment above — fixed safely in the future.
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2099-01-01', end_date: '2099-01-02' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2099-01-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /day 2.*2099-01-02/i }))

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
    wind_speed: 25,
    wind_level: 'Strong',
    uv_index: 9,
    uv_level: 'Very High',
    visibility_m: 500, // -> 'Poor' level, distinct from flood_risk's 'Moderate' and beach_safety_level's 'Good' used elsewhere in this test
    temperature_level: 'High Heat',
    temperature_advice: 'Limit intense outdoor activities, especially during midday.',
    hiking_safety_score: 72,
    hiking_safety_level: 'Caution',
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T09:00', temperature: 15, feels_like_temp: 13, rain_mm: 0, rain_probability: null, condition: 'Partly Cloudy' },
    { time: '2026-08-01T14:00', temperature: 20, feels_like_temp: 19, rain_mm: 2.4, rain_probability: 62, condition: 'Rain' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  // Temp/condition stay on the always-visible condensed day header line.
  expect(await screen.findByText('Partly Cloudy')).toBeInTheDocument()

  await expandForecast()

  expect(screen.getByText('65%')).toBeInTheDocument()
  expect(screen.getByText('Moderate')).toBeInTheDocument()
  expect(screen.getByText('Good')).toBeInTheDocument()
  expect(screen.getByText('62%')).toBeInTheDocument()
  // Wind, UV, and visibility shown beside the condition icon.
  expect(screen.getByText(/25 km\/h/)).toBeInTheDocument()
  expect(screen.getByText(/Strong/)).toBeInTheDocument()
  expect(screen.getByText('Very High')).toBeInTheDocument()
  expect(screen.getByText('0.5 km')).toBeInTheDocument()
  expect(screen.getByText('Poor')).toBeInTheDocument()

  // Extreme Temp shows the level + advice text directly, no %/pill.
  expect(screen.getByText('High Heat')).toBeInTheDocument()
  expect(screen.getByText('Limit intense outdoor activities, especially during midday.')).toBeInTheDocument()

  // Hiking Safety uses the standard score/level card like the other risks.
  expect(screen.getByText('72%')).toBeInTheDocument()
  expect(screen.getByText('Caution')).toBeInTheDocument()

  // Sunrise/sunset now lives in the condensed day-header row, not this
  // panel — when the backend doesn't provide it, it's silently omitted
  // there (a compact summary row isn't the place for an explanatory
  // fallback message) rather than crashing or showing blank/undefined.
  expect(screen.queryByText(/sunrise \/ sunset not available/i)).not.toBeInTheDocument()

  // Not a climatology day — the historical-average badge must not leak in.
  expect(
    screen.queryByText(/typical weather \(historical average\)/i),
  ).not.toBeInTheDocument()
})

test('renders dashes for null climatology values and never displays null%', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
  })

  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])

  getForecast.mockResolvedValueOnce([
    {
      date: '2026-08-01',
      is_climatology: true,
      temp_max: null,
      temp_min: null,
      condition: 'Typical conditions',
      heavy_rain_probability: null,
      heavy_rain_warning: false,
      flood_score: null,
      flood_risk: 'Unknown',
      beach_safety_score: null,
      beach_safety_level: 'Unknown',
      snow_probability: null,
    },
  ])

  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  expect(
    await screen.findByText(/typical weather \(historical average\)/i),
  ).toBeInTheDocument()

  await expandForecast()

  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  expect(screen.queryByText(/null%/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/null°/i)).not.toBeInTheDocument()
})

test('shows the Typical weather badge only for climatology data', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
  })

  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])

  getForecast.mockResolvedValueOnce([
    {
      date: '2026-08-01',
      is_climatology: true,
      temp_max: 21,
      temp_min: 13,
      condition: 'Partly Cloudy',
      heavy_rain_probability: 30,
      heavy_rain_warning: false,
      flood_score: 20,
      flood_risk: 'Low',
      beach_safety_score: 70,
      beach_safety_level: 'Good',
      snow_probability: 0,
    },
  ])

  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  expect(
    await screen.findByText(/typical weather \(historical average\)/i),
  ).toBeInTheDocument()
})

test('hourly strip highlights the current GMT hour with "Now"', async () => {
  // Fake only Date (not setTimeout/setInterval) — faking everything breaks
  // findByText's internal real-timer polling and can hang the whole file.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-01T14:30:00Z'))

  try {
    getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
    geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
    getForecast.mockResolvedValueOnce([{
      date: '2026-08-01',
      temp_max: 22,
      temp_min: 14,
      condition: 'Clear',
      heavy_rain_probability: 5,
      heavy_rain_warning: false,
      flood_score: 5,
      flood_risk: 'Low',
      beach_safety_score: 90,
      beach_safety_level: 'Excellent',
      snow_probability: 0,
      wind_speed: 5,
      wind_level: 'Calm',
      uv_index: 3,
      uv_level: 'Moderate',
      visibility_m: 15000,
    }])
    getHourlyForecast.mockResolvedValueOnce([
      { time: '2026-08-01T13:00', temperature: 18, rain_mm: 0, rain_probability: null, condition: 'Clear' },
      { time: '2026-08-01T14:00', temperature: 20, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    ])
    getItinerary.mockResolvedValue({ status: 'not_generated' })

    renderAt(1)
    await expandForecast()

    // The 14:00 GMT card (matching the fixed system time above) shows "Now"
    // instead of its formatted hour; the 13:00 card is unaffected.
    expect(await screen.findByText('Now')).toBeInTheDocument()
    expect(screen.getByText('1 PM')).toBeInTheDocument()
    expect(screen.queryByText('2 PM')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('inserts dedicated sunrise/sunset cards into the hourly forecast at their sorted position', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 3,
    uv_level: 'Moderate',
    visibility_m: 15000,
    sunrise: '06:34 AM',
    sunset: '07:00 PM',
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T06:00', temperature: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    { time: '2026-08-01T19:00', temperature: 21, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    { time: '2026-08-01T12:00', temperature: 22, rain_mm: 0, rain_probability: null, condition: 'Clear' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  // Dedicated cards at the exact sunrise/sunset time (leading zero dropped,
  // matching formatHour's "6 AM" style), inserted alongside the hour cards.
  expect(await screen.findByText('6:34 AM')).toBeInTheDocument()
  expect(screen.getByText('sunrise')).toBeInTheDocument()
  expect(screen.getByText('7:00 PM')).toBeInTheDocument()
  expect(screen.getByText('sunset')).toBeInTheDocument()

  // Still shows the normal hour cards unaffected.
  expect(screen.getByText('6 AM')).toBeInTheDocument()
  expect(screen.getByText('12 PM')).toBeInTheDocument()
  expect(screen.getByText('7 PM')).toBeInTheDocument()
})

// Regression test: the umbrella tip's trigger used to be /rain|storm/, which
// missed Drizzle entirely (none of "Light Drizzle"/"Drizzle"/"Heavy Drizzle"
// contain the substring "rain") and any Showers variant other than "Rain
// Showers" ("Heavy Showers"/"Violent Showers" don't contain "rain" either).
test.each(['Light Drizzle', 'Drizzle', 'Heavy Drizzle', 'Heavy Showers', 'Violent Showers'])(
  'shows the umbrella tip for condition "%s", not just literal "Rain"/"Storm" text',
  async (condition) => {
    getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
    geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
    getForecast.mockResolvedValueOnce([{
      date: '2026-08-01',
      temp_max: 18,
      temp_min: 12,
      condition,
      heavy_rain_probability: 40,
      heavy_rain_warning: false,
      flood_score: 10,
      flood_risk: 'Low',
      beach_safety_score: 60,
      beach_safety_level: 'Good',
      snow_probability: 0,
      wind_speed: 10,
      wind_level: 'Breezy',
      uv_index: 2,
      uv_level: 'Low',
      visibility_m: 8000,
      sunrise: '06:00 AM',
      sunset: '08:00 PM',
    }])
    getItinerary.mockResolvedValue({ status: 'not_generated' })

    renderAt(1)

    expect(await screen.findByText(/bring an umbrella today/i)).toBeInTheDocument()
  }
)

test('does not show the umbrella tip for a dry condition like Clear', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 3,
    uv_level: 'Moderate',
    visibility_m: 15000,
    sunrise: '06:34 AM',
    sunset: '07:00 PM',
  }])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  await screen.findByText('Clear')
  expect(screen.queryByText(/bring an umbrella today/i)).not.toBeInTheDocument()
})

test('shows the "feels like" temperature in grey next to the actual temp, for today only', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-01T14:30:00Z'))

  try {
    getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
    geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
    getForecast.mockResolvedValueOnce([{
      date: '2026-08-01',
      temp_max: 22,
      temp_min: 14,
      condition: 'Clear',
      heavy_rain_probability: 5,
      heavy_rain_warning: false,
      flood_score: 5,
      flood_risk: 'Low',
      beach_safety_score: 90,
      beach_safety_level: 'Excellent',
      snow_probability: 0,
      wind_speed: 5,
      wind_level: 'Calm',
      uv_index: 3,
      uv_level: 'Moderate',
      visibility_m: 15000,
    }])
    getHourlyForecast.mockResolvedValueOnce([
      { time: '2026-08-01T14:00', temperature: 20, feels_like_temp: 17, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    ])
    getItinerary.mockResolvedValue({ status: 'not_generated' })

    renderAt(1)
    await expandForecast()

    // "20°" appears twice by design — once as the big header number, once on
    // the hourly strip's "Now" card, since both read the same current-hour
    // entry. "17°" (feels-like) is unique, since the hourly strip doesn't
    // show a feels-like value at all.
    expect(await screen.findAllByText('20°')).toHaveLength(2)
    expect(screen.getByText('Feels like 17°')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
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
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 2,
    uv_level: 'Low',
    visibility_m: 500, // -> 'Poor', kept distinct from beach_safety_level's 'Good' used in this test
    temperature_level: 'Safe',
    temperature_advice: 'Temperature conditions are comfortable for outdoor activities.',
    hiking_safety_score: 35,
    hiking_safety_level: 'Unsafe', // -> red
  }])
  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  // findAllByText (not findByText) for 'High' — more than one risk card can
  // legitimately show a 'High' badge for the same fixture, so this asserts
  // every match is correctly red rather than assuming exactly one exists.
  const highBadges = await screen.findAllByText('High')
  highBadges.forEach((badge) => expect(badge).toHaveClass('bg-red-100'))
  expect(screen.getByText('Moderate')).toHaveClass('bg-yellow-100')
  expect(screen.getByText('Good')).toHaveClass('bg-green-100')
  expect(screen.getByText('None')).toHaveClass('bg-green-100')
  expect(screen.getByText('Unsafe')).toHaveClass('bg-red-100')
})

test('heavy rain "Low" (no warning) renders green, not yellow', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false, // -> 'Low' -> should be green, not yellow
    flood_score: 10,
    flood_risk: 'Low',
    beach_safety_score: 95,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 2,
    uv_level: 'Low',
    visibility_m: 12000,
  }])
  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  const lowBadges = await screen.findAllByText('Low')
  lowBadges.forEach((badge) => {
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).not.toHaveClass('bg-yellow-100')
  })
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
    wind_speed: 5, wind_level: 'Calm', uv_index: 2, uv_level: 'Low', visibility_m: 10000,
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

test('clicking Regenerate Itinerary on an existing plan asks for confirmation instead of regenerating immediately', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /regenerate itinerary/i }))

  expect(await screen.findByRole('heading', { name: /regenerate this itinerary/i })).toBeInTheDocument()
  expect(generateItinerary).not.toHaveBeenCalled()
})

test('confirming the regenerate warning actually regenerates and closes the confirmation', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  generateItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /regenerate itinerary/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^regenerate$/i }))

  await waitFor(() => expect(generateItinerary).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('heading', { name: /regenerate this itinerary/i })).not.toBeInTheDocument()
})

test('cancelling the regenerate warning leaves the existing itinerary untouched', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /regenerate itinerary/i }))
  fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

  expect(screen.queryByRole('heading', { name: /regenerate this itinerary/i })).not.toBeInTheDocument()
  expect(generateItinerary).not.toHaveBeenCalled()
  expect(screen.getByText('British Museum')).toBeInTheDocument()
})

test('the first-ever Generate (no existing itinerary) skips the confirmation, since there is nothing to lose yet', async () => {
  generateItinerary.mockResolvedValue({ days: [] })
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /^generate itinerary$/i }))

  expect(screen.queryByRole('heading', { name: /regenerate this itinerary/i })).not.toBeInTheDocument()
  await waitFor(() => expect(generateItinerary).toHaveBeenCalledTimes(1))
})

test('Add Activity is disabled while a regenerate is in flight, so a new activity can\'t be silently wiped out by it', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'Great Russell St', description: 'x', is_swapped: false },
    ] }],
  })
  let resolveGenerate
  generateItinerary.mockReturnValue(new Promise((resolve) => { resolveGenerate = resolve }))
  renderAt(1)

  fireEvent.click(await screen.findByRole('button', { name: /regenerate itinerary/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^regenerate$/i }))

  expect(await screen.findByRole('button', { name: /add activity/i })).toBeDisabled()
  resolveGenerate({ days: [] })
  await waitFor(() => expect(screen.getByRole('button', { name: /add activity/i })).not.toBeDisabled())
})

test('a regenerate started on one trip does not overwrite a different trip navigated to before it resolves', async () => {
  getTrip.mockImplementation((id) =>
    Promise.resolve(id === '1' ? { destination: 'London' } : { destination: 'Tokyo' })
  )
  getItinerary.mockImplementation((id) =>
    Promise.resolve(
      id === '1'
        ? { days: [{ date: '2026-08-01', activities: [
            { id: 1, name: 'British Museum', type: 'indoor', time_slot: '09:00 - 11:00', location: 'x', description: 'x', is_swapped: false },
          ] }] }
        : { status: 'not_generated' }
    )
  )
  let resolveGenerate
  generateItinerary.mockReturnValue(new Promise((resolve) => { resolveGenerate = resolve }))

  function Harness() {
    const navigate = useNavigate()
    return (
      <>
        <button onClick={() => navigate('/trips/2')}>go to trip 2</button>
        <Routes>
          <Route path="/trips/:tripId" element={<ItineraryPage />} />
        </Routes>
      </>
    )
  }

  render(
    <MemoryRouter initialEntries={['/trips/1']}>
      <Harness />
    </MemoryRouter>
  )

  fireEvent.click(await screen.findByRole('button', { name: /regenerate itinerary/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^regenerate$/i }))
  await waitFor(() => expect(generateItinerary).toHaveBeenCalledWith('1'))

  fireEvent.click(screen.getByRole('button', { name: /go to trip 2/i }))
  await waitFor(() => expect(getItinerary).toHaveBeenCalledWith('2'))
  expect(await screen.findByText('Tokyo Trip')).toBeInTheDocument()

  // Trip 1's regenerate resolves only after we've already navigated to trip 2.
  resolveGenerate({ days: [{ date: '2026-08-02', activities: [
    { id: 99, name: 'Stale London Activity', type: 'indoor', time_slot: '09:00 - 11:00', location: 'x', description: 'x', is_swapped: false },
  ] }] })

  // The stale response must not get applied — the "generating" flag still
  // clears (so the button doesn't stay stuck disabled forever), but the
  // regenerated data it carried is for a trip that's no longer on screen.
  await waitFor(() => expect(screen.getByRole('button', { name: /regenerate itinerary/i })).not.toBeDisabled())
  expect(screen.queryByText('Stale London Activity')).not.toBeInTheDocument()
})

test('clicking the UV card opens its hourly-trend popup with the sparkline and the daily advice sentence', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 8,
    uv_level: 'Very High',
    uv_advice: 'High UV. Wear sunscreen and sunglasses until 5:00 PM.',
    visibility_m: 15000,
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T06:00', temperature: 15, uv_index: 2, wind_speed: 5, visibility_km: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    { time: '2026-08-01T12:00', temperature: 20, uv_index: 8, wind_speed: 6, visibility_km: 14, rain_mm: 0, rain_probability: null, condition: 'Clear' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  fireEvent.click(await screen.findByRole('button', { name: /uv index/i }))

  expect(screen.getByRole('heading', { name: /uv index.*hourly trend/i })).toBeInTheDocument()
  expect(screen.getByText('High UV. Wear sunscreen and sunglasses until 5:00 PM.')).toBeInTheDocument()
  // "6 AM"/"12 PM" are the popup's own canonical-clock-time axis labels
  // (matched to whichever hourly entries land on those hours) — also appear
  // on the underlying hourly strip's own per-hour cards, hence getAllByText.
  expect(screen.getAllByText('6 AM').length).toBeGreaterThan(0)
  expect(screen.getAllByText('12 PM').length).toBeGreaterThan(0)

  // UV uses the WHO severity bands as y-axis labels (Low/Moderate/High/Very
  // High/Extreme), not bare numbers — and always shows the full scale up to
  // Extreme, not just whatever the day's actual max happens to be. "Low" and
  // "Very High" also appear as risk-card level badges elsewhere on the page
  // (Flood/Heavy Rain and the UV card itself), hence getAllByText.
  expect(screen.getAllByText('Low').length).toBeGreaterThan(0)
  expect(screen.getByText('Moderate')).toBeInTheDocument()
  expect(screen.getByText('High')).toBeInTheDocument()
  expect(screen.getAllByText('Very High').length).toBeGreaterThan(0)
  expect(screen.getByText('Extreme')).toBeInTheDocument()

  // The line uses a severity-graded gradient (url(#...)), not one flat
  // color like Wind/Visibility — and its gradient stops include the actual
  // severity colors (green for the 6 AM=2/Low reading, red for 12 PM=8/Very
  // High) so the curve itself visually shows the risk level, not just the
  // axis.
  const linePath = document.querySelector('svg.cursor-crosshair path[stroke^="url(#"]')
  expect(linePath).toBeInTheDocument()
  expect(document.querySelector('stop[stop-color="#22c55e"]')).toBeInTheDocument()
  expect(document.querySelector('stop[stop-color="#ef4444"]')).toBeInTheDocument()
})

test('clicking the Wind card opens its popup without an advice sentence, since the backend has none for wind', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 2,
    uv_level: 'Low',
    visibility_m: 15000,
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T09:00', temperature: 15, uv_index: 2, wind_speed: 5, visibility_km: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  fireEvent.click(await screen.findByRole('button', { name: /^wind\b/i }))

  expect(screen.getByRole('heading', { name: /wind.*hourly trend/i })).toBeInTheDocument()
  expect(screen.queryByText(/sunscreen|sunglasses/i)).not.toBeInTheDocument()
  // Unit shown once, on the top axis tick — a data max of 5 rounds up to a
  // nice axis top of 6.
  expect(screen.getByText('6 km/h')).toBeInTheDocument()
  // Each metric's chart line has its own distinct color, not a shared one.
  expect(document.querySelector('svg.cursor-crosshair path[stroke="#0ea5e9"]')).toBeInTheDocument()
})

test('clicking the Visibility card opens its popup with the visibility line color, distinct from Wind/UV', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 2,
    uv_level: 'Low',
    visibility_m: 15000,
  }])
  getHourlyForecast.mockResolvedValueOnce([
    { time: '2026-08-01T09:00', temperature: 15, uv_index: 2, wind_speed: 5, visibility_km: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
  ])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  fireEvent.click(await screen.findByRole('button', { name: /^visibility\b/i }))

  expect(screen.getByRole('heading', { name: /visibility.*hourly trend/i })).toBeInTheDocument()
  expect(document.querySelector('svg.cursor-crosshair path[stroke="#64748b"]')).toBeInTheDocument()
})

test('the popup marks the current hour as "Now" when viewing today\'s data', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-01T14:30:00Z'))

  try {
    getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
    geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
    getForecast.mockResolvedValueOnce([{
      date: '2026-08-01',
      temp_max: 22,
      temp_min: 14,
      condition: 'Clear',
      heavy_rain_probability: 5,
      heavy_rain_warning: false,
      flood_score: 5,
      flood_risk: 'Low',
      beach_safety_score: 90,
      beach_safety_level: 'Excellent',
      snow_probability: 0,
      wind_speed: 5,
      wind_level: 'Calm',
      uv_index: 2,
      uv_level: 'Low',
      visibility_m: 15000,
    }])
    getHourlyForecast.mockResolvedValueOnce([
      { time: '2026-08-01T13:00', temperature: 15, uv_index: 2, wind_speed: 5, visibility_km: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
      { time: '2026-08-01T14:00', temperature: 20, uv_index: 6, wind_speed: 8, visibility_km: 14, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    ])
    getItinerary.mockResolvedValue({ status: 'not_generated' })

    renderAt(1)
    await expandForecast()

    fireEvent.click(await screen.findByRole('button', { name: /^wind\b/i }))

    // 14:00 matches the fixed system time above, so the popup should mark
    // it "Now" with its own wind_speed (8), not the 13:00 entry's (5).
    expect(await screen.findByText('Now · 8 km/h')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('moving the pointer over the popup chart follows it and shows that point\'s time and value', async () => {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, width: 280, height: 96, right: 280, bottom: 96, x: 0, y: 0, toJSON: () => {},
  }))

  try {
    getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
    geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
    getForecast.mockResolvedValueOnce([{
      date: '2026-08-01',
      temp_max: 22,
      temp_min: 14,
      condition: 'Clear',
      heavy_rain_probability: 5,
      heavy_rain_warning: false,
      flood_score: 5,
      flood_risk: 'Low',
      beach_safety_score: 90,
      beach_safety_level: 'Excellent',
      snow_probability: 0,
      wind_speed: 5,
      wind_level: 'Calm',
      uv_index: 2,
      uv_level: 'Low',
      visibility_m: 15000,
    }])
    getHourlyForecast.mockResolvedValueOnce([
      { time: '2026-08-01T06:00', temperature: 15, uv_index: 2, wind_speed: 3, visibility_km: 15, rain_mm: 0, rain_probability: null, condition: 'Clear' },
      { time: '2026-08-01T18:00', temperature: 20, uv_index: 1, wind_speed: 9, visibility_km: 14, rain_mm: 0, rain_probability: null, condition: 'Clear' },
    ])
    getItinerary.mockResolvedValue({ status: 'not_generated' })

    renderAt(1)
    await expandForecast()

    fireEvent.click(await screen.findByRole('button', { name: /^wind\b/i }))
    await screen.findByRole('heading', { name: /wind.*hourly trend/i })

    const chart = document.querySelector('svg.cursor-crosshair')
    // Right edge of the chart is nearest the second (18:00) data point.
    fireEvent.mouseMove(chart, { clientX: 275 })

    expect(await screen.findByText('6 PM · 9 km/h')).toBeInTheDocument()
  } finally {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  }
})

test('risk cards (e.g. Heavy Rain) are not clickable — no popup opens', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])
  getForecast.mockResolvedValueOnce([{
    date: '2026-08-01',
    temp_max: 22,
    temp_min: 14,
    condition: 'Clear',
    heavy_rain_probability: 5,
    heavy_rain_warning: false,
    flood_score: 5,
    flood_risk: 'Low',
    beach_safety_score: 90,
    beach_safety_level: 'Excellent',
    snow_probability: 0,
    wind_speed: 5,
    wind_level: 'Calm',
    uv_index: 2,
    uv_level: 'Low',
    visibility_m: 15000,
  }])
  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)
  await expandForecast()

  // findAllByText (not findByText) — "Heavy Rain" can legitimately appear
  // more than once on the page (e.g. the risk card plus its detail modal).
  await screen.findAllByText(/heavy rain/i)
  expect(screen.queryByRole('button', { name: /heavy rain/i })).not.toBeInTheDocument()
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

test('hides the hourly strip for climatology even when hourly data exists', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
  })

  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])

  getForecast.mockResolvedValueOnce([
    {
      date: '2026-08-01',
      is_climatology: true,
      temp_max: 21,
      temp_min: 13,
      condition: 'Typical conditions',
      heavy_rain_probability: 30,
      heavy_rain_warning: false,
      flood_score: 20,
      flood_risk: 'Low',
      beach_safety_score: 70,
      beach_safety_level: 'Good',
      snow_probability: 0,
    },
  ])

  getHourlyForecast.mockResolvedValueOnce([
    {
      time: '2026-08-01T09:00',
      temperature: 15,
      rain_mm: 0,
      rain_probability: 97,
      condition: 'Hourly Test Weather',
    },
    {
      time: '2026-08-01T14:00',
      temperature: 20,
      rain_mm: 2,
      rain_probability: 98,
      condition: 'Hourly Test Rain',
    },
  ])

  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  expect(
    await screen.findByText(/typical weather \(historical average\)/i),
  ).toBeInTheDocument()

  await expandForecast()

  expect(screen.queryByText('97%')).not.toBeInTheDocument()
  expect(screen.queryByText('98%')).not.toBeInTheDocument()
  expect(screen.queryByText('Hourly Test Weather')).not.toBeInTheDocument()
  expect(screen.queryByText('Hourly Test Rain')).not.toBeInTheDocument()
})

test('uses neutral gray styling for an Unknown beach safety level', async () => {
  getTrip.mockResolvedValue({
    destination: 'London',
    start_date: '2026-08-01',
    end_date: '2026-08-01',
  })

  geocodeCity.mockResolvedValueOnce([51.5074, -0.1278])

  getForecast.mockResolvedValueOnce([
    {
      date: '2026-08-01',
      is_climatology: true,
      temp_max: 21,
      temp_min: 13,
      condition: 'Typical conditions',
      heavy_rain_probability: 30,
      heavy_rain_warning: false,
      flood_score: 20,
      flood_risk: 'Low',
      beach_safety_score: null,
      beach_safety_level: 'Unknown',
      snow_probability: 0,
    },
  ])

  getHourlyForecast.mockResolvedValueOnce([])
  getItinerary.mockResolvedValue({ status: 'not_generated' })

  renderAt(1)

  await screen.findByText(/typical weather \(historical average\)/i)

  await expandForecast()

  const unknownBadges = screen.getAllByText('Unknown')
  const unknownBadge = unknownBadges.find((element) =>
  /gray|slate|neutral/.test(element.className),
  )

  expect(unknownBadge).toBeDefined()

  expect(unknownBadge.className).toMatch(/gray|slate|neutral/)
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

test('shows the swapped activity\'s real type badge, not hardcoded "indoor"', async () => {
  // Regression test: the badge used to hardcode 'indoor' for any swapped
  // activity regardless of what it was actually swapped to (backend now
  // updates `type` to the alternate's real value on swap — see
  // swap_service.apply_swap). A wind/fog/heat/etc. swap can legitimately
  // pick a different outdoor activity instead of forcing indoor, so this
  // must show 'outdoor' in that case, not 'indoor'.
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      mockGeneratedActivity({
        id: 1, name: 'Thames Boat Cruise', type: 'outdoor', is_swapped: true,
        alternate_name: 'Regent\'s Park Walk', alternate_location: 'Regent\'s Park',
        swap_reason: 'Strong winds expected',
      }),
    ] }],
  })
  renderAt(1)

  await screen.findByText('Thames Boat Cruise')
  expect(screen.getByText('outdoor')).toBeInTheDocument()
  expect(screen.queryByText('indoor')).not.toBeInTheDocument()
})

test('shows "indoor" on a swapped activity that really was swapped indoors', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [
      mockGeneratedActivity({
        id: 1, name: 'Hyde Park Walk', type: 'indoor', is_swapped: true,
        alternate_name: 'British Museum', alternate_location: 'Great Russell St',
        swap_reason: 'Heavy rain expected (80.0% chance)',
      }),
    ] }],
  })
  renderAt(1)

  await screen.findByText('Hyde Park Walk')
  expect(screen.getByText('indoor')).toBeInTheDocument()
})

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
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  deleteActivity.mockResolvedValue({ status: 'not_generated' })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))

  expect(await screen.findByRole('heading', { name: /remove this activity/i })).toBeInTheDocument()
  expect(deleteActivity).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))

  await waitFor(() => expect(deleteActivity).toHaveBeenCalledWith('1', 1))
  expect(await screen.findByText(/no activities generated for this day yet/i)).toBeInTheDocument()
})

test('declining the delete confirmation does not call deleteActivity', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))
  fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

  expect(screen.queryByRole('heading', { name: /remove this activity/i })).not.toBeInTheDocument()
  expect(deleteActivity).not.toHaveBeenCalled()
  expect(screen.getByText('British Museum')).toBeInTheDocument()
})

test('a rejected delete shows a removal-failed message instead of crashing', async () => {
  getTrip.mockResolvedValue({ destination: 'London', start_date: '2026-08-01', end_date: '2026-08-01' })
  getItinerary.mockResolvedValue({
    days: [{ date: '2026-08-01', activities: [mockGeneratedActivity()] }],
  })
  deleteActivity.mockRejectedValue(new Error('server error'))
  renderAt(1)

  await screen.findByText('British Museum')
  fireEvent.click(screen.getByRole('button', { name: /delete british museum/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^remove$/i }))

  expect(await screen.findByText(/removing this activity failed/i)).toBeInTheDocument()
})

// test for weather info click
it("opens flood risk calculation modal", async () => {
  geocodeCity.mockResolvedValue([
    "51.5074",
    "-0.1278"
  ])

  getTrip.mockResolvedValue({
    destination: "London",
    start_date: "2026-07-22",
    end_date: "2026-07-22"
  })

  renderItineraryPage()
  await expandForecast()
  const card = await screen.findByText("Flood")
  await userEvent.click(card)
  expect(
    screen.getByText("Flood")
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Heavy Rain Probability/)
  ).toBeInTheDocument()
})

it("opens snow probability calculation modal", async () => {
  geocodeCity.mockResolvedValue([
    "51.5074",
    "-0.1278"
  ])

  getTrip.mockResolvedValue({
    destination: "London",
    start_date: "2026-07-22",
    end_date: "2026-07-22"
  })

  renderItineraryPage()
  await expandForecast()
  const card = await screen.findByText(/Snow/i)
  await userEvent.click(card)
  expect(
    screen.getByText("Snow Probability Calculation")
  ).toBeInTheDocument()
  expect(
    screen.getByText("Temperature")
  ).toBeInTheDocument()
  expect(
    screen.getByText("Precipitation")
  ).toBeInTheDocument()
})

it("opens wind hourly trend modal", async () => {
  geocodeCity.mockResolvedValue([
    "51.5074",
    "-0.1278"
  ])
  getTrip.mockResolvedValue({
    destination: "London",
    start_date: "2026-07-22",
    end_date: "2026-07-22"
  })

  renderItineraryPage()
  await expandForecast()
  const card = await screen.findByText(/Wind/i)
  await userEvent.click(card)
  expect(
    screen.getByText("Wind — Hourly Trend")
  ).toBeInTheDocument()
})

it("shows weather unavailable when forecast fails", async () => {
  getForecast.mockRejectedValueOnce(
    new Error("Weather failed")
  )
  renderItineraryPage()
  expect(
    await screen.findByText(
      "Weather unavailable for this destination."
    )
  ).toBeInTheDocument()
})