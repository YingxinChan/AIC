import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LoginPage from './LoginPage'
import { AuthProvider } from './useAuth'
import { login } from './authApi'

vi.mock('./authApi', () => ({
  login: vi.fn(),
  getMe: vi.fn().mockRejectedValue(new Error('not authenticated')),
}))

function renderPage() {
  return render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>)
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongpass' } })
  fireEvent.click(screen.getByRole('button', { name: /^login$/i }))
}

test('renders welcome back heading and form fields', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
})

test('renders a Register link for new users', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register')
})

test('shows "invalid email or password" for a 401', async () => {
  login.mockRejectedValue({ response: { status: 401, data: { detail: 'Invalid credentials' } } })
  renderPage()
  fillAndSubmit()
  expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
})

test('shows the server detail message for a 422', async () => {
  login.mockRejectedValue({ response: { status: 422, data: { detail: 'value is not a valid email address' } } })
  renderPage()
  fillAndSubmit()
  expect(await screen.findByText(/value is not a valid email address/i)).toBeInTheDocument()
})

test('shows a network-specific message when the backend is unreachable, not "invalid email or password"', async () => {
  login.mockRejectedValue({ request: {}, message: 'Network Error' })
  renderPage()
  fillAndSubmit()
  expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
  expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument()
})

test('shows a generic message for an unexpected server error', async () => {
  login.mockRejectedValue({ response: { status: 500, data: {} } })
  renderPage()
  fillAndSubmit()
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
})

test('password is masked by default and can be toggled visible and back', () => {
  renderPage()
  const passwordInput = screen.getByLabelText(/^password$/i)
  expect(passwordInput).toHaveAttribute('type', 'password')

  fireEvent.click(screen.getByRole('button', { name: /show password/i }))
  expect(passwordInput).toHaveAttribute('type', 'text')
  expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
  expect(passwordInput).toHaveAttribute('type', 'password')
})
