import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Trigger({ message = 'Saved!' }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast.show(message)}>
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
