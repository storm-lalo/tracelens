import { Router, type Request, type Response, type NextFunction } from 'express'
import { compareInvestigations, investigate, providersFromEnvironment, toMarkdown } from '@tracelens/core'
import { getInvestigation, listInvestigations, saveInvestigation, stats } from './store'

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
