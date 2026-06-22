import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'

test('renders My Trips heading', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: /my trips/i })).toBeInTheDocument()
})

test('renders trip list placeholder', () => {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(screen.getByText(/your saved trips will appear here/i)).toBeInTheDocument()
})
