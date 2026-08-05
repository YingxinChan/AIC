import api from '../../lib/api'

export const register = (email, password) =>
  api.post('/api/auth/register', { email, password }).then(r => {
    window.localStorage.setItem('access_token', r.data.token)
    return r.data
  })

export const login = (email, password) =>
  api.post('/api/auth/login', { email, password }).then(r => {
    window.localStorage.setItem('access_token', r.data.token)
    return r.data
  })

export const logout = () =>
  api.post('/api/auth/logout').finally(() => {
    // Cleared regardless of whether the request succeeds — logout is purely
    // a client-side token discard (see routers/auth.py's logout), so a
    // failed network call is no reason to leave the stale token behind.
    window.localStorage.removeItem('access_token')
  }).then(r => r.data)

export const getMe = () =>
  api.get('/api/auth/me').then(r => r.data)
