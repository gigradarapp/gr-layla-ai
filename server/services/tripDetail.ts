import { db } from '../db/sqlite.js'
import { mapActivity, mapDay, mapMessage, mapOffer, mapTrip, type TripRow } from './mapper.js'

export function getTripDetail(tripId: string) {
  const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) as TripRow | undefined
  if (!row) return null
  const dayRows = db.prepare('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_number ASC').all(tripId) as Record<string, unknown>[]
  const days = dayRows.map((day) => {
    const activities = db
      .prepare('SELECT * FROM activities WHERE trip_day_id = ? ORDER BY time ASC')
      .all(day.id) as Record<string, unknown>[]
    return mapDay(day, activities.map(mapActivity))
  })
  const messages = db
    .prepare('SELECT * FROM chat_messages WHERE trip_id = ? ORDER BY created_at ASC')
    .all(tripId) as Record<string, unknown>[]
  const offers = db.prepare('SELECT * FROM offers WHERE trip_id = ? ORDER BY type ASC, price ASC').all(tripId) as Record<string, unknown>[]
  return {
    ...mapTrip(row),
    days,
    messages: messages.map(mapMessage),
    offers: offers.map(mapOffer),
  }
}
