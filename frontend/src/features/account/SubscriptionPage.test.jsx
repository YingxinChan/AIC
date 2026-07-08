import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubscriptionPage from './SubscriptionPage'

function renderPage() {
  return render(<MemoryRouter><SubscriptionPage /></MemoryRouter>)
}

test('renders Subscription heading and a placeholder for unbuilt plans', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /subscription/i })).toBeInTheDocument()
  expect(screen.getByText(/subscription plans will appear here/i)).toBeInTheDocument()
})

test('renders a Back to Account link to /account', () => {
  renderPage()
  expect(screen.getByRole('link', { name: /back to account/i })).toHaveAttribute('href', '/account')
})
