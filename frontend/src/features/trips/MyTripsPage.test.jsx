import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import MyTripsPage from './MyTripsPage'
import { getTrips, deleteTrip } from './tripsApi'

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

test('shows a destination photo background on trip cards, case-insensitively, falling back to the gradient for an unmapped city', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'A', destination: 'paris', start_date: '2026-08-01', end_date: '2026-08-07' },
    { id: 2, name: 'B', destination: 'Nowhereville', start_date: '2026-09-01', end_date: '2026-09-07' },
  ])
  renderPage()

  const parisCard = (await screen.findByText('A')).closest('a')
  const parisPhoto = parisCard.querySelectorAll('div')[1]
  expect(parisPhoto.style.backgroundImage).toContain('/images/destinations/paris.jpg')

  const unmappedCard = screen.getByText('B').closest('a')
  const unmappedPhoto = unmappedCard.querySelectorAll('div')[1]
  expect(unmappedPhoto.style.backgroundImage).toBe('')
  expect(unmappedPhoto.className).toContain('from-brand-400')
})

test('renders every trip as a card with name, dates, status, and a link to its itinerary page', async () => {
  getTrips.mockResolvedValue([
    { id: 1, name: 'Summer Trip', destination: 'Tokyo', start_date: '2020-01-01', end_date: '2020-01-07' },
    { id: 2, name: 'Winter Trip', destination: 'Paris', start_date: '2099-01-01', end_date: '2099-01-07' },
  ])
  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()
  expect(screen.getByText('Winter Trip')).toBeInTheDocument()
  const summerCard = screen.getByRole('link', { name: /summer trip/i })
  const winterCard = screen.getByRole('link', { name: /winter trip/i })
  expect(summerCard).toHaveAttribute('href', '/trips/1')
  expect(winterCard).toHaveAttribute('href', '/trips/2')
  // Scoped to each card specifically — the status filter chips (now shown
  // regardless of trip count) also render "Completed"/"Upcoming" text.
  expect(within(summerCard).getByText(/completed/i)).toBeInTheDocument()
  expect(within(winterCard).getByText(/upcoming/i)).toBeInTheDocument()
})

test('shows an error and keeps the trip visible when deletion fails', async () => {
  const user = userEvent.setup()

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Summer Trip',
      destination: 'Tokyo',
      start_date: '2099-01-01',
      end_date: '2099-01-07',
    },
  ])

  deleteTrip.mockRejectedValueOnce(new Error('network error'))

  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /delete summer trip/i }))
  await user.click(await screen.findByRole('button', { name: /^delete$/i }))

  expect(
    await screen.findByText(/couldn't delete/i)
  ).toBeInTheDocument()

  expect(screen.getByText('Summer Trip')).toBeInTheDocument()
})

test('deletes a trip and removes it from the page', async () => {
  const user = userEvent.setup()

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Summer Trip',
      destination: 'Tokyo',
      start_date: '2099-01-01',
      end_date: '2099-01-07',
    },
  ])

  deleteTrip.mockResolvedValueOnce({})

  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /delete summer trip/i }))
  expect(await screen.findByRole('heading', { name: /delete this trip/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^delete$/i }))

  expect(deleteTrip).toHaveBeenCalledWith(1)

  await waitFor(() => {
    expect(screen.queryByText('Summer Trip')).not.toBeInTheDocument()
  })
})

test('does not delete when the confirmation is cancelled', async () => {
  const user = userEvent.setup()

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Summer Trip',
      destination: 'Tokyo',
      start_date: '2099-01-01',
      end_date: '2099-01-07',
    },
  ])

  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /delete summer trip/i }))
  await user.click(await screen.findByRole('button', { name: /cancel/i }))

  expect(screen.queryByRole('heading', { name: /delete this trip/i })).not.toBeInTheDocument()
  expect(deleteTrip).not.toHaveBeenCalled()
  expect(screen.getByText('Summer Trip')).toBeInTheDocument()
})

test('does not navigate when the delete button is clicked', async () => {
  const user = userEvent.setup()

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Summer Trip',
      destination: 'Tokyo',
      start_date: '2099-01-01',
      end_date: '2099-01-07',
    },
  ])

  deleteTrip.mockResolvedValueOnce({})

  render(
    <MemoryRouter initialEntries={['/trips']}>
      <Routes>
        <Route path="/trips" element={<MyTripsPage />} />
        <Route path="/trips/:id" element={<div>Trip Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  )

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /delete summer trip/i }))
  await user.click(await screen.findByRole('button', { name: /^delete$/i }))

  expect(screen.queryByText('Trip Detail Page')).not.toBeInTheDocument()
})

test('disables the delete button while a delete request is in flight', async () => {
  const user = userEvent.setup()

  getTrips.mockResolvedValue([
    {
      id: 1,
      name: 'Summer Trip',
      destination: 'Tokyo',
      start_date: '2099-01-01',
      end_date: '2099-01-07',
    },
  ])

  deleteTrip.mockReturnValue(new Promise(() => {}))

  renderPage()

  expect(await screen.findByText('Summer Trip')).toBeInTheDocument()

  const deleteButton = screen.getByRole('button', { name: /delete summer trip/i })
  await user.click(deleteButton)
  await user.click(await screen.findByRole('button', { name: /^delete$/i }))

  expect(deleteButton).toBeDisabled()
  expect(deleteTrip).toHaveBeenCalledTimes(1)
})