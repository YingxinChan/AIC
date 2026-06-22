import Placeholder from '../../components/Placeholder'
import MapView from '../../components/MapView'

export default function ItineraryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Your Itinerary</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Weather Forecast</h2>
        <Placeholder label="Weather forecast will appear here." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Day-by-day Activities</h2>
        <Placeholder label="AI-generated itinerary will appear here once generated." />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">London Map</h2>
        <MapView height="h-80" />
      </div>
    </div>
  )
}
