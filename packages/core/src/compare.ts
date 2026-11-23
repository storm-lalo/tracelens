import { gradeForScore, SEVERITY_ORDER } from './scoring'
import type { Entity, Finding, Investigation, Severity } from './types'

export interface Comparison {
  left: Investigation
  right: Investigation
  scoreDelta: number
  entityDelta: number
  findingDelta: number
  severityDelta: Record<Severity, number>
  sharedEntities: Entity[]
  onlyLeft: Entity[]
  onlyRight: Entity[]
  introducedFindings: Finding[]
  resolvedFindings: Finding[]
  narrative: string
}

function titleKey(finding: Finding): string {
  return `${finding.severity}:${finding.title.toLowerCase()}`
}

/** Diffs two investigations so changes after remediation (or over time) are obvious. */
export function compareInvestigations(left: Investigation, right: Investigation): Comparison {
  const leftIds = new Set(left.entities.map((entity) => entity.id))
  const rightIds = new Set(right.entities.map((entity) => entity.id))
  const leftFindings = new Map(left.findings.map((finding) => [titleKey(finding), finding]))
  const rightFindings = new Map(right.findings.map((finding) => [titleKey(finding), finding]))

  const severityDelta = SEVERITY_ORDER.reduce(
    (acc, severity) => {
      const after = right.findings.filter((finding) => finding.severity === severity).length
      const before = left.findings.filter((finding) => finding.severity === severity).length
      acc[severity] = after - before
      return acc
    },
    {} as Record<Severity, number>,
  )

  const introducedFindings = right.findings.filter((finding) => !leftFindings.has(titleKey(finding)))
  const resolvedFindings = left.findings.filter((finding) => !rightFindings.has(titleKey(finding)))
  const scoreDelta = right.score - left.score
  const direction =
    scoreDelta < 0 ? `improved by ${Math.abs(scoreDelta)} points` : scoreDelta > 0 ? `worsened by ${scoreDelta} points` : 'unchanged'

  const narrative =
    `Risk posture ${direction}, moving from ${left.score}/100 (${left.grade}) to ${right.score}/100 (${right.grade}). ` +
    `Entity count changed by ${right.entities.length - left.entities.length >= 0 ? '+' : ''}${right.entities.length - left.entities.length}; ` +
    `findings changed by ${right.findings.length - left.findings.length >= 0 ? '+' : ''}${right.findings.length - left.findings.length}. ` +
    (introducedFindings.length > 0
      ? `${introducedFindings.length} new finding${introducedFindings.length === 1 ? '' : 's'} appeared. `
      : 'No new findings appeared. ') +
    (resolvedFindings.length > 0
      ? `${resolvedFindings.length} previous finding${resolvedFindings.length === 1 ? ' no longer appears' : 's no longer appear'}.`
      : 'No previous findings were resolved.') +
    (right.score < left.score && gradeForScore(right.score) !== gradeForScore(left.score)
      ? ` Overall grade improved from ${left.grade} to ${right.grade}.`
      : '')

  return {
    left,
    right,
    scoreDelta,
    entityDelta: right.entities.length - left.entities.length,
    findingDelta: right.findings.length - left.findings.length,
    severityDelta,
    sharedEntities: right.entities.filter((entity) => leftIds.has(entity.id)),
    onlyLeft: left.entities.filter((entity) => !rightIds.has(entity.id)),
    onlyRight: right.entities.filter((entity) => !leftIds.has(entity.id)),
    introducedFindings,
    resolvedFindings,
    narrative,
  }
}
