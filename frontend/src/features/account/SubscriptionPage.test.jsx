import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import SubscriptionPage from './SubscriptionPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SubscriptionPage />
    </MemoryRouter>,
  )
}

describe('SubscriptionPage', () => {
  test('renders the Upgrade Your Plan heading', () => {
    renderPage()

    expect(
      screen.getByRole('heading', {
        name: 'Upgrade Your Plan',
      }),
    ).toBeInTheDocument()
  })

  test('renders all three plans and prices', () => {
    renderPage()

    expect(
      screen.getByText('Single Trip Pass (One-Time)'),
    ).toBeInTheDocument()
    expect(screen.getByText('£4.99')).toBeInTheDocument()

    expect(
      screen.getByText('Pro Traveler (Monthly)'),
    ).toBeInTheDocument()
    expect(screen.getByText('£9.99')).toBeInTheDocument()

    expect(
      screen.getByText('Lifetime Explorer (Lifetime)'),
    ).toBeInTheDocument()
    expect(screen.getByText('£59.99')).toBeInTheDocument()
  })

  test('renders three Select Plan buttons', () => {
    renderPage()

    expect(
      screen.getAllByRole('button', {
        name: 'Select Plan',
      }),
    ).toHaveLength(3)
  })

  test('renders the Back to Account link', () => {
    renderPage()

    expect(
      screen.getByRole('link', {
        name: 'Back to Account',
      }),
    ).toHaveAttribute('href', '/account')
  })
})