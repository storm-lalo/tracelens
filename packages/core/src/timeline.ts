import { entityId } from './graph'
import type { Finding, RawSignal, TimelineEvent } from './types'

/** Builds a chronological, analyst-readable sequence from raw observations and findings. */
export function buildTimeline(signals: RawSignal[], findings: Finding[]): TimelineEvent[] {
  const events: TimelineEvent[] = signals.map((signal, index) => ({
    id: `evt-signal-${index.toString().padStart(3, '0')}`,
    at: signal.observedAt,
    kind: 'signal',
    label: signal.value,
    detail: `${signal.kind} observed · ${Math.round(signal.confidence * 100)}% confidence`,
    source: signal.source,
    entityId: entityId(signal.kind, signal.value),
  }))

  const latestSignal = signals.reduce(
    (latest, signal) => (signal.observedAt > latest ? signal.observedAt : latest),
    '1970-01-01T00:00:00.000Z',
  )
  const base = new Date(latestSignal).getTime()

  for (const [index, finding] of findings.entries()) {
    events.push({
      id: `evt-finding-${index.toString().padStart(3, '0')}`,
      at: new Date(base + (index + 1) * 60_000).toISOString(),
      kind: 'finding',
      label: finding.title,
      detail: finding.detail,
      source: 'core:analysis',
      severity: finding.severity,
      entityId: finding.entityIds[0],
    })
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}
