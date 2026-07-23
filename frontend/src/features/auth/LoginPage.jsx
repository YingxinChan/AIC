import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { login } from './authApi'
import { useAuth } from './useAuth'
import ErrorMessage from '../../components/ErrorMessage'
import PasswordInput from '../../components/PasswordInput'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login: setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await login(email, password)
      setUser(data.user)
      navigate('/dashboard')
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 401) {
        setError('Invalid email or password.')
      } else if (status === 422) {
        setError(typeof detail === 'string' ? detail : 'Please check your email and password and try again.')
      } else if (typeof detail === 'string') {
        setError(detail)
      } else if (!err?.response) {
        setError('Could not reach the server. Check your connection and try again.')
      } else {
        setError('Something went wrong while signing in. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-4">
          <Plane size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to plan your weather-synced itinerary</p>
      </div>

      {error && <ErrorMessage message={error} />}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Don't have an account?{' '}
        <Link to="/register" className="text-indigo-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  )
}
