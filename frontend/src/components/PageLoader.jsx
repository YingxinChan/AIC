import { motion, useReducedMotion } from 'framer-motion'
import { Plane } from 'lucide-react'

// A full takeover of the page's content area while its data loads — one
// confident animation, not a patchwork of shimmer rectangles. Reserved for
// "the whole page is waiting on its first load" (Dashboard/MyTrips/
// Itinerary's initial fetch); per-item lists that are just refreshing a
// known shape still use Skeleton.jsx.
export default function PageLoader({ label = 'Loading…' }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-6" role="status" aria-live="polite">
      <div className="relative w-64 sm:w-80 h-16">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-brand-200" aria-hidden="true" />
        {prefersReducedMotion ? (
          <Plane size={32} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 text-brand-600" aria-hidden="true" />
        ) : (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2"
            initial={{ left: '-10%' }}
            animate={{ left: '105%' }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <Plane size={32} className="rotate-45 text-brand-600" />
          </motion.div>
        )}
      </div>
      {/* The visible label itself is the accessible name here (role="status"
          + aria-live already announce it) — a separate sr-only "Loading"
          span would just duplicate it for screen readers and double-match
          any test querying by /loading/i. */}
      <p className="font-mono text-xs tracking-wide uppercase text-ink-muted">{label}</p>
    </div>
  )
}
