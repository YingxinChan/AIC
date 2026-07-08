import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import { AuthProvider } from './useAuth'

test('renders welcome back heading and form fields', () => {
  render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>)
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
})

test('renders a Register link for new users', () => {
  render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>)
  expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register')
})
