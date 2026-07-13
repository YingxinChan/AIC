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
  expect(screen.getByText('SmartTrip')).toBeInTheDocument()
  expect(screen.getByText('AI')).toBeInTheDocument()
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
  expect(screen.getByRole('link', { name: /home/i })).toHaveClass('bg-indigo-50')
  expect(screen.getByRole('link', { name: /my trips/i })).not.toHaveClass('bg-indigo-50')
})

test('highlights My Trips as active on any /trips route, including a specific trip', () => {
  render(<MemoryRouter initialEntries={['/trips/42']}><Nav /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /my trips/i })).toHaveClass('bg-indigo-50')
  expect(screen.getByRole('link', { name: /home/i })).not.toHaveClass('bg-indigo-50')
})
