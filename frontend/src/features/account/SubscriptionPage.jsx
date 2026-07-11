import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'

const plans = [
  {
    name: 'Single Trip Pass',
    cadence: 'One-Time',
    price: '£4.99',
    badge: null,
    features: [
      '1 complete trip itinerary',
      'Advanced storm predictions',
      'Smart activity-swapping logic',
      'Basic email support',
    ],
  },
  {
    name: 'Pro Traveler',
    cadence: 'Monthly',
    price: '£9.99',
    period: '/mo',
    badge: 'Most Popular',
    featured: true,
    features: [
      'Unlimited saved trips',
      'Continuous ML forecasting',
      'Real-time activity alerts',
      'Cancel anytime',
    ],
  },
  {
    name: 'Lifetime Explorer',
    cadence: 'Lifetime',
    price: '£59.99',
    badge: 'Best Value',
    features: [
      'Pay once, plan forever',
      'Unlimited everything',
      'Early access to ML models',
      'Priority 24/7 support',
    ],
  },
]

export default function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/account"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Account
      </Link>

      <section className="pb-8">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Upgrade Your Plan
          </h1>

          <p className="mt-3 text-base text-gray-500 sm:text-lg">
            Choose the plan that fits your travel lifestyle.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.featured === true

            return (
              <article
                key={plan.name}
                className={`relative flex min-h-[390px] flex-col rounded-2xl border-2 p-7 ${
                  featured
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl'
                    : 'border-gray-200 bg-white text-gray-900 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
                      featured
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className={plan.badge ? 'pr-28' : ''}>
                  <h2
                    className={`text-sm font-semibold ${
                      featured ? 'text-indigo-100' : 'text-gray-500'
                    }`}
                  >
                    {plan.name} ({plan.cadence})
                  </h2>
                </div>

                <div className="mt-3 flex items-baseline">
                  <span className="text-4xl font-bold tracking-tight">
                    {plan.price}
                  </span>

                  {plan.period && (
                    <span
                      className={`ml-1 text-lg font-semibold ${
                        featured ? 'text-indigo-100' : 'text-gray-500'
                      }`}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>

                <div className="mt-8 flex-1">
                  <p
                    className={`text-xs font-bold tracking-wider ${
                      featured ? 'text-indigo-100' : 'text-gray-400'
                    }`}
                  >
                    FEATURE HIGHLIGHTS:
                  </p>

                  <ul className="mt-4 space-y-4">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-3 text-sm ${
                          featured ? 'text-white' : 'text-gray-600'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            featured
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          <Check size={13} strokeWidth={3} aria-hidden="true" />
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className={`mt-8 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    featured
                      ? 'bg-white text-indigo-700 hover:bg-indigo-50'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Select Plan
                </button>
              </article>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          All plans include SSL security. Cancel anytime. No hidden fees.
        </p>

        {/*
          TODO: Confirm final plan names, prices, billing periods and
          feature descriptions with the team before shipping.
        */}
      </section>
    </div>
  )
}
