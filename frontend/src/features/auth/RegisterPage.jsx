import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from './authApi'
import { useAuth } from './useAuth'
import ErrorMessage from '../../components/ErrorMessage'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login: setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await register(email, password)
      setUser(data.user)
      navigate('/dashboard')
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        setError('An account with this email already exists.')
      } else {
        setError('Could not create account. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create account</h1>
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-gray-900 underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
