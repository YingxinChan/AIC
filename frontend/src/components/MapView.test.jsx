import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import MapView from './MapView'

// react-leaflet requires a DOM with sizing; jsdom doesn't fully support it.
// Mock react-leaflet to avoid Leaflet DOM errors in the test environment.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }) => <div className={className}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
}))

// react-leaflet requires a DOM with sizing; jsdom doesn't fully support it.
// We test that the container renders without crashing.
test('renders map container', () => {
  const { container } = render(<MapView />)
  expect(container.firstChild).not.toBeNull()
})
