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

      {/* Impeccable relayout: a passenger ID stub instead of a gradient
          profile banner — "Passenger" echoes the same field-label
          convention as the landing page's TicketArtifact, so Account reads
          as the same document family rather than a generic settings page. */}
      <div className="rounded-2xl bg-surface shadow-ticket overflow-hidden flex">
        <div className="flex-1 min-w-0">
        <div className="bg-brand-900 px-6 py-5 sm:px-8 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-2xl font-display font-bold text-white">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-wide uppercase text-brand-300">Passenger</p>
            <p className="break-all font-display font-semibold text-white">{email}</p>
          </div>
        </div>

        <div className="relative px-6 py-6 sm:px-8">
          {/* A rubber-stamp graphic, not the amber shadow-stamp treatment —
              that shadow is reserved for the actual REBOOKED weather-swap
              moment, so a routine "verified" flourish here uses a plain
              ring instead of competing for the same visual signal. */}
          <div className="hidden sm:flex absolute top-4 right-4 sm:right-6 h-16 w-16 shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-brand-300 text-brand-400" aria-hidden="true">
            <span className="text-center font-mono text-[8px] font-bold uppercase leading-tight tracking-wide">
              Verified<br />Member
            </span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="font-mono text-[11px] tracking-wide uppercase text-ink-muted">Member since</p>
              <p className="mt-0.5 text-sm font-medium text-ink">{formatMemberSince(user?.created_at)}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] tracking-wide uppercase text-ink-muted">Active plan</p>
              {/* Hardcoded demo value, not real data — there's still no
                  billing backend (SubscriptionPage's Continue button is a
                  toast, not a save), so this can't actually reflect what
                  anyone picked. Deliberately generic ("Demo Plan," not a
                  specific tier name like "Monthly Explorer") — naming a
                  real tier here read as a bug the moment it didn't match
                  whatever was actually selected on SubscriptionPage.jsx. */}
              <span className="mt-1 inline-flex items-center rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1">
                Demo Plan
              </span>
              <p className="mt-1 text-[11px] text-ink-muted">No billing is connected yet.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full bg-surface-sunken border border-brand-100 px-4 py-2.5">
              {loadingTripCount ? (
                <Skeleton className="h-4 w-4 inline-block" />
              ) : (
                <span className="font-mono font-bold text-ink tabular-nums">{tripCount}</span>
              )}
              <span className="text-xs text-ink-muted">Trips Planned</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-surface-sunken border border-brand-100 px-4 py-2.5">
              {loadingTripCount ? (
                <Skeleton className="h-4 w-4 inline-block" />
              ) : (
                <span className="font-mono font-bold text-ink tabular-nums">{destinationCount}</span>
              )}
              <span className="text-xs text-ink-muted">Destinations</span>
            </div>
          </div>
        </div>
        </div>
        {/* A margin on both sides of the barcode, not flush with the
            content or the card's own outer edge — a printed strip on a
            real ticket has a border around it too. */}
        <div className="w-2.5 sm:w-3 shrink-0 bg-surface" aria-hidden="true" />
        {/* Barcode on its own solid-backed side strip, like a real boarding
            pass, rather than a horizontal band across the bottom. */}
        <div className="w-9 sm:w-11 shrink-0 barcode-strip-v text-white/70 bg-brand-950" aria-hidden="true" />
        <div className="w-2.5 sm:w-3 shrink-0 bg-surface" aria-hidden="true" />
      </div>

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