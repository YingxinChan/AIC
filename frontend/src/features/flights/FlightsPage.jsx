import Placeholder from '../../components/Placeholder'

export default function FlightsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flights</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Search flights</h2>
        <Placeholder label="Flight search form will appear here." />
      </div>
      <Placeholder label="Flight results will appear here." />
    </div>
  )
}
