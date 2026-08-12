import { Outlet, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../lib/motion'
import { DESTINATION_IMAGES } from '../features/trips/destinationImages'
import logo from '../assets/logo.png'
import NaviaWordmark from './NaviaWordmark'

export default function AuthLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div
        className="relative hidden lg:flex flex-col justify-between p-10 text-white bg-cover bg-center"
        style={{ backgroundImage: `url(${DESTINATION_IMAGES.Prague.url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/70 to-purple-900/50" />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logo} alt="" className="w-full h-full object-cover" />
          </span>
          <NaviaWordmark className="h-4 w-auto" accentClassName="text-brand-300" />
        </Link>
        <div className="relative max-w-md">
          <p className="font-display font-bold text-4xl leading-tight">
            Weather-perfect trips, without the guesswork.
          </p>
          <p className="mt-4 text-brand-100 text-body-lg">
            83% of travelers have had a holiday ruined by bad weather. Navia makes sure yours isn't next.
          </p>
        </div>
        <p className="relative text-xs text-brand-200">Aegis Innovation Competition 2026</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          key={location.pathname}
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={EASE_OUT}
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={logo} alt="" className="w-full h-full object-cover" />
            </span>
            <NaviaWordmark className="h-5 w-auto text-ink" />
          </div>
          <Outlet />
        </motion.div>
      </div>
    </div>
  )
}
