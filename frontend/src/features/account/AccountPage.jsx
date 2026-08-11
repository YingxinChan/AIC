import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Briefcase, CreditCard, ChevronRight } from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { logout as apiLogout } from '../auth/authApi'
import { getTrips } from '../trips/tripsApi'
import Button from '../../components/Button'
import Card from '../../components/Card'
import Skeleton from '../../components/Skeleton'

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
  const [trips, setTrips] = useState([])
  const [loadingTripCount, setLoadingTripCount] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadTrips() {
      try {
        const result = await getTrips()

        if (!cancelled) {
          setTrips(Array.isArray(result) ? result : [])
        }
      } catch {
        if (!cancelled) {
          setTrips([])
        }
      } finally {
        if (!cancelled) {
          setLoadingTripCount(false)
        }
      }
    }

    loadTrips()

    return () => {
      cancelled = true
    }
  }, [])

  const tripCount = trips.length
  const destinationCount = new Set(trips.map((t) => t.destination).filter(Boolean)).size

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
      <h1 className="heading-1 mb-6">
        Account
      </h1>

      {/* Profile header: gradient banner with the avatar overlapping its bottom edge */}
      <Card className="overflow-hidden p-0">
        <div className="h-24 bg-brand-mesh" />
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-mesh text-3xl font-display font-bold text-white shadow-brand-glow ring-4 ring-white">
            {avatarLetter}
          </div>

          <p className="mt-3 break-all text-base text-gray-600">
            {email}
          </p>
          <p className="text-sm text-ink-muted">
            Member since <span className="font-medium text-ink">{formatMemberSince(user?.created_at)}</span>
          </p>
          {/* Hardcoded demo value, not real data — there's still no billing
              backend (SubscriptionPage's Continue button is a toast, not a
              save), so this can't actually reflect what anyone picked.
              "Monthly Explorer" matches the plan name in SubscriptionPage.jsx
              verbatim. Green pill now that it's representing an active
              status rather than "nothing to report". */}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
            Active plan:
            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1">
              Monthly Explorer
            </span>
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white border border-gray-200/80 shadow-bento-sm px-4 py-2.5">
              {loadingTripCount ? (
                <Skeleton className="h-4 w-4 inline-block" />
              ) : (
                <span className="font-display font-bold text-ink tabular-nums">{tripCount}</span>
              )}
              <span className="text-xs text-ink-muted">Trips Planned</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white border border-gray-200/80 shadow-bento-sm px-4 py-2.5">
              {loadingTripCount ? (
                <Skeleton className="h-4 w-4 inline-block" />
              ) : (
                <span className="font-display font-bold text-ink tabular-nums">{destinationCount}</span>
              )}
              <span className="text-xs text-ink-muted">Destinations</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick links — a small account hub rather than a single dead-end card */}
      <Card className="p-2">
        <Button to="/trips" variant="ghost" className="w-full">
          <span className="flex w-full items-center justify-between">
            <span className="flex items-center gap-3">
              <Briefcase size={18} />
              My Trips
            </span>
            <ChevronRight size={16} />
          </span>
        </Button>
        <Button to="/account/subscription" variant="ghost" className="w-full">
          <span className="flex w-full items-center justify-between">
            <span className="flex items-center gap-3">
              <CreditCard size={18} />
              Manage Subscription
            </span>
            <ChevronRight size={16} />
          </span>
        </Button>
      </Card>

      {/* Signing out isn't destructive (no data loss), so it stays the quiet
          ghost-link treatment rather than borrowing the danger/red styling
          reserved for irreversible actions elsewhere in the app. */}
      <div className="text-center">
        <Button variant="ghost" onClick={handleSignOut}>
          <LogOut size={16} />
          Log Out
        </Button>
      </div>
    </div>
  )
}