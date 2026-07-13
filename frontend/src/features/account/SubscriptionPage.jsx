import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Placeholder from '../../components/Placeholder'

export default function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Account
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <Placeholder label="Subscription plans will appear here." />
      </div>
    </div>
  )
}
