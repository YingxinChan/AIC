import api from '../../lib/api'

export const getTrips = () => api.get('/api/trips/').then(r => r.data)
export const createTrip = (data) => api.post('/api/trips/', data).then(r => r.data)
export const getTrip = (id) => api.get(`/api/trips/${id}`).then(r => r.data)
export const deleteTrip = (id) => api.delete(`/api/trips/${id}`)
export const selectFlight = (id, data) => api.patch(`/api/trips/${id}/flight`, data).then(r => r.data)
