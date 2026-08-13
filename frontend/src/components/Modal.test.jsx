import { useState } from 'react'
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

test('moves focus into the dialog on open, onto its first focusable element', () => {
  render(
    <Modal open onClose={vi.fn()} title="Edit Hotel">
      <button type="button">Save</button>
    </Modal>
  )
  // The close (X) button is the dialog's first focusable element, ahead of
  // the "Save" button in the body.
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
})

test('restores focus to whatever triggered the modal once it closes', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Open</button>
        <Modal open={open} onClose={() => setOpen(false)} title="Edit Hotel">Content</Modal>
      </>
    )
  }
  render(<Harness />)

  const openButton = screen.getByRole('button', { name: 'Open' })
  openButton.focus()
  fireEvent.click(openButton)

  expect(screen.getByText('Edit Hotel')).toBeInTheDocument()
  expect(openButton).not.toHaveFocus()

  fireEvent.keyDown(window, { key: 'Escape' })

  expect(openButton).toHaveFocus()
})

test('Tab from the last focusable element wraps back to the first, trapping focus in the dialog', () => {
  render(
    <Modal open onClose={vi.fn()} title="Edit Hotel">
      <button type="button">Save</button>
    </Modal>
  )
  const closeButton = screen.getByRole('button', { name: 'Close' })
  const saveButton = screen.getByRole('button', { name: 'Save' })

  saveButton.focus()
  fireEvent.keyDown(window, { key: 'Tab' })
  expect(closeButton).toHaveFocus()

  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
  expect(saveButton).toHaveFocus()
})
