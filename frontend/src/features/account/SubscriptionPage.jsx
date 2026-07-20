import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'

const sharedFeatures = [
  'Weather and climate insights',
  'Weather-risk alerts',
  'Activity alternatives and itinerary updates',
]

const plans = [
  {
    id: 'single',
    label: 'Single',
    name: 'Single Trip Pass',
    price: '£4.99',
    cadence: 'one-time',
    description: 'Access for one complete trip',
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
  },
]

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState('single')

  return (
    <div className="space-y-6">
      <Link
        to="/account"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Account
      </Link>

      <section className="rounded-3xl border border-gray-300 bg-white px-5 py-10 shadow-sm sm:px-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Plan
          </h1>

          <p className="mt-3 text-gray-500">
            Choose how long you would like to use SmartTrip AI.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-gray-300 bg-gray-50 p-6 sm:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Feature highlights
          </h2>

          <ul className="mt-6 space-y-5">
            {sharedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-base text-gray-700"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <Check size={15} strokeWidth={3} aria-hidden="true" />
                </span>

                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                aria-pressed={isSelected}
                className={`rounded-2xl border-2 px-5 py-6 text-center transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                    : 'border-gray-300 bg-white text-gray-900 hover:border-indigo-400 hover:bg-indigo-50'
                }`}
              >
                <span className="block text-xl font-bold">{plan.label}</span>

                <span className="mt-3 block text-3xl font-bold">
                  {plan.price}
                </span>

                <span
                  className={`mt-1 block text-sm ${
                    isSelected ? 'text-indigo-100' : 'text-gray-500'
                  }`}
                >
                  {plan.cadence}
                </span>

                <span
                  className={`mt-3 block text-sm ${
                    isSelected ? 'text-indigo-100' : 'text-gray-600'
                  }`}
                >
                  {plan.description}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          All plans include the same core SmartTrip AI features. Only the access
          period differs.
        </p>
      </section>
    </div>
  )
}
