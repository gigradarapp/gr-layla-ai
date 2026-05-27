import { buildHotelBookingUrl } from '../../shared/hotelBookingUrl.js'
import { buildStayPerks } from '../../shared/stayOfferMeta.js'
import { STAY_TIERS } from '../../shared/stayTiers.js'
import { normalizeItineraryDays } from '../../shared/normalizeItinerary.js'
import { parseWhenDateRange } from '../../shared/tripDates.js'
import { buildTripTitle, normalizeTravelerType } from '../../shared/travelerLabel.js'
import { db, id, jsonArray } from '../db/sqlite.js'
import { fallbackTripContent, type AiTripContent } from './tripContent.js'
import { mapDestination } from './mapper.js'
import { resolveDayImageUrl, resolveDestinationHeroImage, resolveSceneImageUrl, resolveStayImageUrl } from './tripImages.js'

type CreateTripInput = {
  prompt: string
  origin?: string
  whereToHint?: string
  whenHint?: string
  startDate?: string
  endDate?: string
  budgetLevel?: string
  travelerType?: string
  pace?: string
  focusActivities?: string[]
  intent?: string
  aiContent?: AiTripContent
}

const fallbackImages: Record<string, string> = {
  Tokyo:
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
  Bali: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1200&q=80',
  'Johor Bahru':
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1200&q=80',
  Seoul: 'https://images.unsplash.com/photo-1506816561089-5cc37b3aa9b0?auto=format&fit=crop&w=1200&q=80',
  Queenstown:
    'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=1200&q=80',
  Lisbon:
    'https://images.unsplash.com/photo-1501927023255-9063be98970c?auto=format&fit=crop&w=1200&q=80',
}

function pickDestination(prompt: string, budgetLevel: string, whereToHint?: string) {
  const lower = prompt.toLowerCase()
  const rows = db.prepare('SELECT * FROM destinations').all() as Record<string, unknown>[]
  const destinations = rows.map(mapDestination)

  if (whereToHint?.trim()) {
    const hint = whereToHint.toLowerCase()
    const fromHint =
      destinations.find((destination) => hint.includes(destination.name.toLowerCase())) ??
      destinations.find((destination) => hint.includes(destination.country.toLowerCase()))
    if (fromHint) return fromHint
  }

  const direct = destinations.find((destination) => lower.includes(destination.name.toLowerCase()))
  if (direct) return direct

  if (lower.includes('johor') || lower.includes('bahru') || lower.includes('jb')) {
    return destinations.find((destination) => destination.id === 'dest_johor_bahru') ?? destinations[0]
  }
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

function daysBetweenIso(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.round(diff / 86_400_000) + 1)
}

function itineraryFor(destination: string, pace: string, focusActivities: string[] = [], intent?: string) {
  const lighter = pace === 'slow'
  const activityCount = lighter ? 2 : 3
  const picks = focusActivities.length > 0 ? focusActivities : intent ? [intent] : []
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
    'Johor Bahru': [
      ['Arrival and Exploring Historic Johor Bahru', 'Cross from Singapore, settle in, then keep the first day focused on cafes and old-town wandering.'],
      ['Cafe Hopping and Downtown Fun', 'A relaxed second day with local food, low-cost activities, and a simple return to Singapore.'],
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
  return selected.map((day, index) => {
    const focusTitle = picks[index]
    const activities: Array<[string, string, string, string, number, number]> = [
      ['09:30', index === 0 ? 'Arrival logistics and neighborhood orientation' : 'Anchor experience', destination, 'logistics', 0, 90],
      ['12:30', 'Local food stop matched to your constraints', destination, 'food', 32, 90],
      ['16:00', 'Flexible experience block with backup option', destination, 'experience', 48, 120],
    ]
    if (focusTitle) {
      activities[1] = ['11:30', focusTitle, destination, 'experience', 28, 120]
    }
    return {
      dayNumber: index + 1,
      title: focusTitle && index > 0 ? `${day[0]} · ${focusTitle}` : day[0],
      summary: focusTitle ? `${day[1]} Includes your pick: ${focusTitle}.` : day[1],
      activities: activities.slice(0, activityCount),
    }
  })
}

async function attachAiTripOffers(
  tripId: string,
  destinationId: string,
  destinationName: string,
  content: AiTripContent,
  now: string,
  usedUrls: Set<string>,
) {
  const insertOffer = db.prepare(
    `INSERT INTO offers
      (id, trip_id, destination_id, type, provider, title, price, rating, perks, url, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  let stayInsertIndex = 0
  for (const tier of STAY_TIERS) {
    const tierStays = content.stays
      .filter((stay) => stay.tier === tier)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
    for (const [rankIndex, stay] of tierStays.entries()) {
      const rank = rankIndex + 1
      const imageUrl = await resolveStayImageUrl(destinationName, stay.tier, stayInsertIndex, stay.title, undefined, {
        aiQueries: [stay.imageSearchQuery],
        usedUrls,
        resultIndex: stayInsertIndex,
      })
      usedUrls.add(imageUrl)
      insertOffer.run(
        id('offer'),
        tripId,
        destinationId,
        'hotel',
        stay.provider,
        stay.title,
        stay.price,
        stay.rating,
        jsonArray(
          buildStayPerks({
            tier: stay.tier,
            rank,
            neighborhood: stay.neighborhood,
            distanceLabel: stay.distanceLabel,
            reviewCount: stay.reviewCount,
            roomDescription: stay.roomDescription,
            amenities: stay.amenities,
            policies: stay.perks,
            reviewLabel: stay.reviewLabel,
          }),
        ),
        buildHotelBookingUrl(stay.title, destinationName),
        imageUrl,
        now,
      )
      stayInsertIndex += 1
    }
  }

  const transfer = content.arriveTransfer
  const transferImage = await resolveSceneImageUrl(destinationName, 'arrival', undefined)
  usedUrls.add(transferImage)
  insertOffer.run(
    id('offer'),
    tripId,
    destinationId,
    'activity',
    transfer.provider,
    transfer.title,
    transfer.price,
    transfer.rating,
    jsonArray([...transfer.perks, transfer.travelTime]),
    '#simulated-handoff',
    transferImage,
    now,
  )
}

export async function createGeneratedTrip(input: CreateTripInput) {
  const budgetLevel = input.budgetLevel ?? 'mid'
  const travelerType = normalizeTravelerType(input.travelerType)
  const pace = input.pace ?? 'balanced'
  const origin = input.origin || 'Singapore'
  const destination = pickDestination(input.prompt, budgetLevel, input.whereToHint)
  const parsedDates = parseWhenDateRange(input.whenHint)
  const startDate = input.startDate || parsedDates.startDate || '2026-08-14'
  const endDate =
    input.endDate || parsedDates.endDate || dateAfter(startDate, destination.name === 'Johor Bahru' ? 1 : 5)
  const tripId = id('trip')
  const now = new Date().toISOString()
  const dayCount = daysBetweenIso(startDate, endDate)
  const title = buildTripTitle({ destination: destination.name, travelerType, dayCount, budgetLevel })
  const focusActivities = input.focusActivities ?? []
  const estimatedCost =
    destination.name === 'Johor Bahru' && budgetLevel === 'budget'
      ? 120 + focusActivities.length * 18
      : destination.flightPriceFrom * 2 + (budgetLevel === 'premium' ? 2200 : budgetLevel === 'budget' ? 760 : 1450)
  const tripContent =
    input.aiContent ??
    fallbackTripContent({
      prompt: input.prompt,
      destination: destination.name,
      origin,
      startDate,
      endDate,
      travelerType,
      budgetLevel,
      pace,
      focusActivities,
      intent: input.intent,
      tripTitle: title,
    })

  const activityLine =
    focusActivities.length > 0 ? ` Focus activities: ${focusActivities.join(', ')}.` : input.intent ? ` Trip intent: ${input.intent}.` : ''
  const summary =
    tripContent.intro ||
    `Built from your chat: ${origin} → ${destination.name}, ${travelerType}, ${startDate} to ${endDate}.${activityLine}`

  const heroImageUrl = await resolveDestinationHeroImage(
    destination.name,
    destination.imageUrl || fallbackImages[destination.name] || fallbackImages.Tokyo,
  )

  db.prepare(
    `INSERT INTO trips
      (id, user_id, title, destination, origin, start_date, end_date, budget_level, traveler_type, pace, status, summary, estimated_cost, hero_image_url, confidence, focus_activities, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    heroImageUrl,
    84,
    jsonArray(focusActivities),
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
    'INSERT INTO trip_days (id, trip_id, day_number, date, title, summary, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  const insertActivity = db.prepare(
    `INSERT INTO activities
      (id, trip_day_id, time, title, location, category, cost, duration_minutes, notes, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const usedUrls = new Set<string>()

  const rawItineraryDays = tripContent.days.length
    ? tripContent.days.map((day, index) => ({
        dayNumber: index + 1,
        title: day.title,
        summary: day.summary,
        imageSearchQuery: day.imageSearchQuery,
        activities: day.activities.map((activity) => ({
          time: activity.time,
          title: activity.title,
          location: activity.location,
          category: activity.category,
          cost: activity.cost,
          durationMinutes: activity.durationMinutes,
        })),
      }))
    : itineraryFor(destination.name, pace, focusActivities, input.intent).map((day) => ({
        ...day,
        activities: day.activities.map(([time, titleText, location, category, cost, duration]) => ({
          time,
          title: titleText,
          location,
          category,
          cost,
          durationMinutes: duration,
        })),
      }))

  const itineraryDays = normalizeItineraryDays(rawItineraryDays, focusActivities, destination.name, pace).map((day) => ({
    ...day,
    activities: day.activities.map(
      (activity) =>
        [activity.time, activity.title, activity.location, activity.category, activity.cost, activity.durationMinutes] as [
          string,
          string,
          string,
          string,
          number,
          number,
        ],
    ),
  }))

  for (const day of itineraryDays) {
    const dayId = id('day')
    const dayImageUrl = await resolveDayImageUrl(
      destination.name,
      {
        title: day.title,
        summary: day.summary,
        activities: day.activities.map((activity) => ({
          title: activity[1],
          location: activity[2],
          category: activity[3],
        })),
      },
      day.dayNumber - 1,
      undefined,
      {
        aiQueries: 'imageSearchQuery' in day && day.imageSearchQuery ? [String(day.imageSearchQuery)] : [],
        usedUrls,
        resultIndex: day.dayNumber - 1,
      },
    )
    usedUrls.add(dayImageUrl)
    insertDay.run(
      dayId,
      tripId,
      day.dayNumber,
      dateAfter(startDate, day.dayNumber - 1),
      day.title,
      day.summary,
      dayImageUrl,
    )
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
        '',
        86,
      )
    }
  }

  await attachAiTripOffers(tripId, destination.id, destination.name, tripContent, now, usedUrls)

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
