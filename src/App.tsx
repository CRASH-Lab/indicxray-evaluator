import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import NotFound from './pages/NotFound'
import RadId from './pages/RadId'
import IndexWrapper from './pages/IndexWrapper'
import DoctorCases from './pages/DoctorCases'
import SupervisorLogin from './pages/SupervisorLogin'
import SupervisorDashboard from './pages/SupervisorDashboard'
import AdminUsers from './pages/AdminUsers'
import StageSelection from './pages/StageSelection'
import GalleryView from './pages/GalleryView'
import { GlobalErrorHandler } from './components/GlobalErrorHandler'

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GlobalErrorHandler />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RadId />} />
          
          {/* Stage Selection */}
          <Route path="/select-stage/:userId" element={<StageSelection />} />
          
          {/* Stage 1 Routes */}
          <Route path="/doctor/:doctorId" element={<DoctorCases />} />
          <Route path="/rad/:radId" element={<IndexWrapper />} />
          
          {/* Stage 2 Routes */}
          <Route path="/doctor/:doctorId/gallery" element={<GalleryView />} />
          
          {/* Supervisor routes */}
          <Route path="/supervisor" element={<SupervisorLogin />} />
          <Route path="/supervisor/dashboard/:supervisorId" element={<SupervisorDashboard />} />
          <Route path="/supervisor/users" element={<AdminUsers />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
