import { db, id, jsonArray } from '../db/sqlite.js'
import { mapDestination } from './mapper.js'

type CreateTripInput = {
  prompt: string
  origin?: string
  startDate?: string
  endDate?: string
  budgetLevel?: string
  travelerType?: string
  pace?: string
}

const fallbackImages: Record<string, string> = {
  Tokyo:
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
  Bali: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1200&q=80',
  Seoul: 'https://images.unsplash.com/photo-1506816561089-5cc37b3aa9b0?auto=format&fit=crop&w=1200&q=80',
  Queenstown:
    'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=1200&q=80',
  Lisbon:
    'https://images.unsplash.com/photo-1501927023255-9063be98970c?auto=format&fit=crop&w=1200&q=80',
}

function pickDestination(prompt: string, budgetLevel: string) {
  const lower = prompt.toLowerCase()
  const rows = db.prepare('SELECT * FROM destinations').all() as Record<string, unknown>[]
  const destinations = rows.map(mapDestination)
  const direct = destinations.find((destination) => lower.includes(destination.name.toLowerCase()))
  if (direct) return direct

  if (lower.includes('japan') || lower.includes('food') || lower.includes('culture')) {
    return destinations.find((destination) => destination.id === 'dest_tokyo') ?? destinations[0]
  }
  if (lower.includes('beach') || lower.includes('wellness') || lower.includes('budget')) {
    return destinations.find((destination) => destination.id === 'dest_bali') ?? destinations[0]
  }
  if (lower.includes('friends') || lower.includes('shopping') || lower.includes('night')) {
    return destinations.find((destination) => destination.id === 'dest_seoul') ?? destinations[0]
  }
  if (lower.includes('road') || lower.includes('nature') || lower.includes('adventure')) {
    return destinations.find((destination) => destination.id === 'dest_queenstown') ?? destinations[0]
  }
  if (lower.includes('family') || lower.includes('kids') || lower.includes('warm')) {
    return destinations.find((destination) => destination.id === 'dest_lisbon') ?? destinations[0]
  }
  return destinations.find((destination) => destination.budgetLevel === budgetLevel) ?? destinations[0]
}

function dateAfter(date: string, offsetDays: number) {
  const parsed = new Date(date)
  parsed.setDate(parsed.getDate() + offsetDays)
  return parsed.toISOString().slice(0, 10)
}

function itineraryFor(destination: string, pace: string) {
  const lighter = pace === 'slow'
  const activityCount = lighter ? 2 : 3
  const base = {
    Tokyo: [
      ['Arrival and food lanes', 'A low-friction arrival day anchored around one reliable food neighborhood.'],
      ['Markets and visual culture', 'Breakfast, a standout museum slot, and a walkable evening route.'],
      ['Neighborhood contrast', 'Vintage shops, quiet side streets, and a late dinner district.'],
    ],
    Bali: [
      ['Arrival and sunset reset', 'Check in, beach walk, and a relaxed dinner.'],
      ['Ubud nature and spa', 'Rice terraces, massage block, and a quiet evening.'],
      ['Surf or waterfall choice', 'Choose between active water time or inland nature.'],
    ],
    Seoul: [
      ['Myeongdong base and snacks', 'Central check-in and low-risk night food.'],
      ['Palace, market, Hongdae', 'Culture and food by day, energy by night.'],
      ['Seongsu and shopping route', 'Design shops, cafes, and cosmetic stops.'],
    ],
    Queenstown: [
      ['Lake arrival and town walk', 'Land, collect car, and keep the first day scenic but easy.'],
      ['Glenorchy road loop', 'A cinematic drive with photo stops and short walks.'],
      ['Milford Sound weather window', 'Reserve the highest-impact nature day for the clearest forecast.'],
    ],
    Lisbon: [
      ['Alfama and viewpoints', 'Easy city orientation with food stops and low-pressure walking.'],
      ['Belém and river light', 'Pastries, monuments, and a flat riverside afternoon.'],
      ['Sintra optional day trip', 'A scenic excursion with transport planned around crowds.'],
    ],
  } satisfies Record<string, [string, string][]>

  const selected = base[destination as keyof typeof base] ?? base.Tokyo
  return selected.map((day, index) => ({
    dayNumber: index + 1,
    title: day[0],
    summary: day[1],
    activities: [
      ['09:30', index === 0 ? 'Arrival logistics and neighborhood orientation' : 'Anchor experience', 'central area', 'logistics', 0, 90],
      ['12:30', 'Local food stop matched to your constraints', 'recommended district', 'food', 32, 90],
      ['16:00', 'Flexible experience block with backup option', 'nearby area', 'experience', 48, 120],
    ].slice(0, activityCount),
  }))
}

export function createGeneratedTrip(input: CreateTripInput) {
  const budgetLevel = input.budgetLevel ?? 'mid'
  const travelerType = input.travelerType ?? 'couple'
  const pace = input.pace ?? 'balanced'
  const origin = input.origin || 'Singapore'
  const startDate = input.startDate || '2026-08-14'
  const endDate = input.endDate || dateAfter(startDate, 5)
  const destination = pickDestination(input.prompt, budgetLevel)
  const tripId = id('trip')
  const now = new Date().toISOString()
  const title = `${destination.name} ${travelerType} plan`
  const estimatedCost = destination.flightPriceFrom * 2 + (budgetLevel === 'premium' ? 2200 : budgetLevel === 'budget' ? 760 : 1450)
  const summary = `Built from your prompt: "${input.prompt}". This ${pace} ${travelerType} trip uses ${destination.name} as the best-fit destination because it matches ${destination.vibe}. Booking cards are simulated demo offers; verify live prices before purchase.`

  db.prepare(
    `INSERT INTO trips
      (id, user_id, title, destination, origin, start_date, end_date, budget_level, traveler_type, pace, status, summary, estimated_cost, hero_image_url, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    tripId,
    'usr_demo',
    title,
    destination.name,
    origin,
    startDate,
    endDate,
    budgetLevel,
    travelerType,
    pace,
    'ready',
    summary,
    estimatedCost,
    destination.imageUrl || fallbackImages[destination.name] || fallbackImages.Tokyo,
    84,
    now,
    now,
  )

  db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('msg'),
    tripId,
    'user',
    input.prompt,
    now,
  )
  db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('msg'),
    tripId,
    'assistant',
    `I mapped your constraints to ${destination.name}, then balanced itinerary density, likely costs, and first-bookable options.`,
    now,
  )

  const insertDay = db.prepare(
    'INSERT INTO trip_days (id, trip_id, day_number, date, title, summary) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertActivity = db.prepare(
    `INSERT INTO activities
      (id, trip_day_id, time, title, location, category, cost, duration_minutes, notes, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const day of itineraryFor(destination.name, pace)) {
    const dayId = id('day')
    insertDay.run(dayId, tripId, day.dayNumber, dateAfter(startDate, day.dayNumber - 1), day.title, day.summary)
    for (const [time, titleText, location, category, cost, duration] of day.activities) {
      insertActivity.run(
        id('act'),
        dayId,
        time,
        titleText,
        location,
        category,
        cost,
        duration,
        'AI demo recommendation with confidence label. Confirm current details before booking.',
        81,
      )
    }
  }

  const existingOffers = db
    .prepare('SELECT * FROM offers WHERE destination_id = ? AND trip_id IS NULL LIMIT 3')
    .all(destination.id) as Record<string, unknown>[]
  const insertOffer = db.prepare(
    `INSERT INTO offers
      (id, trip_id, destination_id, type, provider, title, price, rating, perks, url, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  if (existingOffers.length > 0) {
    for (const offer of existingOffers) {
      insertOffer.run(
        id('offer'),
        tripId,
        destination.id,
        offer.type,
        offer.provider,
        offer.title,
        offer.price,
        offer.rating,
        offer.perks,
        '#simulated-handoff',
        offer.image_url,
        now,
      )
    }
  } else {
    for (const type of ['flight', 'hotel', 'activity']) {
      insertOffer.run(
        id('offer'),
        tripId,
        destination.id,
        type,
        type === 'flight' ? 'SkySearch demo' : type === 'hotel' ? 'StayFinder demo' : 'LocalPass demo',
        `${destination.name} ${type} option`,
        type === 'flight' ? destination.flightPriceFrom : type === 'hotel' ? 148 : 64,
        4.6,
        jsonArray(['simulated', 'refundable option', 'recommended match']),
        '#simulated-handoff',
        destination.imageUrl,
        now,
      )
    }
  }

  return tripId
}

export function refineTrip(tripId: string, refinement: string) {
  const lower = refinement.toLowerCase()
  const now = new Date().toISOString()
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) as { summary: string; estimated_cost: number; pace: string } | undefined
  if (!trip) return null

  const costDelta = lower.includes('cheaper') || lower.includes('budget') ? -180 : lower.includes('premium') ? 250 : 0
  const pace = lower.includes('slow') || lower.includes('less walking') ? 'slow' : lower.includes('fast') ? 'fast' : trip.pace
  const resultSummary = lower.includes('nature')
    ? 'Added more outdoor and scenic blocks while keeping transit simple.'
    : lower.includes('food')
      ? 'Shifted the itinerary toward food markets, local meals, and evening dining routes.'
      : lower.includes('family')
        ? 'Rebalanced the plan with shorter movement windows, downtime, and family-friendly activities.'
        : lower.includes('cheaper') || lower.includes('budget')
          ? 'Reduced paid activities and moved lodging/experience suggestions toward better-value options.'
          : 'Adjusted the plan while preserving the original destination and travel constraints.'

  db.prepare('UPDATE trips SET summary = ?, estimated_cost = ?, pace = ?, updated_at = ? WHERE id = ?').run(
    `${trip.summary}\n\nRefinement: ${resultSummary}`,
    Math.max(450, trip.estimated_cost + costDelta),
    pace,
    now,
    tripId,
  )
  db.prepare('INSERT INTO trip_refinements (id, trip_id, refinement, result_summary, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('refine'),
    tripId,
    refinement,
    resultSummary,
    now,
  )
  db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('msg'),
    tripId,
    'user',
    refinement,
    now,
  )
  db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('msg'),
    tripId,
    'assistant',
    resultSummary,
    now,
  )

  return { resultSummary }
}
