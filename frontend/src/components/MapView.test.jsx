// Test: npm test mapview

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

// react-leaflet requires a DOM with sizing; jsdom doesn't fully support it.
// We test that the container renders without crashing.
test('renders map container', () => {
  const { container } = render(<MapView />)
  expect(container.firstChild).not.toBeNull()
})

// markers render test
test('renders markers when stops are provided', () => {
  const stops = [
    {
      position: [51.5074, -0.1278],
      label: 'British Museum',
    },
    {
      position: [51.5007, -0.1246],
      label: 'Big Ben',
    },
  ]

  render(<MapView stops={stops} />)

  expect(screen.getAllByTestId('marker')).toHaveLength(2)
  expect(screen.getByText('British Museum')).toBeInTheDocument()
  expect(screen.getByText('Big Ben')).toBeInTheDocument()
})

// empty stops test
test('does not render markers or route when stops are empty', () => {
  render(<MapView stops={[]} />)

  expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()
})

// polyline test
test('renders route line when there are multiple stops', () => {
  const stops = [
    {
      position: [51.5074, -0.1278],
      label: 'British Museum',
    },
    {
      position: [51.5007, -0.1246],
      label: 'Big Ben',
    },
  ]

  render(<MapView stops={stops} />)

  expect(screen.getByTestId('polyline')).toBeInTheDocument()
})

// coordinate privacy test
test('does not display raw coordinates', () => {
  const stops = [
    {
      position: [51.5074, -0.1278],
      label: 'British Museum',
    },
  ]

  render(<MapView stops={stops} />)

  expect(screen.queryByText('51.5074')).not.toBeInTheDocument()
  expect(screen.queryByText('-0.1278')).not.toBeInTheDocument()
})