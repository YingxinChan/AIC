import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CloudRain, CloudSun, Shuffle, MapPinned } from 'lucide-react'
import Card from '../../components/Card'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'

const BULLETS = [
  { icon: CloudRain, text: 'Reads the hourly forecast, not just today’s headline' },
  { icon: Shuffle, text: 'Swaps a rained-out activity for an indoor alternative nearby' },
  { icon: MapPinned, text: 'Keeps the rest of the day’s route efficient after the swap.' },
]

export default function WeatherSwapDemo() {
  const prefersReducedMotion = useReducedMotion()
  const [isRaining, setIsRaining] = useState(!!prefersReducedMotion)
  // Paused on hover/focus — a first-time visitor reading the bullets beside
  // this card was often still on the first one by the time the demo had
  // already auto-cycled past the state it describes.
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion || paused) return
    const id = setInterval(() => {
      setIsRaining((prev) => !prev)
    }, 3500)
    return () => clearInterval(id)
  }, [prefersReducedMotion, paused])

  return (
    <section id="adapts" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="eyebrow">See it in action</p>
          <h2 className="heading-1 mt-2">When the forecast changes, so does your day</h2>
          <motion.ul
            className="mt-8 space-y-5"
            variants={GRID_VARIANTS}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
          >
            {BULLETS.map(({ icon: Icon, text }) => (
              <motion.li key={text} variants={ITEM_VARIANTS} className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </span>
                <span className="text-body-sm text-ink-muted mt-1.5">{text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <Card
          elevation="lg"
          className="p-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="flex items-center justify-between">
            <h3 className="heading-3">Barcelona · Day 3</h3>
            <AnimatePresence mode="wait">
              {isRaining ? (
                <motion.span
                  key="rain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700"
                >
                  <CloudRain size={14} /> 14°C, rain
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-accent-100 text-accent-700"
                >
                  <CloudSun size={14} /> 22°C, clear
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 space-y-3">
            <AnimatePresence mode="wait">
              {isRaining ? (
                <motion.div
                  key="rain-activities"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">Picasso Museum</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        indoor
                      </span>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        <CloudRain size={12} /> Swapped
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">Tapas dinner in El Born</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        indoor
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="sun-activities"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">Park Güell walking tour</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        outdoor
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">Tapas dinner in El Born</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        indoor
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </section>
  )
}
