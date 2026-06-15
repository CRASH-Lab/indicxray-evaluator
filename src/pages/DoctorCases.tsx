import { getEvaluatorAssignments, getUserDetails } from '@/services'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  AlertCircle, 
  Menu, 
  X, 
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  Clock,
  CheckCircle2,
  User,
  LogOut,
  Play,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { saveCaseNavigationManifest } from '@/hooks/use-case-navigation'

type CaseStatusFilter = 'all' | 'pending' | 'in_progress' | 'completed'

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

/**
 * Extracts the human-readable case label from a study/image ID.
 * e.g. "CASE_Syn_MIMIC_JPG_Input_1_CENTRAL_LINES" → "CENTRAL LINES"
 * Falls back to the original string if the pattern is not found.
 */
function extractCaseName(id: string): string {
  const match = id.match(/_[Ii]nput_\d+_(.+)$/)
  if (match) {
    return match[1].replace(/_/g, ' ')
  }
  return id
}

// Metric Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  isActive = false,
  onClick,
}: { 
  icon: any
  label: string
  value: number | string
  trend?: string
  isActive?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-slate-800/40 border rounded-xl p-6 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/70 ${
        isActive
          ? 'border-blue-400/70 bg-blue-500/10'
          : 'border-slate-700/50 hover:border-slate-600/50'
      }`}
      aria-pressed={isActive}
    >
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
    </button>
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
            <code className="text-xs bg-slate-900/80 text-slate-300 px-2.5 py-1.5 rounded font-mono tracking-wide">
              {extractCaseName(caseItem.image_id)}
            </code>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Study ID: <span className="text-gray-300">{caseItem.study_id ? extractCaseName(caseItem.study_id) : 'N/A'}</span>
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Progress</span>
              <span className="text-xs font-medium text-blue-300">
                {caseItem.completed_evaluations}/{caseItem.total_evaluations} evaluations
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
  casesData,
  activeFilter,
  onFilterChange,
  onViewTutorial,
}: { 
  isOpen: boolean
  onClose: () => void
  doctorName: string
  onLogout: () => void
  casesData: CasesResponse | null
  activeFilter: CaseStatusFilter
  onFilterChange: (filter: CaseStatusFilter) => void
  onViewTutorial: () => void
}) {
  const [isStatusExpanded, setIsStatusExpanded] = useState(true)
  const statusItems: Array<{
    filter: CaseStatusFilter
    label: string
    count: number
    icon: typeof ListChecks
    classes: string
    activeClasses: string
  }> = [
    {
      filter: 'all',
      label: 'All Cases',
      count: casesData?.total_cases || 0,
      icon: ListChecks,
      classes: 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/70',
      activeClasses: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    },
    {
      filter: 'completed',
      label: 'Completed',
      count: casesData?.completed_cases || 0,
      icon: CheckCircle2,
      classes: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15',
      activeClasses: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200',
    },
    {
      filter: 'in_progress',
      label: 'In Progress',
      count: casesData?.in_progress_cases || 0,
      icon: Clock,
      classes: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/15',
      activeClasses: 'bg-blue-500/20 border-blue-400/60 text-blue-200',
    },
    {
      filter: 'pending',
      label: 'Pending',
      count: casesData?.pending_cases || 0,
      icon: AlertCircle,
      classes: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15',
      activeClasses: 'bg-amber-500/20 border-amber-400/60 text-amber-200',
    },
  ]

  function handleFilterClick(filter: CaseStatusFilter) {
    onFilterChange(filter)
    onClose()
  }

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
            onClick={() => {
              onFilterChange('all')
              setIsStatusExpanded(!isStatusExpanded)
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
            aria-pressed={activeFilter === 'all'}
          >
            <ListChecks className="w-5 h-5" />
            <span className="font-medium text-sm">Assigned Cases</span>
          </button>

          {/* Case Status Overview - Collapsible on Desktop, Always Visible on Mobile */}
          <div className={`lg:overflow-hidden lg:transition-all lg:duration-300 lg:ease-in-out space-y-2 ${
            isStatusExpanded ? 'lg:max-h-96 lg:opacity-100' : 'lg:max-h-0 lg:opacity-0 lg:hidden'
          }`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Status Overview</p>
            {statusItems.map(({ filter, label, count, icon: Icon, classes, activeClasses }) => {
              const isActive = activeFilter === filter
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => handleFilterClick(filter)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/70 ${
                    isActive ? activeClasses : classes
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className="text-xs font-bold bg-current/10 px-2 py-1 rounded">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-6 border-t border-slate-800 space-y-2">
          <button
            onClick={onViewTutorial}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-300 hover:bg-blue-500/10 transition-colors font-medium text-sm"
          >
            <Play className="w-5 h-5" />
            <span>View Tutorial</span>
          </button>
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
  const [activeFilter, setActiveFilter] = useState<CaseStatusFilter>('all')
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const navigate = useNavigate()
  
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!doctorId) return
      
      setLoading(true)
      setError('')
      
      try {
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

  const allCases = casesData?.cases || []
  const filteredCases = activeFilter === 'all'
    ? allCases
    : allCases.filter((caseItem) => caseItem.status === activeFilter)
  const activeFilterLabel = activeFilter === 'all'
    ? 'All Assigned Cases'
    : activeFilter.replace('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

  function navigateToCase(caseId: string) {
    if (filteredCases.length > 0) {
      saveCaseNavigationManifest({
        assignmentIds: filteredCases.map(c => c.id),
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
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onViewTutorial={() => setIsTutorialOpen(true)}
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
                  isActive={activeFilter === 'all'}
                  onClick={() => setActiveFilter('all')}
                />
                <MetricCard
                  icon={AlertCircle}
                  label="Pending Cases"
                  value={casesData?.pending_cases || 0}
                  trend={casesData?.pending_cases === 0 ? '0% Done' : `${Math.round((casesData?.pending_cases || 0) / (casesData?.total_cases || 1) * 100)}% of total`}
                  isActive={activeFilter === 'pending'}
                  onClick={() => setActiveFilter('pending')}
                />
                <MetricCard
                  icon={Clock}
                  label="In Progress"
                  value={casesData?.in_progress_cases || 0}
                  trend={casesData?.in_progress_cases === 0 ? 'Complete' : `${Math.round((casesData?.in_progress_cases || 0) / (casesData?.total_cases || 1) * 100)}% of total`}
                  isActive={activeFilter === 'in_progress'}
                  onClick={() => setActiveFilter('in_progress')}
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Completed"
                  value={casesData?.completed_cases || 0}
                  trend={casesData?.completed_cases === 0 ? 'None' : `${Math.round((casesData?.completed_cases || 0) / (casesData?.total_cases || 1) * 100)}% done`}
                  isActive={activeFilter === 'completed'}
                  onClick={() => setActiveFilter('completed')}
                />
              </div>

              {/* Assigned Cases Panel */}
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">{activeFilterLabel}</h2>
                  <p className="text-gray-400 text-sm">
                    {filteredCases.length} of {casesData?.total_cases || 0} total cases shown
                  </p>
                </div>

                {/* No Cases */}
                {allCases.length === 0 && !error && (
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

                {allCases.length > 0 && filteredCases.length === 0 && !error && (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ListChecks className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 font-medium mb-1">No {activeFilterLabel.toLowerCase()} found</p>
                    <p className="text-gray-500 text-sm">
                      Choose another status filter to see more assigned cases.
                    </p>
                  </div>
                )}

                {/* Cases Grid */}
                {filteredCases.length > 0 && (
                  <div className="space-y-4">
                    {filteredCases.map((caseItem, index) => (
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

      <Dialog open={isTutorialOpen} onOpenChange={setIsTutorialOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stage 1: Clinical Diagnosis Tutorial</DialogTitle>
          </DialogHeader>

          <div className="w-full bg-slate-900/50 rounded-lg p-12 flex flex-col items-center justify-center min-h-96 border-2 border-dashed border-slate-700">
            <Play className="w-16 h-16 text-blue-400 mb-4 opacity-50" />
            <p className="text-gray-400 text-center text-lg mb-2">Tutorial Video Placeholder</p>
            <p className="text-gray-500 text-sm text-center">
              Tutorial content will be displayed here.<br />
              This will be replaced with a video file or GIF from Supabase storage.
            </p>
          </div>

          <div className="mt-6 text-sm text-gray-400 bg-slate-800/50 rounded p-4">
            <p className="font-semibold text-white mb-2">Tutorial Topics:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>How to navigate X-ray images</li>
              <li>Identifying clinical findings</li>
              <li>Writing effective clinical reports</li>
              <li>Submitting your evaluation</li>
            </ul>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsTutorialOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DoctorCases
