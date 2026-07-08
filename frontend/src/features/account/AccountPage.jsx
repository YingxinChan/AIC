import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import { useAuth } from '../auth/useAuth'
import { logout as apiLogout } from '../auth/authApi'

export default function AccountPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try { await apiLogout() } catch (_) {}
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <Placeholder label="Account settings will appear here." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Subscription</h2>
        <Placeholder label="Subscription management will appear here." />
        <Link
          to="/account/subscription"
          className="mt-4 w-full flex items-center justify-center gap-2 border border-indigo-200 text-indigo-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
        >
          Manage Subscription
        </Link>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
      >
        <LogOut size={16} /> Log Out
      </button>
    </div>
  )
}
