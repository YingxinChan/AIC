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

test('renders nav links', () => {
  render(<MemoryRouter><Nav /></MemoryRouter>)
  expect(screen.getByText('SmartTrip AI')).toBeInTheDocument()
  expect(screen.getByText('Trips')).toBeInTheDocument()
  expect(screen.getByText('Flights')).toBeInTheDocument()
  expect(screen.getByText('Notifications')).toBeInTheDocument()
  expect(screen.getByText('Sign out')).toBeInTheDocument()
})
