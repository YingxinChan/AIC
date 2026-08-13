import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, animate } from 'framer-motion'
import { SPRING_SOFT } from '../../lib/motion'
import {
  Plane, Thermometer, MapPin, Zap, Briefcase, ArrowRight,
  Menu, Mail, X, Quote,
} from 'lucide-react'
import Button from '../../components/Button'
import NaviaWordmark from '../../components/NaviaWordmark'
import { GRID_VARIANTS, ITEM_VARIANTS, STRIP_VARIANTS } from '../../lib/motion'
import { useDragScroll } from '../../lib/useDragScroll'
import { DESTINATION_IMAGES } from '../trips/destinationImages'
import WeatherSwapDemo from './WeatherSwapDemo'
import logo from '../../assets/logo.png'

// Each row reads as one segment of a single travel document — a
// multi-leg ticket, not six same-size icon cards (see index.html's
// direction contract: "not the bento-card SaaS shape this category
// always ships").
const FEATURES = [
  {
    icon: Thermometer,
    title: 'Weather-Synced Plans',
    description: 'Navia checks hourly forecasts for every day of your trip and times outdoor and indoor activities around them.',
  },
  {
    icon: MapPin,
    title: 'Smart Routing',
    description: 'We group attractions by location and weather to minimize travel time and maximize fun.',
  },
  {
    icon: Plane,
    title: 'Seamless Logistics',
    description: 'Add your flight and hotel details once, and Navia schedules activities around your check-in, check-out, and departure times.',
  },
  {
    icon: Zap,
    title: 'Real-Time Adjustments',
    description: 'If the forecast changes, your itinerary automatically adapts with smart backups.',
  },
  {
    icon: Mail,
    title: 'Daily Trip Alerts',
    description: 'Get a short email the morning your plan changes, so you\'re never caught off guard.',
  },
  {
    icon: Briefcase,
    title: 'Trip Dashboard',
    description: 'Manage your interactive day-by-day plans from a beautiful, mobile-friendly dashboard.',
  },
]

// A wider stagger than the page's default GRID_VARIANTS (50ms) — this list
// is long enough (6 rows) that the reveal should read clearly as "one
// after another," not just a slightly-offset fade. All rows stay visible
// once shown; only the entrance is sequenced.
const FEATURE_LIST_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const CONTROLS = [
  { tag: 'SET', title: 'Tell us where and when', description: 'Pick your destination and travel dates. Navia takes it from there.' },
  { tag: 'READ', title: 'Navia reads the hourly forecast', description: 'Hourly weather for every day of your trip, turned into real risk scores for rain, heat, and wind — not just a daily summary.' },
  { tag: 'REFLOW', title: 'Your board updates itself', description: 'If rain moves in, indoor and outdoor activities swap automatically. No manual re-planning.' },
]

// The same board grammar tells two different stories on this page: a
// day-by-day itinerary in the hero, and a competitor comparison here.
// One status column, one reserved amber state — "reflows live" is the
// entire pitch, said once and shown twice.
const POSITIONING_ROWS = [
  { name: 'BOOKING PLATFORMS', detail: 'Book it, then hope', status: 'STATIC', changed: false },
  { name: 'WEATHER APPS', detail: 'Raw data, no decision', status: 'STATIC', changed: false },
  { name: 'NAVIA', detail: 'Reads the forecast, reissues the plan', status: 'REFLOWS LIVE', changed: true },
]

const BOARD_COLUMNS = 'minmax(64px,auto) 1fr minmax(96px,auto)'

function StatCounter({ value, suffix = '%' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [isInView, value])

  return (
    <span ref={ref} className="font-mono">
      {display}
      {suffix}
    </span>
  )
}

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#adapts', label: 'See it adapt' },
  { href: '#cities', label: 'Cities' },
  { href: '#why-navia', label: 'Why Navia' },
]

// The departures-board device (see index.html's direction contract): dark
// panel, ranked rows, tabular mono type, ONE reserved amber "changed"
// state. Used below for the "Why Navia" competitor comparison — the hero
// keeps to the boarding-pass ticket alone (see TicketArtifact) so the two
// don't duplicate each other in the same viewport.
function Board({ label, colLabels, children }) {
  return (
    <div className="rounded-2xl bg-brand-900 text-white shadow-ticket overflow-hidden">
      <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/10">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand-200 uppercase">{label}</p>
        <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" aria-hidden="true" />
      </div>
      <div
        className="grid px-5 sm:px-6 py-2 text-[10px] font-mono uppercase tracking-wide text-brand-300 border-b border-white/10"
        style={{ gridTemplateColumns: BOARD_COLUMNS }}
      >
        {colLabels.map((c, i) => (
          <span key={c} className={i === colLabels.length - 1 ? 'text-right' : ''}>{c}</span>
        ))}
      </div>
      {children}
    </div>
  )
}

function BoardRow({ cells, changed }) {
  return (
    <motion.div
      layout
      animate={{ backgroundColor: changed ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0)' }}
      transition={{ duration: 0.6 }}
      className="grid items-center px-5 sm:px-6 py-3.5 border-b border-white/5 last:border-0"
      style={{ gridTemplateColumns: BOARD_COLUMNS }}
    >
      {cells}
    </motion.div>
  )
}

// The hero's sole artifact — a single passenger's ticket, reissued. Shown
// at every breakpoint (not just desktop), since it's no longer sharing
// the hero with a second component.
function TicketArtifact() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -8 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={SPRING_SOFT}
      className="relative mx-auto w-full max-w-sm"
    >
      <div className="bg-surface text-ink rounded-2xl shadow-ticket overflow-hidden">
        <div className="grid grid-cols-[1fr_auto]">
          <div className="p-6">
            <p className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">Passenger</p>
            <p className="font-display font-bold text-lg leading-tight">Alex Chen</p>

            <div className="mt-4">
              <p className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">Original</p>
              <p className="text-ink-muted line-through decoration-2">Beach Day, Nice</p>
            </div>

            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-500 text-brand-900 text-[11px] font-bold px-2.5 py-1 shadow-stamp -rotate-2">
              REBOOKED
            </div>
            <p className="mt-1.5 font-display font-bold">Matisse Museum <span className="font-sans font-normal text-ink-muted">(Indoor)</span></p>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              Rain expected 2pm — indoor swap keeps your afternoon on track.
            </p>
          </div>

          <div className="ticket-divider flex flex-col items-center justify-center px-3 py-6 gap-2 bg-surface-sunken">
            <p className="font-mono text-[11px] font-semibold text-ink-muted [writing-mode:vertical-rl] tracking-wide">DAY 03 · NICE</p>
          </div>
        </div>
        <div className="h-9 barcode-strip text-brand-900/60 border-t border-dashed border-brand-200" aria-hidden="true" />
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dragScroll = useDragScroll()

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={logo} alt="" className="w-full h-full object-cover" />
            </div>
            <NaviaWordmark className="h-4 w-auto text-ink" />
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Button to="/login" variant="ghost" shape="pill">
              Login
            </Button>
            <Button to="/register" shape="pill" size="sm">
              Get Started
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-surface"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-brand-100 bg-white"
            >
              <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-2 flex items-center gap-2">
                  <Button to="/login" variant="ghost" shape="pill" onClick={() => setMobileMenuOpen(false)} className="flex-1 justify-center">
                    Login
                  </Button>
                  <Button to="/register" shape="pill" size="sm" onClick={() => setMobileMenuOpen(false)} className="flex-1 justify-center">
                    Get Started
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO — the ticket is the sole artifact here; the board is saved
          for "Why Navia" below, where it does a different job (a
          comparison, not a second itinerary demo). */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="absolute inset-0 barcode-strip text-white/[0.11]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
          <div>
            <motion.div initial="hidden" animate="show" variants={GRID_VARIANTS}>
              <motion.h1 variants={ITEM_VARIANTS} className="font-display font-extrabold text-display leading-[0.98]">
                Weather changes your plans.
                <br />
                Navia reissues them.
              </motion.h1>
              <motion.p variants={ITEM_VARIANTS} className="mt-6 max-w-lg text-brand-100 text-body-lg">
                Every day of your trip is a ticket. When the forecast turns, Navia reissues it — a new activity, the same plan, one stated reason.
              </motion.p>
              <motion.div variants={ITEM_VARIANTS} className="mt-9">
                <Button to="/register" size="lg" variant="accent" shape="pill">
                  Get Started <ArrowRight size={16} />
                </Button>
              </motion.div>
            </motion.div>
          </div>

          <TicketArtifact />
        </div>
      </section>

      <WeatherSwapDemo />

      {/* PROOF — one featured stat (the strongest number, given a quote-card
          moment of its own) beside the three supporting ones, instead of
          four equal-weight boxes in a row. Same survey data, same navy/cream
          tokens as the rest of the page — just an asymmetric layout instead
          of a uniform grid, per direct layout reference. */}
      <section className="max-w-6xl mx-auto px-4 py-14 sm:py-16 border-t border-brand-100">
        <div className="rounded-3xl bg-surface-sunken p-6 sm:p-10">
          <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-8 md:gap-10 items-center">
            <div className="rounded-2xl bg-surface shadow-ticket p-7 sm:p-8">
              <Quote size={26} className="text-brand-200" />
              <p className="mt-3 font-display font-extrabold text-5xl text-brand-700"><StatCounter value={83} /></p>
              <p className="mt-2.5 text-sm text-ink-muted">had a trip ruined by bad weather</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <p className="font-display font-extrabold text-3xl text-brand-700"><StatCounter value={88} /></p>
                <p className="mt-1.5 text-sm text-ink-muted">change plans based on the forecast</p>
              </div>
              <div>
                <p className="font-display font-extrabold text-3xl text-brand-700"><StatCounter value={85} /></p>
                <p className="mt-1.5 text-sm text-ink-muted">want automatic indoor ⇄ outdoor swaps</p>
              </div>
              <div>
                <p className="font-display font-extrabold text-3xl text-brand-700"><StatCounter value={73} /></p>
                <p className="mt-1.5 text-sm text-ink-muted">would pay directly for this</p>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-[11px] text-ink-muted font-mono">
            100-TRAVELLER SURVEY · NAVIA TEAM 2026 · 81% GEN Z &amp; MILLENNIAL RESPONDENTS
          </p>
        </div>
      </section>

      {/* HOW IT WORKS — three board controls, not three numbered cards. */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-brand-100">
        <h2 className="heading-1 max-w-xl">Three controls, one board</h2>
        <motion.div
          className="mt-10 grid grid-cols-1 sm:grid-cols-3 rounded-3xl border border-brand-100 overflow-hidden bg-surface"
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {CONTROLS.map(({ tag, title, description }, index) => (
            <motion.div
              key={tag}
              variants={ITEM_VARIANTS}
              className={`p-6 sm:p-7 ${index > 0 ? 'border-t sm:border-t-0 sm:border-l border-dashed border-brand-200' : ''}`}
            >
              <span className="inline-block font-mono text-[11px] font-bold text-white bg-brand-800 rounded px-2 py-0.5 tracking-wide">{tag}</span>
              <h3 className="heading-3 mt-3">{title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CITIES */}
      <section id="cities" className="max-w-6xl mx-auto px-4 py-14 sm:py-16 border-t border-brand-100">
        <h2 className="heading-1 max-w-xl">25 routes across Europe, live today</h2>
        <motion.div
          ref={dragScroll.ref}
          onPointerDown={dragScroll.onPointerDown}
          onPointerMove={dragScroll.onPointerMove}
          onPointerUp={dragScroll.onPointerUp}
          onPointerLeave={dragScroll.onPointerLeave}
          onClickCapture={dragScroll.onClickCapture}
          className="scroll-strip gap-4 -mx-1 px-1 pb-1 mt-8"
          variants={STRIP_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {Object.entries(DESTINATION_IMAGES).map(([city, image]) => (
            <motion.div
              key={city}
              variants={ITEM_VARIANTS}
              className="group relative w-36 sm:w-40 shrink-0 snap-start rounded-2xl overflow-hidden aspect-[4/5] shadow-ticket"
            >
              <img
                src={image.url}
                alt={city}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/0 to-transparent" />
              <span className="absolute bottom-3 left-3 text-white text-sm font-semibold">{city}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FEATURES — one continuous multi-leg document, not six same-size
          icon+heading+text cards. Deliberately more generous padding than
          its neighbors — this is the comprehensive "everything" section,
          not another equal-weight band in an unbroken rhythm. */}
      <section className="max-w-6xl mx-auto px-4 py-20 sm:py-24 border-t border-brand-100">
        <div className="text-center">
          <h2 className="heading-1">Everything you need to travel smarter</h2>
          <p className="mt-3 text-ink-muted">From flight search to trip management, all in one place.</p>
        </div>

        <motion.div
          className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={FEATURE_LIST_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {FEATURES.map(({ icon: Icon, title, description }, index) => (
            <motion.div
              key={title}
              variants={ITEM_VARIANTS}
              className="rounded-2xl border border-brand-100 bg-surface p-6 transition-all hover:shadow-ticket hover:border-brand-300"
            >
              <div className="flex items-center justify-between">
                <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon size={20} />
                </span>
                <span className="font-mono text-[11px] text-ink-muted/50">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="heading-3 mt-4">{title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* WHY NAVIA — the same board component as the hero, same columns,
          same reserved amber state, telling a comparison instead of an
          itinerary. Two stories, one device. */}
      <section id="why-navia" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-brand-100">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-start">
          <div>
            <h2 className="heading-1">The missing layer between booking and weather</h2>
            <p className="mt-4 text-ink-muted text-body-lg">
              Booking platforms and weather apps have never talked to each other. Navia is the layer that watches the forecast and rewrites the plan itself — the only row on this board that ever changes.
            </p>
          </div>
          <Board label="Who actually reflows your plan" colLabels={['—', 'Approach', 'Status']}>
            {POSITIONING_ROWS.map((row) => (
              <BoardRow
                key={row.name}
                changed={row.changed}
                cells={
                  <>
                    <span className="font-mono text-[11px] font-bold text-brand-300">{row.name === 'NAVIA' ? '★' : '—'}</span>
                    <span className="min-w-0 pr-2">
                      <span className="block text-sm font-semibold">{row.name}</span>
                      <span className="block text-xs text-brand-300">{row.detail}</span>
                    </span>
                    <span className={`text-right text-[11px] font-mono font-bold ${row.changed ? 'text-accent-400' : 'text-brand-300'}`}>
                      {row.status}
                    </span>
                  </>
                }
              />
            ))}
          </Board>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="relative overflow-hidden bg-brand-900 rounded-3xl px-8 py-14 text-center text-white shadow-ticket">
          <div className="absolute inset-0 barcode-strip text-white/[0.11]" aria-hidden="true" />
          <h2 className="relative heading-1 text-white">Ready to plan your next adventure?</h2>
          <Button to="/register" variant="accent" shape="pill" className="relative mt-8">
            Start Planning with us
          </Button>
        </div>
      </section>

      <footer className="border-t border-brand-100 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-2 text-center">
          <NaviaWordmark className="h-4 w-auto text-ink" />
          <p className="text-body-sm text-ink-muted">Weather-perfect trips, without the guesswork.</p>
          <p className="text-body-sm text-ink-muted">Aegis Innovation Competition 2026</p>
        </div>
      </footer>
    </div>
  )
}
