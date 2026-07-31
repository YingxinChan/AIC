import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import MapView from './MapView'

// react-leaflet requires a DOM with sizing; jsdom doesn't fully support it.
// Mock react-leaflet to avoid Leaflet DOM errors in the test environment.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }) => <div className={className}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
}))

test('renders map container', () => {
  const { container } = render(<MapView />)
  expect(container.firstChild).not.toBeNull()
})

test('renders no markers or route when stops are empty', () => {
  render(<MapView />)
  expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()
})

test('renders one marker per stop with its label', () => {
  const stops = [
    { position: [51.5194, -0.1270], label: 'British Museum' },
    { position: [51.5081, -0.0759], label: 'Tower Bridge' },
  ]
  render(<MapView stops={stops} />)

  expect(screen.getAllByTestId('marker')).toHaveLength(2)
  expect(screen.getByText('British Museum')).toBeInTheDocument()
  expect(screen.getByText('Tower Bridge')).toBeInTheDocument()
})

test('renders a route line only when there are 2+ route stops', () => {
  const oneStop = [[51.5194, -0.1270]]
  const { rerender } = render(<MapView routeStops={oneStop} />)
  expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()

  const twoStops = [[51.5194, -0.1270], [51.5081, -0.0759]]
  rerender(<MapView routeStops={twoStops} />)
  expect(screen.getByTestId('polyline')).toBeInTheDocument()
})

test('renders a distinct hotel marker when provided', () => {
  const hotel = { position: [51.5, -0.12], label: 'The Ritz London' }
  render(<MapView hotel={hotel} />)

  expect(screen.getByTestId('marker')).toBeInTheDocument()
  expect(screen.getByText('The Ritz London')).toBeInTheDocument()
})

test('does not render a hotel marker when hotel is null', () => {
  render(<MapView hotel={null} />)
  expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
})
