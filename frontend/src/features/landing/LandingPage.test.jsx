import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'

function renderPage() {
  return render(<MemoryRouter><LandingPage /></MemoryRouter>)
}

test('renders the headline and Get Started CTA linking to register', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /plan weather-perfect trips with ai/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/register')
})

test('renders a Login link linking to /login', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /^login$/i })).toHaveAttribute('href', '/login')
})

test('feature grid renders all six feature cards', () => {
  renderPage()
  expect(screen.getByText(/weather-synced plans/i)).toBeInTheDocument()
  expect(screen.getByText(/smart routing/i)).toBeInTheDocument()
  expect(screen.getByText(/seamless logistics/i)).toBeInTheDocument()
  expect(screen.getByText(/real-time adjustments/i)).toBeInTheDocument()
  expect(screen.getByText(/destination guides/i)).toBeInTheDocument()
  expect(screen.getByText(/trip dashboard/i)).toBeInTheDocument()
})

test('renders the bottom CTA banner linking to register', () => {
  renderPage()
  expect(screen.getByText(/ready to plan your next adventure/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /start planning/i })).toHaveAttribute('href', '/register')
})
