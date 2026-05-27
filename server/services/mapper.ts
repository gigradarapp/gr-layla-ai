import { parseJsonArray } from '../db/sqlite.js'

export type TripRow = {
  id: string
  user_id: string
  title: string
  destination: string
  origin: string
  start_date: string
  end_date: string
  budget_level: string
  traveler_type: string
  pace: string
  status: string
  summary: string
  estimated_cost: number
  hero_image_url: string
  confidence: number
  focus_activities?: string
  created_at: string
  updated_at: string
}

export function mapDestination(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country),
    vibe: String(row.vibe),
    budgetLevel: String(row.budget_level),
    weather: String(row.weather),
    idealDuration: String(row.ideal_duration),
    travelerTypes: parseJsonArray<string>(String(row.traveler_types)),
    flightPriceFrom: Number(row.flight_price_from),
    imageUrl: String(row.image_url),
    summary: String(row.summary),
    highlights: parseJsonArray<string>(String(row.highlights)),
  }
}

export function mapTrip(row: TripRow) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    destination: row.destination,
    origin: row.origin,
    startDate: row.start_date,
    endDate: row.end_date,
    budgetLevel: row.budget_level,
    travelerType: row.traveler_type,
    pace: row.pace,
    status: row.status,
    summary: row.summary,
    estimatedCost: row.estimated_cost,
    heroImageUrl: row.hero_image_url,
    confidence: row.confidence,
    focusActivities: parseJsonArray<string>(row.focus_activities),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMessage(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tripId: row.trip_id ? String(row.trip_id) : null,
    role: String(row.role),
    content: String(row.content),
    createdAt: String(row.created_at),
  }
}

export function mapOffer(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tripId: row.trip_id ? String(row.trip_id) : null,
    destinationId: row.destination_id ? String(row.destination_id) : null,
    type: String(row.type),
    provider: String(row.provider),
    title: String(row.title),
    price: Number(row.price),
    rating: Number(row.rating),
    perks: parseJsonArray<string>(String(row.perks)),
    url: String(row.url),
    imageUrl: String(row.image_url),
  }
}

export function mapDay(row: Record<string, unknown>, activities: ReturnType<typeof mapActivity>[]) {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    dayNumber: Number(row.day_number),
    date: String(row.date),
    title: String(row.title),
    summary: String(row.summary),
    imageUrl: String(row.image_url ?? ''),
    activities,
  }
}

export function mapActivity(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tripDayId: String(row.trip_day_id),
    time: String(row.time),
    title: String(row.title),
    location: String(row.location),
    category: String(row.category),
    cost: Number(row.cost),
    durationMinutes: Number(row.duration_minutes),
    notes: String(row.notes),
    confidence: Number(row.confidence),
  }
}
