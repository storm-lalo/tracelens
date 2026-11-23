import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  DriftAlert,
  Investigation,
  InvestigationSummary,
  Watch,
} from '@tracelens/core'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const configuredDir = process.env.TRACELENS_DATA_DIR ?? 'data'
const dataDir = isAbsolute(configuredDir) ? configuredDir : resolve(repoRoot, configuredDir)
const dataFile = resolve(dataDir, 'investigations.json')
const watchesFile = resolve(dataDir, 'watches.json')
const alertsFile = resolve(dataDir, 'alerts.json')

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeJson<T>(file: string, items: T[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(items, null, 2), 'utf8')
}

async function readAll(): Promise<Investigation[]> {
  return readJson<Investigation>(dataFile)
}

export async function saveInvestigation(investigation: Investigation): Promise<Investigation> {
  const items = await readAll()
  items.unshift(investigation)
  await writeJson(dataFile, items.slice(0, 100))
  return investigation
}

export async function getInvestigation(id: string): Promise<Investigation | undefined> {
  return (await readAll()).find((item) => item.id === id)
}

/** Most recent earlier investigation for the same query, used as a drift baseline. */
export async function findPreviousInvestigation(
  query: string,
  beforeId: string,
): Promise<Investigation | undefined> {
  const normalized = query.trim().toLowerCase()
  return (await readAll()).find(
    (item) => item.id !== beforeId && item.query.trim().toLowerCase() === normalized,
  )
}

export async function listInvestigations(): Promise<InvestigationSummary[]> {
  const items = await readAll()
  return items.map((item) => ({
    id: item.id,
    query: item.query,
    createdAt: item.createdAt,
    score: item.score,
    grade: item.grade,
    entityCount: item.entities.length,
    findingCount: item.findings.length,
  }))
}

export async function stats(): Promise<{
  investigations: number
  entities: number
  findings: number
  averageScore: number
}> {
  const items = await readAll()
  const entities = items.reduce((sum, item) => sum + item.entities.length, 0)
  const findings = items.reduce((sum, item) => sum + item.findings.length, 0)
  const averageScore =
    items.length === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length)
  return { investigations: items.length, entities, findings, averageScore }
}

// ---------- watches ----------

export async function listWatches(): Promise<Watch[]> {
  return readJson<Watch>(watchesFile)
}

export async function saveWatch(watch: Watch): Promise<Watch> {
  const items = await listWatches()
  const index = items.findIndex((item) => item.id === watch.id)
  if (index >= 0) items[index] = watch
  else items.unshift(watch)
  await writeJson(watchesFile, items.slice(0, 50))
  return watch
}

export async function deleteWatch(id: string): Promise<boolean> {
  const items = await listWatches()
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return false
  await writeJson(watchesFile, next)
  return true
}

// ---------- alerts ----------

export async function listAlerts(): Promise<DriftAlert[]> {
  return readJson<DriftAlert>(alertsFile)
}

export async function saveAlert(alert: DriftAlert): Promise<DriftAlert> {
  const items = await listAlerts()
  items.unshift(alert)
  await writeJson(alertsFile, items.slice(0, 100))
  return alert
}

export async function acknowledgeAlert(id: string): Promise<boolean> {
  const items = await listAlerts()
  const target = items.find((item) => item.id === id)
  if (!target) return false
  target.acknowledged = true
  await writeJson(alertsFile, items)
  return true
}

export { dataFile, watchesFile, alertsFile }
