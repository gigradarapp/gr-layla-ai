import type { StayTier } from './stayTiers.js'

const TIER_PERK = /^(budget|regular|premium)\s+tier$/i
const POLICY_PERK =
  /cancellation|checkout|breakfast|pool|refund|non-refundable|wifi|wi-fi|parking|metro|station|late checkout/i

export type ParsedStayMeta = {
  tier: StayTier | null
  rank: number | null
  neighborhood: string
  distanceLabel: string
  reviewCount: number | null
  roomDescription: string
  reviewLabel: string
  amenities: string[]
  policies: string[]
}

export type StayPerkInput = {
  tier: StayTier
  rank: number
  neighborhood: string
  distanceLabel: string
  reviewCount: number
  roomDescription: string
  amenities: string[]
  policies: string[]
  reviewLabel: string
}

export function buildStayPerks(input: StayPerkInput): string[] {
  return [
    `${input.tier} tier`,
    `rank:${input.rank}`,
    `neighborhood:${input.neighborhood}`,
    `distance:${input.distanceLabel}`,
    `reviewCount:${input.reviewCount}`,
    input.roomDescription,
    ...input.amenities,
    ...input.policies,
    input.reviewLabel,
  ]
}

export function parseStayPerks(perks: string[]): ParsedStayMeta {
  let tier: StayTier | null = null
  let rank: number | null = null
  let neighborhood = ''
  let distanceLabel = ''
  let reviewCount: number | null = null
  let roomDescription = ''
  let reviewLabel = ''
  const amenities: string[] = []
  const policies: string[] = []
  const leftovers: string[] = []

  for (const perk of perks) {
    const trimmed = perk.trim()
    if (!trimmed) continue

    if (TIER_PERK.test(trimmed)) {
      const word = trimmed.split(/\s+/)[0]?.toLowerCase()
      if (word === 'budget' || word === 'regular' || word === 'premium') tier = word
      continue
    }
    if (trimmed.startsWith('rank:')) {
      const value = Number(trimmed.slice(5))
      if (Number.isFinite(value)) rank = value
      continue
    }
    if (trimmed.startsWith('neighborhood:')) {
      neighborhood = trimmed.slice('neighborhood:'.length).trim()
      continue
    }
    if (trimmed.startsWith('distance:')) {
      distanceLabel = trimmed.slice('distance:'.length).trim()
      continue
    }
    if (trimmed.startsWith('reviewCount:')) {
      const value = Number(trimmed.slice('reviewCount:'.length))
      if (Number.isFinite(value)) reviewCount = value
      continue
    }
    leftovers.push(trimmed)
  }

  if (leftovers.length > 0 && !roomDescription) {
    roomDescription = leftovers.shift()!
  }

  for (const item of leftovers) {
    if (!reviewLabel && /favourite|reviews|rated|value|top pick/i.test(item)) {
      reviewLabel = item
      continue
    }
    if (POLICY_PERK.test(item)) {
      policies.push(item)
      continue
    }
    amenities.push(item)
  }

  return {
    tier,
    rank,
    neighborhood,
    distanceLabel,
    reviewCount,
    roomDescription,
    reviewLabel,
    amenities,
    policies,
  }
}
