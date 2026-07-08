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
  useAuth: () => ({ logout: mockAuthLogout }),
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

test('renders Account heading and a placeholder for unbuilt profile/subscription content', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /account/i })).toBeInTheDocument()
  expect(screen.getByText(/account settings will appear here/i)).toBeInTheDocument()
})

test('clicking Log Out calls the real sign-out flow and navigates to login', async () => {
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /log out/i }))

  await waitFor(() => expect(logout).toHaveBeenCalled())
  expect(mockAuthLogout).toHaveBeenCalled()
  await screen.findByText('Login page')
})
