import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plane, ArrowRight, Calendar, ChevronRight, Compass, Plus } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import Skeleton, { SkeletonTripCard, SkeletonForecastGlance } from '../../components/Skeleton'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { WeatherIcon } from '../../lib/weatherDisplay'
import { useTrips } from './useTrips'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { capitalize } from '../../lib/format'
import { findDestinationImage } from './destinationImages'
import { geocodeCity } from '../../lib/geocode'
import { getForecast } from '../weather/weatherApi'
import planeWing from '../../assets/dashboard-plane-wing.jpg'

// The strip scrolls horizontally, so this only needs to be "enough to make
// scrolling worthwhile on a wide screen" — 2 left a large empty gap next to
// the hero on desktop even for a user with many trips.
const RECENT_TRIPS_PREVIEW_COUNT = 4
// How many of the trip's forecast days to show in the at-a-glance strip —
// capped well below a typical trip length so the module stays compact.
const GLANCE_DAY_COUNT = 5

// Both sides parsed as plain "YYYY-MM-DD" strings via `new Date(...)`, same
// convention MyTripsPage's daysUntil() uses for its own "in N days" badge —
// kept local here rather than imported since MyTripsPage doesn't export it.
function daysUntil(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(dateStr) - new Date(today)) / msPerDay)
}

// A trip you're currently on beats a merely-future one — you're literally
// traveling on it right now, more relevant than something next week — so
// this checks for an ongoing trip first (via the same tripStatus() used
// everywhere else) before falling back to the soonest future trip. Used to
// swap the hero from generic acquisition copy into "here's what's up"
// content, and to drive the forecast-at-a-glance module. Completed trips
// never qualify either way.
function pickFeaturedTrip(trips) {
  const ongoing = trips.find((t) => tripStatus(t) === 'Ongoing')
  if (ongoing) return ongoing
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = trips.filter((t) => t.start_date && t.start_date > todayStr)
  if (!upcoming.length) return null
  return [...upcoming].sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
}

export default function DashboardPage() {
  const { trips, loading, error } = useTrips()
  const destinationCount = new Set(trips.map((t) => t.destination).filter(Boolean)).size
  const recentTrips = trips.slice(0, RECENT_TRIPS_PREVIEW_COUNT)
  const featuredTrip = useMemo(() => pickFeaturedTrip(trips), [trips])
  const isOngoing = Boolean(featuredTrip) && tripStatus(featuredTrip) === 'Ongoing'

  // Hero falls back to the generic "Plan a Trip" acquisition copy once we
  // know there's no upcoming trip to show instead (no trips at all, or every
  // trip is in the past). While trips are still loading, neither variant is
  // shown — see the skeleton branch below — so the hero never commits to the
  // wrong copy and then flashes to the other one a moment later.
  const showGenericHero = !loading && !featuredTrip

  const [forecastGlance, setForecastGlance] = useState(null)
  // 'idle' (no upcoming trip) | 'loading' | 'loaded' | 'failed'
  const [glanceStatus, setGlanceStatus] = useState('idle')

  useEffect(() => {
    if (!featuredTrip?.destination) {
      setGlanceStatus('idle')
      setForecastGlance(null)
      return
    }
    let cancelled = false
    setGlanceStatus('loading')
    geocodeCity(featuredTrip.destination)
      .then((coords) => {
        if (cancelled) return
        if (!coords) {
          setGlanceStatus('failed')
          return
        }
        return getForecast(coords[0], coords[1], featuredTrip.start_date, featuredTrip.end_date).then((days) => {
          if (cancelled) return
          setForecastGlance(Array.isArray(days) ? days.slice(0, GLANCE_DAY_COUNT) : [])
          setGlanceStatus('loaded')
        })
      })
      .catch((err) => {
        console.error('Forecast-at-a-glance fetch error:', err)
        if (!cancelled) setGlanceStatus('failed')
      })
    return () => { cancelled = true }
  }, [featuredTrip?.destination, featuredTrip?.start_date, featuredTrip?.end_date])

  // The forecast module only ever has something to show once there's a real
  // upcoming trip — while still loading trips, its skeleton still reserves
  // the layout's 1/3 column so nothing jumps once loading resolves.
  const showForecastColumn = loading || Boolean(featuredTrip)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="heading-1">Welcome back</h1>
          <p className="text-body-sm text-ink-muted">Where are you heading next?</p>
        </div>
        {/* Page-level action, next to the title — same place a "+ New"
            control lives on most dashboards (GitHub repos, Linear boards).
            Plus rather than Plane so it doesn't echo the hero's own "View
            Trip"/"Plan a Trip" icon and read as a second, confusable
            version of the same action. Only shown once there's a hero
            already covering the zero-trips case with its own CTA. */}
        {!loading && trips.length > 0 && (
          <Button to="/trips/new" variant="secondary" shape="pill" size="sm" className="shrink-0">
            <Plus size={14} /> New Trip
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div
          className={`relative rounded-3xl shadow-bento-lg text-white overflow-hidden min-h-[280px] flex flex-col justify-center p-8 bg-cover ${showForecastColumn ? 'lg:col-span-2' : 'lg:col-span-3'}`}
          style={{ backgroundImage: `url(${planeWing})`, backgroundPosition: 'center 68%' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/92 via-brand-800/85 to-purple-900/70" />
          <div className="relative max-w-md">
            {loading ? (
              // Which hero variant will render isn't known until trips
              // finish loading, so this is a deliberate default guess, not
              // a guaranteed match: shaped like the upcoming-trip variant
              // (short destination name + one date line), matching
              // showForecastColumn's own default assumption below. Correct
              // for any account with a trip already planned; an account
              // that turns out to have none will briefly show this shape
              // before reflowing into the longer "Plan your perfect trip"
              // copy — a one-time state right after signup, not the
              // common case, so it's the better default to optimize for.
              <div className="space-y-3 animate-pulse">
                <div className="h-3 w-36 rounded bg-white/20" />
                <div className="h-8 w-40 rounded bg-white/20" />
                <div className="h-4 w-48 rounded bg-white/20" />
                <div className="h-10 w-32 rounded-full bg-white/20 mt-2" />
              </div>
            ) : showGenericHero ? (
              <>
                <p className="text-xs font-medium text-brand-200 mb-1">Ready for your next adventure?</p>
                <h2 className="heading-2 text-white">Plan your perfect trip</h2>
                <p className="text-sm text-brand-100 mt-2">
                  Tell us your destination and dates — Navia builds a day-by-day plan synced with the hourly forecast, so rain never ruins your plans.
                </p>
                <Button to="/trips/new" variant="onBrand" shape="pill" className="mt-5 w-fit">
                  <Plane size={16} /> Plan a Trip <ArrowRight size={14} />
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-brand-200 mb-1">{isOngoing ? 'Your current trip' : 'Your next adventure'}</p>
                <h2 className="heading-2 text-white">{capitalize(featuredTrip.destination)}</h2>
                <p className="flex items-center gap-1.5 text-sm text-brand-100 mt-2">
                  <Calendar size={14} /> {featuredTrip.start_date} &rarr; {featuredTrip.end_date}
                </p>
                <Button to={`/trips/${featuredTrip.id}`} variant="onBrand" shape="pill" className="mt-5 w-fit">
                  <Plane size={16} /> View Trip <ArrowRight size={14} />
                </Button>
              </>
            )}
          </div>
        </div>

        {showForecastColumn && (
          loading ? (
            <SkeletonForecastGlance />
          ) : (
            <Link
              to={`/trips/${featuredTrip.id}`}
              className="group min-h-[280px] flex flex-col justify-center gap-6 rounded-3xl border border-gray-200/80 shadow-bento hover:shadow-bento-hover hover:border-brand-200 transition-shadow bg-white p-6"
            >
              <div>
                <p className="text-xs font-medium text-ink-muted">{isOngoing ? "Your current trip's forecast at a glance" : "Your next trip's forecast at a glance"}</p>
                <h3 className="font-display font-semibold text-ink text-lg mt-0.5">{capitalize(featuredTrip.destination)}</h3>
                <p className="text-sm text-ink-muted mt-0.5">
                  {isOngoing
                    ? 'Enjoy your trip!'
                    : `${daysUntil(featuredTrip.start_date)} day${daysUntil(featuredTrip.start_date) === 1 ? '' : 's'} until departure`}
                </p>
              </div>

              {glanceStatus === 'loading' && (
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 h-24 rounded-xl" />
                  ))}
                </div>
              )}

              {glanceStatus === 'failed' && (
                <p className="text-sm text-ink-muted">Weather preview isn't available right now.</p>
              )}

              {glanceStatus === 'loaded' && (
                forecastGlance?.length > 0 ? (
                  <div className="flex gap-2">
                    {forecastGlance.map((day) => (
                      <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded-xl bg-surface py-3.5 px-1 group-hover:bg-surface-sunken transition-colors">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
                        </span>
                        <WeatherIcon condition={day.condition} timeStr={`${day.date}T12:00:00`} className="w-6 h-6 text-brand-500" />
                        {day.temp_max != null && day.temp_min != null && (
                          <span className="text-[11px] text-ink-muted whitespace-nowrap">
                            {Math.round(day.temp_max)}&deg;/{Math.round(day.temp_min)}&deg;
                          </span>
                        )}
                        {day.condition && (
                          // break-words needs a constrained width to actually
                          // wrap rather than just growing — without w-full it
                          // sizes to its own content and single long words
                          // like "Thunderstorm" overflow past the chip edges.
                          <span className="w-full text-[10px] text-ink-muted/80 text-center leading-tight capitalize break-words">{day.condition}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted mt-4">Weather preview isn't available right now.</p>
                )
              )}
            </Link>
          )
        )}
      </div>

      {!error && (
        <div className="flex flex-wrap gap-3">
          {loading ? (
            <>
              <Skeleton className="h-[46px] w-36 rounded-full" />
              <Skeleton className="h-[46px] w-36 rounded-full" />
            </>
          ) : trips.length > 0 ? (
            <motion.div className="flex flex-wrap gap-3" variants={GRID_VARIANTS} initial="hidden" animate="show">
              <motion.div variants={ITEM_VARIANTS} className="flex items-center gap-2 rounded-full bg-white border border-gray-200/80 shadow-bento-sm px-4 py-2.5">
                <span className="font-display font-bold text-ink tabular-nums">{trips.length}</span>
                <span className="text-xs text-ink-muted">Trips Planned</span>
              </motion.div>
              <motion.div variants={ITEM_VARIANTS} className="flex items-center gap-2 rounded-full bg-white border border-gray-200/80 shadow-bento-sm px-4 py-2.5">
                <span className="font-display font-bold text-ink tabular-nums">{destinationCount}</span>
                <span className="text-xs text-ink-muted">Destinations</span>
              </motion.div>
            </motion.div>
          ) : null}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonTripCard />
          <SkeletonTripCard />
        </div>
      )}

      {!loading && error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!loading && !error && trips.length === 0 && (
        <EmptyState
          icon={Compass}
          title="No trips yet"
          description="Plan your first weather-perfect trip and Navia will build the day-by-day plan for you."
          action={<Button to="/trips/new">Start planning</Button>}
        />
      )}

      {!loading && !error && trips.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink mb-3">Recent Trips</h3>
          <motion.div
            className="scroll-strip gap-4 -mx-1 px-1 pb-1"
            variants={GRID_VARIANTS}
            initial="hidden"
            animate="show"
          >
            {recentTrips.map((trip) => {
              const status = tripStatus(trip)
              const cardImage = findDestinationImage(trip.destination)
              return (
                <Card
                  key={trip.id}
                  as={Link}
                  to={`/trips/${trip.id}`}
                  hoverable
                  variants={ITEM_VARIANTS}
                  className="group relative block w-72 sm:w-80 shrink-0 snap-start overflow-hidden hover:border-brand-300"
                >
                  <div
                    className={`h-48 overflow-hidden ${cardImage ? '' : 'bg-gradient-to-br from-brand-400 to-purple-400'} ${cardImage && cardImage.fit !== 'contain' ? 'bg-cover' : ''} bg-center transition-transform duration-500 group-hover:scale-105`}
                    style={
                      cardImage
                        ? cardImage.fit === 'contain'
                          ? {
                              backgroundImage: `url(${cardImage.url}), linear-gradient(to bottom right, #818cf8, #c084fc)`,
                              backgroundSize: 'contain, cover',
                              backgroundPosition: `${cardImage.position}, center`,
                              backgroundRepeat: 'no-repeat, no-repeat',
                            }
                          : { backgroundImage: `url(${cardImage.url})`, backgroundPosition: cardImage.position }
                        : undefined
                    }
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 pb-3.5 pt-10">
                    <span className={`inline-block mb-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                      {status}
                    </span>
                    <p className="font-display font-semibold text-white text-lg leading-tight">{capitalize(trip.name)}</p>
                    <p className="flex items-center gap-1.5 text-xs text-white/80 mt-1">
                      <Calendar size={12} /> {trip.start_date} &rarr; {trip.end_date}
                    </p>
                  </div>
                </Card>
              )
            })}
            {trips.length > recentTrips.length && (
              <Card
                as={Link}
                to="/trips"
                hoverable
                variants={ITEM_VARIANTS}
                className="group flex h-48 w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 border-dashed text-ink-muted hover:border-brand-300 hover:text-brand-600"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-colors group-hover:bg-brand-50">
                  <ChevronRight size={16} />
                </span>
                <span className="text-sm font-medium">View all</span>
                <span className="text-xs">{trips.length} trips</span>
              </Card>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}
