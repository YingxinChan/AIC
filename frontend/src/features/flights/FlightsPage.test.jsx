import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FlightsPage from './FlightsPage'

test('renders Flights heading', () => {
  render(<MemoryRouter><FlightsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Flights', level: 1 })).toBeInTheDocument()
})

test('renders search and results placeholders', () => {
  render(<MemoryRouter><FlightsPage /></MemoryRouter>)
  expect(screen.getByText(/flight search form will appear here/i)).toBeInTheDocument()
  expect(screen.getByText(/flight results will appear here/i)).toBeInTheDocument()
})
