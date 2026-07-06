import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider } from './features/auth/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './components/AuthLayout'
import AppLayout from './components/AppLayout'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import DashboardPage from './features/trips/DashboardPage'
import NewTripPage from './features/trips/NewTripPage'
import ItineraryPage from './features/trips/ItineraryPage'
import FlightsPage from './features/flights/FlightsPage'
import NotificationsPage from './features/notifications/NotificationsPage'

function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">SmartTrip AI</h1>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Plan your London trip around the weather. Get indoor/outdoor activity swaps when forecasts change.
      </p>
      <div className="flex gap-4">
        <Link
          to="/register"
          className="px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          Get started
        </Link>
        <Link
          to="/login"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/trips/new" element={<NewTripPage />} />
              <Route path="/trips/:tripId" element={<ItineraryPage />} />
              <Route path="/trips/:tripId/flights" element={<FlightsPage />} />
              <Route path="/flights" element={<FlightsPage />} />
              <Route path="/settings/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
