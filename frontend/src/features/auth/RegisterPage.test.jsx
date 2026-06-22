import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import { AuthProvider } from './useAuth'

test('renders create account heading and form fields', () => {
  render(<MemoryRouter><AuthProvider><RegisterPage /></AuthProvider></MemoryRouter>)
  expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
})
