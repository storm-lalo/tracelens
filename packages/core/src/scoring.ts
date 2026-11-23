import type { Entity, Finding, Investigation, Severity } from './types'

const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  low: 5,
  medium: 12,
  high: 24,
  critical: 40,
}

export const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical']

export function severityWeight(severity: Severity): number {
  return SEVERITY_WEIGHT[severity]
}

export function gradeForScore(score: number): Investigation['grade'] {
  if (score < 20) return 'A'
  if (score < 40) return 'B'
  if (score < 60) return 'C'
  if (score < 80) return 'D'
  return 'F'
}

export function riskLabel(score: number): string {
  if (score < 20) return 'Low exposure'
  if (score < 40) return 'Guarded'
  if (score < 60) return 'Notable exposure'
  if (score < 80) return 'High exposure'
  return 'Critical exposure'
}

/**
 * Blends the most severe entity signals with finding severity into a 0-100 risk score.
 * The result is intentionally explainable: every point can be traced to an entity or finding.
 */
export function scoreInvestigation(entities: Entity[], findings: Finding[]): number {
  if (entities.length === 0 && findings.length === 0) return 0

  const rankedRisks = entities
    .map((entity) => entity.risk * (0.65 + entity.confidence * 0.35))
    .sort((a, b) => b - a)
    .slice(0, 8)

  const entitySignal =
    rankedRisks.length === 0
      ? 0
      : rankedRisks.reduce((sum, risk, index) => sum + risk * (1 - index * 0.08), 0) /
        rankedRisks.reduce((sum, _risk, index) => sum + 1 - index * 0.08, 0)

  const findingSignal = Math.min(
    100,
    findings.reduce((sum, finding) => sum + SEVERITY_WEIGHT[finding.severity], 0),
  )

  const raw = entitySignal * 0.45 + findingSignal * 0.55
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] += 1
      return counts
    },
    { info: 0, low: 0, medium: 0, high: 0, critical: 0 } satisfies Record<Severity, number>,
  )
}
