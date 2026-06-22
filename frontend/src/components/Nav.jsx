import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { logout as apiLogout } from '../features/auth/authApi'

export default function Nav() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try { await apiLogout() } catch (_) {}
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/dashboard" className="font-bold text-gray-900 text-lg">SmartTrip AI</Link>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <Link to="/dashboard" className="hover:text-gray-900">Trips</Link>
          <Link to="/flights" className="hover:text-gray-900">Flights</Link>
          <Link to="/settings/notifications" className="hover:text-gray-900">Notifications</Link>
          <button onClick={handleSignOut} className="hover:text-gray-900">Sign out</button>
        </div>
      </div>
    </nav>
  )
}
