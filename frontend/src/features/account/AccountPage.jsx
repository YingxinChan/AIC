import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import { useAuth } from '../auth/useAuth'
import { logout as apiLogout } from '../auth/authApi'
import { useEffect, useState } from "react";
import { getTrips } from "../trips/tripsApi";

export default function AccountPage() {
  const [trips, setTrips] = useState([]);
  useEffect(() => {
  const fetchTrips = async () => {
    const data = await getTrips();
    setTrips(data);
  };

  fetchTrips();
  }, []);

  const { user, logout } = useAuth()
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
  <div className="flex flex-col items-center">
    <div className="h-16 w-16 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
      {user?.email?.charAt(0).toUpperCase()}
    </div>

    <p className="mt-4 text-gray-700">
      {user?.email}
    </p>
  </div>

  <div className="border-t mt-6 pt-6 space-y-4">
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">Member since</span>
      <span className="font-medium text-gray-900">
        {new Date(user?.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </span>
    </div>

    <div className="flex justify-between text-sm">
      <span className="text-gray-600">Trips planned</span>
      <span className="font-medium text-gray-900">
        {trips.length}
      </span>
    </div>
  </div>
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
