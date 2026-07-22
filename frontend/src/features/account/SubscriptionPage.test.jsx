import { fireEvent, render, screen } from '@testing-library/react'
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
  test('renders the Plan heading', () => {
    renderPage()

    expect(
      screen.getByRole('heading', {
        name: 'Plan',
      }),
    ).toBeInTheDocument()
  })

  test('renders the shared feature highlights', () => {
    renderPage()

    expect(
      screen.getByText('Weather and climate insights'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Weather-risk alerts'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Activity alternatives and itinerary updates'),
    ).toBeInTheDocument()
  })

  test('renders all three plans and prices', () => {
    renderPage()

    expect(
      screen.getByRole('button', {
        name: /single/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('£4.99')).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /monthly/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('£8.99')).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /lifetime/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('£59.99')).toBeInTheDocument()
  })

  test('allows the user to select a plan', () => {
    renderPage()

    const singlePlan = screen.getByRole('button', {
      name: /single/i,
    })
    const monthlyPlan = screen.getByRole('button', {
      name: /monthly/i,
    })

    expect(singlePlan).toHaveAttribute('aria-pressed', 'true')
    expect(monthlyPlan).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(monthlyPlan)

    expect(singlePlan).toHaveAttribute('aria-pressed', 'false')
    expect(monthlyPlan).toHaveAttribute('aria-pressed', 'true')
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