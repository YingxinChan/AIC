import { useState } from 'react';

export default function FlightsPage() {
  const [origin, setOrigin] = useState('');
  const [date, setDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      // Map the 2 form fields perfectly to the 3 query arguments expected by the router
      const params = new URLSearchParams({ 
        origin: origin,          // Origin City (e.g., Paris)
        departure: date,         // Departure Date string
        return_date: date        // Return Date string (matching departure for simplicity)
      });
      
      // Add http://127.0.0.1:8000 in front of the route
      // Check if your app stores a login token (common in React apps)
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8000/api/flights/search?${params}`, {
        method: 'GET',
        headers: {
          // If you have a token, this sends it to the backend
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        // This tells the browser to send any secure session cookies
        credentials: 'include' 
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.flights) {
        setFlights(data.flights);
      } else if (Array.isArray(data)) {
        setFlights(data);
      } else {
        setFlights([]);
      }
    } catch (error) {
      console.error("Failed to fetch flights", error);
      setErrorMessage(error.message || "Something went wrong while fetching flights.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flights</h1>
      
      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Search flights to London</h2>
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input 
              type="text" 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Paris"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-900 focus:outline-none"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
            <input 
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
          <strong>Error:</strong> {errorMessage}. Please check if your backend server terminal is running or inspect your network configurations.
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
                {flight.departure_city} ({flight.departure_time}) &rarr; London ({flight.arrival_time})
              </p>
              <p className="text-sm text-gray-500 mt-1">Duration: {flight.duration}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900 mb-2">£{flight.price}</p>
              <button 
                type="button"
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