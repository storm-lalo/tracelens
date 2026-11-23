import type { Comparison } from './compare'
import type { Severity } from './types'

export interface DriftAssessment {
  hasDrift: boolean
  severity: Severity | null
  reasons: string[]
}

const RANK: Severity[] = ['info', 'low', 'medium', 'high', 'critical']

function higher(a: Severity | null, b: Severity): Severity {
  if (!a) return b
  return RANK.indexOf(a) >= RANK.indexOf(b) ? a : b
}

/**
 * Decides whether a comparison is worth alerting on.
 * Threshold applies to risk-score movement; newly introduced critical/high
 * findings always alert regardless of score movement.
 */
export function assessDrift(comparison: Comparison, alertThreshold: number): DriftAssessment {
  const reasons: string[] = []
  let severity: Severity | null = null
  const delta = Math.abs(comparison.scoreDelta)
  const direction = comparison.scoreDelta > 0 ? 'increased' : 'decreased'

  if (delta >= alertThreshold && comparison.scoreDelta !== 0) {
    severity = higher(severity, delta >= 25 ? 'critical' : delta >= 15 ? 'high' : 'medium')
    reasons.push(`Risk score ${direction} by ${delta} points (threshold ${alertThreshold}).`)
  }

  const introducedCritical = comparison.introducedFindings.filter(
    (finding) => finding.severity === 'critical',
  )
  if (introducedCritical.length > 0) {
    severity = higher(severity, 'critical')
    reasons.push(`${introducedCritical.length} critical finding${introducedCritical.length === 1 ? '' : 's'} appeared.`)
  }

  const introducedHigh = comparison.introducedFindings.filter((finding) => finding.severity === 'high')
  if (introducedHigh.length > 0) {
    severity = higher(severity, 'high')
    reasons.push(`${introducedHigh.length} high-severity finding${introducedHigh.length === 1 ? '' : 's'} appeared.`)
  }

  const growth = comparison.entityDelta
  if (Math.abs(growth) >= 8) {
    severity = higher(severity, 'medium')
    reasons.push(`Entity footprint changed by ${growth > 0 ? '+' : ''}${growth}.`)
  }

  return { hasDrift: reasons.length > 0, severity, reasons }
}
