import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CloudSun, AlertTriangle, RefreshCw } from 'lucide-react'
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
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Account
      </Link>

      <section className="rounded-3xl border border-gray-200/80 bg-white px-5 py-10 shadow-bento-lg sm:px-10">
        <header className="text-center">
          <p className="eyebrow">Subscription</p>
          <h1 className="heading-display mt-2">
            Plan
          </h1>

          <p className="mt-3 text-body-sm text-ink-muted">
            Choose how long you would like to use Navia.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-surface ring-1 ring-gray-200/70 p-6 sm:p-8">
          <p className="eyebrow">Feature highlights</p>

          <ul className="mt-6 space-y-5">
            {sharedFeatures.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 text-base text-gray-700"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 text-brand-600">
                  <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
                </span>

                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3"
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
                    ? 'border-brand-600 bg-brand-600 text-white shadow-brand-glow'
                    : 'border-gray-200 bg-white shadow-bento-sm text-ink hover:border-brand-300 hover:shadow-bento-hover'
                }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      isSelected ? 'bg-accent-400 text-ink' : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <span className="block text-body-sm font-semibold uppercase tracking-wide">{plan.label}</span>

                <span className="mt-3 block font-display text-3xl font-bold">
                  {plan.price}
                </span>

                <span
                  className={`mt-1 block text-sm ${
                    isSelected ? 'text-brand-100' : 'text-gray-500'
                  }`}
                >
                  {plan.cadence}
                </span>

                <span
                  className={`mt-3 block text-sm ${
                    isSelected ? 'text-brand-100' : 'text-gray-600'
                  }`}
                >
                  {plan.description}
                </span>

                {plan.footnote && (
                  <span
                    className={`mt-2 block text-xs ${
                      isSelected ? 'text-brand-100' : 'text-ink-muted'
                    }`}
                  >
                    {plan.footnote}
                  </span>
                )}
              </motion.button>
            )
          })}
        </motion.div>

        <p className="mt-8 text-center text-body-sm text-ink-muted">
          All plans include the same core Navia features. Only the access
          period differs.
        </p>

        <div className="mt-6 flex justify-center">
          <Button onClick={handleContinue} shape="pill" size="lg">
            Continue with {selected.name}
          </Button>
        </div>
      </section>
    </div>
  )
}
