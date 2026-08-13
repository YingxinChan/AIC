import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Nav from './Nav'
import { EASE_OUT } from '../lib/motion'

export default function AppLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-surface relative">
      <div className="absolute inset-x-0 top-0 h-64 bg-brand-mesh opacity-[0.04] pointer-events-none" />
      <Nav />
      <motion.main
        key={location.pathname}
        className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={EASE_OUT}
      >
        <Outlet />
      </motion.main>
    </div>
  )
}
