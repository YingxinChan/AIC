import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Trigger({ message = 'Saved!', variant }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast.show(message, variant)}>
      Fire
    </button>
  )
}

test('useToast() outside a provider is a safe no-op', async () => {
  render(<Trigger />)
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))
  expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
})

test('ToastProvider shows a toast fired via useToast()', async () => {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))
  expect(await screen.findByText('Saved!')).toBeInTheDocument()
})

test('toast auto-dismisses after its timeout', () => {
  vi.useFakeTimers()
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))
  expect(screen.getByText('Saved!')).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(3500)
  })

  expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  vi.useRealTimers()
})

test('caps the queue at 3 toasts', () => {
  render(
    <ToastProvider>
      <Trigger message="one" />
      <Trigger message="two" />
      <Trigger message="three" />
      <Trigger message="four" />
    </ToastProvider>
  )
  const buttons = screen.getAllByRole('button', { name: 'Fire' })
  buttons.forEach((btn) => fireEvent.click(btn))

  expect(screen.queryByText('one')).not.toBeInTheDocument()
  expect(screen.getByText('two')).toBeInTheDocument()
  expect(screen.getByText('three')).toBeInTheDocument()
  expect(screen.getByText('four')).toBeInTheDocument()
})

test('a celebration-variant toast gets the brand-gradient treatment instead of the everyday ink pill', async () => {
  render(
    <ToastProvider>
      <Trigger message="Trip created" variant="celebration" />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

  const toast = await screen.findByText('Trip created')
  expect(toast.closest('div')).toHaveClass('from-brand-600')
})

test('a swap-variant toast gets the reserved amber treatment, distinct from both everyday and celebration', async () => {
  render(
    <ToastProvider>
      <Trigger message="Itinerary regenerated — 2 activities adjusted for weather" variant="swap" />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

  const toast = await screen.findByText(/itinerary regenerated/i)
  expect(toast.closest('div')).toHaveClass('bg-accent-500')
})

test('an unrecognized variant falls back to the everyday success style rather than rendering blank', async () => {
  render(
    <ToastProvider>
      <Trigger message="Saved!" variant="not-a-real-variant" />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }))

  const toast = await screen.findByText('Saved!')
  expect(toast.closest('div')).toHaveClass('bg-ink')
})
