import api from '../../lib/api'

export const getWalkingDistance = (fromLat, fromLng, toLat, toLng) =>
  api.get('/api/activities/walking-distance', { params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng } }).then(r => r.data)
