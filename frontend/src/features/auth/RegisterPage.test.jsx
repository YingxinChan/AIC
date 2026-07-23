import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import { AuthProvider } from './useAuth'

function renderPage() {
  return render(<MemoryRouter><AuthProvider><RegisterPage /></AuthProvider></MemoryRouter>)
}

test('renders create your account heading and form fields', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
  expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByRole('button', { name: /^register$/i })).toBeInTheDocument()
})

test('renders a Login link for existing users', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /^login$/i })).toHaveAttribute('href', '/login')
})

test('both password fields are masked by default and toggle independently', () => {
  renderPage()
  const passwordInput = screen.getByLabelText(/^password/i)
  const confirmInput = screen.getByLabelText(/confirm password/i)
  expect(passwordInput).toHaveAttribute('type', 'password')
  expect(confirmInput).toHaveAttribute('type', 'password')

  const showButtons = screen.getAllByRole('button', { name: /show password/i })
  expect(showButtons).toHaveLength(2)

  // Toggle only the password field's visibility.
  fireEvent.click(showButtons[0])
  expect(passwordInput).toHaveAttribute('type', 'text')
  expect(confirmInput).toHaveAttribute('type', 'password')

  // Confirm field still has its own independent toggle.
  expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(1)
  expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()
})
