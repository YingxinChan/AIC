import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import MyTripsPage from './MyTripsPage'
import { getTrips } from './tripsApi'

vi.mock('./tripsApi', () => ({
  getTrips: vi.fn(),
}))

function renderPage() {
  return render(<MemoryRouter><MyTripsPage /></MemoryRouter>)
}

test('renders My Current Trips heading', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('heading', { name: /my current trips/i })).toBeInTheDocument()
})

test('renders a "New Trip" link to /trips/new', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('link', { name: /new trip/i })).toHaveAttribute('href', '/trips/new')
})

test('shows a loading state while trips are being fetched', () => {
  getTrips.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

test('shows an error message when fetching trips fails', async () => {
  getTrips.mockRejectedValue(new Error('network error'))
  renderPage()
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
})

test('shows a friendly empty state when the user has no trips', async () => {
  getTrips.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/no trips yet/i)).toBeInTheDocument()
})

test('renders every trip as a card with name, dates, status, and a link to its itinerary page', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'Summer Trip', destination: 'Tokyo', start_date: '2020-01-01', end_date: '2020-01-07' },
    { id: 2, name: 'Winter Trip', destination: 'Paris', start_date: '2099-01-01', end_date: '2099-01-07' },
  ])
  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()
  expect(screen.getByText('Winter Trip')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /summer trip/i })).toHaveAttribute('href', '/trips/1')
  expect(screen.getByRole('link', { name: /winter trip/i })).toHaveAttribute('href', '/trips/2')
  expect(screen.getAllByText(/view details/i).length).toBe(2)
  expect(screen.getByText(/completed/i)).toBeInTheDocument()
  expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
})
