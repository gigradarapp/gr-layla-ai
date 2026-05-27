export type DestinationImageScene =
  | 'hotel_budget'
  | 'hotel_regular'
  | 'hotel_premium'
  | 'food'
  | 'street'
  | 'culture'
  | 'arrival'
  | 'default'

/** Verified Unsplash URLs (return HTTP 200). */
const u = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`

export const TRIP_IMAGE_FALLBACK = u('photo-1596422846543-75c6fc197f07')

const imagePools: Record<string, Partial<Record<DestinationImageScene, string[]>>> = {
  johor: {
    hotel_budget: [u('photo-1631049307264-da0ec9d70304'), u('photo-1566073771259-6a8506099945')],
    hotel_regular: [u('photo-1551882547-ff40c63fe5fa'), u('photo-1571896349842-33c89424de2d')],
    hotel_premium: [u('photo-1582719478250-c89cae4dc85b'), u('photo-1571896349842-33c89424de2d')],
    food: [u('photo-1504674900247-0877df9cc836'), u('photo-1517248135467-4c7edcad34c4')],
    street: [u('photo-1596422846543-75c6fc197f07'), u('photo-1540959733332-eab4deabeeaf')],
    culture: [u('photo-1596422846543-75c6fc197f07'), u('photo-1488646953014-85cb44e25828')],
    arrival: [u('photo-1544620347-c4fd4a3d5957'), u('photo-1503376780353-7e6692767b70')],
    default: [u('photo-1596422846543-75c6fc197f07')],
  },
  tokyo: {
    hotel_budget: [u('photo-1631049307264-da0ec9d70304')],
    hotel_regular: [u('photo-1566073771259-6a8506099945')],
    hotel_premium: [u('photo-1551882547-ff40c63fe5fa')],
    food: [u('photo-1517248135467-4c7edcad34c4')],
    street: [u('photo-1540959733332-eab4deabeeaf')],
    culture: [u('photo-1493976040374-85c8e12f0c0e')],
    arrival: [u('photo-1540959733332-eab4deabeeaf')],
    default: [u('photo-1540959733332-eab4deabeeaf')],
  },
  bali: {
    hotel_budget: [u('photo-1520250497591-112f2f40a3f4')],
    hotel_regular: [u('photo-1571896349842-33c89424de2d')],
    hotel_premium: [u('photo-1582719478250-c89cae4dc85b')],
    food: [u('photo-1517248135467-4c7edcad34c4')],
    street: [u('photo-1537996194471-e657df975ab4')],
    culture: [u('photo-1518548419970-58e3b4079ab2')],
    arrival: [u('photo-1507525428034-b723cf961d3e')],
    default: [u('photo-1518548419970-58e3b4079ab2')],
  },
  seoul: {
    hotel_budget: [u('photo-1631049307264-da0ec9d70304')],
    hotel_regular: [u('photo-1551882547-ff40c63fe5fa')],
    hotel_premium: [u('photo-1566073771259-6a8506099945')],
    food: [u('photo-1504674900247-0877df9cc836')],
    street: [u('photo-1517154421773-0529f29ea451')],
    culture: [u('photo-1517154421773-0529f29ea451')],
    arrival: [u('photo-1517154421773-0529f29ea451')],
    default: [u('photo-1517154421773-0529f29ea451')],
  },
  default: {
    hotel_budget: [u('photo-1631049307264-da0ec9d70304')],
    hotel_regular: [u('photo-1566073771259-6a8506099945')],
    hotel_premium: [u('photo-1582719478250-c89cae4dc85b')],
    food: [u('photo-1504674900247-0877df9cc836')],
    street: [u('photo-1488646953014-85cb44e25828')],
    culture: [u('photo-1488646953014-85cb44e25828')],
    arrival: [u('photo-1469474968028-56623f02e42e')],
    default: [u('photo-1488646953014-85cb44e25828')],
  },
}

export function destinationImageKey(destination: string) {
  const lower = destination.toLowerCase()
  if (lower.includes('johor') || lower.includes('bahru') || lower.includes('jb')) return 'johor'
  if (lower.includes('tokyo') || lower.includes('kyoto') || lower.includes('japan')) return 'tokyo'
  if (lower.includes('bali') || lower.includes('ubud') || lower.includes('canggu')) return 'bali'
  if (lower.includes('seoul') || lower.includes('korea')) return 'seoul'
  return 'default'
}

export function pickDestinationImage(destination: string, scene: DestinationImageScene, offset = 0) {
  const key = destinationImageKey(destination)
  const pool = imagePools[key]?.[scene] ?? imagePools.default[scene] ?? imagePools.default.default ?? []
  if (pool.length === 0) return TRIP_IMAGE_FALLBACK
  return pool[offset % pool.length]
}

export function pickStayImageUrl(destination: string, tier: 'budget' | 'regular' | 'premium', offset = 0) {
  return pickDestinationImage(destination, `hotel_${tier}` as DestinationImageScene, offset)
}

export function pickDayImageUrl(
  destination: string,
  day: { title: string; summary: string; activities: Array<{ category?: string; title?: string }> },
  dayIndex: number,
) {
  const text = `${day.title} ${day.summary} ${day.activities.map((item) => `${item.category} ${item.title}`).join(' ')}`.toLowerCase()
  const normalized = text.normalize('NFD').replace(/\p{M}/gu, '')

  if (/arrival|cross|border|transfer|check.?in|logistics/.test(normalized)) {
    return pickDestinationImage(destination, 'arrival', dayIndex)
  }
  if (/cafe|coffee|food|eat|dinner|lunch|market|culinar/.test(normalized)) {
    return pickDestinationImage(destination, 'food', dayIndex)
  }
  if (/temple|museum|heritage|culture|palace/.test(normalized)) {
    return pickDestinationImage(destination, 'culture', dayIndex)
  }
  if (dayIndex % 2 === 0) return pickDestinationImage(destination, 'street', dayIndex)
  return pickDestinationImage(destination, 'culture', dayIndex + 1)
}

import { isBadImageUrl } from './imageRelevance.js'
import { isDestinationOnlyPhoto, isStockImageUrl } from './tripImageQueries.js'

function isPreferredTripImage(url: string) {
  return !isStockImageUrl(url) && !isDestinationOnlyPhoto(url) && !isBadImageUrl(url)
}

export function resolveTripImageUrl(...candidates: Array<string | undefined | null>) {
  for (const candidate of candidates) {
    const url = candidate?.trim()
    if (url && isPreferredTripImage(url)) return url
  }
  for (const candidate of candidates) {
    const url = candidate?.trim()
    if (url && !isStockImageUrl(url)) return url
  }
  for (const candidate of candidates) {
    const url = candidate?.trim()
    if (url) return url
  }
  return TRIP_IMAGE_FALLBACK
}
