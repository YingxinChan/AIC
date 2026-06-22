import { Outlet } from 'react-router-dom'
import Nav from './Nav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
