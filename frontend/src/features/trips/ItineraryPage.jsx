import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plane, Building2, MapPin, Calendar, CheckCircle2, Briefcase, Thermometer, Sparkles } from 'lucide-react'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'
import { tripStatus, STATUS_STYLES } from './tripStatus'
import { geocodeCity } from '../../lib/geocode'

function airlineCode(flightNumber) {
  return (flightNumber || '').split(' ')[0]
}

export default function ItineraryPage() {
  const { tripId } = useParams()

  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [itineraryNotice, setItineraryNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [mapCenter, setMapCenter] = useState(null)

  const destination = trip?.destination || ''
  const hasArrivalFlight = Boolean(trip?.arrival_flight_number)
  const hasDepartureFlight = Boolean(trip?.departure_flight_number)

  useEffect(() => {
    let cancelled = false
    getTrip(tripId)
      .then((data) => { if (!cancelled) setTrip(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId])

  useEffect(() => {
    let cancelled = false
    getItinerary(tripId)
      .then((data) => { if (!cancelled && data.days) { setItinerary(data); setSelectedDayIndex(0) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId])

  useEffect(() => {
    if (!destination) return
    let cancelled = false
    geocodeCity(destination)
      .then((coords) => { if (!cancelled) setMapCenter(coords) })
    return () => { cancelled = true }
  }, [destination])

  const handleGenerate = async () => {
    setGenerating(true)
    setItineraryNotice('')
    try {
      const data = await generateItinerary(tripId)
      if (data.days) {
        setItinerary(data)
        setSelectedDayIndex(0)
      } else {
        setItineraryNotice(data.message || 'Could not generate the itinerary.')
      }
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Something went wrong while generating the itinerary.')
    }
    setGenerating(false)
  }

  const status = trip?.start_date && trip?.end_date ? tripStatus(trip) : null

  return (
    <div className="space-y-6">
      {trip && (
        <div className="relative left-1/2 -translate-x-1/2 w-screen -mt-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white h-72 flex flex-col justify-between px-4 sm:px-8 py-8">
            <div className="max-w-6xl mx-auto w-full flex justify-end">
              {status && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
              )}
            </div>
            <div className="max-w-6xl mx-auto w-full">
              <p className="flex items-center gap-1.5 text-sm text-indigo-200">
                <MapPin size={14} /> {destination}
              </p>
              <h2 className="text-3xl font-bold mt-1">{trip.name || `${destination} Trip`}</h2>
              {trip.start_date && trip.end_date && (
                <p className="flex items-center gap-1.5 text-sm text-indigo-100 mt-2">
                  <Calendar size={14} /> {trip.start_date} &rarr; {trip.end_date}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(hasArrivalFlight || hasDepartureFlight) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
            <Plane size={18} className="text-indigo-600" /> Selected Flights
          </h2>
          <div className="space-y-3">
            {hasArrivalFlight && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {airlineCode(trip.arrival_flight_number)}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Outbound · {trip.start_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.arrival_airline} · {trip.arrival_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.arrival_other_time} &rarr; {trip.arrival_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
            )}
            {hasDepartureFlight && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  {airlineCode(trip.departure_flight_number)}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Return · {trip.end_date}</p>
                  <p className="font-medium text-gray-900 text-sm">{trip.departure_airline} · {trip.departure_flight_number}</p>
                  <p className="text-xs text-gray-500">{trip.departure_time} &rarr; {trip.departure_other_time}</p>
                </div>
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
            )}
          </div>
        </div>
      )}

      {trip?.hotel_address && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400" />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-1">
              <Building2 size={18} className="text-indigo-600" /> Hotel
            </h2>
            <p className="text-gray-700 text-sm">{trip.hotel_address}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          {itinerary ? (
            <div className="flex gap-2 flex-wrap">
              {itinerary.days.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIndex(index)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                    index === selectedDayIndex
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  Day {index + 1} &middot; {day.date}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Sparkles size={18} className="text-indigo-600" /> Day-by-day Activities
            </h2>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#0f172a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
          >
            {generating ? 'Generating...' : itinerary ? 'Regenerate itinerary' : 'Generate itinerary'}
          </button>
        </div>

        {itineraryNotice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
            {itineraryNotice}
          </div>
        )}

        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
            <Thermometer size={16} className="text-indigo-600" /> Weather Forecast
          </h3>
          <Placeholder label="Weather forecast will appear here." />
        </div>

        {itinerary && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
              <Sparkles size={16} className="text-indigo-600" /> Itinerary for Day {selectedDayIndex + 1}
            </h3>
            <ul className="space-y-2">
              {itinerary.days[selectedDayIndex].activities.map((activity, index) => (
                <li key={activity.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{activity.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${activity.type === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {activity.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{activity.time_slot}</p>
                    <p className="text-sm text-gray-600">{activity.location}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!itinerary && !itineraryNotice && (
          <Placeholder label="AI-generated itinerary will appear here once generated." />
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
          <MapPin size={18} className="text-indigo-600" /> {destination || 'Trip'} Map
        </h2>
        <MapView height="h-80" center={mapCenter} />
      </div>

      <div className="flex justify-center">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Briefcase size={16} /> Back to My Trips
        </Link>
      </div>
    </div>
  )
}
