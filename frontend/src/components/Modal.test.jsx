import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Modal from './Modal'

test('does not render when open is false', () => {
  render(<Modal open={false} onClose={vi.fn()} title="Edit Hotel">Content</Modal>)
  expect(screen.queryByText('Edit Hotel')).not.toBeInTheDocument()
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})

test('renders title and children when open', () => {
  render(<Modal open onClose={vi.fn()} title="Edit Hotel">Content</Modal>)
  expect(screen.getByText('Edit Hotel')).toBeInTheDocument()
  expect(screen.getByText('Content')).toBeInTheDocument()
})

test('clicking the backdrop calls onClose', () => {
  const onClose = vi.fn()
  const { container } = render(<Modal open onClose={onClose} title="Edit Hotel">Content</Modal>)
  fireEvent.click(container.firstChild)
  expect(onClose).toHaveBeenCalled()
})

test('clicking inside the content does not call onClose', () => {
  const onClose = vi.fn()
  render(<Modal open onClose={onClose} title="Edit Hotel">Content</Modal>)
  fireEvent.click(screen.getByText('Content'))
  expect(onClose).not.toHaveBeenCalled()
})
