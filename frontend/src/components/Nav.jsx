import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import logo from '../assets/logo.png'
import NaviaWordmark from './NaviaWordmark'
import { getMotionComponent } from '../lib/motionComponent'
import { SPRING_POP } from '../lib/motion'

const MotionLink = getMotionComponent(Link)

export default function Nav() {
  const { pathname } = useLocation()
  const isHome = pathname === '/dashboard'
  // Excludes /trips/new (and its flight-select sub-route) — that's the
  // creation form, not browsing your trip list, so "My Trips" shouldn't
  // light up while you're on it. Viewing an existing trip's itinerary
  // (/trips/:tripId) still counts as My Trips.
  const isMyTrips = pathname.startsWith('/trips') && !pathname.startsWith('/trips/new')
  const isAccount = pathname === '/account'

  return (
    <nav className="sticky top-0 z-40 bg-brand-950">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logo} alt="" className="w-full h-full object-cover" />
          </span>
          <NaviaWordmark className="h-5 w-auto text-white" accentClassName="text-brand-300" />
        </Link>
        <div className="flex items-center gap-1.5 text-sm font-mono uppercase tracking-wide text-[13px]">
          <Link
            to="/dashboard"
            aria-label="Home"
            className={`relative px-3 py-1.5 rounded-full font-medium transition-colors ${isHome ? 'bg-brand-800 text-white' : 'text-brand-300 hover:text-white'}`}
          >
            {isHome && (
              <motion.span
                layoutId="navIndicator"
                transition={SPRING_POP}
                className="absolute inset-0 rounded-full ring-1 ring-brand-600"
              />
            )}
            <span className="relative">Home</span>
          </Link>
          <Link
            to="/trips"
            aria-label="My Trips"
            className={`relative px-3 py-1.5 rounded-full font-medium transition-colors ${isMyTrips ? 'bg-brand-800 text-white' : 'text-brand-300 hover:text-white'}`}
          >
            {isMyTrips && (
              <motion.span
                layoutId="navIndicator"
                transition={SPRING_POP}
                className="absolute inset-0 rounded-full ring-1 ring-brand-600"
              />
            )}
            <span className="relative">My Trips</span>
          </Link>
          <MotionLink
            whileTap={{ scale: 0.9 }}
            to="/account"
            aria-label="Account"
            className={`ml-1 w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${isAccount ? 'border-white text-white' : 'border-brand-700 text-brand-300 hover:text-white hover:border-brand-500'}`}
          >
            <User size={18} />
          </MotionLink>
        </div>
      </div>
    </nav>
  )
}
