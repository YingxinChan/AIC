import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import DashboardPage from './DashboardPage'
import { getTrips } from './tripsApi'
import { geocodeCity } from '../../lib/geocode'
import { getForecast } from '../weather/weatherApi'

vi.mock('./tripsApi', () => ({
  getTrips: vi.fn(),
}))

// The forecast-at-a-glance module geocodes the upcoming trip's destination
// and fetches its forecast — mocked here so these tests never hit the real
// Nominatim/backend network, matching how tripsApi is mocked above.
vi.mock('../../lib/geocode', () => ({
  geocodeCity: vi.fn(),
}))

vi.mock('../weather/weatherApi', () => ({
  getForecast: vi.fn(),
}))

beforeEach(() => {
  geocodeCity.mockResolvedValue(null)
  getForecast.mockResolvedValue([])
})

function renderPage() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

test('renders a Welcome back heading (Home page, not the My Trips page)', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
})

// Regression test: the hero used to default to the generic "Plan a Trip"
// copy while trips were still loading, then flash to the personalized
// upcoming-trip hero a moment later once loading resolved. Neither hero
// variant should commit until we actually know whether an upcoming trip
// exists — the loading state should show a neutral placeholder instead.
test('does not show either hero variant while trips are still loading', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.queryByRole('link', { name: /plan a trip/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /view trip/i })).not.toBeInTheDocument()
})

test('renders a "Plan a Trip" link to /trips/new once loaded with no trips', async () => {
  getTrips.mockResolvedValue([])
  renderPage()
  expect(await screen.findByRole('link', { name: /plan a trip/i })).toHaveAttribute('href', '/trips/new')
})

test('shows real stats derived from actual trips: count and distinct destinations, no fake data', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'A', destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-07' },
    { id: 2, name: 'B', destination: 'Tokyo', start_date: '2026-09-01', end_date: '2026-09-07' },
    { id: 3, name: 'C', destination: 'Paris', start_date: '2026-10-01', end_date: '2026-10-07' },
  ])
  renderPage()

  await screen.findByText('3')
  expect(screen.getByText(/trips planned/i)).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText(/destinations/i)).toBeInTheDocument()

  expect(screen.queryByText(/countries visited/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/cities explored/i)).not.toBeInTheDocument()
})

test('shows a condensed Recent Trips preview (not the full list) with a View all link to /trips', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'A', destination: 'Tokyo', start_date: '2026-08-01', end_date: '2026-08-07' },
    { id: 2, name: 'B', destination: 'Tokyo', start_date: '2026-09-01', end_date: '2026-09-07' },
    { id: 3, name: 'C', destination: 'Paris', start_date: '2026-10-01', end_date: '2026-10-07' },
    { id: 4, name: 'D', destination: 'Rome', start_date: '2026-11-01', end_date: '2026-11-07' },
    { id: 5, name: 'E', destination: 'Oslo', start_date: '2026-12-01', end_date: '2026-12-07' },
  ])
  renderPage()

  await screen.findByText('A')
  expect(screen.getByText('B')).toBeInTheDocument()
  expect(screen.getByText('C')).toBeInTheDocument()
  expect(screen.getByText('D')).toBeInTheDocument()
  expect(screen.queryByText('E')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/trips')
})

test('shows a friendly empty state when the user has no trips, with no View all link', async () => {
  getTrips.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /view all/i })).not.toBeInTheDocument()
})

test('shows an error message when fetching trips fails', async () => {
  getTrips.mockRejectedValue(new Error('network error'))
  renderPage()
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
})

// Regression test: the Recent Trips cards here were left on the flat
// gradient placeholder when the destination-photo background was added to
// MyTripsPage/ItineraryPage — this card renders from the same shared
// destinationImages.js map, so it should get the same treatment.
test('shows a destination photo background on Recent Trips cards, case-insensitively, falling back to the gradient for an unmapped city', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'A', destination: 'paris', start_date: '2026-08-01', end_date: '2026-08-07' },
    { id: 2, name: 'B', destination: 'Nowhereville', start_date: '2026-09-01', end_date: '2026-09-07' },
  ])
  renderPage()

  const parisCard = (await screen.findByText('A')).closest('a')
  const parisPhoto = parisCard.querySelector('div')
  expect(parisPhoto.style.backgroundImage).toContain('/images/destinations/paris.jpg')

  const unmappedCard = screen.getByText('B').closest('a')
  const unmappedPhoto = unmappedCard.querySelector('div')
  expect(unmappedPhoto.style.backgroundImage).toBe('')
  expect(unmappedPhoto.className).toContain('from-brand-400')
})

// Hero swap: when every trip is in the past, there's no "upcoming trip" to
// promote into the hero, so it should fall back to the same generic
// acquisition copy as the zero-trips case rather than showing stale info.
test('falls back to the generic "Plan a Trip" hero when all trips are in the past', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'Old Trip', destination: 'Tokyo', start_date: '2020-01-01', end_date: '2020-01-07' },
  ])
  renderPage()

  await screen.findByText('Old Trip')
  expect(screen.getByRole('link', { name: /plan a trip/i })).toHaveAttribute('href', '/trips/new')
  expect(screen.queryByRole('link', { name: /view trip/i })).not.toBeInTheDocument()
})

// Hero swap: a real upcoming trip should replace the generic copy with that
// trip's own destination/dates and a "View Trip" CTA into its itinerary.
test('swaps the hero to the soonest upcoming trip, with a View Trip link to its itinerary', async () => {
  getTrips.mockResolvedValue([
    { id: 5, name: 'Later', destination: 'Paris', start_date: '2099-01-01', end_date: '2099-01-07' },
    { id: 6, name: 'Sooner', destination: 'Rome', start_date: '2098-01-01', end_date: '2098-01-07' },
  ])
  renderPage()

  const viewTripLink = await screen.findByRole('link', { name: /view trip/i })
  expect(viewTripLink).toHaveAttribute('href', '/trips/6')
  expect(screen.queryByRole('link', { name: /^plan a trip/i })).not.toBeInTheDocument()
})

// Hero swap: a trip you're currently on (started in the past, hasn't ended)
// beats a merely-future one — you're literally traveling on it right now.
// Also covers the "current" vs "next adventure" wording split.
test('features an ongoing trip over a later upcoming one, with "current trip" wording', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  getTrips.mockResolvedValue([
    { id: 7, name: 'Later', destination: 'Paris', start_date: '2099-01-01', end_date: '2099-01-07' },
    { id: 8, name: 'Right Now', destination: 'Rome', start_date: yesterday, end_date: '2099-01-01' },
  ])
  renderPage()

  const viewTripLink = await screen.findByRole('link', { name: /view trip/i })
  expect(viewTripLink).toHaveAttribute('href', '/trips/8')
  expect(screen.getByText('Your current trip')).toBeInTheDocument()
  expect(screen.queryByText('Your next adventure')).not.toBeInTheDocument()
})

// Forecast-at-a-glance module: only appears for a real upcoming trip, reuses
// geocodeCity/getForecast (mocked above) the same way ItineraryPage does, and
// links through to that trip's itinerary.
test('shows a forecast-at-a-glance module for the upcoming trip, linking to its itinerary', async () => {
  getTrips.mockResolvedValue([
    { id: 9, name: 'Next Up', destination: 'Rome', start_date: '2099-01-01', end_date: '2099-01-05' },
  ])
  geocodeCity.mockResolvedValue([41.9, 12.5])
  getForecast.mockResolvedValue([
    { date: '2099-01-01', condition: 'Clear', temp_max: 20, temp_min: 10 },
    { date: '2099-01-02', condition: 'Overcast', temp_max: 18, temp_min: 9 },
  ])
  renderPage()

  expect(await screen.findByText(/forecast at a glance/i)).toBeInTheDocument()
  const glanceLink = screen.getByText(/forecast at a glance/i).closest('a')
  expect(glanceLink).toHaveAttribute('href', '/trips/9')
  expect(await screen.findByText(/until departure/i)).toBeInTheDocument()
})

// Forecast-at-a-glance module: a geocode/forecast failure shouldn't crash the
// page or block the rest of the Dashboard from rendering — just a quiet
// fallback inside the module itself.
test('shows a graceful fallback in the forecast module when the weather fetch fails', async () => {
  getTrips.mockResolvedValue([
    { id: 9, name: 'Next Up', destination: 'Rome', start_date: '2099-01-01', end_date: '2099-01-05' },
  ])
  geocodeCity.mockResolvedValue(null)
  renderPage()

  expect(await screen.findByText(/isn't available right now/i)).toBeInTheDocument()
  // The rest of the page still renders fine despite the weather failure.
  expect(screen.getByText('Next Up')).toBeInTheDocument()
})
