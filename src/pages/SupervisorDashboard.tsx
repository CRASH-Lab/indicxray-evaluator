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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getAllEvaluators,
  getMetrics,
  getUserDetails,
  adminGetAssignments,
  adminGetEvaluations,
  adminGetAllEvaluatorEvaluations,
  adminGetEvaluatorInterraterSummary,
  adminGetStage2Stats
} from '@/services'
import {
  downloadCsv,
  downloadWorkbook,
  filterSheetsByColumns,
  flattenSheetsForCsv,
  getCsvColumns,
  interraterSummarySheets,
  makeReportFilename,
} from '@/lib/reportExports'
import { ArrowRight, CheckCircle2, Copy, Download, Info, Loader2, TriangleAlert } from 'lucide-react'

// Type definitions for better type safety
interface Evaluator {
  id: string;
  name: string;
  email: string;
  role: string;
  reviewer_group?: string;
  evaluator_group?: string;
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
  evaluator_name?: string;
  peer_evaluator_id?: string | null;
  peer_evaluator_name?: string | null;
  peer_score?: number | null;
  agreement_status?: 'concordant' | 'divergent' | 'pending' | 'unpaired';
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

interface AgreementStats {
  n: number;
  percent_agreement: number | null;
  cohen_kappa: number | null;
  weighted_kappa: number | null;
  icc_2_1: number | null;
  pabak: number | null;
  prevalence_index: number | null;
  bias_index: number | null;
  gwet_ac1: number | null;
}

interface InterraterSummary {
  overall: AgreementStats & {
    paired_cases: number;
    expected_pairs: number;
    overlap_completed: number;
    selected_completed: number;
    opposite_completed: number;
    missing_selected: number;
    missing_opposite: number;
    concordant: number;
    divergent: number;
  };
  by_case: Array<AgreementStats & {
    case_id: string;
    selected_reviewer: string;
    opposite_reviewer: string;
    expected_pairs: number;
    overlap_completed: number;
    selected_completed: number;
    opposite_completed: number;
    missing_selected: number;
    missing_opposite: number;
    concordant: number;
    divergent: number;
  }>;
  by_metric: Array<AgreementStats & {
    metric_id: string;
    metric_name: string;
    concordant: number;
    divergent: number;
  }>;
  by_model: Array<AgreementStats & {
    model_name: string;
    concordant: number;
    divergent: number;
  }>;
  by_pair: Array<AgreementStats & {
    opposite_reviewer_id: string;
    opposite_reviewer_name: string;
    opposite_reviewer_email?: string;
    opposite_reviewer_group?: string;
    paired_cases: number;
    expected_pairs: number;
    overlap_completed: number;
    selected_completed: number;
    opposite_completed: number;
    missing_selected: number;
    missing_opposite: number;
    concordant: number;
    divergent: number;
    cases: Array<AgreementStats & {
      case_id: string;
      selected_reviewer: string;
      opposite_reviewer: string;
      expected_pairs: number;
      overlap_completed: number;
      selected_completed: number;
      opposite_completed: number;
      missing_selected: number;
      missing_opposite: number;
      concordant: number;
      divergent: number;
    }>;
  }>;
  assignment_type: 'all' | 'original' | 'cross';
  generated_at: string;
}

const HIDE_SUPERVISOR_TUTORIAL_PROMPT_KEY = 'indicxray_hideSupervisorTutorialPrompt'

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
  const [interraterSummary, setInterraterSummary] = useState<InterraterSummary | null>(null)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [stage2Stats, setStage2Stats] = useState<any>(null)
  const [selectedEvaluator, setSelectedEvaluator] = useState<string | null>(initialEvaluator)
  const [evaluatorPickerOpen, setEvaluatorPickerOpen] = useState(false)
  const [caseTab, setCaseTab] = useState<'original' | 'cross'>('original')
  const [interraterExportColumns, setInterraterExportColumns] = useState<string[] | null>(null)
  const [evaluationsPage, setEvaluationsPage] = useState(initialPage)
  const [evaluationsPageSize] = useState(100)
  const [evaluationsQuery, setEvaluationsQuery] = useState('')
  const [evaluationsSortBy, setEvaluationsSortBy] = useState<'case' | 'evaluator' | 'model' | 'metric' | 'status' | 'date'>('date')
  const [evaluationsSortDirection, setEvaluationsSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isSupervisorTutorialOpen, setIsSupervisorTutorialOpen] = useState(false)
  const [showSupervisorTutorialPrompt, setShowSupervisorTutorialPrompt] = useState(false)
  const [dontShowSupervisorTutorialAgain, setDontShowSupervisorTutorialAgain] = useState(false)
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
    interraterSummary: false,
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

  useEffect(() => {
    const isHidden = localStorage.getItem(HIDE_SUPERVISOR_TUTORIAL_PROMPT_KEY) === 'true'
    if (!isHidden) {
      setShowSupervisorTutorialPrompt(true)
    }
  }, [])

  const dismissSupervisorTutorialPrompt = (openTutorial = false) => {
    if (dontShowSupervisorTutorialAgain) {
      localStorage.setItem(HIDE_SUPERVISOR_TUTORIAL_PROMPT_KEY, 'true')
    }
    setShowSupervisorTutorialPrompt(false)
    if (openTutorial) {
      setIsSupervisorTutorialOpen(true)
    }
  }

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
          interraterSummary: false,
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

  useEffect(() => {
    setInterraterExportColumns(null)
  }, [selectedEvaluator, caseTab])

  useEffect(() => {
    if (!selectedEvaluator) {
      setInterraterSummary(null)
      return
    }

    let mounted = true

    async function fetchInterraterSummary() {
      try {
        setInterraterSummary(null)
        setLoading(prev => ({ ...prev, interraterSummary: true }))
        const data = await adminGetEvaluatorInterraterSummary(selectedEvaluator!, caseTab)
        if (mounted) {
          setInterraterSummary(data as InterraterSummary | null)
        }
      } catch (err) {
        console.error('Error fetching interrater summary:', err)
      } finally {
        if (mounted) {
          setLoading(prev => ({ ...prev, interraterSummary: false }))
        }
      }
    }

    fetchInterraterSummary()

    return () => {
      mounted = false
    }
  }, [selectedEvaluator, caseTab])
  
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
        label: '1',
        className: 'border-emerald-500/40 bg-emerald-500/10 text-white',
      }
    }

    return {
      label: '0',
      className: 'border-red-500/40 bg-red-500/10 text-white',
    }
  }

  const getAgreementBadge = (status?: Evaluation['agreement_status']): { label: string; className: string } => {
    if (status === 'concordant') {
      return {
        label: 'Concordant',
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      }
    }

    if (status === 'divergent') {
      return {
        label: 'Divergent',
        className: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
      }
    }

    if (status === 'pending') {
      return {
        label: 'Pending',
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      }
    }

    return {
      label: 'Unpaired',
      className: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    }
  }

  const getPeerScoreBadge = (score?: number | null): { label: string; className: string } => {
    if (score === 0 || score === 1) {
      return getScoreBadge(score)
    }

    return {
      label: '-',
      className: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
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

  const formatStat = (value: number | null | undefined, digits = 3): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return value.toFixed(digits)
  }

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return `${value.toFixed(1)}%`
  }

  const getCompletionPercent = (completed: number, total: number): number => {
    if (!total) return 0
    return Math.max(0, Math.min(100, (completed / total) * 100))
  }

  const getCaseInterraterSummary = (caseId: string) => {
    return interraterSummary?.by_case.find((item) => item.case_id === caseId) || null
  }

  const renderSummaryMetric = (label: string, value: string | number) => (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )

  const renderInfoHeader = (label: string, description: string, className?: string) => (
    <TableHead className={className}>
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`${label} column information`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs leading-relaxed" side="top">
            {description}
          </TooltipContent>
        </Tooltip>
      </div>
    </TableHead>
  )

  const getInterraterExportSheets = () => {
    if (!interraterSummary) return []
    return interraterSummarySheets(
      interraterSummary,
      evaluatorEvaluations,
      selectedEvaluatorLabel || 'Selected evaluator',
      caseTab
    )
  }

  const getActiveInterraterExportColumns = (sheets = getInterraterExportSheets()) => {
    const columns = getCsvColumns(sheets)
    return interraterExportColumns ?? columns
  }

  const handleExportInterraterCsv = () => {
    const sheets = getInterraterExportSheets()
    const columns = getActiveInterraterExportColumns(sheets)
    downloadCsv(
      makeReportFilename(['interrater', selectedEvaluatorLabel || selectedEvaluator, caseTab], 'csv'),
      flattenSheetsForCsv(sheets, columns)
    )
  }

  const handleExportInterraterExcel = () => {
    const sheets = getInterraterExportSheets()
    const columns = getActiveInterraterExportColumns(sheets)
    downloadWorkbook(
      makeReportFilename(['interrater', selectedEvaluatorLabel || selectedEvaluator, caseTab], 'xlsx'),
      filterSheetsByColumns(sheets, columns)
    )
  }

  const renderInterraterExportMenu = (format: 'csv' | 'excel') => {
    const sheets = getInterraterExportSheets()
    const columns = getCsvColumns(sheets)
    const activeColumns = getActiveInterraterExportColumns(sheets)
    const activeColumnSet = new Set(activeColumns)
    const isCsv = format === 'csv'

    const toggleColumn = (column: string, checked: boolean) => {
      const nextColumns = checked
        ? Array.from(new Set([...activeColumns, column]))
        : activeColumns.filter((item) => item !== column)
      setInterraterExportColumns(nextColumns.length === columns.length ? null : nextColumns)
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export {isCsv ? 'CSV' : 'Excel'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
          <DropdownMenuLabel>Columns to export</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={activeColumns.length === 0}
            onClick={isCsv ? handleExportInterraterCsv : handleExportInterraterExcel}
          >
            <Download className="mr-2 h-4 w-4" />
            Download {isCsv ? 'CSV' : 'Excel'} ({activeColumns.length}/{columns.length})
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setInterraterExportColumns(null)}>
            Select all
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setInterraterExportColumns([])}>
            Clear all
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column}
              checked={activeColumnSet.has(column)}
              onCheckedChange={(checked) => toggleColumn(column, Boolean(checked))}
              onSelect={(event) => event.preventDefault()}
            >
              {column}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function handleLogout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('userRole')
    navigate('/supervisor', { replace: true })
  }

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab)

    if (nextTab === 'evaluations') {
      setEvaluationsPage(1)
      setSelectedEvaluator(null)
      updateDashboardUrl({ tab: nextTab, page: 1, evaluator: null })
      return
    }

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

  const _pageSizeNum = evaluationsPagination.page_size || evaluationsPageSize
  const totalPages = Math.max(1, Math.ceil((evaluationsPagination.count || 0) / Math.max(1, _pageSizeNum)))
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
      const peerScoreLabel = getPeerScoreBadge(evaluation.peer_score).label
      const agreementLabel = getAgreementBadge(evaluation.agreement_status).label
      const statusText = scoreLabel.toLowerCase()

      return [
        evaluation.case_id,
        evaluatorName,
        evaluation.peer_evaluator_name,
        evaluation.peer_score,
        evaluation.model_name,
        modelName,
        metricName,
        scoreLabel,
        peerScoreLabel,
        agreementLabel,
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
      const leftStatus = getAgreementBadge(left.agreement_status).label
      const rightStatus = getAgreementBadge(right.agreement_status).label
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

  // Build a per-case model ordinal map for the current page's filtered/sorted evaluations
  const modelOrdinalMap: Record<string, Record<string, number>> = {}
  filteredAndSortedEvaluations.forEach(ev => {
    const caseId = ev.case_id
    const modelId = ev.model_id
    if (!modelOrdinalMap[caseId]) modelOrdinalMap[caseId] = {}
    if (modelOrdinalMap[caseId][modelId] === undefined) {
      modelOrdinalMap[caseId][modelId] = Object.keys(modelOrdinalMap[caseId]).length
    }
  })

  const renderInterraterSummaryPanel = () => {
    if (!selectedEvaluator) return null

    if (loading.interraterSummary) {
      return (
        <Card className="mb-5">
          <CardContent className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading interrater summary...
          </CardContent>
        </Card>
      )
    }

    if (!interraterSummary) return null

    const overall = interraterSummary.overall
    const overlapPercent = getCompletionPercent(overall.overlap_completed, overall.expected_pairs)
    const selectedPercent = getCompletionPercent(overall.selected_completed, overall.expected_pairs)
    const oppositePercent = getCompletionPercent(overall.opposite_completed, overall.expected_pairs)

    return (
      <Card className="mb-5">
        <CardContent className="p-0">
          <Accordion type="single" collapsible defaultValue="interrater-summary" className="w-full">
            <AccordionItem value="interrater-summary" className="border-0">
              <AccordionTrigger className="px-6 py-5 hover:no-underline">
                <div className="text-left">
                  <CardTitle className="text-lg">Interrater Summary</CardTitle>
                  <CardDescription className="mt-1">
                    {caseTab === 'original' ? 'Original cases' : 'Cross-assigned cases'} only. Agreement scores use only paired completed ratings; missing ratings affect progress only.
                  </CardDescription>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 px-6 pb-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    {renderSummaryMetric('Paired cases', overall.paired_cases)}
                    {renderSummaryMetric('Paired ratings complete', `${overall.overlap_completed} / ${overall.expected_pairs}`)}
                    {renderSummaryMetric('Concordant / Divergent', `${overall.concordant} / ${overall.divergent}`)}
                    {renderSummaryMetric('Agreement', formatPercent(overall.percent_agreement))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['Interrater overlap', overall.overlap_completed, overlapPercent],
                      ['Selected reviewer', overall.selected_completed, selectedPercent],
                      ['Opposite reviewer', overall.opposite_completed, oppositePercent],
                    ].map(([label, completed, percent]) => (
                      <div key={String(label)} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{String(label)}</span>
                          <span className="text-muted-foreground">{Number(completed)} / {overall.expected_pairs}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Number(percent)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-5">
                    {renderSummaryMetric('Cohen kappa', formatStat(overall.cohen_kappa))}
                    {renderSummaryMetric('Weighted kappa', formatStat(overall.weighted_kappa))}
                    {renderSummaryMetric('ICC(2,1)', formatStat(overall.icc_2_1))}
                    {renderSummaryMetric('PABAK', formatStat(overall.pabak))}
                    {renderSummaryMetric('Gwet AC1', formatStat(overall.gwet_ac1))}
                  </div>

                  <div className="rounded-md border">
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-semibold">Pair Review</p>
                      <p className="text-xs text-muted-foreground">
                        Opposite reviewers for the active {caseTab === 'original' ? 'Original Cases' : 'Cross-Assigned'} tab.
                      </p>
                    </div>
                    {interraterSummary.by_pair.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">No paired reviewer data for this tab.</p>
                    ) : (
                      <Accordion type="multiple" className="w-full">
                        {interraterSummary.by_pair.map((pair) => {
                          const missingTotal = pair.missing_selected + pair.missing_opposite
                          const pairCompletion = getCompletionPercent(pair.overlap_completed, pair.expected_pairs)
                          return (
                            <AccordionItem key={pair.opposite_reviewer_id} value={pair.opposite_reviewer_id}>
                              <AccordionTrigger className="px-3 py-3 hover:no-underline">
                                <div className="grid w-full gap-3 text-left md:grid-cols-[minmax(160px,1fr)_repeat(4,minmax(90px,auto))] md:items-center">
                                  <div>
                                    <p className="text-sm font-semibold">{pair.opposite_reviewer_name || 'Unknown reviewer'}</p>
                                    <p className="text-xs text-muted-foreground">{pair.paired_cases} paired cases</p>
                                  </div>
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">Overlap</p>
                                    <p className="font-medium">{pair.overlap_completed} / {pair.expected_pairs}</p>
                                  </div>
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">Missing</p>
                                    <p className="font-medium">{missingTotal}</p>
                                  </div>
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">Agreement</p>
                                    <p className="font-medium">{formatPercent(pair.percent_agreement)}</p>
                                  </div>
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">PABAK / Gwet</p>
                                    <p className="font-medium">{formatStat(pair.pabak)} / {formatStat(pair.gwet_ac1)}</p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 px-3 pb-4">
                                  <div className="grid gap-3 md:grid-cols-4">
                                    {renderSummaryMetric('Selected complete', `${pair.selected_completed} / ${pair.expected_pairs}`)}
                                    {renderSummaryMetric('Opposite complete', `${pair.opposite_completed} / ${pair.expected_pairs}`)}
                                    {renderSummaryMetric('Concordant / Divergent', `${pair.concordant} / ${pair.divergent}`)}
                                    {renderSummaryMetric('Cohen kappa', formatStat(pair.cohen_kappa))}
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium">Overlap complete</span>
                                      <span className="text-muted-foreground">{pair.overlap_completed} / {pair.expected_pairs}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pairCompletion}%` }} />
                                    </div>
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Case</TableHead>
                                        <TableHead>Overlap</TableHead>
                                        <TableHead>Selected</TableHead>
                                        <TableHead>Opposite</TableHead>
                                        <TableHead>Missing</TableHead>
                                        <TableHead>Concordant / Divergent</TableHead>
                                        <TableHead>Agreement</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {pair.cases.map((caseRow) => (
                                        <TableRow key={`${pair.opposite_reviewer_id}-${caseRow.case_id}`}>
                                          <TableCell>{caseRow.case_id}</TableCell>
                                          <TableCell>{caseRow.overlap_completed} / {caseRow.expected_pairs}</TableCell>
                                          <TableCell>{caseRow.selected_completed}</TableCell>
                                          <TableCell>{caseRow.opposite_completed}</TableCell>
                                          <TableCell>{caseRow.missing_selected + caseRow.missing_opposite}</TableCell>
                                          <TableCell>{caseRow.concordant} / {caseRow.divergent}</TableCell>
                                          <TableCell>{formatPercent(caseRow.percent_agreement)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border">
                      <div className="border-b px-3 py-2 text-sm font-semibold">By Metric</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>n</TableHead>
                            <TableHead>Agreement</TableHead>
                            <TableHead>PABAK</TableHead>
                            <TableHead>Gwet</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {interraterSummary.by_metric.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">No paired metric data</TableCell>
                            </TableRow>
                          ) : interraterSummary.by_metric.map((row) => (
                            <TableRow key={row.metric_id}>
                              <TableCell>{row.metric_name}</TableCell>
                              <TableCell>{row.n}</TableCell>
                              <TableCell>{formatPercent(row.percent_agreement)}</TableCell>
                              <TableCell>{formatStat(row.pabak)}</TableCell>
                              <TableCell>{formatStat(row.gwet_ac1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="rounded-md border">
                      <div className="border-b px-3 py-2 text-sm font-semibold">By Model</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Model</TableHead>
                            <TableHead>n</TableHead>
                            <TableHead>Agreement</TableHead>
                            <TableHead>PABAK</TableHead>
                            <TableHead>Gwet</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {interraterSummary.by_model.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">No paired model data</TableCell>
                            </TableRow>
                          ) : interraterSummary.by_model.map((row) => (
                            <TableRow key={row.model_name}>
                              <TableCell>{row.model_name}</TableCell>
                              <TableCell>{row.n}</TableCell>
                              <TableCell>{formatPercent(row.percent_agreement)}</TableCell>
                              <TableCell>{formatStat(row.pabak)}</TableCell>
                              <TableCell>{formatStat(row.gwet_ac1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="container mx-auto py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Supervisor Dashboard</CardTitle>
              <CardDescription>Review evaluator performance and case evaluations</CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/80 text-white transition-colors hover:border-primary/70 hover:bg-primary/15 hover:text-primary"
                onClick={() => navigate('/supervisor/analysis')}
              >
                Analysis
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/80 text-white transition-colors hover:border-primary/70 hover:bg-primary/15 hover:text-primary"
                onClick={() => navigate('/supervisor/users')}
              >
                Manage Users
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/80 text-white transition-colors hover:border-primary/70 hover:bg-primary/15 hover:text-primary"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1 sm:grid-cols-4">
          <TabsTrigger
            value="evaluators"
            className="min-h-11 rounded-md text-sm font-semibold text-slate-400 transition-colors hover:bg-primary/15 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Evaluators
          </TabsTrigger>
          <TabsTrigger
            value="evaluations"
            className="min-h-11 rounded-md text-sm font-semibold text-slate-400 transition-colors hover:bg-primary/15 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Stage 1 Evaluations
          </TabsTrigger>
          <TabsTrigger
            value="stage2"
            className="min-h-11 rounded-md text-sm font-semibold text-slate-400 transition-colors hover:bg-primary/15 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Stage 2 Status
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="min-h-11 rounded-md text-sm font-semibold text-slate-400 transition-colors hover:bg-primary/15 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Metrics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="evaluators">
          <Card>
            <CardHeader>
              <CardTitle>Evaluators</CardTitle>
              <CardDescription>Choose a registered evaluator from the dropdown to review their details or open their evaluations.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {loading.evaluators ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : evaluators.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-muted-foreground">
                  No evaluators found.
                </div>
              ) : (
                <div className="grid items-stretch gap-5 xl:grid-cols-2">
                    <div className="flex h-full min-h-[170px] flex-col rounded-xl border border-border/60 bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-800/80 p-4 shadow-sm">
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

                    <div className="flex h-full min-h-[170px] rounded-xl border border-slate-700/70 bg-slate-950/90 p-4 text-slate-100 shadow-lg shadow-black/20 backdrop-blur-sm">
                      {selectedEvaluatorDetails ? (
                        <div className="flex w-full flex-col justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Selected Evaluator</p>
                            <h3 className="mt-1 text-xl font-semibold text-white">{selectedEvaluatorDetails.name}</h3>
                            <p className="text-sm text-slate-300 break-all">{selectedEvaluatorDetails.email}</p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                                Role: {selectedEvaluatorDetails.role}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                                Group: {selectedEvaluatorDetails.reviewer_group || selectedEvaluatorDetails.evaluator_group || 'Unknown'}
                              </span>
                            </div>
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
                        <div className="flex w-full flex-col justify-between gap-4">
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
                        <div className="flex min-h-28 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
                          Pick an evaluator from the searchable picker to show their email, role, and evaluations link here.
                        </div>
                      )}
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
                  <div className="flex flex-wrap justify-end gap-2">
                    {interraterSummary && (
                      <>
                        {renderInterraterExportMenu('csv')}
                        {renderInterraterExportMenu('excel')}
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearEvaluatorFilter}
                    >
                      Show All Evaluations
                    </Button>
                  </div>
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
                      <>
                        {renderInterraterSummaryPanel()}
                        <div className="text-center py-6 text-muted-foreground">
                          No evaluations found for this evaluator
                        </div>
                      </>
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
                          const caseInterrater = getCaseInterraterSummary(caseId)
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
                              <AccordionTrigger className="rounded px-4 hover:bg-primary/10">
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
                                  {caseInterrater && (
                                    <div className="mb-4 grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-sm md:grid-cols-4">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Interrater progress</p>
                                        <p className="font-semibold">{caseInterrater.overlap_completed} / {caseInterrater.expected_pairs}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Selected / Opposite</p>
                                        <p className="font-semibold">{caseInterrater.selected_completed} / {caseInterrater.opposite_completed}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Concordant / Divergent</p>
                                        <p className="font-semibold">{caseInterrater.concordant} / {caseInterrater.divergent}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Missing selected / opposite</p>
                                        <p className="font-semibold">{caseInterrater.missing_selected} / {caseInterrater.missing_opposite}</p>
                                      </div>
                                    </div>
                                  )}
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
                                              {(modelEvals[0]?.model_name && String(modelEvals[0]?.model_name).trim().length > 0)
                                                ? String(modelEvals[0]?.model_name)
                                                : getModelDisplayName('Unknown Model', modelIndex >= 0 ? modelIndex : 0)
                                              }
                                            </h4>
                                          </div>
                                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${modelStatusClassName}`}>
                                            {modelStatusLabel}
                                          </span>
                                        </div>
                                      </div>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            {renderInfoHeader('Metric', 'Evaluation criterion that was scored for this model response.')}
                                            {renderInfoHeader('Selected Value', 'Score given by the selected evaluator. 1 means present or accepted; 0 means absent or rejected.')}
                                            {renderInfoHeader('Opposite Value', 'Score from the paired evaluator for the same case, model, and metric when a paired score exists.')}
                                            {renderInfoHeader('Interrater Agreement', 'Whether the selected and opposite evaluator scores match, differ, are pending, or are unpaired.')}
                                            {renderInfoHeader('Date', 'Date when this evaluation score was submitted.')}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {modelEvals.map(evaluation => {
                                            const scoreBadge = getScoreBadge(evaluation.score)
                                            const peerScoreBadge = getPeerScoreBadge(evaluation.peer_score)
                                            const agreementBadge = getAgreementBadge(evaluation.agreement_status)

                                            return (
                                              <TableRow key={evaluation.id}>
                                                <TableCell>{getMetricName(evaluation.metric_id, evaluation.metric_name)}</TableCell>
                                                <TableCell>
                                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreBadge.className}`}>
                                                    {scoreBadge.label}
                                                  </span>
                                                </TableCell>
                                                <TableCell>
                                                  <div className="flex flex-col items-start gap-1">
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${peerScoreBadge.className}`}>
                                                      {peerScoreBadge.label}
                                                    </span>
                                                    {evaluation.peer_evaluator_name && (
                                                      <span className="max-w-44 truncate text-xs text-muted-foreground">
                                                        {evaluation.peer_evaluator_name}
                                                      </span>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  <span
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${agreementBadge.className}`}
                                                    title={
                                                      evaluation.peer_evaluator_name
                                                        ? `${evaluation.peer_evaluator_name}: ${evaluation.peer_score ?? 'not scored'}`
                                                        : undefined
                                                    }
                                                  >
                                                    {agreementBadge.label}
                                                  </span>
                                                </TableCell>
                                                <TableCell>{formatDate(evaluation.created_at)}</TableCell>
                                              </TableRow>
                                            )
                                          })}
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
                    <>
                      {renderInterraterSummaryPanel()}
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
                    </>
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
                        placeholder="Search case, evaluator, model, metric, score, or agreement"
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
                          <SelectItem value="status">Agreement</SelectItem>
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

                  <Table className="min-w-[1180px] table-fixed">
                    <colgroup>
                      <col className="w-[27%]" />
                      <col className="w-[12%]" />
                      <col className="w-[7%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[11%]" />
                      <col className="w-[7%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        {renderInfoHeader('Case ID', 'Case identifier and image label for the evaluated X-ray case.', 'px-3')}
                        {renderInfoHeader('Evaluator', 'Evaluator who submitted this score.', 'px-3')}
                        {renderInfoHeader('Model', 'AI model whose response was evaluated for this case.', 'px-3')}
                        {renderInfoHeader('Metric', 'Evaluation criterion that was scored for this model response.', 'px-3')}
                        {renderInfoHeader('Evaluator Value', 'Score given by this evaluator. 1 means present or accepted; 0 means absent or rejected.', 'px-3')}
                        {renderInfoHeader('Opposite Value', 'Score from the paired evaluator for the same case, model, and metric when a paired score exists.', 'px-3')}
                        {renderInfoHeader('Interrater Agreement', 'Whether the evaluator and opposite evaluator scores match, differ, are pending, or are unpaired.', 'px-3')}
                        {renderInfoHeader('Date', 'Date when this evaluation score was submitted.', 'px-3 whitespace-nowrap')}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedEvaluations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">No evaluations match the current filter</TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedEvaluations.map((evaluation, index) => {
                          const caseDetails = getCaseDetails(evaluation.case_id);
                          const scoreBadge = getScoreBadge(evaluation.score)
                          const peerScoreBadge = getPeerScoreBadge(evaluation.peer_score)
                          const agreementBadge = getAgreementBadge(evaluation.agreement_status)
                              const modelIndex = (modelOrdinalMap[evaluation.case_id] && typeof modelOrdinalMap[evaluation.case_id][evaluation.model_id] === 'number')
                                ? modelOrdinalMap[evaluation.case_id][evaluation.model_id]
                                : 0
                          return (
                            <TableRow key={evaluation.id}>
                              <TableCell className="px-3 py-5 align-top">
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
                                  <p className="truncate font-mono text-xs text-muted-foreground" title={evaluation.case_id}>
                                    {evaluation.case_id}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <span className="block max-w-full break-words">
                                  {evaluation.evaluator_name || getEvaluatorName(evaluation.evaluator_id)}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">
                                    {(evaluation.model_name && String(evaluation.model_name).trim().length > 0)
                                      ? String(evaluation.model_name)
                                      : getModelDisplayName('Unknown', modelIndex >= 0 ? modelIndex : 0)
                                    }
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <span className="block max-w-full break-words">
                                  {getMetricName(evaluation.metric_id, evaluation.metric_name)}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreBadge.className}`}>
                                  {scoreBadge.label}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <div className="flex flex-col items-start gap-1">
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${peerScoreBadge.className}`}>
                                    {peerScoreBadge.label}
                                  </span>
                                  {evaluation.peer_evaluator_name && (
                                    <span className="block max-w-full truncate text-xs text-muted-foreground" title={evaluation.peer_evaluator_name}>
                                      {evaluation.peer_evaluator_name}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${agreementBadge.className}`}
                                  title={
                                    evaluation.peer_evaluator_name
                                      ? `${evaluation.peer_evaluator_name}: ${evaluation.peer_score ?? 'not scored'}`
                                      : undefined
                                  }
                                >
                                  {agreementBadge.label}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-5 align-top whitespace-nowrap">{formatDate(evaluation.created_at)}</TableCell>
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
                    {(() => {
                      const page = Math.max(1, evaluationsPagination.page || 1)
                      const pageSize = evaluationsPagination.page_size || evaluationsPageSize
                      const total = Math.max(0, evaluationsPagination.count || 0)
                      const from = total === 0 ? 0 : ((page - 1) * pageSize) + 1
                      const to = Math.min(total, page * pageSize)
                      return `Showing ${from}-${to} of ${total} evaluations`
                    })()}
                  </div>
                  <div className="flex gap-2 items-center">
                    {(() => {
                      const current = Math.max(1, evaluationsPagination.page || 1)
                      const totalP = totalPages
                      const pages: (number | string)[] = []

                      if (totalP <= 7) {
                        for (let i = 1; i <= totalP; i++) pages.push(i)
                      } else {
                        if (current <= 4) {
                          pages.push(1, 2, 3, 4, '...', totalP)
                        } else if (current >= totalP - 3) {
                          pages.push(1, '...', totalP - 3, totalP - 2, totalP - 1, totalP)
                        } else {
                          pages.push(1, '...', current - 1, current, current + 1, '...', totalP)
                        }
                      }

                      return (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={!evaluationsPagination.previous}
                          >
                            Previous
                          </Button>

                          {pages.map((p, idx) => (
                            typeof p === 'number' ? (
                              <Button
                                key={`page-${p}-${idx}`}
                                size="sm"
                                variant={p === current ? 'default' : 'outline'}
                                onClick={() => {
                                  const next = Number(p)
                                  setEvaluationsPage(next)
                                  updateDashboardUrl({ tab: 'evaluations', page: next })
                                }}
                                aria-current={p === current ? 'page' : undefined}
                              >
                                {p}
                              </Button>
                            ) : (
                              <span key={`sep-${idx}`} className="px-2 text-sm text-muted-foreground">{String(p)}</span>
                            )
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={!evaluationsPagination.next}
                          >
                            Next
                          </Button>
                        </div>
                      )
                    })()}
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

      <Dialog open={isSupervisorTutorialOpen} onOpenChange={setIsSupervisorTutorialOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supervisor Dashboard Tutorial</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Info className="h-9 w-9 text-blue-400" />
            </div>
            <p className="mb-2 text-center text-lg font-semibold text-white">Supervisor workflow overview</p>
            <p className="mx-auto max-w-xl text-center text-sm text-gray-400">
              Use this dashboard to review evaluator progress, compare paired ratings, inspect interrater agreement,
              and export supervisor-ready reports.
            </p>
          </div>

          <div className="mt-6 rounded bg-slate-800/50 p-4 text-sm text-gray-400">
            <p className="mb-2 font-semibold text-white">Tutorial Topics:</p>
            <ul className="list-inside list-disc space-y-1 text-xs">
              <li>Pick an evaluator and open their Stage 1 evaluation details</li>
              <li>Review original and cross-assigned cases separately</li>
              <li>Read interrater agreement, PABAK, and Gwet AC1 summaries</li>
              <li>Use Pair Review to find incomplete or divergent reviewer pairs</li>
              <li>Export CSV or Excel reports with selected columns</li>
            </ul>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsSupervisorTutorialOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setIsSupervisorTutorialOpen(false)
                setActiveTab('evaluators')
                updateDashboardUrl({ tab: 'evaluators', evaluator: selectedEvaluator })
              }}
            >
              Go to Evaluators
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupervisorTutorialPrompt} onOpenChange={setShowSupervisorTutorialPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Welcome to Supervisor Dashboard</DialogTitle>
          </DialogHeader>

          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Info className="h-9 w-9 text-blue-400" />
            </div>
            <p className="mb-2 font-medium text-gray-300">Want a quick dashboard walkthrough?</p>
            <p className="text-sm text-gray-400">
              We recommend reviewing the supervisor tools before checking evaluator progress and agreement reports.
            </p>
          </div>

          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="dontShowSupervisorTutorialAgain"
              checked={dontShowSupervisorTutorialAgain}
              onCheckedChange={(checked) => setDontShowSupervisorTutorialAgain(checked === true)}
            />
            <Label htmlFor="dontShowSupervisorTutorialAgain" className="cursor-pointer select-none text-sm text-gray-400">
              Don't show this again
            </Label>
          </div>

          <div className="flex flex-col-reverse gap-3">
            <Button
              variant="outline"
              onClick={() => dismissSupervisorTutorialPrompt(false)}
              className="w-full"
            >
              Skip Tutorial
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => dismissSupervisorTutorialPrompt(true)}
            >
              <Info className="mr-2 h-4 w-4" />
              Watch Tutorial
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <Card className="mt-6 border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
    </TooltipProvider>
  )
}

export default SupervisorDashboard 
