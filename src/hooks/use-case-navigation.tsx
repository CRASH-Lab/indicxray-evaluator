import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const MANIFEST_KEY = 'caseNavigationManifest'

export interface CaseNavigationManifest {
  assignmentIds: string[]
  doctorId: string
}

export interface CaseNavigationContext {
  currentIndex: number
  totalCases: number
  hasNext: boolean
  hasPrev: boolean
  goToNextCase: () => void
  goToPrevCase: () => void
  /** True when a valid manifest exists for the current assignment */
  isAvailable: boolean
}

/**
 * Reads the navigation manifest from sessionStorage and provides
 * case-level navigation helpers (next/prev between assignments).
 *
 * The manifest is written by DoctorCases when a user clicks into a case.
 * If no manifest is found (e.g. direct URL access), navigation gracefully
 * degrades — isAvailable will be false.
 */
function useCaseNavigation(currentAssignmentId: string | undefined): CaseNavigationContext {
  const navigate = useNavigate()

  const manifest = useMemo<CaseNavigationManifest | null>(() => {
    try {
      const raw = sessionStorage.getItem(MANIFEST_KEY)
      if (!raw) return null
      return JSON.parse(raw) as CaseNavigationManifest
    } catch {
      return null
    }
  }, [currentAssignmentId]) // re-read when assignment changes

  const currentIndex = useMemo(() => {
    if (!manifest || !currentAssignmentId) return -1
    return manifest.assignmentIds.indexOf(currentAssignmentId)
  }, [manifest, currentAssignmentId])

  const totalCases = manifest?.assignmentIds.length ?? 0
  const isAvailable = manifest !== null && currentIndex >= 0
  const hasNext = isAvailable && currentIndex < totalCases - 1
  const hasPrev = isAvailable && currentIndex > 0

  const goToNextCase = () => {
    if (!hasNext || !manifest) return
    const nextId = manifest.assignmentIds[currentIndex + 1]
    navigate(`/rad/${nextId}?doctorId=${manifest.doctorId}`)
  }

  const goToPrevCase = () => {
    if (!hasPrev || !manifest) return
    const prevId = manifest.assignmentIds[currentIndex - 1]
    navigate(`/rad/${prevId}?doctorId=${manifest.doctorId}`)
  }

  return {
    currentIndex,
    totalCases,
    hasNext,
    hasPrev,
    goToNextCase,
    goToPrevCase,
    isAvailable,
  }
}

/** Persist the navigation manifest to sessionStorage. */
export function saveCaseNavigationManifest(manifest: CaseNavigationManifest): void {
  sessionStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
}

export default useCaseNavigation
