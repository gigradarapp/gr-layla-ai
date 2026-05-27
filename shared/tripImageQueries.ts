import { isBadImageUrl } from './imageRelevance.js'

export function isStockImageUrl(url: string | undefined | null) {
  if (!url?.trim()) return true
  return /unsplash\.com/i.test(url)
}

/** City skyline photos reused for every card — treat as needing a more specific lookup. */
export const DESTINATION_ONLY_PHOTO_URLS = new Set([
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/%E5%AF%8C%E5%8A%9B%E5%85%AC%E4%B8%BB%E6%B9%BE_R%26F_Princess_Cove_%28cropped%29.jpg/960px-%E5%AF%8C%E5%8A%9B%E5%85%AC%E4%B8%BB%E6%B9%BE_R%26F_Princess_Cove_%28cropped%29.jpg',
])

export function isDestinationOnlyPhoto(url: string | undefined | null) {
  if (!url?.trim()) return false
  return DESTINATION_ONLY_PHOTO_URLS.has(url.trim())
}

export function shouldReresolveTripImage(url: string | undefined | null, usedUrls?: Set<string>) {
  if (!url?.trim()) return true
  if (isStockImageUrl(url)) return true
  if (isDestinationOnlyPhoto(url)) return true
  if (isBadImageUrl(url)) return true
  if (usedUrls?.has(url)) return true
  return false
}

function cleanQueryPart(value: string) {
  return value
    .replace(/^day\s*\d+\s*[—–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildDayPhotoQueries(
  day: {
    title: string
    summary: string
    activities: Array<{ title?: string; location?: string; category?: string }>
  },
  destination: string,
  options?: { includeDestinationFallback?: boolean },
) {
  const queries: string[] = []

  for (const activity of day.activities) {
    const location = activity.location?.trim()
    if (location && location.toLowerCase() !== destination.toLowerCase()) {
      queries.push(`${location}, ${destination}`)
      queries.push(location)
    }
    const title = activity.title?.trim()
    if (title && title.length > 3) {
      queries.push(`${title}, ${destination}`)
    }
    const category = activity.category?.toLowerCase()
    if (category === 'food') queries.push(`${destination} street food market`)
    if (category === 'logistics') queries.push(`Johor Singapore Causeway`, `${destination} immigration checkpoint`)
  }

  const dayTitle = cleanQueryPart(day.title)
  if (dayTitle.length > 4) queries.push(`${dayTitle}, ${destination}`)

  if (/cafe|coffee|street food|food/i.test(`${day.title} ${day.summary}`)) {
    queries.push(`Jalan Tan Hiok Nee ${destination}`, `${destination} old town cafe`)
  }
  if (/border|cross|causeway/i.test(`${day.title} ${day.summary}`)) {
    queries.push('Johor–Singapore Causeway', 'Woodlands Checkpoint Singapore')
  }

  if (options?.includeDestinationFallback !== false) {
    queries.push(`${destination} old town`, destination)
  }

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
}

export function buildStayPhotoQueries(title: string, destination: string) {
  const hotel = title.trim()
  const queries = [
    `${hotel} hotel building`,
    `${hotel} exterior`,
    hotel,
    `${hotel}, ${destination}`,
    `hotel ${destination}`,
  ]
  return [...new Set(queries.filter((query) => query.length > 2))]
}

export function mergePhotoQueries(aiQueries: string[] | undefined, builtQueries: string[]) {
  const merged = [...(aiQueries ?? []).map((query) => query.trim()).filter(Boolean), ...builtQueries]
  return [...new Set(merged)]
}
