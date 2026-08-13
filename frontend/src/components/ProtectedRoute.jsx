import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import PageLoader from './PageLoader'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    // This is the single most-frequently-seen loading state in the app —
    // it gates every authenticated page on every cold load, before Nav or
    // AppLayout even mount — so it gets the same branded takeover as every
    // other whole-page load, not a bare "Loading..." string.
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <PageLoader label="Loading…" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
