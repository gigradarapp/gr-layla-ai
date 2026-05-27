import { STAY_TIERS, type StayTier } from '../../shared/stayTiers.js'
import { buildTripTitle, normalizeTravelerType } from '../../shared/travelerLabel.js'
import { extractResponseText } from './openaiText.js'

type AgentTrace = {
  name: string
  label: string
  status: 'complete' | 'fallback'
  result: string
}

export type AiStayOffer = {
  tier: StayTier
  title: string
  provider: string
  price: number
  rating: number
  reviewCount: number
  neighborhood: string
  distanceLabel: string
  roomDescription: string
  amenities: string[]
  perks: string[]
  reviewLabel: string
  imageSearchQuery: string
}

export type AiTransferOffer = {
  title: string
  provider: string
  travelTime: string
  price: number
  rating: number
  perks: string[]
}

export type AiActivityBlock = {
  time: string
  title: string
  location: string
  category: string
  cost: number
  durationMinutes: number
}

export type AiItineraryDay = {
  title: string
  summary: string
  imageSearchQuery: string
  activities: AiActivityBlock[]
}

export type AiTripContent = {
  intro: string
  stays: AiStayOffer[]
  arriveTransfer: AiTransferOffer
  days: AiItineraryDay[]
}

export type TripContentRequest = {
  prompt: string
  destination: string
  origin: string
  startDate: string
  endDate: string
  travelerType: string
  budgetLevel: string
  pace: string
  focusActivities: string[]
  intent?: string
  tripTitle: string
}

function staySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'tier',
      'title',
      'provider',
      'price',
      'rating',
      'reviewCount',
      'neighborhood',
      'distanceLabel',
      'roomDescription',
      'amenities',
      'perks',
      'reviewLabel',
      'imageSearchQuery',
    ],
    properties: {
      tier: { type: 'string', enum: ['budget', 'regular', 'premium'] },
      title: { type: 'string' },
      provider: { type: 'string' },
      price: { type: 'number' },
      rating: { type: 'number' },
      reviewCount: { type: 'number' },
      neighborhood: { type: 'string' },
      distanceLabel: { type: 'string' },
      roomDescription: { type: 'string' },
      amenities: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      perks: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: { type: 'string' },
      },
      reviewLabel: { type: 'string' },
      imageSearchQuery: {
        type: 'string',
        description: 'Specific landmark or building to find a real photo (not just the city name).',
      },
    },
  }
}

export function fallbackTripContent(input: TripContentRequest): AiTripContent {
  const who = normalizeTravelerType(input.travelerType)
  const focus = input.focusActivities.length > 0 ? input.focusActivities : input.intent ? [input.intent] : ['local highlights']
  const dayCount = Math.max(
    1,
    Math.round((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86_400_000) + 1,
  )
  const base =
    input.budgetLevel === 'budget' ? 32 : input.budgetLevel === 'premium' ? 95 : 58

  const stays: AiStayOffer[] = STAY_TIERS.flatMap((tier) => {
    const multipliers = { budget: 1, regular: 1.85, premium: 3.1 }
    const tierBase = Math.round(base * multipliers[tier])
    const ratings = tier === 'budget' ? [4.1, 3.9, 3.7, 3.5, 3.3] : tier === 'regular' ? [4.7, 4.5, 4.3, 4.1, 3.9] : [4.9, 4.8, 4.7, 4.5, 4.3]
    const names =
      tier === 'budget'
        ? ['Central Inn', 'Station Lodge', 'City Capsule', 'Harbour Hostel', 'Budget Square Hotel']
        : tier === 'regular'
          ? ['City Hotel', 'Riverside Stay', 'Garden Court', 'Metro Boutique', 'Urban Comfort']
          : ['Signature Suites', 'Grand Residence', 'Skyline Hotel', 'Luxury Collection', 'Premier Club']
    return ratings.map((rating, index) => ({
      tier,
      title: `${input.destination} ${names[index]}`,
      provider: 'Layla stay match',
      price: Math.round(tierBase * (1 + index * 0.08)),
      rating,
      reviewCount: Math.max(120, 980 - index * 140),
      neighborhood: index === 0 ? 'City centre' : index === 1 ? 'Near transit' : 'Central district',
      distanceLabel:
        index === 0 ? `5 min walk to ${input.destination} core` : `${8 + index * 3} min to main sights`,
      roomDescription:
        tier === 'budget'
          ? 'Compact ensuite with air-conditioning'
          : tier === 'regular'
            ? 'Standard room with queen bed and workspace'
            : 'Suite with premium amenities and lounge access',
      amenities: ['Free Wi-Fi', tier === 'premium' ? 'Pool access' : 'Air-conditioning'],
      perks: [tier === 'premium' ? 'late checkout' : 'free cancellation'],
      reviewLabel: index === 0 ? 'Top pick' : index === 1 ? 'Guest favourite' : `${Math.max(120, 980 - index * 140)} reviews`,
      imageSearchQuery:
        tier === 'budget'
          ? `${input.destination} budget hotel exterior`
          : tier === 'regular'
            ? `City Square ${input.destination}`
            : `${input.destination} luxury hotel lobby`,
    }))
  })

  const days: AiItineraryDay[] = []
  if (focus.length === 1) {
    const activity = focus[0]
    days.push({
      title: `Day 1: ${activity}`,
      summary: `Built around your pick "${activity}" with a ${input.pace} pace for ${who} travellers.`,
      imageSearchQuery: `${activity}, ${input.destination}`,
      activities: [
        {
          time: '09:30',
          title: 'Arrival and hotel check-in',
          location: input.destination,
          category: 'logistics',
          cost: 0,
          durationMinutes: 90,
        },
        {
          time: '11:30',
          title: activity,
          location: input.destination,
          category: 'experience',
          cost: 24,
          durationMinutes: 120,
        },
      ],
    })
    if (dayCount > 1) {
      days.push({
        title: `Day 2: Easy return to ${input.origin}`,
        summary: `Light morning, then cross back to ${input.origin}.`,
        imageSearchQuery: `Johor–Singapore Causeway`,
        activities: [
          {
            time: '10:00',
            title: `Return to ${input.origin}`,
            location: input.destination,
            category: 'logistics',
            cost: 0,
            durationMinutes: 60,
          },
        ],
      })
    }
  } else {
    focus.slice(0, dayCount).forEach((activity, index) => {
      days.push({
        title: index === 0 ? `Arrival & ${activity}` : `Day ${index + 1}: ${activity}`,
        summary: `Built around your chat pick "${activity}" with a ${input.pace} pace for ${who} travellers.`,
        imageSearchQuery: index === 0 ? `Johor–Singapore Causeway` : `${activity}, ${input.destination}`,
        activities: [
          {
            time: '09:30',
            title: index === 0 ? 'Arrival and hotel check-in' : activity,
            location: input.destination,
            category: index === 0 ? 'logistics' : 'experience',
            cost: 0,
            durationMinutes: 90,
          },
          ...(index === 0
            ? [
                {
                  time: '11:30',
                  title: activity,
                  location: input.destination,
                  category: 'experience',
                  cost: 24,
                  durationMinutes: 120,
                } as AiActivityBlock,
              ]
            : []),
        ],
      })
    })
  }

  if (days.length === 0) {
    days.push({
      title: `Explore ${input.destination}`,
      summary: input.intent ? `Focused on ${input.intent}.` : `A ${input.pace} introduction to ${input.destination}.`,
      imageSearchQuery: `${input.destination} old town street`,
      activities: [
        {
          time: '10:30',
          title: 'Neighbourhood orientation',
          location: input.destination,
          category: 'logistics',
          cost: 0,
          durationMinutes: 90,
        },
      ],
    })
  }

  return {
    intro: `${input.tripTitle}: ${input.origin} → ${input.destination}, ${input.startDate} to ${input.endDate}, tailored for ${who} travellers.`,
    stays,
    arriveTransfer: {
      title: `${input.origin} to ${input.destination} private transfer`,
      provider: 'Layla route match',
      travelTime: input.origin.toLowerCase().includes('singapore') && input.destination.toLowerCase().includes('johor') ? '50m' : '1h 15m',
      price: 42,
      rating: 4.5,
      perks: ['door to door', 'land crossing'],
    },
    days,
  }
}

export async function generateTripContent(
  input: TripContentRequest,
  trace: AgentTrace[],
): Promise<{ content: AiTripContent; mode: 'model' | 'fallback' }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    trace.push({
      name: 'trip_content',
      label: 'Generate trip content',
      status: 'fallback',
      result: 'No OpenAI key; used local trip content fallback from chat context.',
    })
    return { content: fallbackTripContent(input), mode: 'fallback' }
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.2'
  const dayCount = Math.max(
    1,
    Math.round((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86_400_000) + 1,
  )

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are Layla, a travel agent. Generate realistic demo trip content from the user chat brief. Use plausible hotel names for the destination (no chains invented as "official"). Prices are indicative SGD per night for hotels and one-way for transfer. For each stay and itinerary day, set imageSearchQuery to a specific landmark, street, building, or venue that exists on Wikipedia (never only the city name). For stays: return 3–5 hotel options per tier (budget, regular, premium), up to 15 stays total. Within each tier, order options from best to worst guest rating (highest rating first). Each stay must include reviewCount, neighborhood, distanceLabel (walk/transit time to a real landmark), roomDescription, amenities (2–4 bullets like Wi-Fi, breakfast), perks (policies like cancellation), and reviewLabel. Vary titles and prices realistically within the tier. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            ...input,
            dayCount,
            instruction: `Return 9–15 stays (3–5 per tier: budget, regular, premium), ranked best-to-worst rating within each tier, 1 arrive transfer, and ${dayCount} itinerary day(s). focusActivities are the ONLY trip experiences the user chose — schedule exactly one experience block per pick (use the pick text as the activity title), plus at most one logistics block per day (check-in, border, transfer). Do not invent extra experience, food, or shopping blocks beyond those picks. Keep activity titles specific to ${input.destination}.`,
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'trip_content',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['intro', 'stays', 'arriveTransfer', 'days'],
            properties: {
              intro: { type: 'string' },
              stays: {
                type: 'array',
                minItems: 9,
                maxItems: 15,
                items: staySchema(),
              },
              arriveTransfer: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'provider', 'travelTime', 'price', 'rating', 'perks'],
                properties: {
                  title: { type: 'string' },
                  provider: { type: 'string' },
                  travelTime: { type: 'string' },
                  price: { type: 'number' },
                  rating: { type: 'number' },
                  perks: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 4,
                    items: { type: 'string' },
                  },
                },
              },
              days: {
                type: 'array',
                minItems: 1,
                maxItems: 7,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'summary', 'imageSearchQuery', 'activities'],
                  properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    imageSearchQuery: { type: 'string' },
                    activities: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 5,
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['time', 'title', 'location', 'category', 'cost', 'durationMinutes'],
                        properties: {
                          time: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string' },
                          category: { type: 'string' },
                          cost: { type: 'number' },
                          durationMinutes: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    trace.push({
      name: 'trip_content',
      label: 'Generate trip content',
      status: 'fallback',
      result: `OpenAI returned ${response.status}; used local trip content fallback.`,
    })
    return { content: fallbackTripContent(input), mode: 'fallback' }
  }

  const body = (await response.json()) as Record<string, unknown>
  const text = extractResponseText(body)
  if (!text) {
    trace.push({
      name: 'trip_content',
      label: 'Generate trip content',
      status: 'fallback',
      result: 'Empty model response; used local trip content fallback.',
    })
    return { content: fallbackTripContent(input), mode: 'fallback' }
  }

  try {
    const parsed = JSON.parse(text) as AiTripContent
    trace.push({
      name: 'trip_content',
      label: 'Generate trip content',
      status: 'complete',
      result: `Model generated ${parsed.stays.length} stay options, transfer, and ${parsed.days.length} itinerary day(s) from chat context.`,
    })
    return { content: parsed, mode: 'model' }
  } catch {
    trace.push({
      name: 'trip_content',
      label: 'Generate trip content',
      status: 'fallback',
      result: 'Unparseable model JSON; used local trip content fallback.',
    })
    return { content: fallbackTripContent(input), mode: 'fallback' }
  }
}

export function tripTitleFromRequest(input: TripContentRequest) {
  const dayCount = Math.max(
    1,
    Math.round((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86_400_000) + 1,
  )
  return buildTripTitle({
    destination: input.destination,
    travelerType: normalizeTravelerType(input.travelerType),
    dayCount,
    budgetLevel: input.budgetLevel,
  })
}
