import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import WeatherSwapDemo from './WeatherSwapDemo'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion')
  return { ...actual, useReducedMotion: () => false }
})

// Real timers throughout — the badge/activity swap goes through
// AnimatePresence mode="wait", whose exit-then-enter transition needs real
// animation frames to actually complete (same as NewTripPage's step
// transitions elsewhere in this app); under fake timers the new content
// never mounts even though the interval itself fires.

test('auto-cycles between rain and clear on an interval', async () => {
  render(<WeatherSwapDemo />)

  expect(screen.getByText(/22°C, clear/i)).toBeInTheDocument()
  expect(await screen.findByText(/14°C, rain/i, {}, { timeout: 6000 })).toBeInTheDocument()
}, 10000)

test('the swapped activity name changes along with the badge, not just the badge', async () => {
  render(<WeatherSwapDemo />)

  expect(screen.getByText('Park Güell walking tour')).toBeInTheDocument()
  expect(await screen.findByText('Picasso Museum', {}, { timeout: 6000 })).toBeInTheDocument()
}, 10000)

test('pauses the auto-cycle while hovered, so a reader is not cut off mid-read', async () => {
  render(<WeatherSwapDemo />)
  const card = screen.getByText(/barcelona/i).closest('.p-6')

  fireEvent.mouseEnter(card)

  // Comfortably longer than one interval tick (3.5s) — the badge must still
  // read "clear" the whole way through while hovered.
  await new Promise((resolve) => setTimeout(resolve, 4200))
  expect(screen.getByText(/22°C, clear/i)).toBeInTheDocument()

  fireEvent.mouseLeave(card)
  expect(await screen.findByText(/14°C, rain/i, {}, { timeout: 6000 })).toBeInTheDocument()
}, 15000)
