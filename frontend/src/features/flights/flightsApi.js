import api from '../../lib/api'

export const searchFlights = (origin, departure, returnDate, direction, destination, flightNumber = '') => {
  // We use the exact path '/api/flights' to match your Flask @app.route('/api/flights')
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