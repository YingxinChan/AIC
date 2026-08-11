import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import logo from '../assets/logo.png'
import { getMotionComponent } from '../lib/motionComponent'
import { SPRING_POP } from '../lib/motion'

const MotionLink = getMotionComponent(Link)

export default function Nav() {
  const { pathname } = useLocation()
  const isHome = pathname === '/dashboard'
  const isMyTrips = pathname.startsWith('/trips')
  const isAccount = pathname === '/account'

  return (
    <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200/70">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-ink text-xl">
          <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logo} alt="Navia" className="w-full h-full object-cover" />
          </span>
          <span>Nav<span className="text-brand-600">ia</span></span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/dashboard"
            aria-label="Home"
            className={`relative px-3 py-1.5 rounded-full font-medium transition-colors ${isHome ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {isHome && (
              <motion.span
                layoutId="navIndicator"
                transition={SPRING_POP}
                className="absolute inset-0 rounded-full ring-1 ring-brand-200"
              />
            )}
            <span className="relative">Home</span>
          </Link>
          <Link
            to="/trips"
            aria-label="My Trips"
            className={`relative px-3 py-1.5 rounded-full font-medium transition-colors ${isMyTrips ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {isMyTrips && (
              <motion.span
                layoutId="navIndicator"
                transition={SPRING_POP}
                className="absolute inset-0 rounded-full ring-1 ring-brand-200"
              />
            )}
            <span className="relative">My Trips</span>
          </Link>
          <MotionLink
            whileTap={{ scale: 0.9 }}
            to="/account"
            aria-label="Account"
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${isAccount ? 'border-brand-600 text-brand-600' : 'border-gray-300 text-gray-500 hover:text-gray-900'}`}
          >
            <User size={16} />
          </MotionLink>
        </div>
      </div>
    </nav>
  )
}
