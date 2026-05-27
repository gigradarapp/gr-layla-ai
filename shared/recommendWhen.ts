export type WhenRecommendationContext = {
  whereTo?: string
  whereFrom?: string
  who?: string
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDayMonth(date: Date) {
  return date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Next Saturday–Sunday window, optionally shifted by whole weeks. */
function weekendRange(weeksAhead: number, now = startOfDay(new Date())) {
  const day = now.getDay()
  let daysToSaturday = (6 - day + 7) % 7
  if (daysToSaturday === 0 && weeksAhead === 0) {
    // Still on Saturday: treat as this weekend.
    daysToSaturday = 0
  }
  const saturday = addDays(now, daysToSaturday + weeksAhead * 7)
  const sunday = addDays(saturday, 1)
  return `${formatDayMonth(saturday)} – ${formatDayMonth(sunday)}`
}

function fridayToSundayRange(weeksAhead: number, now = startOfDay(new Date())) {
  const day = now.getDay()
  let daysToFriday = (5 - day + 7) % 7
  if (daysToFriday === 0 && weeksAhead === 0) daysToFriday = 0
  const friday = addDays(now, daysToFriday + weeksAhead * 7)
  const sunday = addDays(friday, 2)
  return `${formatDayMonth(friday)} – ${formatDayMonth(sunday)} (3 days)`
}

function weekBlock(weeksAhead: number, lengthDays: number, now = startOfDay(new Date())) {
  const start = addDays(now, 14 + weeksAhead * 7)
  const end = addDays(start, lengthDays - 1)
  return `${formatDayMonth(start)} – ${formatDayMonth(end)} (${lengthDays} days)`
}

/**
 * Dynamic date-window pills when the model does not return its own.
 * Uses real calendar dates — not static template strings.
 */
export function recommendWhenWindows(context: WhenRecommendationContext): string[] {
  const dest = (context.whereTo ?? '').toLowerCase()
  const who = (context.who ?? '').toLowerCase()
  const isShortHop = /johor|jb|bahru|batam|bintan|malacca|penang|kl|kuala/.test(dest)
  const isLongHaul = /tokyo|kyoto|japan|europe|queenstown|lisbon|bali|seoul|korea|zealand|australia/.test(dest)

  if (isShortHop) {
    const dayTrip = weekendRange(0).replace(/ – .+$/, ' (day trip)')
    if (who.includes('family')) {
      return [weekendRange(0), weekendRange(1), fridayToSundayRange(1)]
    }
    return [weekendRange(0), weekendRange(1), dayTrip]
  }

  if (isLongHaul) {
    return [weekBlock(0, 5), weekBlock(1, 7), weekBlock(2, 10)]
  }

  return [weekendRange(0), weekendRange(1), weekBlock(0, 5)]
}

const MONTH_ALIASES: Record<string, string> = {
  jan: 'jan',
  january: 'jan',
  feb: 'feb',
  february: 'feb',
  mar: 'mar',
  march: 'mar',
  apr: 'apr',
  april: 'apr',
  may: 'may',
  jun: 'jun',
  june: 'jun',
  jul: 'jul',
  july: 'jul',
  aug: 'aug',
  august: 'aug',
  sep: 'sep',
  sept: 'sep',
  september: 'sep',
  oct: 'oct',
  october: 'oct',
  nov: 'nov',
  november: 'nov',
  dec: 'dec',
  december: 'dec',
}

function monthTokenFromPreference(preference: string) {
  const match = preference.toLowerCase().match(/\bin\s+([a-z]+)\b/)
  if (!match) return null
  return MONTH_ALIASES[match[1]] ?? null
}

/** Narrow date pills after a vague timing hint (e.g. "This weekend" → Sat–Sun windows). */
export function recommendWhenWindowsForPreference(preference: string | undefined, context: WhenRecommendationContext): string[] {
  const windows = recommendWhenWindows(context)
  const trimmed = preference?.trim() ?? ''
  if (!trimmed) return windows

  const lower = trimmed.toLowerCase()
  if (/^this weekend$/i.test(trimmed)) {
    const dayTrip = weekendRange(0).replace(/ – .+$/, ' (day trip)')
    return [weekendRange(0), weekendRange(1), dayTrip]
  }
  if (/^next weekend$/i.test(trimmed)) {
    return [weekendRange(1), weekendRange(2), weekendRange(0)]
  }

  const monthToken = monthTokenFromPreference(trimmed)
  if (monthToken) {
    const inMonth = windows.filter((window) => new RegExp(`\\b${monthToken}\\b`, 'i').test(window))
    if (inMonth.length >= 2) return inMonth.slice(0, 4)
    if (inMonth.length === 1) return [...inMonth, ...windows.filter((window) => !inMonth.includes(window))].slice(0, 4)
  }

  return windows
}
