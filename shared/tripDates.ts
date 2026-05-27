import { normalizeDateWindow } from './checklistFocus.js'

function parseDatePart(fragment: string, year: number) {
  const clean = fragment.trim().replace(/,(?=\s*\d)/g, '')
  if (!clean) return null
  const withYear = /\b\d{4}\b/.test(clean) ? clean : `${clean} ${year}`
  const parsed = new Date(withYear)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

/** Parse checklist "when" strings like "Fri 29 May – Sun 31 May" into ISO dates. */
export function parseWhenDateRange(when?: string, referenceYear = new Date().getFullYear()) {
  const raw = when?.trim()
  if (!raw) return {}

  const normalized = normalizeDateWindow(raw) || raw
  const parts = normalized.split(/\s*[–—-]\s*|\s+to\s+/i).map((part) => part.trim()).filter(Boolean)

  if (parts.length >= 2) {
    const startDate = parseDatePart(parts[0], referenceYear)
    const endDate = parseDatePart(parts[1], referenceYear)
    if (startDate && endDate) return { startDate, endDate }
  }

  const single = parseDatePart(normalized, referenceYear)
  if (single) return { startDate: single, endDate: single }

  return {}
}
