import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Nav from './Nav'
import * as useAuthModule from '../features/auth/useAuth'

beforeEach(() => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: { id: 1, email: 'test@example.com' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })
})
afterEach(() => vi.restoreAllMocks())

test('renders the logo, Home linking to /dashboard, and My Trips linking to /trips', () => {
  render(<MemoryRouter><Nav /></MemoryRouter>)
  expect(screen.getByText('Navia')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard')
  expect(screen.getByRole('link', { name: /my trips/i })).toHaveAttribute('href', '/trips')
})

test('renders a profile icon link to /account', () => {
  render(<MemoryRouter><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /account/i })).toHaveAttribute('href', '/account')
})

test('no longer shows Flights, Notifications, or Sign out links (notifications frontend removed, sign out moved to Account page)', () => {
  render(<MemoryRouter><Nav /></MemoryRouter>)
  expect(screen.queryByText('Flights')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
})

test('highlights only Home as active on the dashboard route', () => {
  render(<MemoryRouter initialEntries={['/dashboard']}><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /home/i })).toHaveClass('bg-brand-800')
  expect(screen.getByRole('link', { name: /my trips/i })).not.toHaveClass('bg-brand-800')
})

test('highlights My Trips as active on any /trips route, including a specific trip', () => {
  render(<MemoryRouter initialEntries={['/trips/42']}><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /my trips/i })).toHaveClass('bg-brand-800')
  expect(screen.getByRole('link', { name: /home/i })).not.toHaveClass('bg-brand-800')
})

// The creation form isn't "browsing your trips" — so My Trips shouldn't
// light up there.
test('does not highlight My Trips on the New Trip form', () => {
  render(<MemoryRouter initialEntries={['/trips/new']}><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /my trips/i })).not.toHaveClass('bg-brand-800')
})

// Nor on its nested flight-select sub-route — still part of the same
// creation flow, not the trip list.
test('does not highlight My Trips on the New Trip flow\'s flight-select sub-route', () => {
  render(<MemoryRouter initialEntries={['/trips/new/flights/outbound']}><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /my trips/i })).not.toHaveClass('bg-brand-800')
})
