export type StayTier = 'budget' | 'regular' | 'premium'

type StayOfferLike = {
  type: string
  price: number
  perks: string[]
}

export const STAY_TIERS: StayTier[] = ['budget', 'regular', 'premium']

export const STAY_TIER_LABELS: Record<StayTier, string> = {
  budget: 'Budget',
  regular: 'Regular',
  premium: 'Premium',
}

export function defaultStayTier(budgetLevel?: string): StayTier {
  if (budgetLevel === 'budget') return 'budget'
  if (budgetLevel === 'premium') return 'premium'
  return 'regular'
}

export function tierFromPerks(perks: string[]): StayTier | null {
  const hit = perks.find((perk) => /^(budget|regular|premium)\s+tier$/i.test(perk.trim()))
  if (!hit) return null
  const word = hit.split(/\s+/)[0]?.toLowerCase()
  if (word === 'budget' || word === 'regular' || word === 'premium') return word
  return null
}

export function hotelOffersByTier<T extends StayOfferLike>(offers: T[]): Record<StayTier, T | undefined> {
  const lists = hotelOffersByTierLists(offers)
  return {
    budget: lists.budget[0],
    regular: lists.regular[0],
    premium: lists.premium[0],
  }
}

export function hotelOffersByTierLists<T extends StayOfferLike & { rating?: number }>(
  offers: T[],
  maxPerTier = 5,
): Record<StayTier, T[]> {
  const hotels = offers.filter((offer) => offer.type === 'hotel')
  const result: Record<StayTier, T[]> = {
    budget: [],
    regular: [],
    premium: [],
  }

  for (const tier of STAY_TIERS) {
    result[tier] = hotels
      .filter((offer) => tierFromPerks(offer.perks) === tier)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, maxPerTier)
  }

  const unassigned = hotels.filter((offer) => !tierFromPerks(offer.perks))
  const priced = [...hotels].sort((a, b) => a.price - b.price)

  if (result.budget.length === 0 && priced[0]) result.budget = [priced[0]]
  if (result.regular.length === 0 && priced[1]) result.regular = [priced[1]]
  if (result.premium.length === 0 && priced[2]) result.premium = [priced[2]]
  if (result.regular.length === 0 && priced[0] && priced.length === 1) result.regular = [priced[0]]
  if (result.premium.length === 0 && priced.length > 0) {
    result.premium = [priced[priced.length - 1]!]
  }

  for (const offer of unassigned) {
    const tier = tierFromPerks(offer.perks)
    if (tier && result[tier].length < maxPerTier) {
      result[tier].push(offer)
      result[tier].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    }
  }

  for (const tier of STAY_TIERS) {
    result[tier] = result[tier].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, maxPerTier)
  }

  return result
}
