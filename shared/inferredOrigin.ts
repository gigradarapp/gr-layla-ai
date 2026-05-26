const STORAGE_KEY = 'layla_home_origin'

const TIMEZONE_ORIGINS: Array<{ match: RegExp; origin: string }> = [
  { match: /singapore/i, origin: 'Singapore' },
  { match: /kuala_lumpur|malaysia\/kuala/i, origin: 'Kuala Lumpur' },
  { match: /jakarta|indonesia/i, origin: 'Jakarta' },
  { match: /bangkok|thailand/i, origin: 'Bangkok' },
  { match: /manila|philippines/i, origin: 'Manila' },
  { match: /hong_kong/i, origin: 'Hong Kong' },
  { match: /taipei|taiwan/i, origin: 'Taipei' },
  { match: /tokyo|japan/i, origin: 'Tokyo' },
  { match: /seoul|korea/i, origin: 'Seoul' },
]

const LOCALE_ORIGINS: Array<{ suffix: string; origin: string }> = [
  { suffix: '-SG', origin: 'Singapore' },
  { suffix: '-MY', origin: 'Kuala Lumpur' },
  { suffix: '-ID', origin: 'Jakarta' },
  { suffix: '-TH', origin: 'Bangkok' },
  { suffix: '-PH', origin: 'Manila' },
  { suffix: '-HK', origin: 'Hong Kong' },
  { suffix: '-TW', origin: 'Taipei' },
  { suffix: '-JP', origin: 'Tokyo' },
  { suffix: '-KR', origin: 'Seoul' },
]

function readStoredOrigin() {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY)?.trim()
    return stored || null
  } catch {
    return null
  }
}

/** Best guess for home / departure city — must still be confirmed in chat. */
export function inferDefaultOrigin() {
  const stored = readStoredOrigin()
  if (stored) return stored

  if (typeof Intl !== 'undefined') {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    for (const entry of TIMEZONE_ORIGINS) {
      if (entry.match.test(tz)) return entry.origin
    }
  }

  if (typeof navigator !== 'undefined') {
    const locale = navigator.language
    for (const entry of LOCALE_ORIGINS) {
      if (locale.endsWith(entry.suffix)) return entry.origin
    }
  }

  return 'Singapore'
}

export function originConfirmationPrompt(origin: string, destination: string) {
  const dest = destination.trim() || 'your trip'
  return `Looks like you're setting off from ${origin} for ${dest}. Is that right?`
}

export function whereFromSuggestionPills(origin: string) {
  const options = [origin, 'Singapore', 'Kuala Lumpur', 'Bangkok', 'Jakarta']
  const seen = new Set<string>()
  return options.filter((city) => {
    const key = city.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
