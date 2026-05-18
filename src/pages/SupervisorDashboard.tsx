import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  getAllEvaluators,
  getMetrics,
  getUserDetails,
  adminGetAssignments,
  adminGetEvaluations,
  adminGetAllEvaluatorEvaluations,
  adminGetStage2Stats
} from '@/services'
import { ArrowRight, CheckCircle2, Copy, Loader2, TriangleAlert } from 'lucide-react'

// Type definitions for better type safety
interface Evaluator {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Evaluation {
  id: string;
  case_id: string;
  evaluator_id: string;
  model_id: string;
  model_name: string;
  metric_id: string;
  metric_name?: string;
  score: number;
  created_at: string;
}

interface PaginatedEvaluationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  results: Evaluation[];
}

interface Case {
  id: string;
  image_id: string;
}

interface Metric {
  id: string;
  name: string;
  description?: string;
}

function SupervisorDashboard() {
  const { supervisorId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get('tab') || 'evaluations'
  const initialPage = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const initialEvaluator = searchParams.get('evaluator')

  const [activeTab, setActiveTab] = useState(initialTab)
  const [evaluators, setEvaluators] = useState<Evaluator[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [evaluatorEvaluations, setEvaluatorEvaluations] = useState<(Evaluation & { is_cross_assigned: boolean })[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [stage2Stats, setStage2Stats] = useState<any>(null)
  const [selectedEvaluator, setSelectedEvaluator] = useState<string | null>(initialEvaluator)
  const [evaluatorPickerOpen, setEvaluatorPickerOpen] = useState(false)
  const [caseTab, setCaseTab] = useState<'original' | 'cross'>('original')
  const [evaluationsPage, setEvaluationsPage] = useState(initialPage)
  const [evaluationsPageSize] = useState(100)
  const [evaluationsQuery, setEvaluationsQuery] = useState('')
  const [evaluationsSortBy, setEvaluationsSortBy] = useState<'case' | 'evaluator' | 'model' | 'metric' | 'status' | 'date'>('date')
  const [evaluationsSortDirection, setEvaluationsSortDirection] = useState<'asc' | 'desc'>('desc')
  const [evaluationsPagination, setEvaluationsPagination] = useState<PaginatedEvaluationsResponse>({
    count: 0,
    next: null,
    previous: null,
    page: 1,
    page_size: 100,
    results: [],
  })
  const [loading, setLoading] = useState({
    evaluators: true,
    evaluations: true,
    cases: true,
    metrics: true,
    evaluatorEvaluations: false,
    stage2: true
  })
  const [error, setError] = useState('')
  const selectedEvaluatorDetails = selectedEvaluator
    ? (evaluators.find((evaluator) => {
        if (!evaluator) return false
        const idCandidates = [
          // common id fields returned by various backends
          (evaluator as any).id,
          (evaluator as any).pk,
          (evaluator as any).user_id,
          (evaluator as any).uuid,
        ].filter(Boolean).map(String)

        if (idCandidates.includes(String(selectedEvaluator))) return true

        // fallback: allow matching by email
        if ((evaluator as any).email && String((evaluator as any).email) === String(selectedEvaluator)) return true

        return false
      }) as Evaluator) || null
    : null

  const selectedEvaluatorLabel =
    selectedEvaluatorDetails?.name || selectedEvaluatorDetails?.email || selectedEvaluator || ''

  // If a selected evaluator id exists but we couldn't find details in the initial list,
  // attempt to fetch the user's details from the API so the UI can show their card.
  useEffect(() => {
    if (!selectedEvaluator) return
    if (selectedEvaluatorDetails) return

    let mounted = true
    ;(async () => {
      try {
        const user = await getUserDetails(selectedEvaluator)
        if (!mounted || !user) return
        // append to evaluators list so subsequent lookups work
        setEvaluators(prev => {
          // avoid duplicates
          if (prev.find(e => String((e as any).id) === String(user.id))) return prev
          return [...prev, user as Evaluator]
        })
      } catch (err) {
        console.warn('Failed to fetch selected evaluator details:', err)
      }
    })()

    return () => {
      mounted = false
    }
  }, [selectedEvaluator, selectedEvaluatorDetails])

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'evaluations'
    const pageFromUrl = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const evaluatorFromUrl = searchParams.get('evaluator')

    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }

    if (pageFromUrl !== evaluationsPage) {
      setEvaluationsPage(pageFromUrl)
    }

    if (evaluatorFromUrl !== selectedEvaluator) {
      setSelectedEvaluator(evaluatorFromUrl)
    }
  }, [searchParams, activeTab, evaluationsPage, selectedEvaluator])

  const updateDashboardUrl = (nextState: {
    tab?: string;
    page?: number;
    evaluator?: string | null;
  }) => {
    const nextTab = nextState.tab ?? activeTab
    const nextPage = nextState.page ?? evaluationsPage
    const nextEvaluator = nextState.evaluator !== undefined ? nextState.evaluator : selectedEvaluator
    const params = new URLSearchParams(searchParams)

    params.set('tab', nextTab)

    if (nextTab === 'evaluations') {
      params.set('page', String(nextPage))
    } else {
      params.delete('page')
    }

    if (nextEvaluator) {
      params.set('evaluator', nextEvaluator)
    } else {
      params.delete('evaluator')
    }

    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch users (Evaluators)
        setLoading(prev => ({ ...prev, evaluators: true }))
        const evaluatorsData = await getAllEvaluators()
        setEvaluators(evaluatorsData)
        setLoading(prev => ({ ...prev, evaluators: false }))
        
        // Fetch Stage 2 Stats
        setLoading(prev => ({ ...prev, stage2: true }))
        const s2Stats = await adminGetStage2Stats()
        setStage2Stats(s2Stats)
        setLoading(prev => ({ ...prev, stage2: false }))
        
        // Fetch all assignments (Cases)
        setLoading(prev => ({ ...prev, cases: true }))
        const assignmentsData = await adminGetAssignments()
        
        // Map assignments to "Cases" format
        const mappedCases = assignmentsData.map((a: any) => ({
            id: a.evaluation_set.study_id,
            image_id: a.evaluation_set.study_id,
        }));
        setCases(mappedCases)
        setLoading(prev => ({ ...prev, cases: false }))
        
        // Fetch metrics
        setLoading(prev => ({ ...prev, metrics: true }))
        const metricsData = await getMetrics()

        setMetrics(metricsData)
        setLoading(prev => ({ ...prev, metrics: false }))
        
      } catch (err) {
        console.error('Error fetching supervisor data:', err)
        setError('Failed to load data. Please check your connection and try again.')
        setLoading({
          evaluators: false,
          evaluations: false,
          cases: false,
          metrics: false,
          evaluatorEvaluations: false,
          stage2: false
        })
      }
    }
    
    fetchData()
  }, [])

  // Paginated evaluations — only used for the "all evaluations" flat table (no evaluator selected)
  useEffect(() => {
    if (selectedEvaluator) return

    async function fetchEvaluations() {
      try {
        setLoading(prev => ({ ...prev, evaluations: true }))
        const evaluationsData = await adminGetEvaluations({
          page: evaluationsPage,
          pageSize: evaluationsPageSize,
        })

        setEvaluations(evaluationsData.results || [])
        setEvaluationsPagination({
          count: evaluationsData.count || 0,
          next: evaluationsData.next || null,
          previous: evaluationsData.previous || null,
          page: evaluationsData.page || evaluationsPage,
          page_size: evaluationsData.page_size || evaluationsPageSize,
          results: evaluationsData.results || [],
        })
      } catch (err) {
        console.error('Error fetching evaluations:', err)
        setError('Failed to load evaluations. Please check your connection and try again.')
      } finally {
        setLoading(prev => ({ ...prev, evaluations: false }))
      }
    }

    fetchEvaluations()
  }, [evaluationsPage, evaluationsPageSize, selectedEvaluator])

  // Fetch all evaluations for a specific evaluator (no pagination) when one is selected
  useEffect(() => {
    if (!selectedEvaluator) {
      setEvaluatorEvaluations([])
      return
    }

    async function fetchEvaluatorEvaluations() {
      try {
        setLoading(prev => ({ ...prev, evaluatorEvaluations: true }))
        const data = await adminGetAllEvaluatorEvaluations(selectedEvaluator!)
        setEvaluatorEvaluations(data as (Evaluation & { is_cross_assigned: boolean })[])
      } catch (err) {
        console.error('Error fetching evaluator evaluations:', err)
        setError('Failed to load evaluator evaluations.')
      } finally {
        setLoading(prev => ({ ...prev, evaluatorEvaluations: false }))
      }
    }

    fetchEvaluatorEvaluations()
  }, [selectedEvaluator])
  
  // Add a utility method to load case details if needed
  const fetchCaseDetailIfNeeded = async (caseId: string) => {
    // Only fetch if we need to (case not found in our list)
    if (cases.find(c => c.id === caseId)) {
      return;
    }
    
    try {
      const caseResponse = await fetch(`/api/cases/${caseId}/`);
      
      if (!caseResponse.ok) {
        console.warn(`Failed to fetch case ${caseId}: ${caseResponse.status}`);
        return;
      }
      
      const caseData = await caseResponse.json();

      
      // Add this case to our list
      setCases(prevCases => [...prevCases, caseData]);
    } catch (error) {
      console.error(`Error fetching case ${caseId}:`, error);
    }
  };

  // Get case details by ID
  const getCaseDetails = (caseId: string): Case => {
    const foundCase = cases.find(c => c.id === caseId);
    if (foundCase) {
      return foundCase;
    }
    
    console.warn(`Case not found for ID: ${caseId}`);
    
    // Try to fetch the missing case data (won't update immediately but will be available for next render)
    fetchCaseDetailIfNeeded(caseId);
    
    return { id: caseId, image_id: `Case ${caseId.slice(0, 8)}` };
  }
  
  // Get evaluator name by ID
  const getEvaluatorName = (evaluatorId: string): string => {
    const evaluator = evaluators.find(e => e.id === evaluatorId);
    if (evaluator) {
      return evaluator.name;
    }
    
    console.warn(`Evaluator not found for ID: ${evaluatorId}`);
    return `Evaluator ${evaluatorId.slice(0, 8)}`;
  }

  // Get metric name by ID
  const getMetricName = (metricId: string, fallbackName?: string): string => {
    const metric = metrics.find(m => m.id === metricId);
    if (metric) {
      return metric.name;
    }

    if (fallbackName) {
      return fallbackName;
    }

    console.warn(`Metric not found for ID: ${metricId}`);
    return `Metric ${metricId.slice(0, 8)}`;
  }

  const getScoreBadge = (score: number): { label: string; className: string } => {
    if (score >= 1) {
      return {
        label: 'Concordant',
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      }
    }

    return {
      label: 'Divergent',
      className: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
    }
  }

  const getCaseDisplayName = (caseId: string, index: number, caseImageId?: string): string => {
    const candidate = caseImageId?.trim()

    if (candidate && candidate.length <= 28 && !candidate.toUpperCase().includes('CASE_')) {
      return candidate
    }

    return `Case #${String(index + 1).padStart(3, '0')}`
  }

  const getModelDisplayName = (modelName: string, ordinal: number): string => {
    const hasLabel = modelName.trim().length > 0
    return hasLabel ? `Model ${ordinal + 1}` : `Model ${ordinal + 1}`
  }

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (error) {
      console.warn('Failed to copy text:', error)
    }
  }

  const openReviewDetails = (evaluation: Evaluation, caseImageId: string) => {
    const params = new URLSearchParams({
      case: evaluation.case_id,
      evaluator: evaluation.evaluator_id,
      model: evaluation.model_id,
      metric: evaluation.metric_id,
    })

    if (caseImageId) {
      params.set('caseLabel', caseImageId)
    }

    navigate(`/supervisor/analysis?${params.toString()}`)
  }

  const getStage2RowState = (completedCount: number, totalCount: number) => {
    if (totalCount === 0) {
      return {
        label: 'Unassigned',
        labelClassName: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
        trackClassName: 'bg-slate-800',
        fillClassName: 'bg-slate-500',
        fillWidth: 0,
        rowClassName: 'opacity-70',
        icon: TriangleAlert,
      }
    }

    if (completedCount >= totalCount) {
      return {
        label: 'Completed',
        labelClassName: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        trackClassName: 'bg-emerald-950/40',
        fillClassName: 'bg-emerald-500',
        fillWidth: 100,
        rowClassName: '',
        icon: CheckCircle2,
      }
    }

    if (completedCount === 0) {
      return {
        label: 'Not started',
        labelClassName: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
        trackClassName: 'bg-slate-800',
        fillClassName: 'bg-slate-500',
        fillWidth: 0,
        rowClassName: '',
        icon: TriangleAlert,
      }
    }

    return {
      label: 'In progress',
      labelClassName: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
      trackClassName: 'bg-slate-800',
      fillClassName: 'bg-blue-500',
      fillWidth: (completedCount / totalCount) * 100,
      rowClassName: '',
      icon: Loader2,
    }
  }

  // Format date string safely
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Invalid Date';
    
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.warn(`Error formatting date: ${dateString}`, error);
      return 'Invalid Date';
    }
  }
  function handleLogout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('userRole')
    navigate('/supervisor', { replace: true })
  }

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab)
    updateDashboardUrl({ tab: nextTab })
  }

  const handleEvaluatorSelect = (evaluatorId: string) => {
    setSelectedEvaluator(evaluatorId)
    setEvaluatorPickerOpen(false)
    // Persist selection to URL without leaving the current tab
    updateDashboardUrl({ tab: activeTab, page: activeTab === 'evaluations' ? 1 : evaluationsPage, evaluator: evaluatorId })
  }

  const handleViewSelectedEvaluatorEvaluations = (evaluatorId: string) => {
    setEvaluationsPage(1)
    setSelectedEvaluator(evaluatorId)
    setActiveTab('evaluations')
    updateDashboardUrl({
      tab: 'evaluations',
      page: 1,
      evaluator: evaluatorId,
    })
  }

  const clearEvaluatorFilter = () => {
    setEvaluationsPage(1)
    setSelectedEvaluator(null)
    updateDashboardUrl({
      tab: activeTab,
      page: activeTab === 'evaluations' ? 1 : evaluationsPage,
      evaluator: null,
    })
  }

  const goToPreviousPage = () => {
    const nextPage = Math.max(1, evaluationsPage - 1)
    setEvaluationsPage(nextPage)
    updateDashboardUrl({ tab: 'evaluations', page: nextPage })
  }

  const goToNextPage = () => {
    const nextPage = evaluationsPage + 1
    setEvaluationsPage(nextPage)
    updateDashboardUrl({ tab: 'evaluations', page: nextPage })
  }

  const totalPages = Math.max(1, Math.ceil(evaluationsPagination.count / evaluationsPagination.page_size))
  const stage2AssignedCount = stage2Stats?.assigned_images_per_evaluator ?? stage2Stats?.total_images ?? 0
  const sortedStage2Stats = [...(stage2Stats?.stats ?? [])].sort((left: any, right: any) => {
    const priority = (stat: any) => {
      if ((stat.total_count ?? 0) === 0) return 3
      if ((stat.completed_count ?? 0) >= (stat.total_count ?? 0)) return 0
      if ((stat.completed_count ?? 0) === 0) return 1
      return 2
    }

    const leftPriority = priority(left)
    const rightPriority = priority(right)

    if (leftPriority !== rightPriority) return leftPriority - rightPriority

    const leftRatio = (left.total_count ?? 0) === 0 ? -1 : left.completed_count / left.total_count
    const rightRatio = (right.total_count ?? 0) === 0 ? -1 : right.completed_count / right.total_count

    return leftRatio - rightRatio
  })

  const filteredAndSortedEvaluations = (() => {
    const query = evaluationsQuery.trim().toLowerCase()

    const filtered = evaluations.filter((evaluation, index) => {
      if (!query) return true

      const evaluatorName = evaluators.find((evaluator) => evaluator.id === evaluation.evaluator_id)?.name || evaluation.evaluator_id
      const modelIndex = evaluations
        .filter(item => item.case_id === evaluation.case_id)
        .findIndex(item => item.model_id === evaluation.model_id)
      const modelName = getModelDisplayName(evaluation.model_name || 'Unknown', modelIndex >= 0 ? modelIndex : index)
      const metricName = getMetricName(evaluation.metric_id, evaluation.metric_name)
      const scoreLabel = getScoreBadge(evaluation.score).label
      const statusText = scoreLabel.toLowerCase()

      return [
        evaluation.case_id,
        evaluatorName,
        evaluation.model_name,
        modelName,
        metricName,
        scoreLabel,
        statusText,
        evaluation.created_at,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })

    const directionFactor = evaluationsSortDirection === 'asc' ? 1 : -1

    return [...filtered].sort((left, right) => {
      const leftCaseIndex = evaluations.findIndex(item => item.id === left.id)
      const rightCaseIndex = evaluations.findIndex(item => item.id === right.id)
      const leftEvaluatorName = evaluators.find((evaluator) => evaluator.id === left.evaluator_id)?.name || left.evaluator_id
      const rightEvaluatorName = evaluators.find((evaluator) => evaluator.id === right.evaluator_id)?.name || right.evaluator_id
      const leftModelIndex = evaluations
        .filter(item => item.case_id === left.case_id)
        .findIndex(item => item.model_id === left.model_id)
      const rightModelIndex = evaluations
        .filter(item => item.case_id === right.case_id)
        .findIndex(item => item.model_id === right.model_id)
      const leftModelName = getModelDisplayName(left.model_name || 'Unknown', leftModelIndex >= 0 ? leftModelIndex : leftCaseIndex)
      const rightModelName = getModelDisplayName(right.model_name || 'Unknown', rightModelIndex >= 0 ? rightModelIndex : rightCaseIndex)
      const leftMetricName = getMetricName(left.metric_id, left.metric_name)
      const rightMetricName = getMetricName(right.metric_id, right.metric_name)
      const leftStatus = getScoreBadge(left.score).label
      const rightStatus = getScoreBadge(right.score).label
      const leftDate = new Date(left.created_at).getTime() || 0
      const rightDate = new Date(right.created_at).getTime() || 0

      const compareMap: Record<typeof evaluationsSortBy, number> = {
        case: String(left.case_id).localeCompare(String(right.case_id)),
        evaluator: leftEvaluatorName.localeCompare(rightEvaluatorName),
        model: leftModelName.localeCompare(rightModelName),
        metric: leftMetricName.localeCompare(rightMetricName),
        status: leftStatus.localeCompare(rightStatus),
        date: leftDate - rightDate,
      }

      const comparison = compareMap[evaluationsSortBy]
      return comparison === 0 ? 0 : comparison * directionFactor
    })
  })()

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Supervisor Dashboard</CardTitle>
              <CardDescription>Review evaluator performance and case evaluations</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/supervisor/analysis')}>
                Analysis
              </Button>
              <Button variant="default" onClick={() => navigate('/supervisor/users')}>
                Manage Users
              </Button>
              <Button variant="outline" onClick={handleLogout}>Log out</Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="evaluators">Evaluators</TabsTrigger>
          <TabsTrigger value="evaluations">Stage 1 Evaluations</TabsTrigger>
          <TabsTrigger value="stage2">Stage 2 Status</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="evaluators">
          <Card>
            <CardHeader>
              <CardTitle>Evaluators</CardTitle>
              <CardDescription>Choose a registered evaluator from the dropdown to review their details or open their evaluations.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.evaluators ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : evaluators.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-muted-foreground">
                  No evaluators found.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-800/80 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Registered Evaluators</p>
                          <p className="text-xs text-slate-400">Select one profile to reveal the evaluator summary below.</p>
                        </div>
                        <span className="rounded-full border border-slate-700/70 bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-200">
                          {evaluators.length} total
                        </span>
                      </div>

                      <Popover open={evaluatorPickerOpen} onOpenChange={setEvaluatorPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-12 w-full justify-between border-slate-700 bg-slate-950/70 text-left text-white shadow-inner shadow-black/20 hover:bg-slate-900"
                          >
                            <span className="truncate">
                              {selectedEvaluatorLabel || 'Choose an evaluator'}
                            </span>
                            <span className="ml-3 text-xs text-slate-400">Search</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search evaluator by name or email..." />
                            <CommandList className="max-h-72">
                              <CommandEmpty>No evaluator matches your search.</CommandEmpty>
                              <CommandGroup>
                                {evaluators.map((evaluator) => {
                                  const evaluatorId = String((evaluator as any).id ?? (evaluator as any).pk ?? (evaluator as any).email)
                                  const evaluatorName = String((evaluator as any).name ?? 'Unknown evaluator')
                                  const evaluatorEmail = String((evaluator as any).email ?? '')

                                  return (
                                    <CommandItem
                                      key={evaluatorId}
                                      value={`${evaluatorName} ${evaluatorEmail}`}
                                      onSelect={() => handleEvaluatorSelect(evaluatorId)}
                                    >
                                      <div className="flex w-full flex-col text-left">
                                        <span className="font-medium">{evaluatorName}</span>
                                        <span className="text-xs text-muted-foreground">{evaluatorEmail}</span>
                                      </div>
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/90 p-4 text-slate-100 shadow-lg shadow-black/20 backdrop-blur-sm">
                      {selectedEvaluatorDetails ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Selected Evaluator</p>
                            <h3 className="mt-1 text-xl font-semibold text-white">{selectedEvaluatorDetails.name}</h3>
                            <p className="text-sm text-slate-300 break-all">{selectedEvaluatorDetails.email}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                              Role: {selectedEvaluatorDetails.role}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-500/40 bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-200">
                              Registered evaluator
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="default"
                              onClick={() => handleViewSelectedEvaluatorEvaluations(selectedEvaluatorDetails.id)}
                            >
                              View Evaluations
                            </Button>
                            <Button
                              variant="outline"
                              onClick={clearEvaluatorFilter}
                            >
                              Clear Selection
                            </Button>
                          </div>
                        </div>
                      ) : selectedEvaluator ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Selected Evaluator</p>
                            <h3 className="mt-1 text-xl font-semibold text-white">{selectedEvaluatorLabel}</h3>
                            <p className="text-sm text-slate-300 break-all">{String(selectedEvaluator)}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="default"
                              onClick={() => handleViewSelectedEvaluatorEvaluations(String(selectedEvaluator))}
                            >
                              View Evaluations
                            </Button>
                            <Button
                              variant="outline"
                              onClick={clearEvaluatorFilter}
                            >
                              Clear Selection
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-[168px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                          Pick an evaluator from the searchable picker to show their email, role, and evaluations link here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="evaluations">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Evaluations {selectedEvaluator && `for ${getEvaluatorName(selectedEvaluator)}`}</CardTitle>
                  <CardDescription>Review all evaluation metrics and scores</CardDescription>
                </div>
                {selectedEvaluator && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearEvaluatorFilter}
                  >
                    Show All Evaluations
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(selectedEvaluator ? loading.evaluatorEvaluations : loading.evaluations) || loading.metrics ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : selectedEvaluator ? (
                // Display evaluations split into Original / Cross-Assigned tabs
                (() => {
                  const batch1Evaluations: Record<string, Evaluation[]> = {}
                  const batch2Evaluations: Record<string, Evaluation[]> = {}

                  for (const ev of evaluatorEvaluations) {
                    const target = ev.is_cross_assigned ? batch2Evaluations : batch1Evaluations
                    if (!target[ev.case_id]) target[ev.case_id] = []
                    target[ev.case_id].push(ev)
                  }

                  if (evaluatorEvaluations.length === 0) {
                    return (
                      <div className="text-center py-6 text-muted-foreground">
                        No evaluations found for this evaluator
                      </div>
                    )
                  }

                  const renderBatchAccordion = (batchEvaluations: Record<string, Evaluation[]>, emptyMsg: string) => {
                    if (Object.keys(batchEvaluations).length === 0) {
                      return <p className="text-sm text-muted-foreground py-4 px-1">{emptyMsg}</p>
                    }
                    return (
                      <Accordion type="single" collapsible className="w-full">
                        {Object.entries(batchEvaluations).map(([caseId, caseEvaluations], caseIndex) => {
                          const caseDetails = getCaseDetails(caseId)
                          const sortedModels = Array.from(new Set(caseEvaluations.map(evaluation => evaluation.model_id)))
                          const completedMetrics = caseEvaluations.filter(evaluation => evaluation.score >= 1).length
                          const caseStatusLabel = caseEvaluations.length === 0
                            ? 'No Metrics'
                            : completedMetrics === caseEvaluations.length
                              ? 'Completed'
                              : completedMetrics === 0
                                ? 'Pending Review'
                                : `Score: ${completedMetrics}/${caseEvaluations.length}`
                          const caseStatusClassName = caseEvaluations.length === 0
                            ? 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                            : completedMetrics === caseEvaluations.length
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : completedMetrics === 0
                                ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          const modelGroups = caseEvaluations.reduce((acc, evaluation) => {
                            if (!acc[evaluation.model_id]) acc[evaluation.model_id] = []
                            acc[evaluation.model_id].push(evaluation)
                            return acc
                          }, {} as Record<string, Evaluation[]>)

                          return (
                            <AccordionItem key={caseId} value={caseId}>
                              <AccordionTrigger className="hover:bg-gray-50 px-4 rounded">
                                <div className="flex items-center justify-between w-full gap-4">
                                  <div className="text-left">
                                    <div className="font-medium text-foreground">
                                      {getCaseDisplayName(caseId, caseIndex, caseDetails.image_id)}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono break-all">
                                      ID: {caseId} · Click to expand and view {caseEvaluations.length} evaluation metrics
                                    </div>
                                  </div>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${caseStatusClassName}`}>
                                    {caseStatusLabel}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="pt-2 pb-4 px-4">
                                  {Object.entries(modelGroups).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                                      No evaluation metrics are available for this case.
                                    </div>
                                  ) : (
                                  Object.entries(modelGroups).map(([modelId, modelEvals]) => {
                                    const modelIndex = sortedModels.indexOf(modelId)
                                    const modelCompletedMetrics = modelEvals.filter(evaluation => evaluation.score >= 1).length
                                    const modelStatusLabel = modelEvals.length === 0
                                      ? 'No Metrics'
                                      : modelCompletedMetrics === modelEvals.length
                                        ? 'Completed'
                                        : modelCompletedMetrics === 0
                                          ? 'Pending Review'
                                          : `Score: ${modelCompletedMetrics}/${modelEvals.length}`
                                    const modelStatusClassName = modelEvals.length === 0
                                      ? 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                                      : modelCompletedMetrics === modelEvals.length
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : modelCompletedMetrics === 0
                                          ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                                          : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'

                                    return (
                                    <div key={modelId} className="mb-6 border rounded-lg p-4">
                                      <div className="mb-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <h4 className="font-medium text-lg text-foreground">
                                              {getModelDisplayName(modelEvals[0]?.model_name || 'Unknown Model', modelIndex >= 0 ? modelIndex : 0)}
                                            </h4>
                                            <p className="text-xs text-muted-foreground font-mono break-all">
                                              {modelEvals[0]?.model_name || 'Unknown Model'}
                                            </p>
                                          </div>
                                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${modelStatusClassName}`}>
                                            {modelStatusLabel}
                                          </span>
                                        </div>
                                      </div>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Metric</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Date</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {modelEvals.map(evaluation => (
                                            <TableRow key={evaluation.id}>
                                              <TableCell>{getMetricName(evaluation.metric_id, evaluation.metric_name)}</TableCell>
                                              <TableCell>
                                                {(() => {
                                                  const badge = getScoreBadge(evaluation.score)
                                                  return (
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                                                      {badge.label}
                                                    </span>
                                                  )
                                                })()}
                                              </TableCell>
                                              <TableCell>{formatDate(evaluation.created_at)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    )
                                  }))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    )
                  }

                  return (
                    <Tabs value={caseTab} onValueChange={(v) => setCaseTab(v as 'original' | 'cross')}>
                      <TabsList className="mb-4">
                        <TabsTrigger value="original">
                          Original Cases ({Object.keys(batch1Evaluations).length})
                        </TabsTrigger>
                        <TabsTrigger value="cross">
                          Cross-Assigned ({Object.keys(batch2Evaluations).length})
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="original">
                        {renderBatchAccordion(batch1Evaluations, 'No original cases found.')}
                      </TabsContent>
                      <TabsContent value="cross">
                        {renderBatchAccordion(batch2Evaluations, 'No cross-assigned cases found.')}
                      </TabsContent>
                    </Tabs>
                  )
                })()
              ) : (
                // Display all evaluations when no evaluator is selected
                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px_170px] lg:items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Filter evaluations</label>
                      <Input
                        value={evaluationsQuery}
                        onChange={(event) => setEvaluationsQuery(event.target.value)}
                        placeholder="Search case, evaluator, model, metric, or status"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Sort by</label>
                      <Select value={evaluationsSortBy} onValueChange={(value) => setEvaluationsSortBy(value as typeof evaluationsSortBy)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="case">Case ID</SelectItem>
                          <SelectItem value="evaluator">Evaluator</SelectItem>
                          <SelectItem value="model">Model</SelectItem>
                          <SelectItem value="metric">Metric</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Direction</label>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => setEvaluationsSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                      >
                        <span>{evaluationsSortDirection === 'asc' ? 'Ascending' : 'Descending'}</span>
                        <ArrowRight className={`h-4 w-4 transition-transform ${evaluationsSortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                      </Button>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Evaluator</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Metric</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedEvaluations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">No evaluations match the current filter</TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedEvaluations.map((evaluation, index) => {
                          const caseDetails = getCaseDetails(evaluation.case_id);
                          const scoreBadge = getScoreBadge(evaluation.score)
                          const modelIndex = filteredAndSortedEvaluations
                            .filter(item => item.case_id === evaluation.case_id)
                            .findIndex(item => item.model_id === evaluation.model_id)
                          return (
                            <TableRow key={evaluation.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {getCaseDisplayName(evaluation.case_id, index, caseDetails.image_id)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => void copyText(evaluation.case_id)}
                                      aria-label="Copy case ID"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground font-mono break-all">{evaluation.case_id}</p>
                                </div>
                              </TableCell>
                              <TableCell>{getEvaluatorName(evaluation.evaluator_id)}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">
                                    {getModelDisplayName(evaluation.model_name || 'Unknown', modelIndex >= 0 ? modelIndex : 0)}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono break-all">
                                    {evaluation.model_name || 'Unknown'}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getMetricName(evaluation.metric_id, evaluation.metric_name)}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreBadge.className}`}>
                                  {scoreBadge.label}
                                </span>
                              </TableCell>
                              <TableCell>{formatDate(evaluation.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant={evaluation.score === 0 ? 'destructive' : 'outline'}
                                  size="sm"
                                  onClick={() => openReviewDetails(evaluation, caseDetails.image_id)}
                                >
                                  {evaluation.score === 0 ? 'Review Details' : 'Open Analysis'}
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading.evaluations && !selectedEvaluator && (
                <div className="flex items-center justify-between mt-4 gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredAndSortedEvaluations.length} filtered evaluations on page {evaluationsPagination.page} of {totalPages} ({evaluationsPagination.count} total evaluations)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={!evaluationsPagination.previous}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={!evaluationsPagination.next}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="stage2">
             <Card>
                 <CardHeader>
                     <CardTitle>Stage 2: AI Detection Progress</CardTitle>
                     <CardDescription>
                        Tracking evaluator progress on {stage2AssignedCount} assigned Stage 2 images per evaluator.
                     </CardDescription>
                 </CardHeader>
                 <CardContent>
                     {loading.stage2 ? (
                         <div className="flex justify-center py-8">
                             <Loader2 className="h-8 w-8 animate-spin text-primary" />
                         </div>
                     ) : (
                         <Table>
                             <TableHeader>
                                 <TableRow>
                                     <TableHead>Evaluator</TableHead>
                                     <TableHead>Email</TableHead>
                           <TableHead>Progress</TableHead>
                                     <TableHead>Current Progress</TableHead>
                                 </TableRow>
                             </TableHeader>
                             <TableBody>
                         {sortedStage2Stats.length === 0 ? (
                                     <TableRow>
                                         <TableCell colSpan={4} className="text-center">No evaluator data found</TableCell>
                                     </TableRow>
                                 ) : (
                           sortedStage2Stats.map((stat: any) => {
                             const rowState = getStage2RowState(stat.completed_count ?? 0, stat.total_count ?? 0)
                             const StatusIcon = rowState.icon

                             return (
                             <TableRow key={stat.evaluator_id} className={rowState.rowClassName}>
                               <TableCell className="font-medium">{stat.evaluator_name}</TableCell>
                               <TableCell>{stat.email}</TableCell>
                               <TableCell>
                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between gap-3">
                                     <span className="text-sm font-semibold text-foreground">
                                       {stat.total_count === 0 ? 'Unassigned' : `${stat.completed_count} / ${stat.total_count}`}
                                     </span>
                                     <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${rowState.labelClassName}`}>
                                       <StatusIcon className={`h-3.5 w-3.5 ${rowState.label === 'In progress' ? 'animate-spin' : ''}`} />
                                       {rowState.label}
                                     </span>
                                   </div>
                                   <div className={`h-3 overflow-hidden rounded-full ${rowState.trackClassName}`}>
                                     <div 
                                       className={`h-full rounded-full ${rowState.fillClassName} transition-all duration-300`} 
                                       style={{ width: `${rowState.fillWidth}%` }}
                                     />
                                   </div>
                                 </div>
                               </TableCell>
                               <TableCell>
                                 <div className="text-sm text-muted-foreground">
                                   {stat.total_count === 0
                                     ? 'No Stage 2 images assigned to this evaluator.'
                                     : stat.completed_count === stat.total_count
                                     ? 'All assigned images are complete.'
                                     : `${stat.total_count - stat.completed_count} images still need attention.`}
                                 </div>
                               </TableCell>
                             </TableRow>
                             )
                           })
                                 )}
                             </TableBody>
                         </Table>
                     )}
                 </CardContent>
             </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Metrics</CardTitle>
              <CardDescription>All evaluation metrics used in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.metrics ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">No metrics found</TableCell>
                      </TableRow>
                    ) : (
                      metrics.map(metric => (
                        <TableRow key={metric.id}>
                          <TableCell>{metric.id}</TableCell>
                          <TableCell>{metric.name}</TableCell>
                          <TableCell>{metric.description || 'No description available'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Card className="mt-6 border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SupervisorDashboard 
