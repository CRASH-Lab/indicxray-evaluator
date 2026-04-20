import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminRunReliabilityReport } from '@/services'

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

function SupervisorAnalysis() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ReliabilityResponse | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminRunReliabilityReport()
      setReport(data as ReliabilityResponse)
    } catch (err) {
      console.error('Failed to run reliability analysis:', err)
      setError('Failed to run reliability analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Supervisor Analysis</CardTitle>
              <CardDescription>
                Run inter-rater, PABAK, and Gwet AC1 reports for cross-assigned Stage 1 evaluations.
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
        </CardHeader>
      </Card>

      {error && (
        <Card className="mb-6 border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
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
