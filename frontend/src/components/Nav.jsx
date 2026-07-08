import { Link, useLocation } from 'react-router-dom'
import { Plane, Home, Briefcase, User } from 'lucide-react'

export default function Nav() {
  const { pathname } = useLocation()
  const isHome = pathname === '/dashboard'
  const isMyTrips = pathname.startsWith('/trips')
  const isAccount = pathname === '/account'

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Plane size={16} className="text-white" />
          </span>
          SmartTrip<span className="text-indigo-600">AI</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${isHome ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Home size={16} /> Home
          </Link>
          <Link
            to="/trips"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${isMyTrips ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Briefcase size={16} /> My Trips
          </Link>
          <Link
            to="/account"
            aria-label="Account"
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${isAccount ? 'border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-500 hover:text-gray-900'}`}
          >
            <User size={16} />
          </Link>
        </div>
      </div>
    </nav>
  )
}
