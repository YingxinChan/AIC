import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FlightsPage from './FlightsPage';

test('renders Flights heading', () => {
  render(<MemoryRouter><FlightsPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Flights', level: 1 })).toBeInTheDocument();
});

test('renders search form and empty-state placeholder', () => {
  render(<MemoryRouter><FlightsPage /></MemoryRouter>);
  expect(screen.getByLabelText(/origin city/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/travel date/i)).toBeInTheDocument();
  expect(screen.getByText(/flight results will appear here/i)).toBeInTheDocument();
});