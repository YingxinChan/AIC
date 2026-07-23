import { Link } from 'react-router-dom'
import { Plane, Thermometer, MapPin, Zap, Globe, Briefcase, ArrowRight } from 'lucide-react'
import heroImage from '../../assets/hero-amalfi-coast.jpg'

const FEATURES = [
  {
    icon: Thermometer,
    title: 'Weather-Synced Plans',
    description: 'Our AI analyzes hourly forecasts to perfectly time your outdoor and indoor activities.',
  },
  {
    icon: MapPin,
    title: 'Smart Routing',
    description: 'We group attractions by location and weather to minimize travel time and maximize fun.',
  },
  {
    icon: Plane,
    title: 'Seamless Logistics',
    description: 'Input your flight and hotel details so our AI can perfectly schedule activities around your check-ins and departures.',
  },
  {
    icon: Zap,
    title: 'Real-Time Adjustments',
    description: 'If the forecast changes, your itinerary automatically adapts with smart backups.',
  },
  {
    icon: Globe,
    title: 'Destination Guides',
    description: 'Explore curated guides and hidden gems for every destination worldwide.',
  },
  {
    icon: Briefcase,
    title: 'Trip Dashboard',
    description: 'Manage your interactive day-by-day plans from a beautiful, mobile-friendly dashboard.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Plane size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">SmartTrip<span className="text-indigo-600">AI</span></span>
          </div>
          <Link
            to="/login"
            className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Login
          </Link>
        </div>
      </header>

      <section
        className="relative bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-slate-900/10" />
        <div className="relative max-w-6xl mx-auto px-4 py-28">
          <span className="inline-flex items-center gap-1.5 bg-indigo-600 px-3 py-1.5 rounded-full text-xs font-bold mb-6">
            <Zap size={14} /> AI-Powered Travel Planning
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight max-w-2xl">
            Plan weather-perfect
            <br />
            <span className="text-indigo-300">trips with AI</span>
          </h1>
          <p className="mt-6 max-w-xl text-gray-300 text-lg">
            SmartTrip AI builds your ideal daily itinerary perfectly synced with hourly weather forecasts, ensuring rain never ruins your plans.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything you need to travel smarter</h2>
        <p className="mt-3 text-gray-500">From flight search to trip management, all in one place.</p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold">Ready to plan your next adventure?</h2>
          <p className="mt-2 text-indigo-100">Join thousands of travelers using SmartTrip AI.</p>
          <Link
            to="/register"
            className="mt-6 inline-block bg-white text-indigo-700 px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-50 transition-colors"
          >
            Start Planning with us
          </Link>
        </div>
      </section>
    </div>
  )
}
