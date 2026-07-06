import api from '../../lib/api'

export const getItinerary = (tripId) => api.get(`/api/trips/${tripId}/itinerary/`).then(r => r.data)
export const generateItinerary = (tripId) => api.post(`/api/trips/${tripId}/itinerary/generate`).then(r => r.data)
