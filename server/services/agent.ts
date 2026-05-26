import { recommendWhenWindows } from '../../shared/recommendWhen.js'
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

type AgentChatTurn = {
  assistantMessage: string
  contextPatch: Required<AgentContext>
  activeField: 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
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

  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('kyoto')) patch.whereTo = 'Tokyo + Kyoto'
  if (lower.includes('johor') || lower.includes('bahru') || lower.includes('jb')) patch.whereTo = 'Johor Bahru'
  if (lower.includes('bali')) patch.whereTo = 'Bali'
  if (lower.includes('seoul') || lower.includes('korea')) patch.whereTo = 'Seoul'
  if (lower.includes('queenstown') || lower.includes('new zealand') || lower.includes('road trip')) patch.whereTo = 'Queenstown'
  if (lower.includes('lisbon') || lower.includes('portugal')) patch.whereTo = 'Lisbon'
  if (lower.includes('singapore')) patch.whereFrom = 'Singapore'
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
  if (
    /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+\d{1,2}\s+[a-z]{3,}/i.test(trimmedMessage) ||
    /\d{1,2}\s+[a-z]{3,}\s*(?:[–—-]\s*|\s+to\s+)/i.test(trimmedMessage)
  ) {
    patch.when = trimmedMessage.length <= 56 ? trimmedMessage : trimmedMessage.slice(0, 56)
  } else if (/sat[^\w]*sun|sat\s*[–-]\s*sun|saturday.*sunday/i.test(message)) {
    patch.when = message.trim().length <= 42 ? message.trim() : 'Sat–Sun (this weekend)'
  } else if (lower.includes('sun-mon') || lower.includes('sun mon')) {
    patch.when = 'Sun–Mon'
  } else if (lower.includes('this month')) patch.when = 'This month'
  else if (lower.includes('next month')) patch.when = 'Next month'
  else if (lower.includes('last-minute') || lower.includes('weekend')) {
    patch.when = lower.includes('overnight') ? 'This weekend or next weekend, overnight stay' : 'This weekend or next weekend'
  }
  if (lower.includes('overnight') && !patch.when) patch.when = 'Overnight stay'
  if (lower.includes('5-day') || lower.includes('5 day')) patch.when = '5 days'
  if (lower.includes('food')) patch.intent = 'Food and culture'
  if (lower.includes('nature') || lower.includes('adventure')) patch.intent = 'Nature adventure'
  if (lower.includes('wellness') || lower.includes('beach')) patch.intent = 'Wellness and beach'
  if (lower.includes('minimal walking')) patch.intent = 'Low walking family plan'
  if (lower.includes('relax') || lower.includes('local activit') || lower.includes('cafe')) patch.intent = 'Relaxation and local activities'

  if (!patch.whereFrom && current.whereFrom) patch.whereFrom = current.whereFrom
  if (!patch.whereFrom && (current.whereTo?.toLowerCase().includes('johor') || patch.whereTo.toLowerCase().includes('johor')) && (patch.who || current.who) && (patch.when || current.when)) {
    patch.whereFrom = 'Singapore'
  }
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
  return captureOrder.filter((key) => Boolean(context[key]))
}

function missingFields(context: Required<AgentContext>) {
  return captureOrder.filter((key) => !context[key])
}

function nextField(context: Required<AgentContext>): AgentChatTurn['activeField'] {
  const missing = missingFields(context)
  return (missing[0] as AgentChatTurn['activeField'] | undefined) ?? 'whereFrom'
}

function combineContextPatch(message: string, current: AgentContext = {}, modelPatch: AgentContext = {}) {
  const inferred = inferPatch(message, current)
  return {
    whereTo: modelPatch.whereTo || inferred.whereTo,
    whereFrom: modelPatch.whereFrom || inferred.whereFrom,
    who: modelPatch.who || inferred.who,
    when: modelPatch.when || inferred.when,
    intent: modelPatch.intent || inferred.intent,
    budgetLevel: modelPatch.budgetLevel || inferred.budgetLevel,
    pace: modelPatch.pace || inferred.pace,
  }
}

const fieldSuggestions: Record<Exclude<AgentChatTurn['activeField'], 'when'>, string[]> = {
  whereTo: ['Johor Bahru', 'Bali', 'Tokyo + Kyoto'],
  whereFrom: ['Singapore', 'Kuala Lumpur', 'Bangkok'],
  who: ['Solo trip', 'With family', 'Couple trip'],
  intent: ['Relaxation and local activities', 'Cafe hopping', 'Food and shopping'],
}

function resolveSuggestedReplies(
  merged: Required<AgentContext>,
  activeField: AgentChatTurn['activeField'],
  turn: AgentChatTurn,
  shouldFinish: boolean,
) {
  if (shouldFinish) return []

  if (activeField === 'when') {
    if (turn.suggestedReplies.length >= 2) return turn.suggestedReplies.slice(0, 4)
    return recommendWhenWindows(merged)
  }

  if (turn.activeField === activeField && turn.suggestedReplies.length) {
    return turn.suggestedReplies
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

function finalizeChatTurn(input: AgentChatRequest, turn: AgentChatTurn) {
  const combinedPatch = combineContextPatch(input.message, input.context, turn.contextPatch)
  const merged = mergedContext(input.context, combinedPatch) as Required<AgentContext>
  const activeField = nextField(merged)
  const captured = capturedFields(merged).length
  const shouldFinish = captured >= 5
  const suggestions = resolveSuggestedReplies(merged, activeField, turn, shouldFinish)

  return {
    assistantMessage: turn.assistantMessage,
    contextPatch: combinedPatch,
    activeField,
    suggestedReplies: suggestions,
    shouldFinish,
    confidence: turn.confidence,
  }
}

function fallbackChat(input: AgentChatRequest, trace: AgentTrace[]): AgentChatTurn {
  const patch = inferPatch(input.message, input.context)
  const merged = mergedContext(input.context, patch)
  const activeField = nextField(merged)
  const captured = ['whereTo', 'whereFrom', 'who', 'when', 'intent'].filter((key) => Boolean(merged[key as keyof typeof merged])).length
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

  return {
    assistantMessage,
    contextPatch: patch,
    activeField,
    suggestedReplies:
      activeField === 'when'
        ? recommendWhenWindows(merged)
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
            'You are Layla, a warm concise AI travel-agent. The user tapped "Suggest more recommendations" — return ONLY fresh alternative pills for the requested field. Do not change captured checklist values. contextPatch must use empty strings for every field. assistantMessage is one short inviting line (under 20 words). suggestedReplies: exactly 3 options, max 42 chars each, must not repeat or paraphrase excluded options.',
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
          content:
            'You are Layla, a warm concise AI travel-agent. Collection chat must not produce a full itinerary; that only happens after the user confirms Finish. Keep assistantMessage under 70 words in one short paragraph. NEVER re-ask or re-clarify a checklist item that is already in capturedFields—acknowledge it briefly and ask only about the next missing field. Do not ask "Sat–Sun or Sun–Mon" if when is already captured. Update contextPatch with anything clearly stated in the latest user message. Set activeField to the first missing field. Return 1-4 short suggestedReplies for that activeField only. When activeField is "when", suggestedReplies MUST be 2-4 specific calendar windows with real dates (e.g. "Sat 31 May – Sun 1 Jun") tailored to whereTo, who, destinationSeason, and today—recommend the best windows in assistantMessage too; never use generic-only pills like "Next weekend" without dates. Never pretend live prices are guaranteed. Infer whereFrom as Singapore for Johor Bahru weekend trips from the region when plausible. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            userMessage: input.message,
            currentContext: input.context ?? {},
            capturedFields: capturedFields(mergedContext(input.context ?? {}, {}) as Required<AgentContext>),
            missingFields: missingFields(mergedContext(input.context ?? {}, {}) as Required<AgentContext>),
            today: new Date().toISOString().slice(0, 10),
            destinationHint: destinationHintForContext(input.context),
            recentHistory: (input.history ?? []).slice(-8),
            destinationInventory: destinations,
            instruction:
              'Infer only fields strongly supported by the message or inventory. Use empty strings for unknown contextPatch fields. If the user already answered a missing field in this message, fill contextPatch and move on. If asking about when, recommend concrete date windows in suggestedReplies.',
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
    return JSON.parse(text) as AgentChatTurn
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

  const modelTurn = await callChatModel(input, trace)
  const rawTurn = modelTurn ?? fallbackChat(input, trace)
  const turn = finalizeChatTurn(input, rawTurn)
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
