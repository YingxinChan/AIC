import { CircleAlert } from 'lucide-react'

export default function ErrorMessage({ message = 'Something went wrong — please try again.' }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <CircleAlert size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
