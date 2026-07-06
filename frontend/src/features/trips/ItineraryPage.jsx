import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'
import { getTrip } from './tripsApi'
import { getItinerary, generateItinerary } from './itineraryApi'

export default function ItineraryPage() {
  const { tripId } = useParams()

  const [destination, setDestination] = useState('')
  const [itinerary, setItinerary] = useState(null)
  const [itineraryNotice, setItineraryNotice] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    getTrip(tripId)
      .then((data) => { if (!cancelled) setDestination(data.destination || '') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId])

  useEffect(() => {
    let cancelled = false
    getItinerary(tripId)
      .then((data) => { if (!cancelled && data.days) setItinerary(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tripId])

  const handleGenerate = async () => {
    setGenerating(true)
    setItineraryNotice('')
    try {
      const data = await generateItinerary(tripId)
      if (data.days) {
        setItinerary(data)
      } else {
        setItineraryNotice(data.message || 'Could not generate the itinerary.')
      }
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Something went wrong while generating the itinerary.')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Your Itinerary</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Weather Forecast</h2>
        <Placeholder label="Weather forecast will appear here." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Day-by-day Activities</h2>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#0f172a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : itinerary ? 'Regenerate itinerary' : 'Generate itinerary'}
          </button>
        </div>

        {itineraryNotice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
            {itineraryNotice}
          </div>
        )}

        {itinerary ? (
          <div className="space-y-4">
            {itinerary.days.map((day) => (
              <div key={day.date}>
                <h3 className="font-semibold text-gray-900 mb-2">{day.date}</h3>
                <ul className="space-y-2">
                  {day.activities.map((activity) => (
                    <li key={activity.id} className="border border-gray-100 rounded-md p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{activity.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${activity.type === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {activity.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{activity.time_slot}</p>
                      <p className="text-sm text-gray-600">{activity.location}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          !itineraryNotice && <Placeholder label="AI-generated itinerary will appear here once generated." />
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{destination || 'Trip'} Map</h2>
        <MapView height="h-80" />
      </div>
    </div>
  )
}
