import api from '../../lib/api'

export const searchFlights = (origin, departure, returnDate, direction, destination, flightNumber = '') =>
  api.get('/api/flights/search', { params: { origin, departure, return_date: returnDate, direction, destination, flight_number: flightNumber } }).then(r => r.data)
