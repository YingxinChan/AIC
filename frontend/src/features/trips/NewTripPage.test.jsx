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

// Each question swaps in via an AnimatePresence exit/enter animation
// (mode="wait"), so the next question's fields don't exist in the DOM
// until that transition actually finishes — real wall-clock time in
// jsdom, not instant. Every step-advancing click below is followed by an
// awaited findBy for the next question before interacting with it.

// Walks through the three required questions (origin, destination, dates)
// one at a time via Continue, same as a real user would, landing on the
// flight question.
async function answerRequiredQuestions() {
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(await screen.findByLabelText(/destination/i), { target: { value: 'Tokyo' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(await screen.findByLabelText(/date depart/i), { target: { value: '2026-08-01' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-10' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await screen.findByText(/know your flight number/i)
}

// From the flight question, skips flight/hotel/places to land on Review.
async function skipOptionalQuestions() {
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i })) // flight
  await screen.findByText(/where are you staying/i)
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i })) // hotel
  await screen.findByText(/anywhere you want to visit/i)
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i })) // places
  await screen.findByText(/ready to go/i)
}

test('renders the Plan Your Trip heading and the first question, with no Back button on step one', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /plan your trip!/i })).toBeInTheDocument()
  expect(screen.getByText(/where are you flying from/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/departure/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()

  // Only the current question's field exists — one at a time, not the whole form.
  expect(screen.queryByLabelText(/destination/i)).not.toBeInTheDocument()
})

test('Continue is disabled until the current question is answered', () => {
  renderPage()
  expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
})

test('advances one question at a time and shows a Back button once past the first', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))

  // The Back button lives outside the animated question area, so it
  // appears the instant the step changes, ahead of the content swap.
  expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  expect(await screen.findByText(/where are you headed/i)).toBeInTheDocument()
  expect(screen.queryByLabelText(/departure/i)).not.toBeInTheDocument()
})

test('Back returns to the previous question without losing what was already typed', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await screen.findByText(/where are you headed/i)

  fireEvent.click(screen.getByRole('button', { name: /back/i }))

  expect(await screen.findByLabelText(/departure/i)).toHaveValue('London, UK')
})

test('blocks Continue on the dates question when the return date is before the departure date', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(await screen.findByLabelText(/destination/i), { target: { value: 'Tokyo' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await screen.findByText(/when are you traveling/i)

  fireEvent.change(screen.getByLabelText(/date depart/i), { target: { value: '2026-08-10' } })
  fireEvent.change(screen.getByLabelText(/date return/i), { target: { value: '2026-08-01' } })

  expect(screen.getByText(/return date must be after the departure date/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
})

test('the flight question reads "Skip for now" when empty and switches to "Continue" once a flight number is typed', async () => {
  renderPage()
  await answerRequiredQuestions()

  expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText(/flight number/i), { target: { value: 'JL 712' } })

  expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^continue/i })).toBeInTheDocument()
})

test('clicking Find Flight For Me saves the current answers, persists the step, and navigates to outbound flight search', async () => {
  renderPage()
  await answerRequiredQuestions()

  fireEvent.click(screen.getByRole('button', { name: /find flight for me/i }))

  expect(await screen.findByText('Outbound flight page')).toBeInTheDocument()
  const saved = JSON.parse(sessionStorage.getItem('tripDraft'))
  expect(saved).toMatchObject({
    origin: 'London, UK', destination: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10',
  })
  expect(saved._step).toBe(3) // the flight question's index — resumes here, not step 0
})

test('shows selected flights and a Change Flights option once both legs are picked, instead of the flight-number input', () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({
    origin: 'London, UK', destination: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10',
    outboundFlight: { airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15' },
    returnFlight: { airline: 'ANA', flight_number: 'NH 206', departure_time: '11:00', arrival_time: '17:20' },
    _step: 3,
  }))
  renderPage()

  expect(screen.queryByLabelText(/flight number/i)).not.toBeInTheDocument()
  expect(screen.getByText(/japan airlines.*jl 712/i)).toBeInTheDocument()
  expect(screen.getByText(/ana.*nh 206/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /change flights/i })).toBeInTheDocument()
  // Real content to keep, so this reads "Continue", not "Skip for now".
  expect(screen.getByRole('button', { name: /^continue/i })).toBeInTheDocument()
})

test('the review step summarizes every answer and Edit jumps back to the right question', async () => {
  sessionStorage.setItem('tripDraft', JSON.stringify({
    origin: 'London, UK', destination: 'Tokyo', startDate: '2026-08-01', endDate: '2026-08-10',
    hotelAddress: 'Park Hyatt Tokyo', placesToVisit: 'Senso-ji Temple',
    _step: 6,
  }))
  renderPage()

  expect(screen.getByText(/ready to go/i)).toBeInTheDocument()
  expect(screen.getByText(/london, uk.*tokyo/i)).toBeInTheDocument()
  expect(screen.getByText('Park Hyatt Tokyo')).toBeInTheDocument()
  expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /plan my trip/i })).toBeInTheDocument()

  const editButtons = screen.getAllByRole('button', { name: /edit/i })
  fireEvent.click(editButtons[0]) // the origin/destination/dates row
  expect(await screen.findByText(/where are you flying from/i)).toBeInTheDocument()
})

test('reaching Review by answering the required questions and skipping every optional one still works end to end', async () => {
  createTrip.mockResolvedValue({ id: 5 })
  renderPage()
  await answerRequiredQuestions()
  await skipOptionalQuestions()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  await waitFor(() => expect(createTrip).toHaveBeenCalled())
  expect(selectFlight).not.toHaveBeenCalled()
  await screen.findByText('Itinerary page')
})

test('submitting from Review creates the trip, attaches both flights, and goes to the itinerary page', async () => {
  createTrip.mockResolvedValue({ id: 99 })
  selectFlight.mockResolvedValue({})
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10',
    hotelAddress: 'Park Hyatt Tokyo', placesToVisit: 'Senso-ji Temple',
    outboundFlight: { airline: 'Japan Airlines', flight_number: 'JL 712', departure_time: '08:30', arrival_time: '14:15' },
    returnFlight: { airline: 'ANA', flight_number: 'NH 206', departure_time: '11:00', arrival_time: '17:20' },
    _step: 6,
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

test('submitting with a whitespace-only hotel address trims it to empty, not saved as blank-looking text', async () => {
  createTrip.mockResolvedValue({ id: 99 })
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10',
    hotelAddress: '   ', placesToVisit: '', _step: 6,
  }))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  await waitFor(() => expect(createTrip).toHaveBeenCalledWith(expect.objectContaining({
    hotel_address: '',
  })))
})

test('shows an inline error message when trip creation fails', async () => {
  createTrip.mockRejectedValue({ response: { data: { detail: 'Something went wrong.' } } })
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10', _step: 6,
  }))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
})

test('shows a loading state while submitting', async () => {
  let resolvePromise
  createTrip.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))
  sessionStorage.setItem('tripDraft', JSON.stringify({
    destination: 'Tokyo', origin: 'London, UK', startDate: '2026-08-01', endDate: '2026-08-10', _step: 6,
  }))
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /plan my trip/i }))

  expect(await screen.findByRole('button', { name: /planning/i })).toBeDisabled()
  resolvePromise({ id: 1 })
  await screen.findByText('Itinerary page')
})

test('pressing Enter on an early question advances to the next question instead of submitting the trip', async () => {
  renderPage()
  fireEvent.change(screen.getByLabelText(/departure/i), { target: { value: 'London, UK' } })
  fireEvent.submit(screen.getByLabelText(/departure/i).closest('form'))

  expect(createTrip).not.toHaveBeenCalled()
  expect(await screen.findByText(/where are you headed/i)).toBeInTheDocument()
})
