export type ChecklistFieldKey = 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'

export const CHECKLIST_CAPTURE_ORDER: ChecklistFieldKey[] = ['whereTo', 'whereFrom', 'when', 'who', 'intent']

/** Required before the trip summary / generation step. */
export const DEPARTURE_PREREQUISITES: ChecklistFieldKey[] = ['whereTo', 'whereFrom', 'when', 'who', 'intent']

export function originStepUnlocked(context: ChecklistContext) {
  return isValidCapturedValue('whereTo', context.whereTo)
}

export type ChecklistContext = {
  whereTo?: string
  whereFrom?: string
  who?: string
  when?: string
  intent?: string
}

function normalizeDestination(value: string) {
  return value
    .toLowerCase()
    .replace(/,?\s*malaysia$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const DESTINATION_ALIASES: Array<{ keys: string[]; token: string }> = [
  { keys: ['johor', 'jb', 'bahru'], token: 'johor' },
  { keys: ['bali'], token: 'bali' },
  { keys: ['tokyo', 'kyoto', 'japan'], token: 'tokyo' },
  { keys: ['seoul', 'korea'], token: 'seoul' },
  { keys: ['lisbon', 'portugal'], token: 'lisbon' },
  { keys: ['queenstown', 'new zealand'], token: 'queenstown' },
]

function destinationToken(message: string) {
  const lower = message.toLowerCase()
  for (const entry of DESTINATION_ALIASES) {
    if (entry.keys.some((key) => lower.includes(key))) return entry.token
  }
  return null
}

export function mentionsDifferentDestination(message: string, currentWhereTo: string) {
  if (!currentWhereTo.trim()) return false
  const mentioned = destinationToken(message)
  if (!mentioned) return false
  const current = normalizeDestination(currentWhereTo)
  return !current.includes(mentioned)
}

export function looksLikeDateWindow(value: string) {
  const normalized = value.trim().replace(/,(?=\s*\d)/g, '')
  return (
    /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+\d{1,2}\s+[a-z]{3,}/i.test(value) ||
    /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+\d{1,2}\s+[a-z]{3,}/i.test(normalized) ||
    /\d{1,2}\s+[a-z]{3,}\s*(?:[–—-]\s*|\s+to\s+)/i.test(value) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(value)
  )
}

export function normalizeDateWindow(value: string) {
  const trimmed = value.trim().replace(/,(?=\s*\d)/g, '')
  if (!looksLikeDateWindow(trimmed)) return ''
  return trimmed.length <= 56 ? trimmed : trimmed.slice(0, 56)
}

/** Relative timing only — not a locked calendar window for the checklist. */
export function looksLikeVagueDateHint(value: string) {
  const trimmed = value.trim()
  if (!trimmed || looksLikeDateWindow(trimmed)) return false

  const lower = trimmed.toLowerCase()
  if (/^this weekend$/i.test(trimmed)) return true
  if (/^next weekend$/i.test(trimmed)) return true
  if (/^this month$/i.test(trimmed)) return true
  if (/^next month$/i.test(trimmed)) return true
  if (/^in\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(lower)) {
    return true
  }
  if (/\b(just\s+)?for\s+a\s+day\b/i.test(lower)) return true
  if (/^overnight(\s+stay)?$/i.test(trimmed)) return true
  if (/^\d[\d\s-]*days?$/i.test(trimmed)) return true
  if (/\bweekend\b/i.test(lower) && !/\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+\d/i.test(lower)) return true
  if (/\bthis month\b|\bnext month\b/i.test(lower)) return true
  return false
}

export function isDateRefinementRequest(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (looksLikeDateWindow(trimmed)) return false
  if (looksLikeVagueDateHint(trimmed)) return true

  const lower = trimmed.toLowerCase()
  return (
    /\b(suggest|show|give|list|pick|choose|recommend|again|other|another|what)\b.*\b(date|dates|weekend|window|options)\b/i.test(
      lower,
    ) ||
    /\b(date|dates|weekend|when)\b.*\b(suggest|again|other|options|only|change)\b/i.test(lower) ||
    /\b(between\s+)?sat(?:urday)?\s+and\s+sun(?:day)?\s+only\b/i.test(lower) ||
    /\bweekends?\s+only\b/i.test(lower) ||
    /\bbetween\s+weekends?\b/i.test(lower) ||
    /\bchange\s+(the\s+)?dates?\b/i.test(lower) ||
    /\bweekend\s+dates?\b/i.test(lower)
  )
}

export function looksLikeWhoAnswer(value: string) {
  const trimmed = value.trim()
  if (!trimmed || looksLikeDateWindow(trimmed)) return false
  const lower = trimmed.toLowerCase()
  return (
    /^(solo|solo trip|couple|couple trip|family with kids|family|friends|friends group|with family|multi-gen family)$/i.test(
      trimmed,
    ) || /\b(solo|couple|family|friends|group)\b/i.test(lower)
  )
}

export function isValidCapturedValue(field: ChecklistFieldKey, value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return false
  if (field === 'who' && (looksLikeDateWindow(trimmed) || looksLikeVagueDateHint(trimmed))) return false
  if (field === 'when') {
    if (looksLikeWhoAnswer(trimmed) || looksLikeVagueDateHint(trimmed)) return false
    return looksLikeDateWindow(trimmed)
  }
  if (field === 'whereFrom') return looksLikeOriginAnswer(trimmed)
  if (field === 'intent' && (looksLikeDateWindow(trimmed) || looksLikeWhoAnswer(trimmed) || looksLikeVagueDateHint(trimmed))) {
    return false
  }
  return true
}

const ORIGIN_CITY_PATTERN =
  /\b(singapore|kuala lumpur|kl|bangkok|jakarta|batam|penang|melbourne|sydney|hong kong|taipei|tokyo|seoul)\b/i

export function looksLikeOriginAnswer(value: string) {
  return ORIGIN_CITY_PATTERN.test(value.trim())
}

export function inferFieldFromValue(value: string): ChecklistFieldKey | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (looksLikeDateWindow(trimmed) || looksLikeVagueDateHint(trimmed)) return 'when'
  if (looksLikeWhoAnswer(trimmed)) return 'who'
  if (looksLikeOriginAnswer(trimmed)) return 'whereFrom'
  return null
}

export function sanitizeChecklistContext<T extends ChecklistContext>(context: T): T {
  const next = { ...context }
  if (next.who && !isValidCapturedValue('who', next.who)) {
    if (looksLikeDateWindow(next.who) && !isValidCapturedValue('when', next.when)) {
      next.when = next.who
    }
    next.who = ''
  }
  if (next.when && !isValidCapturedValue('when', next.when)) next.when = ''
  if (next.intent && !isValidCapturedValue('intent', next.intent)) next.intent = ''
  return next
}

export function suggestFieldForReplies(suggestions: string[], fallback: ChecklistFieldKey): ChecklistFieldKey {
  if (suggestions.some((item) => looksLikeDateWindow(item) || looksLikeVagueDateHint(item))) return 'when'
  if (suggestions.some((item) => looksLikeOriginAnswer(item))) return 'whereFrom'
  if (suggestions.length > 0 && suggestions.every((item) => looksLikeWhoAnswer(item))) return 'who'
  return fallback
}

export function departurePrerequisitesMet(context: ChecklistContext) {
  return DEPARTURE_PREREQUISITES.every((key) => isValidCapturedValue(key, context[key]))
}

export function checklistComplete(context: ChecklistContext) {
  return departurePrerequisitesMet(sanitizeChecklistContext(context))
}

export function firstMissingField(context: ChecklistContext, excludeWhereFrom = false): ChecklistFieldKey | null {
  for (const key of CHECKLIST_CAPTURE_ORDER) {
    if (excludeWhereFrom && key === 'whereFrom') continue
    if (!isValidCapturedValue(key, context[key])) return key
  }
  if (!excludeWhereFrom && !isValidCapturedValue('whereFrom', context.whereFrom)) return 'whereFrom'
  return null
}

/** The step the user must complete before any later step unlocks. */
export function currentRequiredField(context: ChecklistContext): ChecklistFieldKey {
  const clean = sanitizeChecklistContext(context)
  if (!clean.whereTo?.trim()) return 'whereTo'
  return firstMissingField(clean) ?? 'intent'
}

/** Checklist tap or explicit edit — current step, or a completed earlier step only. */
export function canFocusField(field: ChecklistFieldKey, context: ChecklistContext): boolean {
  const clean = sanitizeChecklistContext(context)
  if (field === 'whereTo') return !clean.whereTo?.trim()
  if (field === 'whereFrom' && !originStepUnlocked(clean)) return false

  const required = currentRequiredField(clean)
  if (field === required) return true

  const fieldIndex = CHECKLIST_CAPTURE_ORDER.indexOf(field)
  const requiredIndex = CHECKLIST_CAPTURE_ORDER.indexOf(required)
  return fieldIndex < requiredIndex && isValidCapturedValue(field, clean[field])
}

/** Drop answers for checklist steps that are not unlocked yet. */
/** Keep checklist fields that were already captured correctly if the new patch is invalid. */
export function preserveValidatedChecklistFields<T extends ChecklistContext>(current: ChecklistContext, patch: T): T {
  const next = { ...patch }
  for (const key of CHECKLIST_CAPTURE_ORDER) {
    const currentValue = current[key]
    const patchValue = patch[key]
    if (isValidCapturedValue(key, currentValue) && !isValidCapturedValue(key, patchValue)) {
      next[key] = currentValue as T[typeof key]
    }
  }
  return next
}

const TRIP_CONFIRMATION_PATTERN =
  /^(?:i'?m\s+good|good\s+to\s+go|all\s+good|let'?s\s+go|let'?s\s+do\s+it|sounds\s+good|looks\s+good|perfect|yes+,?\s*confirm|confirm(?:\s+summary)?|go\s+ahead|build\s+(?:the\s+)?trip|ready\s+when\s+you\s+are)[.!?\s]*$/i

/** User wants to finish / build the trip — not add another activity or checklist answer. */
export function isTripConfirmationMessage(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase().replace(/[.!?]+$/g, '').trim()
  if (TRIP_CONFIRMATION_PATTERN.test(lower)) return true
  if (/\b(confirm|go ahead|build\s+it|generate\s+the\s+trip)\b/i.test(lower) && lower.length <= 48) return true
  return false
}

export function isActivityPickMessage(message: string, context: ChecklistContext) {
  const trimmed = message.trim()
  if (!trimmed || inferFieldFromValue(trimmed)) return false
  if (isTripConfirmationMessage(trimmed)) return false
  if (isDateRefinementRequest(trimmed) || looksLikeVagueDateHint(trimmed)) return false
  if (looksLikeWhoAnswer(trimmed) || looksLikeOriginAnswer(trimmed)) return false
  const clean = sanitizeChecklistContext(context)
  if (!checklistComplete(clean)) return false
  if (!isValidCapturedValue('intent', clean.intent)) return false
  if (firstMissingField(clean) === 'intent') return false
  return true
}

export function gateContextPatch<T extends ChecklistContext>(patch: T, context: ChecklistContext): T {
  const required = currentRequiredField(context)
  const requiredIndex = CHECKLIST_CAPTURE_ORDER.indexOf(required)
  const next = { ...patch }
  for (const key of CHECKLIST_CAPTURE_ORDER) {
    if (CHECKLIST_CAPTURE_ORDER.indexOf(key) > requiredIndex && next[key]) {
      next[key] = '' as T[typeof key]
    }
  }
  return next
}

export function resolveFocusField(
  message: string,
  context: ChecklistContext,
  hintedFocus?: ChecklistFieldKey,
  options?: { activityMode?: boolean },
): ChecklistFieldKey {
  const clean = sanitizeChecklistContext(context)
  if (options?.activityMode || isActivityPickMessage(message, clean)) return 'intent'

  const required = currentRequiredField(clean)

  if (hintedFocus && canFocusField(hintedFocus, clean)) return hintedFocus

  if (required === 'when' && (isDateRefinementRequest(message) || looksLikeVagueDateHint(message))) {
    return 'when'
  }

  if (isDateRefinementRequest(message) && canFocusField('when', clean)) return 'when'

  const inferred = inferFieldFromValue(message)
  if (inferred && inferred !== required && !canFocusField(inferred, clean)) {
    return required
  }

  return required
}
