import { getEvaluatorAssignments, getUserDetails } from '@/services'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, 
  Menu, 
  X, 
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  Clock,
  CheckCircle2,
  TrendingUp,
  Bell,
  Settings,
  User,
  LogOut,
  Loader2
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { saveCaseNavigationManifest } from '@/hooks/use-case-navigation'

interface CaseWithDetails {
  id: string
  image_id: string
  image_url: string
  status: string
  study_id?: string
  completed_evaluations: number
  total_evaluations: number
  completed_images: number
  total_images: number
  last_updated?: string
}

interface CasesResponse {
  cases: CaseWithDetails[]
  total_cases: number
  pending_cases: number
  in_progress_cases: number
  completed_cases: number
}

// Metric Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  trend 
}: { 
  icon: any
  label: string
  value: number | string
  trend?: string
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-blue-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        {trend && (
          <span className="text-xs text-green-400 font-medium">{trend}</span>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

// Case Row Component
function CaseRow({ 
  caseItem, 
  index, 
  onClick 
}: { 
  caseItem: CaseWithDetails
  index: number
  onClick: () => void
}) {
  const progressPercent = (caseItem.completed_evaluations / caseItem.total_evaluations) * 100
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  return (
    <div
      onClick={onClick}
      className="group bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/60 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left Section - Case Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-3">
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
              Case #{index + 1}
            </h3>
            <code className="text-xs bg-slate-900/80 text-slate-300 px-2.5 py-1.5 rounded font-mono">
              {caseItem.image_id}
            </code>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Study ID: <span className="text-gray-300">{caseItem.study_id || 'N/A'}</span>
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Progress</span>
              <span className="text-xs font-medium text-blue-300">
                {caseItem.completed_evaluations}/{caseItem.total_evaluations} models
              </span>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center Section - Status Badge */}
        <div className="flex-shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-medium text-sm ${getStatusColor(caseItem.status)}`}>
            {getStatusIcon(caseItem.status)}
            <span>{caseItem.status.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Right Section - Action Arrow */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  )
}

// Sidebar Navigation Component
function DashboardSidebar({ 
  isOpen, 
  onClose,
  doctorName,
  onLogout,
  casesData
}: { 
  isOpen: boolean
  onClose: () => void
  doctorName: string
  onLogout: () => void
  casesData: CasesResponse | null
}) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out z-50 lg:static lg:transform-none flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Close Button - Mobile */}
        <div className="lg:hidden p-4 flex justify-end">
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Logo Area */}
        <div className="px-6 py-8 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">Indicxray</h2>
              <p className="text-xs text-gray-500">Evaluator</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors bg-blue-500/20 text-blue-300 border border-blue-500/30"
          >
            <ListChecks className="w-5 h-5" />
            <span className="font-medium text-sm">Assigned Cases</span>
          </button>

          {/* Case Status Overview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Status Overview</p>
            
            {/* Completed */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-300 font-medium">Completed</span>
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">
                {casesData?.completed_cases || 0}
              </span>
            </div>

            {/* In Progress */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-blue-500/10 border-blue-500/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">In Progress</span>
              </div>
              <span className="text-xs font-bold text-blue-300 bg-blue-500/20 px-2 py-1 rounded">
                {casesData?.in_progress_cases || 0}
              </span>
            </div>

            {/* Pending */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-amber-500/10 border-amber-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300 font-medium">Pending</span>
              </div>
              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-1 rounded">
                {casesData?.pending_cases || 0}
              </span>
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-6 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors font-medium text-sm"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}

function DoctorCases() {
  const { doctorId } = useParams()
  const [casesData, setCasesData] = useState<CasesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [doctorInfo, setDoctorInfo] = useState({ name: 'Loading...', specialty: '' })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!doctorId) return
      
      setLoading(true)
      setError('')
      
      try {
        const { getEvaluatorAssignments } = await import('@/services');
        
        const [details, casesResponse] = await Promise.all([
          getUserDetails(doctorId),
          getEvaluatorAssignments() 
        ]);

        if (!isMounted) return;

        if (details && details.name) {
          setDoctorInfo({
            name: details.name,
            specialty: details.role || ''
          });
        } else {
          setDoctorInfo({ 
            name: `Doctor ${doctorId.substring(0, 8)}`,
            specialty: 'Evaluator'
          });
        }

        if (casesResponse) {
             setCasesData(casesResponse);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        if (!isMounted) return;
        setError('Failed to fetch data. Please check your connection and try again.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    fetchData();

    return () => {
      isMounted = false;
    };
  }, [doctorId]);

  function navigateToCase(caseId: string) {
    if (casesData?.cases) {
      saveCaseNavigationManifest({
        assignmentIds: casesData.cases.map(c => c.id),
        doctorId: doctorId || '',
      });
    }
    navigate(`/rad/${caseId}?doctorId=${doctorId}`);
  }

  function handleLogout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('userRole')
    navigate('/', { replace: true })
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex">
        {/* Sidebar Skeleton */}
        <div className="hidden lg:block w-64 bg-slate-900 border-r border-slate-800 p-6">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 p-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex h-screen">
        {/* Sidebar */}
        <DashboardSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          doctorName={doctorInfo.name}
          onLogout={handleLogout}
          casesData={casesData}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center justify-between h-16 px-6 lg:px-8">
              {/* Left - Menu Toggle & Title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden text-gray-400 hover:text-white transition-colors"
                >
                  {sidebarOpen ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">Dashboard</h1>
                  <p className="text-xs text-gray-400">Assigned Cases Overview</p>
                </div>
              </div>

              {/* Right - User Info */}
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-white">{doctorInfo.name}</p>
                  <p className="text-xs text-gray-400">{doctorInfo.specialty}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/30 text-red-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                  icon={ListChecks}
                  label="Total Assigned"
                  value={casesData?.total_cases || 0}
                />
                <MetricCard
                  icon={AlertCircle}
                  label="Pending Cases"
                  value={casesData?.pending_cases || 0}
                  trend={casesData?.pending_cases === 0 ? '0% Done' : `${Math.round((casesData?.pending_cases || 0) / (casesData?.total_cases || 1) * 100)}% of total`}
                />
                <MetricCard
                  icon={Clock}
                  label="In Progress"
                  value={casesData?.in_progress_cases || 0}
                  trend={casesData?.in_progress_cases === 0 ? 'Complete' : `${Math.round((casesData?.in_progress_cases || 0) / (casesData?.total_cases || 1) * 100)}% of total`}
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Completed"
                  value={casesData?.completed_cases || 0}
                  trend={casesData?.completed_cases === 0 ? 'None' : `${Math.round((casesData?.completed_cases || 0) / (casesData?.total_cases || 1) * 100)}% done`}
                />
              </div>

              {/* Assigned Cases Panel */}
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Assigned Cases</h2>
                  <p className="text-gray-400 text-sm">
                    {casesData?.total_cases || 0} total cases assigned to you
                  </p>
                </div>

                {/* No Cases */}
                {(!casesData?.cases || casesData.cases.length === 0) && !error && (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ListChecks className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 font-medium mb-1">No cases assigned</p>
                    <p className="text-gray-500 text-sm">
                      You don't have any cases assigned yet. Check back later or contact an administrator.
                    </p>
                  </div>
                )}

                {/* Cases Grid */}
                {casesData?.cases && casesData.cases.length > 0 && (
                  <div className="space-y-4">
                    {casesData.cases.map((caseItem, index) => (
                      <CaseRow
                        key={caseItem.id}
                        caseItem={caseItem}
                        index={index}
                        onClick={() => navigateToCase(caseItem.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorCases