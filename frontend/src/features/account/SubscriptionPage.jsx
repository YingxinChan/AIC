import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CloudSun, AlertTriangle, RefreshCw, Check } from 'lucide-react'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { useToast } from '../../components/Toast'
import Button from '../../components/Button'

const sharedFeatures = [
  { icon: CloudSun, text: 'Weather and climate insights' },
  { icon: AlertTriangle, text: 'Weather-risk alerts' },
  { icon: RefreshCw, text: 'Activity alternatives and itinerary updates' },
]

const plans = [
  {
    id: 'single',
    label: 'Single',
    name: 'Single Trip Pass',
    price: '£4.99',
    cadence: 'one-time',
    description: 'Access for one complete trip',
    badge: 'Recommended',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    name: 'Monthly Explorer',
    price: '£8.99',
    cadence: 'per month',
    description: 'Unlimited trips while subscribed',
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    name: 'Lifetime Explorer',
    price: '£59.99',
    cadence: 'one-time',
    description: 'Ongoing lifetime access',
    badge: 'Best value',
    // £59.99 / £4.99 ≈ 12.02 — Lifetime only comes out cheaper than paying
    // per trip once you've taken 13 single trips.
    footnote: 'Cheaper than paying per trip after 13 trips',
  },
]

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState('single')
  const toast = useToast()
  const selected = plans.find((plan) => plan.id === selectedPlan)

  const handleContinue = () => {
    toast.show("Checkout isn't available in this preview — thanks for trying Navia!")
  }

  return (
    <div className="space-y-6">
      <Link
        to="/account"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to Account
      </Link>

      {/* Impeccable surface concept-seed roll (scope=surface, mode=persuade):
          assigned candidate — a check-in desk. The navy band above the
          perforation is the counter, the mono tag is the desk number, and
          the three plans below are stubs the agent hands you, not a plain
          bordered pricing grid. Says "plan," not "fare" — this is a
          subscription tier, not a flight, and reusing "book"/"fare" language
          from the actual flight-booking flow risked a cold user thinking
          they'd landed on a booking screen (clarify pass). */}
      <section className="rounded-3xl bg-surface shadow-ticket overflow-hidden">
        <div className="bg-brand-900 text-white px-6 py-10 sm:px-10 text-center">
          <p className="font-mono text-[11px] tracking-wide text-brand-300 uppercase">Desk 01 · Plan select</p>
          <h1 className="heading-display mt-2 text-white">Which plan would you like?</h1>
          <p className="mt-3 text-body-sm text-brand-100 max-w-lg mx-auto">
            Every plan includes the same weather-adaptive itinerary. Only your access window changes.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 max-w-2xl mx-auto">
            {sharedFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-brand-100">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-brand-200">
                  <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 pt-9 pb-8 sm:px-10">
          <motion.div
            className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3"
            variants={GRID_VARIANTS}
            initial="hidden"
            animate="show"
          >
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id

              return (
                <motion.button
                  key={plan.id}
                  type="button"
                  layout
                  variants={ITEM_VARIANTS}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={isSelected}
                  className={`relative rounded-2xl border-2 px-5 py-6 text-center transition ${
                    isSelected
                      ? 'border-brand-600 bg-surface shadow-bento-hover'
                      : 'border-brand-100 bg-surface hover:border-brand-300'
                  }`}
                >
                  {(isSelected || plan.badge) && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        isSelected ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                      {isSelected ? 'Selected' : plan.badge}
                    </span>
                  )}

                  <span className="block text-body-sm font-semibold uppercase tracking-wide text-ink-muted">
                    {plan.label}
                  </span>

                  <span className="mt-3 block font-mono text-3xl font-bold text-ink">{plan.price}</span>

                  <span className="mt-1 block text-sm text-ink-muted">{plan.cadence}</span>

                  <span className="mt-3 block text-sm text-ink-muted">{plan.description}</span>

                  {plan.footnote && (
                    <span className="mt-2 block text-xs text-ink-muted">{plan.footnote}</span>
                  )}
                </motion.button>
              )
            })}
          </motion.div>
        </div>

        <div className="h-8 barcode-strip text-brand-900/60" aria-hidden="true" />

        <div className="flex flex-col items-center gap-3 px-6 py-8 sm:px-10">
          <Button onClick={handleContinue} shape="pill" size="lg">
            Continue with {selected.name}
          </Button>
          <p className="text-xs text-ink-muted">This is a prototype checkout — no payment is actually taken.</p>
        </div>
      </section>
    </div>
  )
}
