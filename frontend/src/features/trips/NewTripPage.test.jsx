import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NewTripPage from './NewTripPage'

test('renders Plan a new trip heading', () => {
  render(<MemoryRouter><NewTripPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: /plan a new trip/i })).toBeInTheDocument()
})

test('shows London as fixed destination', () => {
  render(<MemoryRouter><NewTripPage /></MemoryRouter>)
  expect(screen.getByText(/london/i)).toBeInTheDocument()
})
