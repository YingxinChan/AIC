import api from '../../lib/api'

// Removed the incorrect Flask comment as requested
export const searchFlights = (origin, departure, returnDate, direction, destination, flightNumber = '') => {
  return api.get('/api/flights/search', { 
    params: { 
      origin, 
      departure, 
      return_date: returnDate, 
      direction, 
      destination, 
      flight_number: flightNumber 
    } 
  }).then(r => r.data)
}