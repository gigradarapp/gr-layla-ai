import type { Router } from 'express'
import { db } from '../db/sqlite.js'
import { mapDestination } from '../services/mapper.js'

export function registerDestinationRoutes(router: Router) {
  router.get('/destinations', (req, res) => {
    const { vibe, budget, travelerType } = req.query
    let rows = db.prepare('SELECT * FROM destinations ORDER BY flight_price_from ASC').all() as Record<string, unknown>[]
    if (vibe) rows = rows.filter((row) => String(row.vibe).toLowerCase().includes(String(vibe).toLowerCase()))
    if (budget) rows = rows.filter((row) => String(row.budget_level) === String(budget))
    if (travelerType) {
      rows = rows.filter((row) => String(row.traveler_types).toLowerCase().includes(String(travelerType).toLowerCase()))
    }
    res.json(rows.map(mapDestination))
  })

  router.get('/destinations/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
      res.status(404).json({ error: 'Destination not found' })
      return
    }
    res.json(mapDestination(row))
  })
}
