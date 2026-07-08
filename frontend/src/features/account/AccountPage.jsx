import { useNavigate } from 'react-router-dom'
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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <Placeholder label="Account settings will appear here." />
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  )
}
