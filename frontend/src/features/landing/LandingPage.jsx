import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, animate } from 'framer-motion'
import {
  Plane, Thermometer, MapPin, Zap, Briefcase, ArrowRight,
  Check, X, Menu, Mail, Quote,
  ChevronRight,
} from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import NaviaWordmark from '../../components/NaviaWordmark'
import { GRID_VARIANTS, ITEM_VARIANTS, STRIP_VARIANTS } from '../../lib/motion'
import { useDragScroll } from '../../lib/useDragScroll'
import { DESTINATION_IMAGES } from '../trips/destinationImages'
import WeatherSwapDemo from './WeatherSwapDemo'
import logo from '../../assets/logo.png'

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

const STATS = [
  { value: 88, label: 'change their destination based on the forecast' },
  { value: 85, label: 'want their itinerary to swap indoor ⇄ outdoor automatically' },
  { value: 73, label: 'willing to pay directly for this' },
]

const STEPS = [
  {
    number: '01',
    title: 'Tell us where and when',
    description: 'Pick your destination and travel dates. Navia takes it from there.',
  },
  {
    number: '02',
    title: 'Navia reads the hourly forecast',
    description: 'We pull hourly weather data for every day of your trip and turn it into real risk scores for rain, heat, wind, and more, not just a daily summary.',
  },
  {
    number: '03',
    title: 'Your day rearranges itself',
    description: 'If rain moves in, indoor and outdoor activities swap automatically, with no manual re-planning.',
  },
]

const COMPARISON_ROWS = [
  'Reacts to weather forecasts',
  'Rewrites the day automatically',
  'Indoor/outdoor swapping',
  'Suggests flights',
]

const POSITIONING = [
  {
    name: 'Flight booking platforms',
    tagline: 'Book it, then hope',
    checks: [false, false, false, true],
  },
  {
    name: 'Weather apps',
    tagline: 'Raw data, no decision',
    checks: [true, false, false, false],
  },
  {
    name: 'Navia',
    tagline: 'The layer that connects them',
    checks: [true, true, true, true],
    highlight: true,
  },
]

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
    <span ref={ref}>
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

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dragScroll = useDragScroll()

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200/70">
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
                className="px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50"
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
              className="md:hidden overflow-hidden border-t border-gray-200/70 bg-white"
            >
              <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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

      <section
        className="relative bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${DESTINATION_IMAGES.Venice.url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-slate-900/10" />
        <motion.div
          className="relative max-w-6xl mx-auto px-4 py-32 sm:py-40"
          initial="hidden"
          animate="show"
          variants={GRID_VARIANTS}
        >
          <motion.h1 variants={ITEM_VARIANTS} className="heading-display text-white max-w-2xl">
            Weather changes your plans.
            <br />
            <span className="text-brand-300">Navia changes them back.</span>
          </motion.h1>
          <motion.p variants={ITEM_VARIANTS} className="mt-6 max-w-xl text-gray-300 text-body-lg">
            Navia reads the hourly forecast for every day of your trip and swaps indoor and outdoor activities before bad weather gets there.
          </motion.p>
          <motion.div variants={ITEM_VARIANTS} className="mt-8 flex flex-wrap items-center gap-4">
            <Button to="/register" size="lg">
              Get Started <ArrowRight size={16} />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <WeatherSwapDemo />

      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
        <div className="rounded-3xl border border-gray-200 bg-surface p-8 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <Card elevation="lg" className="p-8 text-center lg:text-left">
              <Quote size={28} className="text-brand-200 mx-auto lg:mx-0" />
              <p className="mt-4 heading-display text-brand-600">
                <StatCounter value={83} />
              </p>
              <p className="mt-2 text-body-sm text-ink-muted">had a holiday ruined by bad weather</p>
            </Card>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center lg:text-left"
              variants={GRID_VARIANTS}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
            >
              {STATS.map((stat) => (
                <motion.div key={stat.label} variants={ITEM_VARIANTS}>
                  <p className="heading-2 text-brand-600">
                    <StatCounter value={stat.value} />
                  </p>
                  <p className="mt-1.5 text-body-sm text-ink-muted">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
          <p className="mt-10 text-center text-body-sm text-ink-muted">
            Independent 100-traveller survey conducted by the Navia team in 2026, with 81% Gen Z &amp; Millennial respondents.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-gray-100">
        <div className="text-center mb-12">
          <p className="eyebrow">How it works</p>
          <h2 className="heading-1 mt-2">From forecast to finished plan</h2>
        </div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4"
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {STEPS.map(({ number, title, description }, index) => (
            <motion.div key={number} variants={ITEM_VARIANTS} className="relative text-left sm:flex sm:flex-col">
              {index < STEPS.length - 1 && (
                <div className="hidden sm:flex absolute top-4 left-full w-8 items-center justify-center text-brand-200 z-10">
                  <ChevronRight size={18} />
                </div>
              )}
              <span className="font-display text-display text-brand-100 leading-none select-none">{number}</span>
              <h3 className="heading-3 mt-4">{title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section id="cities" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-gray-100">
        <div className="mb-8">
          <p className="eyebrow">Where you can go</p>
          <h2 className="heading-1 mt-2">25 cities across Europe, ready today</h2>
        </div>
        <motion.div
          ref={dragScroll.ref}
          onPointerDown={dragScroll.onPointerDown}
          onPointerMove={dragScroll.onPointerMove}
          onPointerUp={dragScroll.onPointerUp}
          onPointerLeave={dragScroll.onPointerLeave}
          onClickCapture={dragScroll.onClickCapture}
          className="scroll-strip gap-4 -mx-1 px-1 pb-1"
          variants={STRIP_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {Object.entries(DESTINATION_IMAGES).map(([city, image]) => (
            <motion.div
              key={city}
              variants={ITEM_VARIANTS}
              className="group relative w-36 sm:w-40 shrink-0 snap-start rounded-2xl overflow-hidden aspect-[4/5]"
            >
              <img
                src={image.url}
                alt={city}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
              <span className="absolute bottom-3 left-3 text-white text-sm font-semibold">{city}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20 text-center border-t border-gray-100">
        <h2 className="heading-1">Everything you need to travel smarter</h2>
        <p className="mt-3 text-ink-muted">From flight search to trip management, all in one place.</p>

        <motion.div
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left"
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} hoverable variants={ITEM_VARIANTS} className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center mb-4">
                <Icon size={22} className="text-brand-600" />
              </div>
              <h3 className="heading-3">{title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p>
            </Card>
          ))}
        </motion.div>
      </section>

      <section id="why-navia" className="max-w-6xl mx-auto px-4 py-16 sm:py-20 border-t border-gray-100">
        <div className="text-center mb-12">
          <p className="eyebrow">Why Navia</p>
          <h2 className="heading-1 mt-2">The missing layer between booking and weather</h2>
        </div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          variants={GRID_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {POSITIONING.map((item) => (
            <motion.div
              key={item.name}
              variants={ITEM_VARIANTS}
              className={`rounded-2xl border p-6 ${
                item.highlight
                  ? 'border-brand-200 bg-white shadow-bento-lg'
                  : 'border-gray-200 bg-surface'
              }`}
            >
              <h3 className="heading-3">{item.name}</h3>
              <p className={`mt-1 text-body-sm font-semibold ${item.highlight ? 'text-brand-600' : 'text-ink-muted'}`}>
                {item.tagline}
              </p>
              <ul className="mt-4 space-y-2.5">
                {COMPARISON_ROWS.map((row, index) => (
                  <li key={row} className="flex items-center gap-2">
                    {item.checks[index] ? (
                      <Check size={16} className="text-brand-600 shrink-0" />
                    ) : (
                      <X size={16} className="text-gray-300 shrink-0" />
                    )}
                    <span className="text-body-sm text-ink-muted">{row}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="bg-brand-mesh rounded-3xl px-8 py-14 text-center text-white shadow-bento-lg">
          <h2 className="heading-1 text-white">Ready to plan your next adventure?</h2>
          <Button to="/register" variant="onBrand" shape="pill" className="mt-8">
            Start Planning with us
          </Button>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-2 text-center">
          <NaviaWordmark className="h-4 w-auto text-ink" />
          <p className="text-body-sm text-ink-muted">Weather-perfect trips, without the guesswork.</p>
          <p className="text-body-sm text-ink-muted">Aegis Innovation Competition 2026</p>
        </div>
      </footer>
    </div>
  )
}
