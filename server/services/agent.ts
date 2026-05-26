import {
  canFocusField,
  currentRequiredField,
  departurePrerequisitesMet,
  gateContextPatch,
  inferFieldFromValue,
  isDateRefinementRequest,
  isActivityPickMessage,
  isTripConfirmationMessage,
  isValidCapturedValue,
  normalizeDateWindow,
  preserveValidatedChecklistFields,
  looksLikeDateWindow,
  looksLikeOriginAnswer,
  looksLikeVagueDateHint,
  looksLikeWhoAnswer,
  mentionsDifferentDestination,
  resolveFocusField,
  sanitizeChecklistContext,
  suggestFieldForReplies,
} from '../../shared/checklistFocus.js'
import { conversationPhase } from '../../shared/chatIntent.js'
import { inferDefaultOrigin } from '../../shared/inferredOrigin.js'
import { recommendWhenWindows, recommendWhenWindowsForPreference } from '../../shared/recommendWhen.js'
import { db, id } from '../db/sqlite.js'
import { createGeneratedTrip } from './planner.js'
import { getTripDetail } from './tripDetail.js'

type AgentContext = {
  whereTo?: string
  whereFrom?: string
  who?: string
  when?: string
  intent?: string
  budgetLevel?: string
  pace?: string
}

type AgentRequest = {
  prompt: string
  context?: AgentContext
}

type MoreSuggestionsRequest = {
  field: AgentChatTurn['activeField']
  exclude: string[]
}

type AgentChatRequest = {
  message: string
  context?: AgentContext
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  focusField?: AgentChatTurn['activeField']
  moreSuggestions?: MoreSuggestionsRequest
}

type AgentPlan = {
  assistantMessage: string
  selectedDestination: string
  origin: string
  travelerType: string
  budgetLevel: string
  pace: string
  tripTitle: string
  itineraryFocus: string[]
  confidence: number
}

type ChatMessageIntent = 'checklist_step' | 'add_activity' | 'confirm_trip' | 'change_checklist' | 'clarify'

type AgentChatTurn = {
  assistantMessage: string
  contextPatch: Required<AgentContext>
  activeField: 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
  suggestionField: 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
  messageIntent: ChatMessageIntent
  addActivities: string[]
  suggestedReplies: string[]
  shouldFinish: boolean
  confidence: number
}

export type AgentTrace = {
  name: string
  label: string
  status: 'complete' | 'fallback'
  result: string
}

function normalizeConfidence(value: number) {
  const scaled = value <= 1 ? value * 100 : value
  return Math.max(50, Math.min(96, Math.round(scaled)))
}

function compactAssistantMessage(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 420) return normalized

  const draft = normalized.slice(0, 417)
  const sentenceEnd = Math.max(draft.lastIndexOf('. '), draft.lastIndexOf('? '), draft.lastIndexOf('! '))
  const cut = sentenceEnd > 180 ? draft.slice(0, sentenceEnd + 1) : draft.trimEnd()
  return `${cut}...`
}

function destinationsForAgent() {
  return db
    .prepare(
      `SELECT id, name, country, vibe, budget_level, weather, ideal_duration, flight_price_from, summary
       FROM destinations
       ORDER BY flight_price_from ASC`,
    )
    .all() as Array<Record<string, unknown>>
}

function offersForDestination(destinationName: string) {
  return db
    .prepare(
      `SELECT offers.type, offers.provider, offers.title, offers.price, offers.rating, offers.perks
       FROM offers
       LEFT JOIN destinations ON destinations.id = offers.destination_id
       WHERE LOWER(destinations.name) LIKE LOWER(?)
       ORDER BY offers.type ASC, offers.price ASC
       LIMIT 6`,
    )
    .all(`%${destinationName.split('+')[0].trim()}%`) as Array<Record<string, unknown>>
}

function fallbackPlan(input: AgentRequest, trace: AgentTrace[]): AgentPlan {
  const prompt = `${input.prompt} ${Object.values(input.context ?? {}).join(' ')}`
  const lower = prompt.toLowerCase()
  const selectedDestination = lower.includes('bali')
    ? 'Bali'
    : lower.includes('johor') || lower.includes('bahru') || lower.includes('jb')
      ? 'Johor Bahru'
      : lower.includes('seoul')
      ? 'Seoul'
      : lower.includes('nature') || lower.includes('road')
        ? 'Queenstown'
        : lower.includes('family') || lower.includes('warm')
          ? 'Lisbon'
          : 'Tokyo'

  trace.push({
    name: 'model_reasoning',
    label: 'Fallback planner',
    status: 'fallback',
    result: 'No model response was available, so the local planner used deterministic intent ranking.',
  })

  return {
    assistantMessage: `I treated this like an agent task: captured your constraints, ranked destinations, checked seeded offers, and saved a ${selectedDestination} plan you can refine.`,
    selectedDestination,
    origin: input.context?.whereFrom || 'Singapore',
    travelerType: input.context?.who || 'couple',
    budgetLevel: input.context?.budgetLevel || 'mid',
    pace: input.context?.pace || 'balanced',
    tripTitle:
      selectedDestination === 'Johor Bahru'
        ? '2-Day Solo Johor Bahru Budget Escape'
        : `${selectedDestination} agent-built plan`,
    itineraryFocus:
      selectedDestination === 'Johor Bahru'
        ? ['Singapore land route', 'budget overnight stay', 'local cafes and activities']
        : ['constraint fit', 'route realism', 'booking handoff readiness'],
    confidence: selectedDestination === 'Johor Bahru' ? 88 : 78,
  }
}

function extractResponseText(body: Record<string, unknown>) {
  if (typeof body.output_text === 'string') return body.output_text
  const output = Array.isArray(body.output) ? body.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : []
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text
      }
    }
  }
  return ''
}

function inferPatch(message: string, current: AgentContext = {}): Required<AgentContext> {
  const lower = message.toLowerCase()
  const patch: Required<AgentContext> = {
    whereTo: '',
    whereFrom: '',
    who: '',
    when: '',
    intent: '',
    budgetLevel: '',
    pace: '',
  }

  if (!current.whereTo?.trim()) {
    if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('kyoto')) patch.whereTo = 'Tokyo + Kyoto'
    if (lower.includes('johor') || lower.includes('bahru') || lower.includes('jb')) patch.whereTo = 'Johor Bahru'
    if (lower.includes('bali')) patch.whereTo = 'Bali'
  }
  if (lower.includes('seoul') || lower.includes('korea')) patch.whereTo = 'Seoul'
  if (lower.includes('queenstown') || lower.includes('new zealand') || lower.includes('road trip')) patch.whereTo = 'Queenstown'
  if (lower.includes('lisbon') || lower.includes('portugal')) patch.whereTo = 'Lisbon'
  if (/\bfrom\s+singapore\b/i.test(lower) || (current.whereTo?.trim() && lower.includes('singapore') && !lower.includes('johor'))) {
    patch.whereFrom = 'Singapore'
  }
  if (/\bfrom\s+kuala lumpur\b/i.test(lower) || /\bfrom\s+kl\b/i.test(lower)) patch.whereFrom = 'Kuala Lumpur'
  if (/\bfrom\s+bangkok\b/i.test(lower)) patch.whereFrom = 'Bangkok'
  if (lower.includes('budget') || lower.includes('cheap')) patch.budgetLevel = 'budget'
  if (lower.includes('mid')) patch.budgetLevel = 'mid'
  if (lower.includes('premium') || lower.includes('luxury')) patch.budgetLevel = 'premium'
  if (lower.includes('family') || lower.includes('kids')) patch.who = 'family'
  if (lower.includes('friend') || lower.includes('group')) patch.who = 'friends'
  if (lower.includes('solo')) patch.who = 'solo'
  if (lower.includes('two') || lower.includes('couple')) patch.who = 'couple'
  if (lower.includes('slow') || lower.includes('minimal walking')) patch.pace = 'slow'
  if (lower.includes('balanced')) patch.pace = 'balanced'
  if (lower.includes('fast') || lower.includes('crazy') || lower.includes('adventure')) patch.pace = 'fast'
  const trimmedMessage = message.trim()
  if (!isDateRefinementRequest(trimmedMessage)) {
    const normalizedWhen = normalizeDateWindow(trimmedMessage)
    if (normalizedWhen) patch.when = normalizedWhen
  }
  if (lower.includes('food')) patch.intent = 'Food and culture'
  if (lower.includes('nature') || lower.includes('adventure')) patch.intent = 'Nature adventure'
  if (lower.includes('wellness') || lower.includes('beach')) patch.intent = 'Wellness and beach'
  if (lower.includes('minimal walking')) patch.intent = 'Low walking family plan'
  if (lower.includes('relax') || lower.includes('local activit') || lower.includes('cafe')) patch.intent = 'Relaxation and local activities'

  if (!patch.whereFrom && current.whereFrom) patch.whereFrom = current.whereFrom
  if (!patch.budgetLevel && current.budgetLevel) patch.budgetLevel = current.budgetLevel
  if (!patch.pace && current.pace) patch.pace = current.pace
  return patch
}

function mergedContext(context: AgentContext = {}, patch: AgentContext = {}) {
  return {
    whereTo: patch.whereTo || context.whereTo || '',
    whereFrom: patch.whereFrom || context.whereFrom || '',
    who: patch.who || context.who || '',
    when: patch.when || context.when || '',
    intent: patch.intent || context.intent || '',
    budgetLevel: patch.budgetLevel || context.budgetLevel || '',
    pace: patch.pace || context.pace || '',
  }
}

const captureOrder: Array<keyof AgentContext> = ['whereTo', 'when', 'who', 'intent', 'whereFrom']

function capturedFields(context: Required<AgentContext>) {
  return captureOrder.filter((key) => isValidCapturedValue(key, context[key]))
}

function missingFields(context: Required<AgentContext>) {
  return captureOrder.filter((key) => !context[key])
}

function coalesceField(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value?.trim()) return value.trim()
  }
  return ''
}

function coalesceWhenField(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value ? normalizeDateWindow(value) : ''
    if (normalized) return normalized
  }
  return ''
}

function combineContextPatch(
  message: string,
  current: AgentContext = {},
  modelPatch: AgentContext = {},
  options?: { skipWhenInfer?: boolean },
) {
  const inferred = inferPatch(message, current)
  const refiningDates = options?.skipWhenInfer ?? isDateRefinementRequest(message)
  const explicitDate = looksLikeDateWindow(message.trim())

  let safeModelPatch = { ...modelPatch }
  if (current.whereTo?.trim() && modelPatch.whereTo && mentionsDifferentDestination(message, current.whereTo)) {
    safeModelPatch.whereTo = ''
  }
  if (safeModelPatch.who && (looksLikeDateWindow(safeModelPatch.who) || looksLikeVagueDateHint(safeModelPatch.who))) {
    if (!coalesceWhenField(safeModelPatch.when, current.when)) safeModelPatch.when = safeModelPatch.who
    safeModelPatch.who = ''
  }
  if (safeModelPatch.when) {
    const normalizedModelWhen = normalizeDateWindow(safeModelPatch.when)
    safeModelPatch.when = normalizedModelWhen || ''
  }
  if (safeModelPatch.whereFrom && !looksLikeOriginAnswer(safeModelPatch.whereFrom)) {
    safeModelPatch.whereFrom = ''
  }
  if (safeModelPatch.when && inferFieldFromValue(safeModelPatch.when) === 'who') {
    safeModelPatch.when = ''
  }

  const whenValue = refiningDates
    ? coalesceWhenField(explicitDate ? safeModelPatch.when : undefined, explicitDate ? inferred.when : undefined, current.when)
    : coalesceWhenField(safeModelPatch.when, inferred.when, current.when)

  const interim = {
    whereTo: current.whereTo?.trim() ? current.whereTo : coalesceField(safeModelPatch.whereTo, inferred.whereTo),
    whereFrom: '',
    who: coalesceField(safeModelPatch.who, inferred.who, current.who),
    when: whenValue,
    intent: coalesceField(safeModelPatch.intent, inferred.intent, current.intent),
    budgetLevel: coalesceField(safeModelPatch.budgetLevel, inferred.budgetLevel, current.budgetLevel),
    pace: coalesceField(safeModelPatch.pace, inferred.pace, current.pace),
  }
  const whereFromValue = coalesceField(safeModelPatch.whereFrom, inferred.whereFrom, current.whereFrom)

  return gateContextPatch(
    preserveValidatedChecklistFields(current, {
      whereTo: interim.whereTo,
      whereFrom: whereFromValue,
      who: interim.who,
      when: interim.when,
      intent: interim.intent,
      budgetLevel: interim.budgetLevel,
      pace: interim.pace,
    }),
    current,
  )
}

const fieldSuggestions: Record<Exclude<AgentChatTurn['activeField'], 'when'>, string[]> = {
  whereTo: ['Johor Bahru', 'Bali', 'Tokyo + Kyoto'],
  whereFrom: ['Singapore', 'Kuala Lumpur', 'Bangkok'],
  who: ['Solo trip', 'With family', 'Couple trip'],
  intent: ['Relaxation and local activities', 'Cafe hopping', 'Food and shopping'],
}

const LAYLA_CHAT_SYSTEM_PROMPT = `You are Layla, a warm concise AI travel-agent. Infer what the user means from their message and the conversation phase — do not rely on keyword matching alone.

Checklist order (when phase is checklist): whereTo → whereFrom → when → who → intent.
- whereTo locks after capture. Vague when ("This weekend") is NOT captured — offer concrete Sat–Sun date pills until they pick real dates.
- whereFrom: confirm suggestedOrigin or another city; only set contextPatch.whereFrom when they confirm.

messageIntent (REQUIRED — classify the user's latest message):
- checklist_step: answering the current checklist field (focusField).
- add_activity: optional extra activity after essentials are captured (e.g. "night markets", "spa") — NOT departure city, NOT dates, NOT "good to go".
- confirm_trip: user wants to build the trip ("good to go", "confirm", "let's go", "I'm good", "build it").
- change_checklist: user wants to revise a captured field (e.g. change dates).
- clarify: unclear or off-topic.

Rules:
- activeField and suggestionField: what you are asking about NOW; pills must match suggestionField only.
- addActivities: non-empty only when messageIntent is add_activity (labels to append).
- contextPatch: only fields the user clearly provided this turn; empty string otherwise.
- shouldFinish true when messageIntent is confirm_trip OR all 5 essentials are captured and user is done.
- conversationPhase in the request tells you if they are still on checklist, picking activities, or at summary.
- Keep assistantMessage under 70 words. No full itinerary in chat.`

function resolveSuggestedReplies(
  merged: Required<AgentContext>,
  activeField: AgentChatTurn['activeField'],
  turn: AgentChatTurn,
  shouldFinish: boolean,
  preferModel = false,
  userMessage = '',
) {
  if (shouldFinish) return []

  if (activeField === 'when') {
    const concreteModelPills = turn.suggestedReplies.filter((item) => looksLikeDateWindow(item))
    if (concreteModelPills.length >= 2) return concreteModelPills.slice(0, 4)
    const preference = looksLikeVagueDateHint(userMessage) ? userMessage : undefined
    return recommendWhenWindowsForPreference(preference, merged)
  }

  if (activeField === 'whereFrom') {
    const origin = inferDefaultOrigin()
    const originPills = turn.suggestedReplies.filter((item) => looksLikeOriginAnswer(item))
    if (originPills.length >= 2) return originPills.slice(0, 4)
    return [origin, 'Kuala Lumpur', 'Bangkok', 'Jakarta'].filter(
      (city, index, list) => list.findIndex((item) => item.toLowerCase() === city.toLowerCase()) === index,
    )
  }

  if (preferModel && turn.suggestedReplies.length >= 2) {
    return turn.suggestedReplies.slice(0, 4)
  }

  if (turn.suggestedReplies.length >= 2) {
    return turn.suggestedReplies.slice(0, 4)
  }

  return fieldSuggestions[activeField as Exclude<AgentChatTurn['activeField'], 'when'>] ?? []
}

function destinationHintForContext(context: AgentContext = {}) {
  const needle = (context.whereTo ?? '').toLowerCase()
  if (!needle) return null
  return (
    destinationsForAgent().find((row) => String(row.name ?? '').toLowerCase().includes(needle.split(',')[0] ?? needle)) ??
    null
  )
}

function sanitizeModelPatch(modelPatch: AgentContext, message: string): Required<AgentContext> {
  const patch: Required<AgentContext> = { ...emptyContextPatch(), ...modelPatch }
  if (patch.when) {
    const normalized = normalizeDateWindow(patch.when) || normalizeDateWindow(message)
    patch.when = normalized || ''
  }
  if (patch.whereFrom && !looksLikeOriginAnswer(patch.whereFrom)) patch.whereFrom = ''
  if (patch.who && !isValidCapturedValue('who', patch.who)) patch.who = ''
  if (patch.intent && !isValidCapturedValue('intent', patch.intent)) patch.intent = ''
  return patch
}

function applyModelTurnPatch(input: AgentChatRequest, turn: AgentChatTurn) {
  const sanitized = sanitizeModelPatch(turn.contextPatch, input.message)
  return gateContextPatch(preserveValidatedChecklistFields(input.context ?? {}, sanitized), input.context ?? {})
}

function fieldCorrectionMessage(field: AgentChatTurn['activeField'], merged: Required<AgentContext>) {
  const destination = merged.whereTo || 'your destination'
  if (field === 'when') {
    return `Got it — let's lock exact dates for ${destination}. Pick a weekend window or tell me how to narrow it.`
  }
  if (field === 'whereFrom') return `Where will you be travelling from for ${destination}?`
  if (field === 'who') return `Who's joining you in ${destination}?`
  if (field === 'intent') return `What would make this ${destination} trip feel like yours?`
  return `Let's finish ${field} first.`
}

function finalizeChatTurn(input: AgentChatRequest, turn: AgentChatTurn, preferModel = false) {
  const combinedPatch = preferModel
    ? applyModelTurnPatch(input, turn)
    : combineContextPatch(input.message, input.context, turn.contextPatch, {
        skipWhenInfer: isDateRefinementRequest(input.message),
      })
  const merged = sanitizeChecklistContext(mergedContext(input.context, combinedPatch) as Required<AgentContext>)

  let activeField = turn.activeField
  let suggestionField = turn.suggestionField ?? turn.activeField
  let messageIntent = turn.messageIntent
  let shouldFinish = turn.shouldFinish
  let addActivities = turn.addActivities ?? []
  let assistantMessage = turn.assistantMessage

  if (preferModel) {
    if (messageIntent === 'confirm_trip') shouldFinish = departurePrerequisitesMet(merged)
    if (messageIntent === 'add_activity') {
      activeField = 'intent'
      suggestionField = 'intent'
      shouldFinish = false
      if (addActivities.length === 0 && input.message.trim()) addActivities = [input.message.trim()]
    }
    if (messageIntent === 'checklist_step' || messageIntent === 'change_checklist') {
      const clean = sanitizeChecklistContext(merged)
      const required = currentRequiredField(clean)
      if (isDateRefinementRequest(input.message) && canFocusField('when', clean)) {
        activeField = 'when'
        suggestionField = 'when'
        if (turn.activeField !== 'when') assistantMessage = fieldCorrectionMessage('when', merged)
      } else if (!canFocusField(activeField, clean)) {
        activeField = required
        suggestionField = required
        assistantMessage = fieldCorrectionMessage(required, merged)
      }
    }
  } else {
    const activityMode = isActivityPickMessage(input.message, sanitizeChecklistContext(input.context ?? {}))
    activeField = resolveFocusField(input.message, merged, input.focusField, { activityMode })
    suggestionField = suggestFieldForReplies(turn.suggestedReplies, activeField)
    messageIntent = isTripConfirmationMessage(input.message)
      ? 'confirm_trip'
      : activityMode
        ? 'add_activity'
        : 'checklist_step'
    shouldFinish = capturedFields(merged).length >= 5 || messageIntent === 'confirm_trip'
  }

  const suggestions = resolveSuggestedReplies(merged, activeField, turn, shouldFinish, preferModel, input.message)
  if (!preferModel) suggestionField = suggestFieldForReplies(suggestions, activeField)

  return {
    assistantMessage,
    contextPatch: combinedPatch,
    activeField,
    suggestionField,
    messageIntent,
    addActivities,
    suggestedReplies: suggestions,
    shouldFinish,
    confidence: turn.confidence,
  }
}

function fallbackChat(input: AgentChatRequest, trace: AgentTrace[]): AgentChatTurn {
  const patch = combineContextPatch(input.message, input.context, inferPatch(input.message, input.context), {
    skipWhenInfer: isDateRefinementRequest(input.message),
  })
  const merged = mergedContext(input.context, patch) as Required<AgentContext>
  const activityMode = isActivityPickMessage(input.message, sanitizeChecklistContext(input.context ?? {}))
  const activeField = resolveFocusField(input.message, merged, input.focusField, { activityMode })
  const captured = capturedFields(merged).length
  trace.push({
    name: 'fallback_chat',
    label: 'Fallback chat',
    status: 'fallback',
    result: 'No model response was available, so the local parser updated the trip checklist.',
  })

  const assistantMessage =
    captured >= 5
      ? `I have the essentials: ${merged.whereTo} from ${merged.whereFrom}, ${merged.when}, for ${merged.who}, focused on ${merged.intent}. I can finish the trip now or tune the style first.`
      : `Got it. I captured ${captured} of 5 essentials. Next I need ${activeField === 'whereTo' ? 'where you want to go' : activeField === 'who' ? "who's coming" : activeField === 'when' ? "when you'd go" : 'what would make the trip yours'}.`

  const messageIntent: ChatMessageIntent = isTripConfirmationMessage(input.message)
    ? 'confirm_trip'
    : activityMode
      ? 'add_activity'
      : 'checklist_step'

  return {
    assistantMessage,
    contextPatch: patch,
    activeField,
    suggestionField: activeField,
    messageIntent,
    addActivities: messageIntent === 'add_activity' ? [input.message.trim()] : [],
    suggestedReplies:
      activeField === 'when'
        ? recommendWhenWindowsForPreference(
            looksLikeVagueDateHint(input.message) ? input.message : undefined,
            merged,
          )
        : activeField === 'whereTo'
          ? ['Tokyo + Kyoto', 'Bali', 'Surprise me under $1.5k']
          : activeField === 'who'
            ? ['Couple trip', 'Friends group', 'Family with kids']
            : ['Food and culture', 'Nature adventure', 'Low walking family plan'],
    shouldFinish: captured >= 5,
    confidence: 70,
  }
}

const intentSuggestionPool = [
  'Eat & café-hop',
  'Relax & unwind',
  'Shopping + markets',
  'Culture & heritage',
  'Night food crawl',
  'Nature & photo spots',
  'Wellness & spa',
  'Family-friendly fun',
  'Adventure & outdoors',
  'Hidden local gems',
]

function emptyContextPatch(): Required<AgentContext> {
  return {
    whereTo: '',
    whereFrom: '',
    who: '',
    when: '',
    intent: '',
    budgetLevel: '',
    pace: '',
  }
}

function freshSuggestionsFromPool(pool: string[], exclude: string[], count = 3) {
  const blocked = new Set(exclude.map((value) => value.trim().toLowerCase()))
  const fresh = pool.filter((option) => {
    const lower = option.toLowerCase()
    return ![...blocked].some((blockedValue) => lower.includes(blockedValue) || blockedValue.includes(lower))
  })
  if (fresh.length >= count) return fresh.slice(0, count)
  return [...fresh, ...pool.filter((option) => !fresh.includes(option))].slice(0, count)
}

function fallbackMoreSuggestions(input: AgentChatRequest, trace: AgentTrace[]): AgentChatTurn {
  const field = input.moreSuggestions?.field ?? 'intent'
  const exclude = input.moreSuggestions?.exclude ?? []
  trace.push({
    name: 'more_suggestions_fallback',
    label: 'More suggestions',
    status: 'fallback',
    result: `Returned alternate ${field} pills without repeating prior options.`,
  })

  const pool =
    field === 'when'
      ? recommendWhenWindows(input.context ?? {})
      : field === 'who'
        ? ['Solo trip', 'Couple trip', 'Family with kids', 'Friends group', 'Multi-gen family']
        : field === 'whereTo'
          ? ['Johor Bahru', 'Bali', 'Tokyo + Kyoto', 'Seoul', 'Queenstown']
          : field === 'whereFrom'
            ? ['Singapore', 'Kuala Lumpur', 'Bangkok', 'Jakarta']
            : intentSuggestionPool

  return {
    assistantMessage: 'Here are a few more ideas to choose from:',
    contextPatch: emptyContextPatch(),
    activeField: field,
    suggestedReplies: freshSuggestionsFromPool(pool, exclude, 3),
    shouldFinish: false,
    confidence: 72,
  }
}

async function callMoreSuggestionsModel(input: AgentChatRequest, trace: AgentTrace[]): Promise<AgentChatTurn | null> {
  const apiKey = process.env.OPENAI_API_KEY
  const more = input.moreSuggestions
  if (!apiKey || !more) return null

  const model = process.env.OPENAI_MODEL || 'gpt-5.2'
  trace.push({
    name: 'model_more_suggestions',
    label: 'More suggestions',
    status: 'complete',
    result: `Requesting fresh ${more.field} pills from the chat model.`,
  })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are Layla, a warm concise AI travel-agent. The user is adding trip activities and may stop before 5. Return ONLY fresh alternative pills for the requested field. Do not change captured checklist values. contextPatch must use empty strings for every field. assistantMessage is one short inviting line (under 20 words). For intent/activities: suggestedReplies must contain exactly 3 distinct options, max 42 chars each, must not repeat excluded options. For other fields: exactly 3 options.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            mode: 'more_suggestions',
            field: more.field,
            exclude: more.exclude,
            currentContext: input.context ?? {},
            capturedFields: capturedFields(mergedContext(input.context ?? {}, {}) as Required<AgentContext>),
            destinationHint: destinationHintForContext(input.context),
            recentHistory: (input.history ?? []).slice(-6),
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'travel_agent_more_suggestions',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['assistantMessage', 'contextPatch', 'activeField', 'suggestedReplies', 'shouldFinish', 'confidence'],
            properties: {
              assistantMessage: { type: 'string' },
              contextPatch: {
                type: 'object',
                additionalProperties: false,
                required: ['whereTo', 'whereFrom', 'who', 'when', 'intent', 'budgetLevel', 'pace'],
                properties: {
                  whereTo: { type: 'string' },
                  whereFrom: { type: 'string' },
                  who: { type: 'string' },
                  when: { type: 'string' },
                  intent: { type: 'string' },
                  budgetLevel: { type: 'string' },
                  pace: { type: 'string' },
                },
              },
              activeField: { type: 'string', enum: ['whereTo', 'whereFrom', 'who', 'when', 'intent'] },
              suggestedReplies: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'string', maxLength: 56 },
              },
              shouldFinish: { type: 'boolean' },
              confidence: { type: 'number' },
            },
          },
        },
      },
    }),
  })

  if (!response.ok) return null
  const body = (await response.json()) as Record<string, unknown>
  const text = extractResponseText(body)
  if (!text) return null
  try {
    return JSON.parse(text) as AgentChatTurn
  } catch {
    return null
  }
}

async function callChatModel(input: AgentChatRequest, trace: AgentTrace[]): Promise<AgentChatTurn | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const destinations = destinationsForAgent()
  const model = process.env.OPENAI_MODEL || 'gpt-5.2'
  trace.push({
    name: 'model_chat_call',
    label: 'Call chat model',
    status: 'complete',
    result: 'Using configured OpenAI model for this chat turn.',
  })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: LAYLA_CHAT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({
            userMessage: input.message,
            currentContext: input.context ?? {},
            capturedFields: capturedFields(mergedContext(input.context ?? {}, {}) as Required<AgentContext>),
            missingFields: missingFields(mergedContext(input.context ?? {}, {}) as Required<AgentContext>),
            departurePrerequisitesMet: departurePrerequisitesMet(input.context ?? {}),
            suggestedOrigin: inferDefaultOrigin(),
            focusField: resolveFocusField(
              input.message,
              mergedContext(input.context ?? {}, {}) as Required<AgentContext>,
              input.focusField,
            ),
            conversationPhase: conversationPhase(input.context ?? {}, {
              hasSummaryActions: (input.history ?? []).some((entry) =>
                /confirm summary|change dates|add more activities/i.test(entry.content),
              ),
            }),
            today: new Date().toISOString().slice(0, 10),
            destinationHint: destinationHintForContext(input.context),
            recentHistory: (input.history ?? []).slice(-8),
            destinationInventory: destinations,
            checklistOrder: captureOrder,
            instruction:
              'Classify messageIntent from user meaning and conversationPhase. Trust your inference — do not treat confirmations as activities or cities as activities.',
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'travel_agent_chat_turn',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'assistantMessage',
              'contextPatch',
              'activeField',
              'suggestionField',
              'messageIntent',
              'addActivities',
              'suggestedReplies',
              'shouldFinish',
              'confidence',
            ],
            properties: {
              assistantMessage: { type: 'string' },
              contextPatch: {
                type: 'object',
                additionalProperties: false,
                required: ['whereTo', 'whereFrom', 'who', 'when', 'intent', 'budgetLevel', 'pace'],
                properties: {
                  whereTo: { type: 'string' },
                  whereFrom: { type: 'string' },
                  who: { type: 'string' },
                  when: { type: 'string' },
                  intent: { type: 'string' },
                  budgetLevel: { type: 'string' },
                  pace: { type: 'string' },
                },
              },
              activeField: { type: 'string', enum: ['whereTo', 'whereFrom', 'who', 'when', 'intent'] },
              suggestionField: { type: 'string', enum: ['whereTo', 'whereFrom', 'who', 'when', 'intent'] },
              messageIntent: {
                type: 'string',
                enum: ['checklist_step', 'add_activity', 'confirm_trip', 'change_checklist', 'clarify'],
              },
              addActivities: {
                type: 'array',
                items: { type: 'string', maxLength: 80 },
              },
              suggestedReplies: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: { type: 'string', maxLength: 56 },
              },
              shouldFinish: { type: 'boolean' },
              confidence: { type: 'number' },
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    trace.push({
      name: 'model_chat_call',
      label: 'Chat model unavailable',
      status: 'fallback',
      result: `OpenAI returned ${response.status}; used local chat fallback.`,
    })
    return null
  }

  const body = (await response.json()) as Record<string, unknown>
  const text = extractResponseText(body)
  if (!text) return null
  try {
    return normalizeAgentTurn(JSON.parse(text) as AgentChatTurn)
  } catch {
    trace.push({
      name: 'parse_chat_turn',
      label: 'Parse chat output',
      status: 'fallback',
      result: 'Model chat output was not parseable JSON; used local chat fallback.',
    })
    return null
  }
}

function normalizeAgentTurn(raw: AgentChatTurn): AgentChatTurn {
  return {
    assistantMessage: raw.assistantMessage,
    contextPatch: { ...emptyContextPatch(), ...raw.contextPatch },
    activeField: raw.activeField ?? 'whereTo',
    suggestionField: raw.suggestionField ?? raw.activeField ?? 'whereTo',
    messageIntent: raw.messageIntent ?? 'checklist_step',
    addActivities: raw.addActivities ?? [],
    suggestedReplies: raw.suggestedReplies ?? [],
    shouldFinish: raw.shouldFinish ?? false,
    confidence: raw.confidence ?? 80,
  }
}

export async function runTravelChat(input: AgentChatRequest) {
  const trace: AgentTrace[] = [
    {
      name: 'read_chat_state',
      label: 'Read chat state',
      status: 'complete',
      result: 'Loaded current message, checklist context, and recent chat history.',
    },
    {
      name: 'search_destinations',
      label: 'Search destination inventory',
      status: 'complete',
      result: `Made ${destinationsForAgent().length} seeded destinations available to the chat agent.`,
    },
  ]

  if (input.moreSuggestions) {
    const modelTurn = await callMoreSuggestionsModel(input, trace)
    const rawTurn = modelTurn ?? fallbackMoreSuggestions(input, trace)
    const merged = mergedContext(input.context, {}) as Required<AgentContext>
    const field = input.moreSuggestions.field
    const suggestions = freshSuggestionsFromPool(
      rawTurn.suggestedReplies.length ? rawTurn.suggestedReplies : intentSuggestionPool,
      input.moreSuggestions.exclude,
      3,
    )

    return {
      mode: modelTurn ? 'model' : 'fallback',
      assistantMessage: compactAssistantMessage(rawTurn.assistantMessage || 'Here are a few more ideas:'),
      contextPatch: mergedContext(input.context, emptyContextPatch()),
      activeField: field,
      suggestedReplies: suggestions,
      shouldFinish: false,
      confidence: normalizeConfidence(rawTurn.confidence),
      trace,
    }
  }

  const baseContext = mergedContext(input.context ?? {}, {}) as Required<AgentContext>
  if (baseContext.whereTo && mentionsDifferentDestination(input.message, baseContext.whereTo)) {
    const focus = resolveFocusField(input.message, baseContext, input.focusField)
    trace.push({
      name: 'destination_locked',
      label: 'Destination locked',
      status: 'complete',
      result: 'User mentioned a different destination; this chat stays on the original trip.',
    })
    return {
      mode: 'fallback',
      assistantMessage: compactAssistantMessage(
        `This chat is locked to ${baseContext.whereTo}. To plan a different destination, tap + for a new trip.`,
      ),
      contextPatch: emptyContextPatch(),
      activeField: focus === 'whereTo' ? 'when' : focus,
      suggestionField: focus === 'whereTo' ? 'when' : focus,
      messageIntent: 'clarify',
      addActivities: [],
      suggestedReplies: [],
      shouldFinish: false,
      confidence: 82,
      trace,
    }
  }

  const modelTurn = await callChatModel(input, trace)
  const rawTurn = modelTurn ?? fallbackChat(input, trace)
  const turn = finalizeChatTurn(input, rawTurn, Boolean(modelTurn))
  const merged = mergedContext(input.context, turn.contextPatch)
  trace.push({
    name: 'update_checklist',
    label: 'Update trip checklist',
    status: 'complete',
    result: `Checklist now has ${capturedFields(merged as Required<AgentContext>).length} of 5 essentials.`,
  })

  return {
    mode: modelTurn ? 'model' : 'fallback',
    assistantMessage: compactAssistantMessage(turn.assistantMessage),
    contextPatch: turn.contextPatch,
    activeField: turn.activeField,
    suggestionField: turn.suggestionField,
    messageIntent: turn.messageIntent,
    addActivities: turn.addActivities,
    suggestedReplies: turn.suggestedReplies,
    shouldFinish: turn.shouldFinish,
    confidence: normalizeConfidence(turn.confidence),
    trace,
  }
}

async function callPlannerModel(input: AgentRequest, trace: AgentTrace[]): Promise<AgentPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const destinations = destinationsForAgent()
  const model = process.env.OPENAI_MODEL || 'gpt-5.2'
  trace.push({
    name: 'model_call',
    label: 'Call planning model',
    status: 'complete',
    result: `Using configured OpenAI model to produce structured travel-agent output.`,
  })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'You are a concise agentic AI travel planner. Convert user intent into a practical trip plan using only the provided destination inventory. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            userPrompt: input.prompt,
            capturedContext: input.context ?? {},
            destinations,
            instruction:
              'Pick the best destination, infer missing fields safely, and return a high-signal travel-agent response. Do not claim live prices.',
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'travel_agent_plan',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'assistantMessage',
              'selectedDestination',
              'origin',
              'travelerType',
              'budgetLevel',
              'pace',
              'tripTitle',
              'itineraryFocus',
              'confidence',
            ],
            properties: {
              assistantMessage: { type: 'string' },
              selectedDestination: { type: 'string' },
              origin: { type: 'string' },
              travelerType: { type: 'string' },
              budgetLevel: { type: 'string', enum: ['budget', 'mid', 'premium'] },
              pace: { type: 'string', enum: ['slow', 'balanced', 'fast'] },
              tripTitle: { type: 'string' },
              itineraryFocus: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: { type: 'string' },
              },
              confidence: { type: 'number' },
            },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    trace.push({
      name: 'model_call',
      label: 'Model unavailable',
      status: 'fallback',
      result: `OpenAI returned ${response.status}; used local agent fallback.`,
    })
    return null
  }

  const body = (await response.json()) as Record<string, unknown>
  const text = extractResponseText(body)
  if (!text) return null
  try {
    return JSON.parse(text) as AgentPlan
  } catch {
    trace.push({
      name: 'parse_model_plan',
      label: 'Parse model output',
      status: 'fallback',
      result: 'Model output was not parseable JSON; used local agent fallback.',
    })
    return null
  }
}

export async function runTravelAgent(input: AgentRequest) {
  const trace: AgentTrace[] = [
    {
      name: 'parse_trip_intent',
      label: 'Parse trip intent',
      status: 'complete',
      result: 'Captured destination, origin, traveler type, timing, budget, pace, and trip intent from the chat state.',
    },
    {
      name: 'search_destinations',
      label: 'Search destination inventory',
      status: 'complete',
      result: `Checked ${destinationsForAgent().length} seeded destinations in SQLite.`,
    },
  ]

  const modelPlan = await callPlannerModel(input, trace)
  const plan = modelPlan ?? fallbackPlan(input, trace)
  const offers = offersForDestination(plan.selectedDestination)

  trace.push({
    name: 'rank_options',
    label: 'Rank options',
    status: 'complete',
    result: `Selected ${plan.selectedDestination} with ${normalizeConfidence(plan.confidence)}% confidence based on constraints and seeded destination fit.`,
  })
  trace.push({
    name: 'scan_offers',
    label: 'Scan offer cards',
    status: 'complete',
    result:
      offers.length > 0
        ? `Found ${offers.length} simulated flight, hotel, and activity cards for handoff.`
        : 'No pre-seeded offers matched exactly; the save tool will synthesize demo flight, hotel, and activity cards.',
  })

  const tripId = createGeneratedTrip({
    prompt: `${plan.tripTitle}. ${plan.assistantMessage}. Focus: ${plan.itineraryFocus.join(', ')}. Original user ask: ${
      input.prompt
    }`,
    origin: plan.origin,
    budgetLevel: plan.budgetLevel,
    travelerType: plan.travelerType,
    pace: plan.pace,
  })

  db.prepare('UPDATE trips SET title = ?, confidence = ?, updated_at = ? WHERE id = ?').run(
    plan.tripTitle,
    normalizeConfidence(plan.confidence),
    new Date().toISOString(),
    tripId,
  )
  db.prepare('INSERT INTO chat_messages (id, trip_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id('msg'),
    tripId,
    'assistant',
    plan.assistantMessage,
    new Date().toISOString(),
  )

  trace.push({
    name: 'save_trip',
    label: 'Save trip object',
    status: 'complete',
    result: `Persisted itinerary, messages, days, activities, and offers to SQLite as ${tripId}.`,
  })

  return {
    mode: modelPlan ? 'model' : 'fallback',
    assistantMessage: plan.assistantMessage,
    plan,
    trace,
    trip: getTripDetail(tripId),
  }
}
