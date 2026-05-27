export type ImageSearchContext = 'hotel' | 'day' | 'food' | 'transport' | 'landmark' | 'general'

const BLOCKED_TEXT =
  /\b(sultan|ibrahim|ismail|portrait|eagle|hawk|falcon|bird|ornithol|fauna|wildlife|coat of arms|head of state|politician|prime minister|president|minister|royal|monarch|flag of|map of|emblem|logo only|military uniform|army|navy)\b/i

const HOTEL_POSITIVE =
  /\b(hotel|resort|inn|suites?|hilton|marriott|hyatt|ibis|holiday inn|tower|lodge|hostel|accommodation|princess cove|sentral|pool|lobby|bedroom|exterior|building|skyline|waterfront|condo|apartment)\b/i

const FOOD_POSITIVE = /\b(food|street food|cafe|coffee|market|restaurant|hawker|kopitiam|dining)\b/i
const LANDMARK_POSITIVE = /\b(mosque|temple|church|palace|museum|park|garden|causeway|bridge|river|old town|street|waterfront|promenade)\b/i

export function isBlockedImageText(...parts: Array<string | undefined | null>) {
  const text = parts.filter(Boolean).join(' ').toLowerCase()
  return BLOCKED_TEXT.test(text)
}

export function isBadImageUrl(url: string | undefined | null) {
  if (!url?.trim()) return false
  const lower = decodeURIComponent(url).toLowerCase()
  return (
    /sultan|ibrahim|portrait|eagle|hawk|falcon|bird|ornithol|coat_of_arms|head_of_state|prime_minister|royal_visit/i.test(
      lower,
    ) || BLOCKED_TEXT.test(lower)
  )
}

export function scoreImageCandidate(input: {
  query: string
  title?: string
  url?: string
  context: ImageSearchContext
}) {
  const blob = `${input.title ?? ''} ${input.url ?? ''} ${input.query}`.toLowerCase()
  if (isBlockedImageText(blob)) return -100

  let score = 1
  if (input.context === 'hotel') {
    if (HOTEL_POSITIVE.test(blob)) score += 12
    if (/\b(animal|zoo|nature reserve|national park)\b/i.test(blob)) score -= 40
  } else if (input.context === 'food') {
    if (FOOD_POSITIVE.test(blob)) score += 10
  } else if (input.context === 'transport') {
    if (/\b(causeway|bridge|checkpoint|border|highway|road)\b/i.test(blob)) score += 10
  } else if (input.context === 'landmark' || input.context === 'day') {
    if (LANDMARK_POSITIVE.test(blob)) score += 8
    if (FOOD_POSITIVE.test(blob)) score += 4
  }

  const queryTokens = input.query.toLowerCase().split(/\W+/).filter((token) => token.length > 3)
  const matched = queryTokens.filter((token) => blob.includes(token)).length
  score += Math.min(6, matched)

  return score
}

export function pickBestImageCandidate<T extends { title?: string; url: string }>(
  query: string,
  context: ImageSearchContext,
  candidates: T[],
  options?: { avoidUrls?: Set<string>; minScore?: number },
) {
  const minScore = options?.minScore ?? 2
  let best: { item: T; score: number } | null = null

  for (const item of candidates) {
    if (options?.avoidUrls?.has(item.url)) continue
    if (isBadImageUrl(item.url)) continue
    const score = scoreImageCandidate({ query, title: item.title, url: item.url, context })
    if (score < minScore) continue
    if (!best || score > best.score) best = { item, score }
  }

  return best?.item.url ?? null
}
