import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import NotFound from './pages/NotFound'
import RadId from './pages/RadId'
import IndexWrapper from './pages/IndexWrapper'
import DoctorCases from './pages/DoctorCases'
import SupervisorLogin from './pages/SupervisorLogin'
import SupervisorDashboard from './pages/SupervisorDashboard'
import AdminUsers from './pages/AdminUsers'
import SupervisorAnalysis from './pages/SupervisorAnalysis'
import StageSelection from './pages/StageSelection'
import GalleryView from './pages/GalleryView'
import { GlobalErrorHandler } from './components/GlobalErrorHandler'

const queryClient = new QueryClient()

const AUTH_TOKEN_KEY = 'authToken'
const AUTH_USER_ID_KEY = 'userId'
const AUTH_ROLE_KEY = 'userRole'

function LoginRouteGuard({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userId = localStorage.getItem(AUTH_USER_ID_KEY)
  const userRole = localStorage.getItem(AUTH_ROLE_KEY)

  if (!token) {
    return children
  }

  // If auth payload is incomplete, clear stale auth and keep user on login screen.
  if (!userId || !userRole) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_ID_KEY)
    localStorage.removeItem(AUTH_ROLE_KEY)
    return children
  }

  if (userRole === 'supervisor') {
    return <Navigate to={`/supervisor/dashboard/${userId}`} replace />
  }

  return <Navigate to={`/select-stage/${userId}`} replace />
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GlobalErrorHandler />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginRouteGuard><RadId /></LoginRouteGuard>} />
          
          {/* Stage Selection */}
          <Route path="/select-stage/:userId" element={<StageSelection />} />
          
          {/* Stage 1 Routes */}
          <Route path="/doctor/:doctorId" element={<DoctorCases />} />
          <Route path="/rad/:radId" element={<IndexWrapper />} />
          
          {/* Stage 2 Routes */}
          <Route path="/stage2/:doctorId" element={<GalleryView />} />
          
          {/* Supervisor routes */}
          <Route path="/supervisor" element={<LoginRouteGuard><SupervisorLogin /></LoginRouteGuard>} />
          <Route path="/supervisor/dashboard/:supervisorId" element={<SupervisorDashboard />} />
          <Route path="/supervisor/users" element={<AdminUsers />} />
          <Route path="/supervisor/analysis" element={<SupervisorAnalysis />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
