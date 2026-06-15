import * as XLSX from 'xlsx'

type CellValue = string | number | boolean | null | undefined
export type ExportRow = Record<string, CellValue>
export type ExportSheet = {
  name: string
  rows: ExportRow[]
}

const dash = (value: CellValue) => (value === null || value === undefined || value === '' ? '-' : value)

const timestamp = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const csvEscape = (value: CellValue) => {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const filterRowsByColumns = (rows: ExportRow[], columns?: string[]) => {
  if (!columns || columns.length === 0) return rows
  return rows.map((row) =>
    columns.reduce<ExportRow>((filtered, column) => {
      if (Object.prototype.hasOwnProperty.call(row, column)) {
        filtered[column] = row[column]
      }
      return filtered
    }, {})
  )
}

const toCsv = (rows: ExportRow[]) => {
  if (rows.length === 0) return ''

  const headers = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key))
      return keys
    }, new Set<string>())
  )

  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n')
}

export const makeReportFilename = (parts: Array<string | null | undefined>, extension: 'csv' | 'xlsx') => {
  const base = sanitizeFilename(parts.filter(Boolean).join('-')) || 'report'
  return `${base}-${timestamp()}.${extension}`
}

export const downloadCsv = (filename: string, rows: ExportRow[]) => {
  const csv = toCsv(rows)
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}

export const downloadWorkbook = (filename: string, sheets: ExportSheet[]) => {
  const workbook = XLSX.utils.book_new()
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ note: 'No data' }])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  })
  XLSX.writeFile(workbook, filename)
}

export const getSheetColumns = (sheets: ExportSheet[]) =>
  Array.from(
    sheets.reduce((keys, sheet) => {
      sheet.rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)))
      return keys
    }, new Set<string>())
  )

export const filterSheetsByColumns = (sheets: ExportSheet[], columns?: string[]) =>
  sheets.map((sheet) => ({
    ...sheet,
    rows: filterRowsByColumns(sheet.rows, columns),
  }))

export const interraterSummarySheets = (
  summary: any,
  evaluations: any[],
  evaluatorName: string,
  assignmentType: 'original' | 'cross'
): ExportSheet[] => {
  const scope = assignmentType === 'original' ? 'Original Cases' : 'Cross-Assigned'
  const scopedEvaluations = evaluations.filter((row) => row.is_cross_assigned === (assignmentType === 'cross'))

  const pairRows = (summary?.by_pair || []).map((pair: any) => ({
    scope,
    evaluator: evaluatorName,
    opposite_reviewer_id: pair.opposite_reviewer_id,
    opposite_reviewer_name: pair.opposite_reviewer_name,
    paired_cases: pair.paired_cases,
    expected_ratings: pair.expected_pairs,
    overlap_complete: pair.overlap_completed,
    selected_complete: pair.selected_completed,
    opposite_complete: pair.opposite_completed,
    missing_selected: pair.missing_selected,
    missing_opposite: pair.missing_opposite,
    concordant: pair.concordant,
    divergent: pair.divergent,
    percent_agreement: pair.percent_agreement,
    cohen_kappa: pair.cohen_kappa,
    weighted_kappa: pair.weighted_kappa,
    icc_2_1: pair.icc_2_1,
    pabak: pair.pabak,
    prevalence_index: pair.prevalence_index,
    bias_index: pair.bias_index,
    gwet_ac1: pair.gwet_ac1,
  }))

  const caseRows = (summary?.by_pair || []).flatMap((pair: any) =>
    (pair.cases || []).map((caseRow: any) => ({
      scope,
      evaluator: evaluatorName,
      opposite_reviewer_id: pair.opposite_reviewer_id,
      opposite_reviewer_name: pair.opposite_reviewer_name,
      case_id: caseRow.case_id,
      expected_ratings: caseRow.expected_pairs,
      overlap_complete: caseRow.overlap_completed,
      selected_complete: caseRow.selected_completed,
      opposite_complete: caseRow.opposite_completed,
      missing_selected: caseRow.missing_selected,
      missing_opposite: caseRow.missing_opposite,
      concordant: caseRow.concordant,
      divergent: caseRow.divergent,
      percent_agreement: caseRow.percent_agreement,
      cohen_kappa: caseRow.cohen_kappa,
      pabak: caseRow.pabak,
      gwet_ac1: caseRow.gwet_ac1,
    }))
  )

  const metricRows = (summary?.by_metric || []).map((row: any) => ({
    scope,
    metric_id: row.metric_id,
    metric_name: row.metric_name,
    n: row.n,
    concordant: row.concordant,
    divergent: row.divergent,
    percent_agreement: row.percent_agreement,
    cohen_kappa: row.cohen_kappa,
    pabak: row.pabak,
    gwet_ac1: row.gwet_ac1,
  }))

  const modelRows = (summary?.by_model || []).map((row: any) => ({
    scope,
    model_name: row.model_name,
    n: row.n,
    concordant: row.concordant,
    divergent: row.divergent,
    percent_agreement: row.percent_agreement,
    cohen_kappa: row.cohen_kappa,
    pabak: row.pabak,
    gwet_ac1: row.gwet_ac1,
  }))

  const rowValueRows = scopedEvaluations.map((row) => ({
    scope,
    evaluator: evaluatorName,
    case_id: row.case_id,
    model_name: row.model_name,
    metric_name: row.metric_name,
    selected_value: row.score,
    opposite_reviewer_id: dash(row.peer_evaluator_id),
    opposite_reviewer_name: dash(row.peer_evaluator_name),
    opposite_value: dash(row.peer_score),
    interrater_agreement: dash(row.agreement_status),
    created_at: row.created_at,
  }))

  const summaryRow = summary?.overall
    ? [{
        scope,
        evaluator: evaluatorName,
        paired_cases: summary.overall.paired_cases,
        expected_ratings: summary.overall.expected_pairs,
        overlap_complete: summary.overall.overlap_completed,
        selected_complete: summary.overall.selected_completed,
        opposite_complete: summary.overall.opposite_completed,
        missing_selected: summary.overall.missing_selected,
        missing_opposite: summary.overall.missing_opposite,
        concordant: summary.overall.concordant,
        divergent: summary.overall.divergent,
        percent_agreement: summary.overall.percent_agreement,
        cohen_kappa: summary.overall.cohen_kappa,
        weighted_kappa: summary.overall.weighted_kappa,
        icc_2_1: summary.overall.icc_2_1,
        pabak: summary.overall.pabak,
        prevalence_index: summary.overall.prevalence_index,
        bias_index: summary.overall.bias_index,
        gwet_ac1: summary.overall.gwet_ac1,
        generated_at: summary.generated_at,
      }]
    : []

  return [
    { name: 'Summary', rows: summaryRow },
    { name: 'Pair Summary', rows: pairRows },
    { name: 'Case Summary', rows: caseRows },
    { name: 'Row Values', rows: rowValueRows },
    { name: 'By Metric', rows: metricRows },
    { name: 'By Model', rows: modelRows },
  ]
}

export const flattenSheetsForCsv = (sheets: ExportSheet[], columns?: string[]) =>
  filterRowsByColumns(
    sheets.flatMap((sheet) => sheet.rows.map((row) => ({ section: sheet.name, ...row }))),
    columns
  )

export const getCsvColumns = (sheets: ExportSheet[]) => ['section', ...getSheetColumns(sheets)]

export const reliabilityReportSheets = (report: any, modelNameMap: Record<string, string>): ExportSheet[] => {
  const summaryRows = report
    ? [
        {
          generated_at: report.generated_at,
          cross_assigned_sets_found: report.summary?.cross_assigned_sets_found,
          paired_sets_included: report.summary?.paired_sets_included,
          aligned_pairs: report.summary?.aligned_pairs,
          excluded_test_users: report.summary?.excluded_test_users,
        },
      ]
    : []

  const overallRows = report?.overall ? [{ scope: 'overall', ...report.overall }] : []
  const metricRows = (report?.by_metric || []).map((row: any) => ({ ...row }))
  const modelRows = (report?.by_model || []).map((row: any) => ({
    ...row,
    model: modelNameMap[row.model] || row.model,
    model_code: row.model,
  }))

  return [
    { name: 'Run Summary', rows: summaryRows },
    { name: 'Overall', rows: overallRows },
    { name: 'By Metric', rows: metricRows },
    { name: 'By Model', rows: modelRows },
  ]
}
