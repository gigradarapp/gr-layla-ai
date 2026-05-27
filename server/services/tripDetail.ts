import { resolveHotelBookingUrl } from '../../shared/hotelBookingUrl.js'
import { parseStayPerks } from '../../shared/stayOfferMeta.js'
import { STAY_TIERS, tierFromPerks, type StayTier } from '../../shared/stayTiers.js'
import { shouldReresolveTripImage } from '../../shared/tripImageQueries.js'
import { db } from '../db/sqlite.js'
import { mapActivity, mapDay, mapMessage, mapOffer, mapTrip, type TripRow } from './mapper.js'
import { resolveDayImageUrl, resolveDestinationHeroImage, resolveSceneImageUrl, resolveStayImageUrl } from './tripImages.js'

type TripDetailPayload = ReturnType<typeof buildTripDetailSync>

function buildTripDetailSync(tripId: string) {
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

async function enrichTripDetailImages(trip: NonNullable<TripDetailPayload>) {
  const usedUrls = new Set<string>()
  const tierIndex = new Map<StayTier, number>(STAY_TIERS.map((tier, index) => [tier, index]))

  trip.heroImageUrl = await resolveDestinationHeroImage(trip.destination, trip.heroImageUrl)
  usedUrls.add(trip.heroImageUrl)

  for (const [index, day] of trip.days.entries()) {
    if (!shouldReresolveTripImage(day.imageUrl, usedUrls)) {
      usedUrls.add(day.imageUrl)
      continue
    }
    day.imageUrl = await resolveDayImageUrl(trip.destination, day, index, day.imageUrl, {
      usedUrls,
      resultIndex: index,
    })
    usedUrls.add(day.imageUrl)
  }

  for (const offer of trip.offers) {
    if (offer.type === 'hotel') {
      offer.url = resolveHotelBookingUrl(offer.url, offer.title, trip.destination)
      if (!shouldReresolveTripImage(offer.imageUrl, usedUrls)) {
        usedUrls.add(offer.imageUrl)
        continue
      }
      const tier = tierFromPerks(offer.perks) ?? 'regular'
      const tierBaseIndex = tierIndex.get(tier) ?? 0
      const rankOffset = Math.max(0, (parseStayPerks(offer.perks).rank ?? 1) - 1)
      offer.imageUrl = await resolveStayImageUrl(trip.destination, tier, tierBaseIndex + rankOffset, offer.title, offer.imageUrl, {
        usedUrls,
        resultIndex: tierBaseIndex + rankOffset + 2,
      })
      usedUrls.add(offer.imageUrl)
      continue
    }
    if (offer.type === 'activity') {
      if (!shouldReresolveTripImage(offer.imageUrl, usedUrls)) {
        usedUrls.add(offer.imageUrl)
        continue
      }
      offer.imageUrl = await resolveSceneImageUrl(trip.destination, 'arrival', offer.imageUrl)
      usedUrls.add(offer.imageUrl)
    }
  }
}

export async function getTripDetail(tripId: string) {
  const trip = buildTripDetailSync(tripId)
  if (!trip) return null
  await enrichTripDetailImages(trip)
  return trip
}
