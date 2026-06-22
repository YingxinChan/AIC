import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import * as useAuthModule from '../features/auth/useAuth'

test('redirects to /login when not authenticated', () => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Login page')).toBeInTheDocument()
  expect(screen.queryByText('Protected')).not.toBeInTheDocument()
})

test('renders outlet when authenticated', () => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ user: { id: 1, email: 'test@example.com' }, loading: false, login: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Protected')).toBeInTheDocument()
})
