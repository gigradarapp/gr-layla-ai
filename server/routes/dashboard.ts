import type { Router } from 'express'
import { db } from '../db/sqlite.js'
import { mapMessage, mapTrip, type TripRow } from '../services/mapper.js'

export function registerDashboardRoutes(router: Router) {
  router.get('/dashboard/summary', (_req, res) => {
    const trips = db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number }
    const messages = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number }
    const saved = db.prepare("SELECT COUNT(*) as count FROM trips WHERE status = 'ready'").get() as { count: number }
    const avgCost = db.prepare('SELECT AVG(estimated_cost) as value FROM trips').get() as { value: number | null }
    const byBudget = db.prepare('SELECT budget_level as label, COUNT(*) as count FROM trips GROUP BY budget_level').all()
    const byTraveler = db.prepare('SELECT traveler_type as label, COUNT(*) as count FROM trips GROUP BY traveler_type').all()
    res.json({
      trips: trips.count,
      messages: messages.count,
      readyTrips: saved.count,
      averageTripValue: Math.round(avgCost.value ?? 0),
      byBudget,
      byTraveler,
    })
  })

  router.get('/dashboard/trips', (_req, res) => {
    const rows = db.prepare('SELECT * FROM trips ORDER BY updated_at DESC').all() as TripRow[]
    res.json(rows.map(mapTrip))
  })

  router.get('/dashboard/messages', (_req, res) => {
    const rows = db.prepare('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100').all() as Record<string, unknown>[]
    res.json(rows.map(mapMessage))
  })
}
