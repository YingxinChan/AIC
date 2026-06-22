import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'
import * as authApi from './authApi'

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `signed in as ${user.email}` : 'signed out'}</div>
}

test('shows signed in when getMe resolves', async () => {
  vi.spyOn(authApi, 'getMe').mockResolvedValue({ user: { id: 1, email: 'test@example.com' } })
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(screen.getByText('loading')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('signed in as test@example.com')).toBeInTheDocument())
})

test('shows signed out when getMe rejects', async () => {
  vi.spyOn(authApi, 'getMe').mockRejectedValue(new Error('401'))
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument())
})
