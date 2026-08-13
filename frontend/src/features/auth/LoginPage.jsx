import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from './authApi'
import { useAuth } from './useAuth'
import ErrorMessage from '../../components/ErrorMessage'
import PasswordInput from '../../components/PasswordInput'
import Input from '../../components/Input'
import Button from '../../components/Button'

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
    <div>
      <div className="mb-8">
        <h1 className="heading-1">Welcome back</h1>
        <p className="text-body-sm text-ink-muted mt-1.5">Sign in and let the forecast guide your trip</p>
      </div>

      {error && <ErrorMessage message={error} />}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Login'}
        </Button>
      </form>
      <p className="text-body-sm text-ink-muted mt-4 text-center">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  )
}
