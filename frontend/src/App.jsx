import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './components/AuthLayout'
import AppLayout from './components/AppLayout'
import LandingPage from './features/landing/LandingPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import DashboardPage from './features/trips/DashboardPage'
import MyTripsPage from './features/trips/MyTripsPage'
import NewTripPage from './features/trips/NewTripPage'
import ItineraryPage from './features/trips/ItineraryPage'
import FlightSelectPage from './features/flights/FlightSelectPage'
import AccountPage from './features/account/AccountPage'

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
              <Route path="/trips" element={<MyTripsPage />} />
              <Route path="/trips/new" element={<NewTripPage />} />
              <Route path="/trips/new/flights/:leg" element={<FlightSelectPage />} />
              <Route path="/trips/:tripId" element={<ItineraryPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
