import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import AccountPage from './AccountPage'
import { logout } from '../auth/authApi'

vi.mock('../auth/authApi', () => ({
  logout: vi.fn(),
}))

const mockAuthLogout = vi.fn()
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      email: 'test@example.com',
      created_at: '2024-01-15T00:00:00Z',
    },
    logout: mockAuthLogout,
  }),
}))

vi.mock('../trips/tripsApi', () => ({
  getTrips: vi.fn(() =>
    Promise.resolve([
      { id: 1 },
      { id: 2 },
    ])
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  logout.mockResolvedValue({})
  mockAuthLogout.mockClear()
})

test('renders user email, member since, and trips planned count', async () => {
  renderPage()

  expect(screen.getByRole('heading', { name: /account/i })).toBeInTheDocument()
  expect(screen.getByText('test@example.com')).toBeInTheDocument()
  expect(screen.getByText('January 2024')).toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

test('Manage Subscription links to /account/subscription', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /manage subscription/i })).toHaveAttribute('href', '/account/subscription')
})

test('clicking Log Out calls the real sign-out flow and navigates to login', async () => {
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /log out/i }))

  await waitFor(() => expect(logout).toHaveBeenCalled())
  expect(mockAuthLogout).toHaveBeenCalled()
  await screen.findByText('Login page')
})
