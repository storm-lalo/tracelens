import './env'
import cors from 'cors'
import express from 'express'
import { api } from './routes'
import { startScheduler, stopScheduler } from './scheduler'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(cors())
app.use(express.json({ limit: '32kb' }))
app.use('/api', api)

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[tracelens]', error)
  res.status(500).json({ error: error.message || 'Internal server error' })
})

const server = app.listen(port, () => {
  console.log(`TraceLens API listening on http://localhost:${port}/api`)
  startScheduler()
})

function shutdown(): void {
  stopScheduler()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export { app }
