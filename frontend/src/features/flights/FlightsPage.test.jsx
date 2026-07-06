import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import FlightsPage from './FlightsPage';
import api from '../../lib/api';
import { getTrip, selectFlight } from '../trips/tripsApi';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../trips/tripsApi', () => ({
  getTrip: vi.fn(),
  selectFlight: vi.fn(),
}));

beforeEach(() => {
  getTrip.mockResolvedValue({ destination: 'London' });
});

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

test('toggling to "Leaving London" relabels the city field', () => {
  render(<MemoryRouter><FlightsPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /leaving london/i }));
  expect(screen.getByLabelText(/destination city/i)).toBeInTheDocument();
});

test('selecting a flight within a trip context saves it and navigates back', async () => {
  api.get.mockResolvedValue({
    data: {
      flights: [
        { airline: 'British Airways', flight_number: 'BA 112', departure_city: 'Paris',
          departure_time: '08:00', arrival_time: '08:15', duration: '1h 15m' },
      ],
    },
  });
  selectFlight.mockResolvedValue({});

  render(
    <MemoryRouter initialEntries={['/trips/7/flights']}>
      <Routes>
        <Route path="/trips/:tripId/flights" element={<FlightsPage />} />
        <Route path="/trips/:tripId" element={<div>Trip detail page</div>} />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText(/origin city/i), { target: { value: 'Paris' } });
  fireEvent.change(screen.getByLabelText(/travel date/i), { target: { value: '2026-08-01' } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));

  const selectButton = await screen.findByRole('button', { name: /select/i });
  fireEvent.click(selectButton);

  await waitFor(() => expect(selectFlight).toHaveBeenCalledWith('7', {
    leg: 'arrival',
    flight_number: 'BA 112',
    airline: 'British Airways',
    time: '08:15',
  }));
  await screen.findByText('Trip detail page');
});
