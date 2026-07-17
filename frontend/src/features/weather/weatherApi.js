import api from '../../lib/api'

export const getForecast = async (lat, lon) => {
  try {
    const response = await api.get('/api/weather/prediction', { 
      params: { lat, lon } // The backend expects 'lat' and 'lon'
    });
    return response.data;
  } catch (error) {
    console.error("Weather forecast failed:", error);
    return null; 
  }
}
