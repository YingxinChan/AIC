import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Loading...
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
