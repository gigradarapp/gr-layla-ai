export function normalizeTravelerType(who?: string) {
  const lower = (who ?? '').trim().toLowerCase()
  if (!lower) return 'couple'
  if (lower.includes('solo')) return 'solo'
  if (lower.includes('family') || lower.includes('kid')) return 'family'
  if (lower.includes('friend') || lower.includes('group')) return 'friends'
  if (lower.includes('couple') || lower.includes('two')) return 'couple'
  return lower.replace(/\s*trip$/i, '').trim() || 'couple'
}

export function travelerCountLabel(travelerType: string) {
  const lower = travelerType.toLowerCase()
  if (lower.includes('solo')) return '1 traveller'
  if (lower.includes('couple')) return '2 travellers'
  if (lower.includes('family')) return 'Family group'
  if (lower.includes('friend')) return 'Group trip'
  return travelerType
}

export function buildTripTitle(input: {
  destination: string
  travelerType: string
  dayCount: number
  budgetLevel?: string
}) {
  const who =
    input.travelerType === 'solo'
      ? 'Solo'
      : input.travelerType === 'couple'
        ? 'Couple'
        : input.travelerType === 'family'
          ? 'Family'
          : input.travelerType === 'friends'
            ? 'Friends'
            : input.travelerType.charAt(0).toUpperCase() + input.travelerType.slice(1)

  const budget =
    input.budgetLevel === 'budget' ? 'Budget ' : input.budgetLevel === 'premium' ? 'Premium ' : ''

  return `${input.dayCount}-Day ${who} ${input.destination} ${budget}Trip`.replace(/\s+/g, ' ').trim()
}
