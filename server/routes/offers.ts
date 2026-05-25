import type { Router } from 'express'
import { db } from '../db/sqlite.js'
import { mapOffer } from '../services/mapper.js'

export function registerOfferRoutes(router: Router) {
  router.get('/offers', (req, res) => {
    const { tripId, destinationId, type } = req.query
    let sql = 'SELECT * FROM offers WHERE 1 = 1'
    const params: unknown[] = []
    if (tripId) {
      sql += ' AND trip_id = ?'
      params.push(String(tripId))
    }
    if (destinationId) {
      sql += ' AND destination_id = ?'
      params.push(String(destinationId))
    }
    if (type) {
      sql += ' AND type = ?'
      params.push(String(type))
    }
    sql += ' ORDER BY type ASC, price ASC'
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    res.json(rows.map(mapOffer))
  })
}
