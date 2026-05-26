import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminRunReliabilityReport } from '@/services'
import {
  downloadCsv,
  downloadWorkbook,
  filterSheetsByColumns,
  flattenSheetsForCsv,
  getCsvColumns,
  makeReportFilename,
  reliabilityReportSheets,
} from '@/lib/reportExports'

type ReliabilityStats = {
  n: number
  percent_agreement: number | null
  cohen_kappa: number | null
  weighted_kappa: number | null
  icc_2_1: number | null
  pabak: number | null
  prevalence_index: number | null
  bias_index: number | null
  gwet_ac1: number | null
}

type ReliabilityResponse = {
  generated_at: string
  summary: {
    cross_assigned_sets_found: number
    paired_sets_included: number
    aligned_pairs: number
    excluded_test_users: number
  }
  overall: ReliabilityStats | null
  by_metric: Array<{ metric: string } & ReliabilityStats>
  by_model: Array<{ model: string } & ReliabilityStats>
}

const MODEL_NAME_MAP: Record<string, string> = {
  A: 'gemini-3-pro-image-preview',
  B: 'gpt-image-1.5',
  C: 'flux-2-max',
  D: 'Seedream 4.5',
  E: 'Qwen-Image-Edit-2511',
  F: 'LongCat-Image-Edit',
}

const formatStat = (value: number | null, digits = 4) => {
  if (value === null || Number.isNaN(value)) return 'N/A'
  return value.toFixed(digits)
}

const getAnalysisErrorMessage = (err: unknown) => {
  const responseData = (err as { response?: { data?: unknown } })?.response?.data

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData
  }

  if (responseData && typeof responseData === 'object') {
    const data = responseData as { detail?: unknown; error?: unknown; message?: unknown }
    const message = data.detail || data.error || data.message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  return 'Failed to run reliability analysis. Please try again.'
}

function SupervisorAnalysis() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ReliabilityResponse | null>(null)
  const [analysisExportColumns, setAnalysisExportColumns] = useState<string[] | null>(null)

  useEffect(() => {
    setAnalysisExportColumns(null)
  }, [report])

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminRunReliabilityReport()
      setReport(data as ReliabilityResponse)
    } catch (err) {
      console.error('Failed to run reliability analysis:', err)
      setError(getAnalysisErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCsv = () => {
    if (!report) return
    const sheets = reliabilityReportSheets(report, MODEL_NAME_MAP)
    const columns = analysisExportColumns ?? getCsvColumns(sheets)
    downloadCsv(makeReportFilename(['analysis-report'], 'csv'), flattenSheetsForCsv(sheets, columns))
  }

  const handleSaveExcel = () => {
    if (!report) return
    const sheets = reliabilityReportSheets(report, MODEL_NAME_MAP)
    const columns = analysisExportColumns ?? getCsvColumns(sheets)
    downloadWorkbook(makeReportFilename(['analysis-report'], 'xlsx'), filterSheetsByColumns(sheets, columns))
  }

  const renderAnalysisExportMenu = (format: 'csv' | 'excel') => {
    if (!report) return null

    const sheets = reliabilityReportSheets(report, MODEL_NAME_MAP)
    const columns = getCsvColumns(sheets)
    const activeColumns = analysisExportColumns ?? columns
    const activeColumnSet = new Set(activeColumns)
    const isCsv = format === 'csv'

    const toggleColumn = (column: string, checked: boolean) => {
      const nextColumns = checked
        ? Array.from(new Set([...activeColumns, column]))
        : activeColumns.filter((item) => item !== column)
      setAnalysisExportColumns(nextColumns.length === columns.length ? null : nextColumns)
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Save {isCsv ? 'CSV' : 'Excel'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
          <DropdownMenuLabel>Columns to export</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={activeColumns.length === 0}
            onClick={isCsv ? handleSaveCsv : handleSaveExcel}
          >
            <Download className="h-4 w-4 mr-2" />
            Download {isCsv ? 'CSV' : 'Excel'} ({activeColumns.length}/{columns.length})
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAnalysisExportColumns(null)}>
            Select all
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAnalysisExportColumns([])}>
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

  const hasReport = Boolean(report)

  return (
    <div
      className={`container mx-auto py-8 transition-all duration-500 ${
        hasReport ? '' : 'flex min-h-[calc(100vh-4rem)] flex-col justify-center'
      }`}
    >
      <Card
        className={`transition-all duration-500 ${
          hasReport
            ? 'mb-6'
            : 'mx-auto w-full max-w-3xl border-primary/20 bg-card/95 shadow-2xl shadow-primary/10'
        }`}
      >
        <CardHeader>
          <div
            className={`flex gap-6 ${
              hasReport
                ? 'items-center justify-between'
                : 'flex-col items-center text-center'
            }`}
          >
            <div className={hasReport ? '' : 'max-w-2xl'}>
              <div
                className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  loading
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : hasReport
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-900/80 text-slate-300'
                }`}
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? 'Running analysis' : hasReport ? 'Latest analysis ready' : 'Ready to run'}
              </div>
              <CardTitle className={hasReport ? '' : 'text-3xl'}>Supervisor Analysis</CardTitle>
              <CardDescription className={hasReport ? '' : 'mt-3 text-base'}>
                Run inter-rater, PABAK, and Gwet AC1 reports for cross-assigned Stage 1 evaluations.
              </CardDescription>
            </div>
            <div className={`flex flex-wrap gap-2 ${hasReport ? 'justify-end' : 'justify-center'}`}>
              {report && (
                <>
                  {renderAnalysisExportMenu('csv')}
                  {renderAnalysisExportMenu('excel')}
                </>
              )}
              <Button onClick={runAnalysis} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Run Analysis'
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
            </div>
          </div>
          {!hasReport && (
            <div className="mt-8 grid gap-3 border-t border-border/60 pt-6 text-left sm:grid-cols-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Cross-assigned Stage 1</p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Includes</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Agreement and reliability</p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Exports</p>
                <p className="mt-1 text-sm font-semibold text-foreground">CSV and Excel after run</p>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {error && (
        <Alert
          variant="destructive"
          className={`mb-6 border-red-500/60 bg-red-500/10 text-red-100 ${
            hasReport ? '' : 'mx-auto w-full max-w-3xl'
          }`}
        >
          <AlertTitle>Analysis could not run</AlertTitle>
          <AlertDescription className="text-red-100/90">{error}</AlertDescription>
        </Alert>
      )}

      {report && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Run Summary</CardTitle>
              <CardDescription>
                Generated at {new Date(report.generated_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cross-assigned sets</p>
                <p className="font-semibold">{report.summary.cross_assigned_sets_found}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Paired sets included</p>
                <p className="font-semibold">{report.summary.paired_sets_included}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Aligned score pairs</p>
                <p className="font-semibold">{report.summary.aligned_pairs}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Excluded test users</p>
                <p className="font-semibold">{report.summary.excluded_test_users}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>How These Numbers Are Computed</CardTitle>
              <CardDescription>
                Data source and calculation logic used for every value on this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Source rows come from cross-assigned Stage 1 cases only. The backend finds sets with one original evaluator
                and one cross evaluator, then aligns both raters on the same <span className="text-foreground font-medium">model + metric</span> pair.
              </p>
              <p>
                <span className="text-foreground font-medium">Cross-assigned sets</span> = all sets that have a cross-assigned assignment.
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">Paired sets included</span> = sets with exactly 1 original + 1 cross evaluator.
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">Aligned score pairs (n)</span> = pair count where both evaluators submitted a score.
              </p>
              <p>
                <span className="text-foreground font-medium">% Agreement</span> is direct agreement rate.
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">Cohen kappa</span> adjusts agreement for chance.
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">Weighted kappa</span> equals Cohen here because ratings are binary (0/1).
              </p>
              <p>
                <span className="text-foreground font-medium">PABAK</span> adjusts for prevalence/bias effects (reported alongside
                <span className="text-foreground font-medium"> PI</span> and <span className="text-foreground font-medium">BI</span>).
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">Gwet AC1</span> is a chance-corrected agreement statistic robust to prevalence skew.
                <span className="mx-1">|</span>
                <span className="text-foreground font-medium">ICC(2,1)</span> is two-way random-effects absolute agreement.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Overall Reliability</CardTitle>
              <CardDescription>
                Aggregated across all aligned evaluator pairs from all included cross-assigned sets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!report.overall ? (
                <p className="text-sm text-muted-foreground">No paired data found for analysis.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground">n</p><p className="font-semibold">{report.overall.n}</p></div>
                  <div><p className="text-muted-foreground">% Agreement</p><p className="font-semibold">{formatStat(report.overall.percent_agreement, 1)}</p></div>
                  <div><p className="text-muted-foreground">Cohen kappa</p><p className="font-semibold">{formatStat(report.overall.cohen_kappa)}</p></div>
                  <div><p className="text-muted-foreground">Weighted kappa</p><p className="font-semibold">{formatStat(report.overall.weighted_kappa)}</p></div>
                  <div><p className="text-muted-foreground">ICC(2,1)</p><p className="font-semibold">{formatStat(report.overall.icc_2_1)}</p></div>
                  <div><p className="text-muted-foreground">PABAK</p><p className="font-semibold">{formatStat(report.overall.pabak)}</p></div>
                  <div><p className="text-muted-foreground">Gwet AC1</p><p className="font-semibold">{formatStat(report.overall.gwet_ac1)}</p></div>
                  <div><p className="text-muted-foreground">PI / BI</p><p className="font-semibold">{formatStat(report.overall.prevalence_index, 3)} / {formatStat(report.overall.bias_index, 3)}</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>By Metric</CardTitle>
              <CardDescription>
                Each row is computed using only aligned pairs for that specific metric (across all models and included sets).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>n</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Kappa</TableHead>
                    <TableHead>PABAK</TableHead>
                    <TableHead>Gwet AC1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.by_metric.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">No metric-level data</TableCell>
                    </TableRow>
                  ) : (
                    report.by_metric.map((row) => (
                      <TableRow key={row.metric}>
                        <TableCell>{row.metric}</TableCell>
                        <TableCell>{row.n}</TableCell>
                        <TableCell>{formatStat(row.percent_agreement, 1)}%</TableCell>
                        <TableCell>{formatStat(row.cohen_kappa)}</TableCell>
                        <TableCell>{formatStat(row.pabak)}</TableCell>
                        <TableCell>{formatStat(row.gwet_ac1)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Model</CardTitle>
              <CardDescription>
                Each row is computed using only aligned pairs for that model (across all metrics and included sets).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>n</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Kappa</TableHead>
                    <TableHead>PABAK</TableHead>
                    <TableHead>Gwet AC1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.by_model.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">No model-level data</TableCell>
                    </TableRow>
                  ) : (
                    report.by_model.map((row) => (
                      <TableRow key={row.model}>
                        <TableCell>{MODEL_NAME_MAP[row.model] || row.model}</TableCell>
                        <TableCell>{row.n}</TableCell>
                        <TableCell>{formatStat(row.percent_agreement, 1)}%</TableCell>
                        <TableCell>{formatStat(row.cohen_kappa)}</TableCell>
                        <TableCell>{formatStat(row.pabak)}</TableCell>
                        <TableCell>{formatStat(row.gwet_ac1)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default SupervisorAnalysis
