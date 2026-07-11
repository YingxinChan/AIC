import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { logout as apiLogout } from '../auth/authApi'
import { getTrips } from '../trips/tripsApi'

function formatMemberSince(createdAt) {
  if (!createdAt) {
    return '—'
  }

  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tripCount, setTripCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadTrips() {
      try {
        const trips = await getTrips()

        if (!cancelled) {
          setTripCount(Array.isArray(trips) ? trips.length : 0)
        }
      } catch {
        if (!cancelled) {
          setTripCount(0)
        }
      }
    }

    loadTrips()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await apiLogout()
    } catch (_) {
      // Clear local auth state even if the API logout request fails.
    }

    logout()
    navigate('/login')
  }

  const email = user?.email ?? ''
  const avatarLetter = email.charAt(0).toUpperCase() || '?'

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Account
      </h1>

      {/* Account summary card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-3xl font-bold text-white">
            {avatarLetter}
          </div>

          <div className="min-w-0">
            <p className="break-all text-base text-gray-600">
              {email}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-gray-200" />

        <dl className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500">
              Member since
            </dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatMemberSince(user?.created_at)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500">
              Trips planned
            </dt>
            <dd className="text-sm font-medium text-gray-900">
              {tripCount}
            </dd>
          </div>
        </dl>
      </div>

      {/* Existing subscription card — leave its content unchanged */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">
          Subscription
        </h2>

        <Link
          to="/account/subscription"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
        >
          Manage Subscription
        </Link>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
      >
        <LogOut size={16} />
        Log Out
      </button>
    </div>
  )
}