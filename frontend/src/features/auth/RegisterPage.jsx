import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from './authApi'
import { useAuth } from './useAuth'
import ErrorMessage from '../../components/ErrorMessage'
import PasswordInput from '../../components/PasswordInput'
import Input from '../../components/Input'
import Button from '../../components/Button'

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
      const detail = err?.response?.data?.detail
      if (status === 409) {
        setError('An account with this email already exists.')
      } else if (status === 422) {
        setError(typeof detail === 'string' ? detail : 'Please check your email and password and try again.')
      } else if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('Could not create account. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="heading-1">Create your account</h1>
        <p className="text-body-sm text-ink-muted mt-1.5">Start planning weather-perfect trips today</p>
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
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <PasswordInput
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="text-body-sm text-ink-muted mt-4 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">
          Login
        </Link>
      </p>
    </div>
  )
}
