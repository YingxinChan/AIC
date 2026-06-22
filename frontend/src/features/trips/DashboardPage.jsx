import { Link } from 'react-router-dom'
import Placeholder from '../../components/Placeholder'

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <Link
          to="/trips/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          + New trip
        </Link>
      </div>
      <Placeholder label="Your saved trips will appear here." />
    </div>
  )
}
