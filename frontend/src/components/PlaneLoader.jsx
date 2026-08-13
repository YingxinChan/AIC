import { motion, useReducedMotion } from 'framer-motion'
import { Plane } from 'lucide-react'

// A branded stand-in for the biggest, most-noticed loading moments (a hero
// waiting on its first trip, a whole itinerary page still fetching) — a
// plane crossing a dashed flight path instead of another gray shimmer bar.
// Reserved for those "this is the whole thing you're waiting for" spots;
// per-line content placeholders (Skeleton.jsx) stay plain shimmer, since
// their job is previewing content shape, not filling dead air.
export default function PlaneLoader({ label, dark = false, className = '' }) {
  const prefersReducedMotion = useReducedMotion()
  const trackClass = dark ? 'border-white/20' : 'border-brand-200'
  const planeClass = dark ? 'text-white' : 'text-brand-500'
  const labelClass = dark ? 'text-brand-100' : 'text-ink-muted'

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="relative w-40 h-8 overflow-hidden">
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed ${trackClass}`} aria-hidden="true" />
        {prefersReducedMotion ? (
          <Plane size={20} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 ${planeClass}`} aria-hidden="true" />
        ) : (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2"
            initial={{ left: '-10%' }}
            animate={{ left: '105%' }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <Plane size={20} className={`rotate-45 ${planeClass}`} />
          </motion.div>
        )}
      </div>
      {label ? <p className={`text-sm ${labelClass}`}>{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  )
}
