import type { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/sqlite.js'
import { mapMessage, mapTrip, type TripRow } from '../services/mapper.js'
import { createGeneratedTrip, refineTrip } from '../services/planner.js'
import { getTripDetail } from '../services/tripDetail.js'

const createTripSchema = z.object({
  prompt: z.string().min(4),
  origin: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetLevel: z.string().optional(),
  travelerType: z.string().optional(),
  pace: z.string().optional(),
})

const refineSchema = z.object({
  refinement: z.string().min(3),
})

export function registerTripRoutes(router: Router) {
  router.get('/trips', (req, res) => {
    const { status, q } = req.query
    let sql = 'SELECT * FROM trips WHERE 1 = 1'
    const params: unknown[] = []
    if (status) {
      sql += ' AND status = ?'
      params.push(String(status))
    }
    if (q) {
      sql += ' AND (title LIKE ? OR destination LIKE ? OR summary LIKE ?)'
      const term = `%${String(q)}%`
      params.push(term, term, term)
    }
    sql += ' ORDER BY updated_at DESC'
    const rows = db.prepare(sql).all(...params) as TripRow[]
    res.json(rows.map(mapTrip))
  })

  router.post('/trips', (req, res) => {
    const result = createTripSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid trip request', details: result.error.flatten() })
      return
    }
    const tripId = createGeneratedTrip(result.data)
    res.status(201).json(getTripDetail(tripId))
  })

  router.get('/trips/:id', (req, res) => {
    const trip = getTripDetail(req.params.id)
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' })
      return
    }
    res.json(trip)
  })

  router.patch('/trips/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'Trip not found' })
      return
    }
    const allowed = ['title', 'status', 'pace', 'budget_level'] as const
    const updates: string[] = []
    const params: unknown[] = []
    for (const key of allowed) {
      const camel = key === 'budget_level' ? 'budgetLevel' : key
      if (Object.prototype.hasOwnProperty.call(req.body, camel)) {
        updates.push(`${key} = ?`)
        params.push(req.body[camel])
      }
    }
    if (updates.length === 0) {
      res.json(getTripDetail(req.params.id))
      return
    }
    updates.push('updated_at = ?')
    params.push(new Date().toISOString(), req.params.id)
    db.prepare(`UPDATE trips SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    res.json(getTripDetail(req.params.id))
  })

  router.post('/trips/:id/refine', (req, res) => {
    const result = refineSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid refinement', details: result.error.flatten() })
      return
    }
    const refined = refineTrip(req.params.id, result.data.refinement)
    if (!refined) {
      res.status(404).json({ error: 'Trip not found' })
      return
    }
    res.json({ ...refined, trip: getTripDetail(req.params.id) })
  })

  router.get('/trips/:id/messages', (req, res) => {
    const rows = db
      .prepare('SELECT * FROM chat_messages WHERE trip_id = ? ORDER BY created_at ASC')
      .all(req.params.id) as Record<string, unknown>[]
    res.json(rows.map(mapMessage))
  })

  router.post('/trips/:id/messages', (req, res) => {
    const schema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) })
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid message', details: result.error.flatten() })
      return
    }
    const now = new Date().toISOString()
    db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      req.params.id,
      result.data.role,
      result.data.content,
      now,
    )
    const rows = db
      .prepare('SELECT * FROM chat_messages WHERE trip_id = ? ORDER BY created_at ASC')
      .all(req.params.id) as Record<string, unknown>[]
    res.status(201).json(rows.map(mapMessage))
  })
}
