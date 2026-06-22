import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSessionCheck = error.config?.url?.includes('/auth/me')
    if (error.response?.status === 401 && !isSessionCheck) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
