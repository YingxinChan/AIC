import { render, screen } from '@testing-library/react'
import Placeholder from './Placeholder'

test('renders label text', () => {
  render(<Placeholder label="Trips will appear here." />)
  expect(screen.getByText('Trips will appear here.')).toBeInTheDocument()
})
