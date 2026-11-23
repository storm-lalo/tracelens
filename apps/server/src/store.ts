import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Investigation, InvestigationSummary } from '@tracelens/core'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const configuredDir = process.env.TRACELENS_DATA_DIR ?? 'data'
const dataDir = isAbsolute(configuredDir) ? configuredDir : resolve(repoRoot, configuredDir)
const dataFile = resolve(dataDir, 'investigations.json')

async function readAll(): Promise<Investigation[]> {
  try {
    const raw = await readFile(dataFile, 'utf8')
    const parsed = JSON.parse(raw) as Investigation[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeAll(items: Investigation[]): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true })
  await writeFile(dataFile, JSON.stringify(items, null, 2), 'utf8')
}

export async function saveInvestigation(investigation: Investigation): Promise<Investigation> {
  const items = await readAll()
  items.unshift(investigation)
  await writeAll(items.slice(0, 100))
  return investigation
}

export async function getInvestigation(id: string): Promise<Investigation | undefined> {
  return (await readAll()).find((item) => item.id === id)
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

export { dataFile }
