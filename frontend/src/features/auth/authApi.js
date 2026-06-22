import api from '../../lib/api'

export const register = (email, password) =>
  api.post('/api/auth/register', { email, password }).then(r => r.data)

export const login = (email, password) =>
  api.post('/api/auth/login', { email, password }).then(r => r.data)

export const logout = () =>
  api.post('/api/auth/logout').then(r => r.data)

export const getMe = () =>
  api.get('/api/auth/me').then(r => r.data)
