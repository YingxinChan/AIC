import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'

test('renders Notification Preferences heading', () => {
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: /notification preferences/i })).toBeInTheDocument()
})

test('renders settings placeholder', () => {
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
  expect(screen.getByText(/email notification settings will appear here/i)).toBeInTheDocument()
})
