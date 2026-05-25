import cors from 'cors'
import express from 'express'
import { hasSeedData, migrate } from './db/sqlite.js'
import { seedDatabase } from './db/seed.js'
import { loadLocalEnv } from './env.js'
import { registerAgentRoutes } from './routes/agent.js'
import { registerDashboardRoutes } from './routes/dashboard.js'
import { registerDestinationRoutes } from './routes/destinations.js'
import { registerOfferRoutes } from './routes/offers.js'
import { registerTripRoutes } from './routes/trips.js'

const app = express()
const api = express.Router()
const port = Number(process.env.PORT ?? 4000)

loadLocalEnv()
migrate()
if (!hasSeedData()) {
  seedDatabase()
}

app.use(cors())
app.use(express.json({ limit: '1mb' }))

registerDestinationRoutes(api)
registerOfferRoutes(api)
registerTripRoutes(api)
registerDashboardRoutes(api)
registerAgentRoutes(api)

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gr-layla-ai-api' })
})

app.use('/api', api)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Unexpected server error' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
