import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import {
  compareInvestigations,
  investigate,
  providersFromEnvironment,
  toMarkdown,
  toPrintableHtml,
  type Watch,
} from '@tracelens/core'
import {
  acknowledgeAlert,
  deleteWatch,
  getInvestigation,
  listAlerts,
  listInvestigations,
  listWatches,
  saveInvestigation,
  saveWatch,
  stats,
} from './store'
import { runWatch, schedulerStatus } from './scheduler'

const EXAMPLES = [
  { label: 'Corporate domain', value: 'northwind-labs.io' },
  { label: 'Username', value: 'octocat' },
  { label: 'IP address', value: '203.0.113.42' },
  { label: 'Email address', value: 'security@example.com' },
]

type AsyncHandler = (req: Request, res: Response) => Promise<void>
const asyncRoute = (handler: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }

export const api = Router()

api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tracelens-api',
    version: '0.1.0',
    providers: providersFromEnvironment().map((provider) => ({
      name: provider.name,
      enabled: provider.enabled,
    })),
  })
})

api.get('/examples', (_req, res) => {
  res.json(EXAMPLES)
})

api.get('/stats', asyncRoute(async (_req, res) => {
  res.json(await stats())
}))

api.post('/investigations', asyncRoute(async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (query.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' })
    return
  }
  if (query.length > 200) {
    res.status(400).json({ error: 'Query must be at most 200 characters' })
    return
  }

  const investigation = await investigate(query)
  await saveInvestigation(investigation)
  res.status(201).json(investigation)
}))

api.get('/investigations', asyncRoute(async (_req, res) => {
  res.json(await listInvestigations())
}))

api.get('/investigations/:id', asyncRoute(async (req, res) => {
  const investigation = await getInvestigation(req.params.id)
  if (!investigation) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  res.json(investigation)
}))

api.get('/investigations/:id/report', asyncRoute(async (req, res) => {
  const investigation = await getInvestigation(req.params.id)
  if (!investigation) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  res.type('text/markdown').send(toMarkdown(investigation))
}))

api.get('/investigations/:id/print', asyncRoute(async (req, res) => {
  const investigation = await getInvestigation(req.params.id)
  if (!investigation) {
    res.status(404).json({ error: 'Investigation not found' })
    return
  }
  res.type('html').send(toPrintableHtml(investigation))
}))

api.post('/compare', asyncRoute(async (req, res) => {
  const leftId = typeof req.body?.left === 'string' ? req.body.left : ''
  const rightId = typeof req.body?.right === 'string' ? req.body.right : ''
  const [left, right] = await Promise.all([getInvestigation(leftId), getInvestigation(rightId)])
  if (!left || !right) {
    res.status(404).json({ error: 'One or both investigations were not found' })
    return
  }
  res.json(compareInvestigations(left, right))
}))

// ---------- recurring watches and drift alerts ----------

api.get('/scheduler', asyncRoute(async (_req, res) => {
  res.json(await schedulerStatus())
}))

api.get('/watches', asyncRoute(async (_req, res) => {
  res.json(await listWatches())
}))

api.post('/watches', asyncRoute(async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  const intervalMinutes = Number(req.body?.intervalMinutes ?? 60)
  const alertThreshold = Number(req.body?.alertThreshold ?? 10)

  if (query.length < 2 || query.length > 200) {
    res.status(400).json({ error: 'Query must be between 2 and 200 characters' })
    return
  }
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 10080) {
    res.status(400).json({ error: 'intervalMinutes must be between 5 and 10080' })
    return
  }
  if (!Number.isFinite(alertThreshold) || alertThreshold < 1 || alertThreshold > 100) {
    res.status(400).json({ error: 'alertThreshold must be between 1 and 100' })
    return
  }

  const now = new Date()
  const watch: Watch = {
    id: `watch_${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    query,
    intervalMinutes: Math.round(intervalMinutes),
    alertThreshold: Math.round(alertThreshold),
    enabled: true,
    createdAt: now.toISOString(),
    lastRunAt: null,
    nextRunAt: new Date(now.getTime() + Math.round(intervalMinutes) * 60_000).toISOString(),
    lastError: null,
  }
  await saveWatch(watch)
  res.status(201).json(watch)
}))

api.patch('/watches/:id', asyncRoute(async (req, res) => {
  const watches = await listWatches()
  const watch = watches.find((item) => item.id === req.params.id)
  if (!watch) {
    res.status(404).json({ error: 'Watch not found' })
    return
  }
  const enabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : watch.enabled
  const updated = await saveWatch({ ...watch, enabled })
  res.json(updated)
}))

api.delete('/watches/:id', asyncRoute(async (req, res) => {
  const removed = await deleteWatch(req.params.id)
  if (!removed) {
    res.status(404).json({ error: 'Watch not found' })
    return
  }
  res.status(204).end()
}))

api.post('/watches/:id/run', asyncRoute(async (req, res) => {
  const watch = (await listWatches()).find((item) => item.id === req.params.id)
  if (!watch) {
    res.status(404).json({ error: 'Watch not found' })
    return
  }
  const result = await runWatch(watch)
  res.status(201).json(result)
}))

api.get('/alerts', asyncRoute(async (_req, res) => {
  res.json(await listAlerts())
}))

api.post('/alerts/:id/acknowledge', asyncRoute(async (req, res) => {
  const updated = await acknowledgeAlert(req.params.id)
  if (!updated) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  res.json({ ok: true })
}))
