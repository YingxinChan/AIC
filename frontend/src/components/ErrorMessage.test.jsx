import { render, screen } from '@testing-library/react'
import ErrorMessage from './ErrorMessage'

test('renders default message', () => {
  render(<ErrorMessage />)
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
})

test('renders custom message', () => {
  render(<ErrorMessage message="Custom error." />)
  expect(screen.getByText('Custom error.')).toBeInTheDocument()
})
