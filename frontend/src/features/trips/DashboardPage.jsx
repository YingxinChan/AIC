import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plane, ArrowRight, ChevronRight, Calendar, Compass, Plus } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import PageLoader from '../../components/PageLoader'
import Skeleton from '../../components/Skeleton'
import { GRID_VARIANTS, ITEM_VARIANTS } from '../../lib/motion'
import { WeatherIcon } from '../../lib/weatherDisplay'
import { useTrips } from './useTrips'
import { tripStatus } from './tripStatus'
import { cityCode, cityOnly } from '../../lib/format'
import TripTicketCard from './TripTicketCard'
import { geocodeCity } from '../../lib/geocode'
import { getForecast } from '../weather/weatherApi'

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

      {/* A full-page takeover while trips load — not a patchwork of a small
          hero animation plus gray shimmer everywhere else below it. Once
          this resolves, the real content (hero, stats, trips list) mounts
          all at once. */}
      {loading ? (
        <PageLoader label="Loading your trips…" />
      ) : (
      <>
      {/* Impeccable relayout: hero and forecast-at-a-glance used to be two
          separate boxes side by side in a 3-col grid — an ordinary
          dashboard-widget arrangement. They're one boarding pass now: a
          torn-stub column on the right of the main coupon (same anatomy as
          the landing page's own TicketArtifact — main coupon | perforation |
          stub), a second tear (ticket-divider-h) into the forecast below.
          The stub's own notches + "BOARDING PASS" tag already say "ticket"
          clearly — an extra full-bleed barcode texture behind the coupon
          text was redundant with it and dropped during a distill pass. */}
      <div className="rounded-2xl shadow-ticket overflow-hidden">
        <div className="grid grid-cols-[1fr_auto]">
          <div className="relative text-white overflow-hidden min-h-[220px] flex bg-brand-900">
            <div className="relative flex-1 flex flex-col justify-center p-8">
            <div className="relative max-w-md">
              {showGenericHero ? (
                <>
                  <p className="font-mono text-[11px] tracking-wide uppercase text-brand-300">Ready for your next adventure?</p>
                  <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mt-1.5">Plan your perfect trip</h2>
                  <p className="text-sm text-brand-100 mt-2">
                    Tell us your destination and dates — Navia builds a day-by-day plan synced with the hourly forecast, so rain never ruins your plans.
                  </p>
                  <Button to="/trips/new" variant="onBrand" shape="pill" className="mt-5 w-fit">
                    <Plane size={16} /> Plan a Trip <ArrowRight size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-mono text-[11px] tracking-wide uppercase text-brand-300">{isOngoing ? 'Your current trip' : 'Your next adventure'}</p>
                  <h2 className="font-display text-5xl sm:text-6xl font-bold text-white mt-1.5 leading-none">{cityOnly(featuredTrip.destination)}</h2>
                  <p className="flex items-center gap-1.5 text-sm text-brand-100 mt-2 font-mono">
                    <Calendar size={14} /> {featuredTrip.start_date} &rarr; {featuredTrip.end_date}
                  </p>
                  <Button to={`/trips/${featuredTrip.id}`} variant="onBrand" shape="pill" className="mt-5 w-fit">
                    <Plane size={16} /> View Trip <ArrowRight size={14} />
                  </Button>
                </>
              )}
            </div>
            </div>
          </div>

          {/* The torn stub — static branding, not trip data, so it renders
              identically across the loading/generic/featured states above
              instead of needing its own three-way conditional. Wide and
              confident on purpose — a real boarding-pass stub is a
              proportionally large chunk of the document, not a sliver. */}
          <div className="ticket-divider hidden sm:flex flex-col items-center justify-center gap-3 w-20 sm:w-24 shrink-0 bg-brand-950 text-brand-200 [--ticket-notch:theme(colors.brand.950)]">
            {!showGenericHero && (
              <p className="font-display font-bold text-xl text-white leading-none">{cityCode(featuredTrip.destination)}</p>
            )}
            <Plane size={20} className="text-brand-400 rotate-45" />
            <span className="font-mono text-xs font-bold tracking-[0.25em] [writing-mode:vertical-rl]">BOARDING PASS</span>
          </div>
        </div>

        {showForecastColumn && (
            <>
            <div className="ticket-divider-h bg-surface" aria-hidden="true" />
            <Link
              to={`/trips/${featuredTrip.id}`}
              className="group flex flex-col gap-6 hover:bg-surface-sunken transition-colors bg-surface p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            >
              <div>
                <p className="font-mono text-[11px] tracking-wide uppercase text-ink-muted">{isOngoing ? "Your current trip's forecast at a glance" : "Your next trip's forecast at a glance"}</p>
                <h3 className="font-display font-semibold text-ink text-lg mt-1">{cityOnly(featuredTrip.destination)}</h3>
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
                      <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 rounded-xl bg-surface-sunken py-3.5 px-1 group-hover:bg-white transition-colors">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
                        </span>
                        <WeatherIcon condition={day.condition} timeStr={`${day.date}T12:00:00`} className="w-6 h-6 text-brand-500" />
                        {day.condition && (
                          // break-words needs a constrained width to actually
                          // wrap rather than just growing — without w-full it
                          // sizes to its own content and single long words
                          // like "Thunderstorm" overflow past the chip edges.
                          <span className="w-full text-[10px] text-ink-muted text-center leading-tight capitalize break-words">{day.condition}</span>
                        )}
                        {day.temp_max != null && day.temp_min != null && (
                          <span className="text-[11px] text-ink-muted whitespace-nowrap">
                            {Math.round(day.temp_max)}&deg;/{Math.round(day.temp_min)}&deg;
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted mt-4">Weather preview isn't available right now.</p>
                )
              )}
            </Link>
            </>
        )}
      </div>

      {!error && trips.length > 0 && (
        <motion.div className="flex flex-wrap gap-3" variants={GRID_VARIANTS} initial="hidden" animate="show">
          <motion.div variants={ITEM_VARIANTS} className="flex items-center gap-2 rounded-full bg-surface border border-brand-100 px-4 py-2.5">
            <span className="font-mono font-bold text-ink tabular-nums">{trips.length}</span>
            <span className="text-xs text-ink-muted">Trips Planned</span>
          </motion.div>
          <motion.div variants={ITEM_VARIANTS} className="flex items-center gap-2 rounded-full bg-surface border border-brand-100 px-4 py-2.5">
            <span className="font-mono font-bold text-ink tabular-nums">{destinationCount}</span>
            <span className="text-xs text-ink-muted">Destinations</span>
          </motion.div>
        </motion.div>
      )}

      {error && <ErrorMessage message="Something went wrong while loading your trips." />}

      {!error && trips.length === 0 && (
        <EmptyState
          icon={Compass}
          title="No trips yet"
          description="Plan your first weather-perfect trip and Navia will build the day-by-day plan for you."
          action={<Button to="/trips/new">Start planning</Button>}
        />
      )}

      {/* Horizontal-scroll strip of ticket-styled photo cards — a block-card
          rail, not the full-width booklet-row layout (that stays on
          MyTripsPage). */}
      {!error && trips.length > 0 && (
        <div>
          <h3 className="heading-3 mb-3">Recent Trips</h3>
          <motion.div
            className="scroll-strip gap-4 -mx-1 px-1 pb-1"
            variants={GRID_VARIANTS}
            initial="hidden"
            animate="show"
          >
            {recentTrips.map((trip) => (
              <motion.div key={trip.id} variants={ITEM_VARIANTS} className="w-72 sm:w-80 shrink-0 snap-start">
                <TripTicketCard trip={trip} />
              </motion.div>
            ))}
            {trips.length > recentTrips.length && (
              <Card
                as={Link}
                to="/trips"
                hoverable
                variants={ITEM_VARIANTS}
                className="group flex h-48 w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 border-dashed !border-brand-200 text-ink-muted hover:!border-brand-300 hover:text-brand-600"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken transition-colors group-hover:bg-brand-50">
                  <ChevronRight size={16} />
                </span>
                <span className="text-sm font-medium">View all</span>
                <span className="text-xs">{trips.length} trips</span>
              </Card>
            )}
          </motion.div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
