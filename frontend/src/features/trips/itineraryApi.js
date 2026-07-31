import api from '../../lib/api'

export const getItinerary = (tripId) => api.get(`/api/trips/${tripId}/itinerary/`).then(r => r.data)
export const generateItinerary = (tripId) => api.post(`/api/trips/${tripId}/itinerary/generate`).then(r => r.data)
export const updateActivity = (tripId, activityId, patch) =>
  api.patch(`/api/trips/${tripId}/itinerary/activities/${activityId}`, patch).then(r => r.data)
export const createActivity = (tripId, body) =>
  api.post(`/api/trips/${tripId}/itinerary/activities`, body).then(r => r.data)
export const deleteActivity = (tripId, activityId) =>
  api.delete(`/api/trips/${tripId}/itinerary/activities/${activityId}`).then(r => r.data)
