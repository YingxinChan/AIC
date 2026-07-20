import api from '../../lib/api'

export const getForecast = (lat, lon, startDate, endDate) =>
  api.get('/api/weather/prediction', { 
    params: { 
      lat, 
      lon, 
      start_date: startDate, 
      end_date: endDate 
    } 
  }).then(r => r.data)

export const getHourlyForecast = (lat, lon, startDate, endDate) =>
  api.get('/api/weather/hourly', { 
    params: { 
      lat, 
      lon, 
      start_date: startDate, 
      end_date: endDate 
    } 
  }).then(r => r.data)