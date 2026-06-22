import api from '../../lib/api'

export const getPreferences = () =>
  api.get('/api/notifications/preferences').then(r => r.data)

export const updatePreferences = (data) =>
  api.put('/api/notifications/preferences', data).then(r => r.data)

export const sendTest = () =>
  api.post('/api/notifications/test').then(r => r.data)
