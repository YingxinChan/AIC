import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { getTrip, selectFlight } from '../trips/tripsApi';

export default function FlightsPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [destination, setDestination] = useState('London');
  const [direction, setDirection] = useState('arrival');
  const [origin, setOrigin] = useState('');
  const [date, setDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    getTrip(tripId)
      .then((data) => { if (!cancelled) setDestination(data.destination || 'London') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId])

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const { data } = await api.get('/api/flights/search', {
        params: { origin, departure: date, return_date: date, direction, destination }
      });
      setFlights(data.flights || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Something went wrong while fetching flights.');
    }
    setLoading(false);
  };

  const handleSelect = async (flight) => {
    if (!tripId) return;
    setErrorMessage('');
    try {
      await selectFlight(tripId, {
        leg: direction,
        flight_number: flight.flight_number,
        airline: flight.airline,
        time: direction === 'arrival' ? flight.arrival_time : flight.departure_time,
      });
      navigate(`/trips/${tripId}`);
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Could not save this flight to your trip.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flights</h1>

      {tripId && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          Selecting a flight for this trip — we'll use its time to plan your itinerary.
        </div>
      )}

      {/* Direction Toggle */}
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
        <button
          type="button"
          onClick={() => { setDirection('arrival'); setFlights([]); }}
          className={`px-4 py-2 text-sm font-medium ${direction === 'arrival' ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-700'}`}
        >
          Arriving in {destination}
        </button>
        <button
          type="button"
          onClick={() => { setDirection('departure'); setFlights([]); }}
          className={`px-4 py-2 text-sm font-medium ${direction === 'departure' ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-700'}`}
        >
          Leaving {destination}
        </button>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {direction === 'arrival' ? `Search flights to ${destination}` : `Search flights from ${destination}`}
        </h2>
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-1">
              {direction === 'arrival' ? 'Origin City' : 'Destination City'}
            </label>
            <input
              id="origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Paris"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
              required
            />
          </div>
          <div className="flex-1">
            <label htmlFor="travel-date" className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
            <input
              id="travel-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#0f172a] text-white px-6 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Error Feedback Display */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Flight Cards Output */}
      <div className="space-y-4">
        {flights.map((flight, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-semibold text-lg text-gray-900">
                {flight.airline} <span className="text-sm font-normal text-gray-500">({flight.flight_number})</span>
              </p>
              <p className="text-gray-600">
                {flight.departure_city} ({flight.departure_time}) &rarr; {flight.destination_city || destination} ({flight.arrival_time})
              </p>
              <p className="text-sm text-gray-500 mt-1">Duration: {flight.duration}</p>
            </div>
            <div className="text-right flex items-center justify-end">
              <button
                type="button"
                onClick={tripId ? () => handleSelect(flight) : undefined}
                className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Select
              </button>
            </div>
          </div>
        ))}

        {flights.length === 0 && !loading && !errorMessage && (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-lg">
            Flight results will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
