import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import MyTripsPage from './MyTripsPage'
import { getTrips, deleteTrip } from './tripsApi'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./tripsApi', () => ({
  getTrips: vi.fn(),
  deleteTrip: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

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

it('deletes a trip and removes it from the page', async () => {
  const user = userEvent.setup()

  window.confirm = vi.fn(() => true)

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Edinburgh Trip',
      start_date: '2026-08-01',
      end_date: '2026-08-04',
    },
  ])

  deleteTrip.mockResolvedValue({})

  render(
    <MemoryRouter>
      <MyTripsPage />
    </MemoryRouter>,
  )

  expect(
    await screen.findByText('Edinburgh Trip'),
  ).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', {
      name: /delete edinburgh trip/i,
    }),
  )

  expect(window.confirm).toHaveBeenCalled()
  expect(deleteTrip).toHaveBeenCalledWith(1)

  await waitFor(() => {
    expect(
      screen.queryByText('Edinburgh Trip'),
    ).not.toBeInTheDocument()
  })

  expect(getTrips).toHaveBeenCalledTimes(1)
})

it('does not delete when confirmation is cancelled', async () => {
  const user = userEvent.setup()

  window.confirm = vi.fn(() => false)

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Edinburgh Trip',
      start_date: '2026-08-01',
      end_date: '2026-08-04',
    },
  ])

  render(
    <MemoryRouter>
      <MyTripsPage />
    </MemoryRouter>,
  )

  expect(
    await screen.findByText('Edinburgh Trip'),
  ).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', {
      name: /delete edinburgh trip/i,
    }),
  )

  expect(deleteTrip).not.toHaveBeenCalled()
  expect(
    screen.getByText('Edinburgh Trip'),
  ).toBeInTheDocument()
})

it('keeps the trip visible when deletion fails', async () => {
  const user = userEvent.setup()

  window.confirm = vi.fn(() => true)

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Edinburgh Trip',
      start_date: '2026-08-01',
      end_date: '2026-08-04',
    },
  ])

  deleteTrip.mockRejectedValue(new Error('Delete failed'))

  render(
    <MemoryRouter>
      <MyTripsPage />
    </MemoryRouter>,
  )

  expect(
    await screen.findByText('Edinburgh Trip'),
  ).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', {
      name: /delete edinburgh trip/i,
    }),
  )

  await waitFor(() => {
    expect(deleteTrip).toHaveBeenCalledWith(1)
  })

  expect(
    screen.getByText('Edinburgh Trip'),
  ).toBeInTheDocument()
})