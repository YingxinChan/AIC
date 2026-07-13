import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import DashboardPage from './DashboardPage'
import { getTrips } from './tripsApi'

vi.mock('./tripsApi', () => ({
  getTrips: vi.fn(),
}))

function renderPage() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

test('renders a Welcome back heading (Home page, not the My Trips page)', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
})

test('renders a "Plan a Trip" link to /trips/new', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('link', { name: /plan a trip/i })).toHaveAttribute('href', '/trips/new')
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
  ])
  renderPage()

  await screen.findByText('A')
  expect(screen.getByText('B')).toBeInTheDocument()
  expect(screen.queryByText('C')).not.toBeInTheDocument()
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
