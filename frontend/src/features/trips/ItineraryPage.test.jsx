import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import ItineraryPage from './ItineraryPage'

vi.mock('../../components/MapView', () => ({
  default: () => <div>London Map</div>,
}))

test('renders itinerary sections', () => {
  render(
    <MemoryRouter initialEntries={['/trips/1']}>
      <Routes>
        <Route path="/trips/:tripId" element={<ItineraryPage />} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { name: /your itinerary/i })).toBeInTheDocument()
  expect(screen.getByText(/weather forecast will appear here/i)).toBeInTheDocument()
  expect(screen.getByText(/ai-generated itinerary will appear here/i)).toBeInTheDocument()
  expect(screen.getAllByText(/london map/i).length).toBeGreaterThan(0)
})
