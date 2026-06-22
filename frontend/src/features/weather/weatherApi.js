import api from '../../lib/api'

export const getForecast = (start, end) =>
  api.get('/api/weather/forecast', { params: { start, end } }).then(r => r.data)
