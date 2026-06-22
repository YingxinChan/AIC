import Placeholder from '../../components/Placeholder'

export default function NewTripPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Plan a new trip</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-4">
          Destination:{' '}
          <span className="font-medium text-gray-900">London</span>
        </p>
        <Placeholder label="Trip creation form will appear here." />
      </div>
    </div>
  )
}
