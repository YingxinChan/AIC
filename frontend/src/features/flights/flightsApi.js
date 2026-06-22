import api from '../../lib/api'

export const searchFlights = (origin, departure, returnDate) =>
  api.get('/api/flights/search', { params: { origin, departure, return: returnDate } }).then(r => r.data)
