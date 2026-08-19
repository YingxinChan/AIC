import { Outlet, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EASE_OUT } from '../lib/motion'
import logo from '../assets/logo.png'
import NaviaWordmark from './NaviaWordmark'
import SplitFlapText from './SplitFlapText'

// Impeccable surface concept-seed roll (scope=surface, mode=operate):
// assigned candidate — split-flap board header on a single centered ticket
// card. Same visual technique the landing page's weather demo used, but
// played once on mount instead of looping, since this surface is Operate
// (get signed in) not Persuade (hold attention) — see SplitFlapText.jsx.
const HEADER_WORDS = {
  login: ['CHECKING IN…', 'WELCOME BACK'],
  register: ['NEW BOOKING…', 'WELCOME ABOARD'],
}

export default function AuthLayout() {
  const location = useLocation()
  const isRegister = location.pathname.startsWith('/register')

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 bg-brand-950 overflow-hidden">
      <div className="absolute inset-0 barcode-strip text-white/[0.11]" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={EASE_OUT}
        className="relative w-full max-w-sm"
      >
        <div className="bg-surface text-ink rounded-2xl shadow-ticket overflow-hidden">
          <div className="flex flex-col items-center gap-3 px-8 pt-8 pb-6 text-center">
            <Link to="/" className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img src={logo} alt="" className="w-full h-full object-cover" />
              </span>
              <NaviaWordmark className="h-5 w-auto" />
            </Link>
            <SplitFlapText
              words={isRegister ? HEADER_WORDS.register : HEADER_WORDS.login}
              className="font-mono text-[11px] tracking-wide text-ink-muted uppercase"
              aria-hidden="true"
            />
          </div>

          <div className="ticket-divider-h bg-surface" aria-hidden="true" />
          <div className="px-8 pt-7 pb-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={EASE_OUT}
            >
              <Outlet />
            </motion.div>
          </div>

          <div className="h-8 barcode-strip text-brand-900/60" aria-hidden="true" />
        </div>

        <p className="mt-6 text-center text-xs text-brand-300">Aegis Innovation Competition 2026</p>
      </motion.div>
    </div>
  )
}
