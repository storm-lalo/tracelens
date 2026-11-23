import { randomUUID } from 'node:crypto'
import {
  assessDrift,
  compareInvestigations,
  investigate,
  type DriftAlert,
  type SchedulerStatus,
  type Watch,
} from '@tracelens/core'
import {
  findPreviousInvestigation,
  listAlerts,
  listWatches,
  saveAlert,
  saveInvestigation,
  saveWatch,
} from './store'

const TICK_MS = 30_000
let timer: NodeJS.Timeout | null = null
let lastTickAt: string | null = null

/** Runs one investigation, diffs it against the prior run, and raises an alert on drift. */
export async function runWatch(watch: Watch): Promise<{ investigationId: string; alert: DriftAlert | null }> {
  const startedAt = new Date().toISOString()
  const nextRunAt = new Date(Date.now() + watch.intervalMinutes * 60_000).toISOString()

  try {
    const investigation = await investigate(watch.query)
    await saveInvestigation(investigation)

    const previous = await findPreviousInvestigation(watch.query, investigation.id)
    let alert: DriftAlert | null = null

    if (previous) {
      const comparison = compareInvestigations(previous, investigation)
      const drift = assessDrift(comparison, watch.alertThreshold)

      if (drift.hasDrift && drift.severity) {
        alert = {
          id: `alert_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          watchId: watch.id,
          query: watch.query,
          createdAt: new Date().toISOString(),
          severity: drift.severity,
          title: drift.reasons[0] ?? 'Investigation drift detected',
          detail: drift.reasons.join(' '),
          scoreDelta: comparison.scoreDelta,
          investigationId: investigation.id,
          previousInvestigationId: previous.id,
          acknowledged: false,
        }
        await saveAlert(alert)
      }
    }

    await saveWatch({ ...watch, lastRunAt: startedAt, nextRunAt, lastError: null })
    return { investigationId: investigation.id, alert }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await saveWatch({ ...watch, lastRunAt: startedAt, nextRunAt, lastError: message })
    throw error
  }
}

async function tick(): Promise<void> {
  lastTickAt = new Date().toISOString()
  const now = Date.now()
  const due = (await listWatches()).filter(
    (watch) => watch.enabled && new Date(watch.nextRunAt).getTime() <= now,
  )
  for (const watch of due) {
    try {
      await runWatch(watch)
    } catch (error) {
      console.error(`[tracelens] watch ${watch.id} failed:`, error)
    }
  }
}

export function startScheduler(): void {
  if (timer) return
  timer = setInterval(() => void tick(), TICK_MS)
  timer.unref?.()
  console.log(`[tracelens] scheduler started (${TICK_MS / 1000}s tick)`)
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export async function schedulerStatus(): Promise<SchedulerStatus> {
  const [watches, alerts] = await Promise.all([listWatches(), listAlerts()])
  return {
    running: Boolean(timer),
    tickMs: TICK_MS,
    watchCount: watches.length,
    alertCount: alerts.length,
    unacknowledgedCount: alerts.filter((alert) => !alert.acknowledged).length,
    lastTickAt,
  }
}
