import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Loader2,
  MapPin,
  Mic,
  Paperclip,
  PlaneTakeoff,
  Plus,
  Send,
  UserRound,
  Users,
  Heart,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { recommendWhenWindows } from '../../../shared/recommendWhen'
import { api } from '../../lib/api'
import type { AgentChatResponse, AgentTrace, TripDetail } from '../../lib/types'

type FieldKey = 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
type Stage = 'collecting' | 'generating' | 'ready'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  suggestions?: string[]
  suggestionField?: FieldKey
  summaryActions?: boolean
}

const MAX_TRIP_ACTIVITIES = 5

type TripContext = {
  whereTo: string
  whereFrom: string
  who: string
  when: string
  intent: string
  activities: string[]
  budgetLevel: string
  pace: string
}

const emptyContext: TripContext = {
  whereTo: '',
  whereFrom: '',
  who: '',
  when: '',
  intent: '',
  activities: [],
  budgetLevel: 'mid',
  pace: 'balanced',
}

function normalizeActivityLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function ensureActivitiesFromIntent(context: TripContext): TripContext {
  if (context.activities.length > 0 || !context.intent) return context
  return { ...context, activities: [context.intent] }
}

function activitySlotsMessage(context: TripContext) {
  const ctx = ensureActivitiesFromIntent(context)
  const left = Math.max(0, MAX_TRIP_ACTIVITIES - ctx.activities.length)
  if (left === 0) {
    return `You've reached the ${MAX_TRIP_ACTIVITIES}-activity limit for this trip.`
  }
  return `You can add up to ${MAX_TRIP_ACTIVITIES} — stop whenever you're happy (${ctx.activities.length} picked, ${left} slot${left === 1 ? '' : 's'} left).`
}

function pickActivityOptions(context: TripContext, messages: ChatMessage[], fromModel: string[] = []) {
  const blocked = activityPickExclude(context, messages)
  const options: string[] = []

  for (const item of fromModel) {
    if (isActivityFlowLabel(item)) continue
    const lower = item.toLowerCase()
    if (blocked.has(lower)) continue
    if (!options.some((option) => option.toLowerCase() === lower)) options.push(item)
    if (options.length >= ACTIVITY_PICK_COUNT) break
  }

  for (const item of intentActivityPool) {
    if (options.length >= ACTIVITY_PICK_COUNT) break
    if (blocked.has(item.toLowerCase())) continue
    if (!options.some((option) => option.toLowerCase() === item.toLowerCase())) options.push(item)
  }

  return options
}

function buildActivityPickerSuggestions(context: TripContext, activityOptions: string[]) {
  const ctx = ensureActivitiesFromIntent(context)
  const suggestions: string[] = [ACTIVITY_IM_GOOD_LABEL, ...activityOptions]
  if (ctx.activities.length < MAX_TRIP_ACTIVITIES && activityOptions.length > 0) {
    suggestions.push(ACTIVITY_ADD_MORE_LABEL)
  }
  return suggestions
}

function activityPickerIntro(context: TripContext, justAdded?: string) {
  const ctx = ensureActivitiesFromIntent(context)
  if (justAdded) {
    return `Added "${justAdded}". ${activitySlotsMessage(ctx)} Pick another or tap "${ACTIVITY_IM_GOOD_LABEL}".`
  }
  return `Add what you'd like — tap "${ACTIVITY_IM_GOOD_LABEL}" when you're done. ${activitySlotsMessage(ctx)}`
}

function addTripActivity(
  context: TripContext,
  label: string,
): { context: TripContext; added: boolean; reason?: 'duplicate' | 'max' | 'empty' } {
  const clean = normalizeActivityLabel(label)
  if (!clean) return { context, added: false, reason: 'empty' }

  const base = ensureActivitiesFromIntent(context)
  const exists = base.activities.some((item) => item.toLowerCase() === clean.toLowerCase())
  if (exists) return { context: base, added: false, reason: 'duplicate' }

  if (base.activities.length >= MAX_TRIP_ACTIVITIES) {
    return { context: base, added: false, reason: 'max' }
  }

  const activities = [...base.activities, clean]
  return {
    context: {
      ...base,
      activities,
      intent: base.intent || clean,
    },
    added: true,
  }
}

const checklist: Array<{
  key: FieldKey
  label: string
  empty: string
  icon: typeof MapPin
}> = [
  { key: 'whereTo', label: 'Where to', empty: "I'll help pick or confirm the destination", icon: MapPin },
  { key: 'whereFrom', label: 'Where from', empty: "I'll ask where you're setting off from", icon: PlaneTakeoff },
  { key: 'who', label: "Who's coming", empty: "I'll ask who you're travelling with", icon: Users },
  { key: 'when', label: "When you'd go", empty: "I'll ask when you'd like to travel", icon: Calendar },
  { key: 'intent', label: "What you're after", empty: 'Tell me what would make this trip yours', icon: Heart },
]

const captureOrder: FieldKey[] = ['whereTo', 'when', 'who', 'intent', 'whereFrom']

const SUGGEST_MORE_LABEL = 'Suggest more recommendations...'
const ACTIVITY_IM_GOOD_LABEL = "I'm good"
const ACTIVITY_ADD_MORE_LABEL = 'Add more suggestions...'
const ACTIVITY_PICK_COUNT = 3

const fieldSuggestions: Record<Exclude<FieldKey, 'when'>, string[]> = {
  whereTo: ['Johor Bahru', 'Bali', 'Tokyo + Kyoto'],
  whereFrom: ['Singapore', 'Kuala Lumpur', 'Bangkok'],
  who: ['Solo trip', 'With family', 'Couple trip'],
  intent: ['Relaxation and local activities', 'Cafe hopping', 'Food and shopping'],
}

const intentActivityPool = [
  ...fieldSuggestions.intent,
  'Culture & heritage',
  'Night food crawl',
  'Hidden local gems',
  'Street food trail',
  'Nature & parks',
  'Shopping + markets',
  'Eat & café-hop',
]

const activityFlowLabels = new Set([ACTIVITY_IM_GOOD_LABEL, ACTIVITY_ADD_MORE_LABEL, SUGGEST_MORE_LABEL])

function isActivityFlowLabel(value: string) {
  return activityFlowLabels.has(value)
}

function activityPickExclude(context: TripContext, messages: ChatMessage[]) {
  const ctx = ensureActivitiesFromIntent(context)
  const blocked = new Set<string>()
  for (const item of [...ctx.activities, ctx.intent, ...collectExcludedSuggestions(messages, 'intent')]) {
    if (item) blocked.add(item.toLowerCase())
  }
  return blocked
}

function isActivityRefinementContext(context: TripContext) {
  return capturedCount(context) >= 5 && ensureActivitiesFromIntent(context).activities.length > 0
}

function withSuggestMoreChip(
  suggestions: string[],
  field: FieldKey,
  summaryActions?: boolean,
  context?: TripContext,
) {
  if (summaryActions || field !== 'intent') return suggestions
  const ctx = context ? ensureActivitiesFromIntent(context) : null
  if (ctx && isActivityRefinementContext(ctx)) {
    return suggestions.filter((suggestion) => suggestion !== SUGGEST_MORE_LABEL)
  }
  if (ctx && ctx.activities.length >= MAX_TRIP_ACTIVITIES) return suggestions.filter((s) => s !== SUGGEST_MORE_LABEL)
  const base = suggestions.filter((suggestion) => suggestion !== SUGGEST_MORE_LABEL)
  if (base.length === 0) return suggestions
  return [...base, SUGGEST_MORE_LABEL]
}

function collectExcludedSuggestions(messages: ChatMessage[], field: FieldKey) {
  const excluded = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'assistant' || message.suggestionField !== field || !message.suggestions?.length) continue
    for (const suggestion of message.suggestions) {
      if (!activityFlowLabels.has(suggestion)) excluded.add(suggestion)
    }
  }
  return [...excluded]
}

function resolveSuggestions(field: FieldKey, fromAgent: string[], context: TripContext) {
  if (field === 'when') {
    if (fromAgent.length >= 2) return fromAgent.slice(0, 4)
    return recommendWhenWindows(context)
  }
  if (fromAgent.length) return fromAgent
  return fieldSuggestions[field as Exclude<FieldKey, 'when'>] ?? []
}

const generationSteps = [
  'Optimizing your route, end to end',
  'Scanning 2000+ airlines for best value',
  'Reading review signals for you',
  'Finding hotels with demo-only deals',
  'Tailoring the plan to you',
]

function nextId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function assistantReplyDelay(content: string) {
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) return 120
  // Brief pause for local fallback replies only.
  return Math.min(900, 380 + Math.min(content.length, 140) * 3)
}

function mergeTripContext(context: TripContext, patch: Partial<TripContext>): TripContext {
  const merged: TripContext = {
    whereTo: patch.whereTo || context.whereTo,
    whereFrom: patch.whereFrom || context.whereFrom,
    who: patch.who || context.who,
    when: patch.when || context.when,
    intent: patch.intent || context.intent,
    activities: context.activities,
    budgetLevel: patch.budgetLevel || context.budgetLevel,
    pace: patch.pace || context.pace,
  }
  if (patch.activities?.length) {
    let next = merged
    for (const activity of patch.activities) {
      const result = addTripActivity(next, activity)
      next = result.context
    }
    return next
  }
  return merged
}

const summaryActionSuggestions = ['Confirm summary', 'Change dates', 'Add more activities'] as const
const summaryActionSet = new Set<string>(summaryActionSuggestions)

function isSummarySuggestionSet(suggestions: string[]) {
  return suggestions.length > 0 && suggestions.every((item) => summaryActionSet.has(item))
}

function buildSummaryAssistantMessage(context: TripContext): ChatMessage {
  return {
    id: nextId(),
    role: 'assistant',
    content: `Got it! A ${context.who?.toLowerCase() || 'solo'}, ${context.budgetLevel === 'budget' ? 'budget-friendly' : 'flexible'} trip shape. Here is the plan so far:\n\n${summaryPrompt(
      context,
    )
      .map((line) => `• ${line}`)
      .join('\n')}\n\nDoes this look like the perfect escape, or should we aim for next weekend instead? Once you confirm, I'll build your full trip card.`,
    suggestions: [...summaryActionSuggestions],
    summaryActions: true,
  }
}

function shouldReplaceDateClarification(merged: TripContext, content: string, nextField: FieldKey) {
  if (!merged.when || nextField === 'when') return false
  return /\b(sat|sun|weekend|date|when|mon)\b/i.test(content) && content.includes('?')
}

function forwardChecklistPrompt(merged: TripContext, nextField: FieldKey) {
  const label = checklist.find((item) => item.key === nextField)?.label.toLowerCase() ?? 'the next detail'
  return `Got it — ${merged.when} is locked in for ${displayValue(merged, 'whereTo')}. Last one: ${label}?`
}

function buildAssistantFromAgentResponse(result: AgentChatResponse, merged: TripContext): ChatMessage {
  const keepCollecting =
    result.suggestedReplies.length > 0 && !isSummarySuggestionSet(result.suggestedReplies)
  if ((capturedCount(merged) >= 5 || result.shouldFinish) && !keepCollecting) {
    return buildSummaryAssistantMessage(merged)
  }

  const field = nextMissingField(merged) ?? result.activeField
  const suggestions =
    result.mode === 'model' && result.suggestedReplies.length >= 2
      ? withSuggestMoreChip(result.suggestedReplies.slice(0, 4), field, false, merged)
      : resolveSuggestions(field, result.suggestedReplies, merged)
  const content = shouldReplaceDateClarification(merged, result.assistantMessage, field)
    ? forwardChecklistPrompt(merged, field)
    : result.assistantMessage

  return {
    id: nextId(),
    role: 'assistant',
    content,
    suggestions,
    suggestionField: field,
  }
}

function TypingIndicator() {
  return (
    <div className="layla-message assistant" aria-live="polite">
      <div className="layla-typing-indicator" role="status" aria-label="Layla is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function valueForField(context: TripContext, key: FieldKey) {
  return context[key]
}

function capturedCount(context: TripContext) {
  return checklist.filter((item) => Boolean(valueForField(context, item.key))).length
}

function nextMissingField(context: TripContext): FieldKey | null {
  return captureOrder.find((key) => !valueForField(context, key)) ?? null
}

function displayValue(context: TripContext, key: FieldKey) {
  const value = valueForField(context, key)
  if (!value) return ''
  if (key === 'whereTo' && value === 'Johor Bahru, Malaysia') return 'Johor Bahru'
  return value
}

function normalizeWho(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('family') || lower.includes('kid')) return 'Family'
  if (lower.includes('friend') || lower.includes('group')) return 'Friends'
  if (lower.includes('solo')) return 'Solo'
  if (lower.includes('couple') || lower.includes('two')) return 'Couple'
  return value
}

function looksLikeDateWindow(value: string) {
  return (
    /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+\d{1,2}\s+[a-z]{3,}/i.test(value) ||
    /\d{1,2}\s+[a-z]{3,}\s*(?:[–—-]\s*|\s+to\s+)/i.test(value) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(value)
  )
}

function normalizeWhen(value: string, current: string) {
  const trimmed = value.trim()
  if (looksLikeDateWindow(trimmed)) return trimmed.length <= 56 ? trimmed : trimmed.slice(0, 56)

  const lower = trimmed.toLowerCase()
  if (/sat/.test(lower) && /sun/.test(lower)) return trimmed
  if (lower.includes('sun-mon') || lower.includes('sun mon')) return 'Sun–Mon'
  if (lower.includes('this month')) return 'This month'
  if (lower.includes('next month')) return 'Next month'
  if (lower.includes('overnight') && current && !current.toLowerCase().includes('overnight')) {
    return `${current}, overnight stay`
  }
  if (lower.includes('weekend') && lower.includes('next')) return 'Next weekend'
  if (lower.includes('weekend')) return trimmed || 'This weekend'
  if (lower.includes('day')) return 'Just for a day'
  return trimmed
}

function applyFieldValue(context: TripContext, key: FieldKey, value: string): TripContext {
  if (key === 'whereTo') {
    return {
      ...context,
      whereTo: value.toLowerCase().includes('johor') ? 'Johor Bahru, Malaysia' : value,
    }
  }
  if (key === 'whereFrom') return { ...context, whereFrom: value }
  if (key === 'who') return { ...context, who: normalizeWho(value) }
  if (key === 'when') return { ...context, when: normalizeWhen(value, context.when) }
  return addTripActivity({ ...context, intent: value }, value).context
}

function inferContextFromPrompt(prompt: string, current: TripContext): TripContext {
  const lower = prompt.toLowerCase()
  const next = { ...current }

  if (lower.includes('johor') || lower.includes('jb') || lower.includes('bahru')) next.whereTo = 'Johor Bahru, Malaysia'
  if (lower.includes('tokyo') || lower.includes('kyoto') || lower.includes('japan')) next.whereTo = 'Tokyo + Kyoto'
  if (lower.includes('bali')) next.whereTo = 'Bali'
  if (lower.includes('singapore')) next.whereFrom = 'Singapore'
  if (lower.includes('solo')) next.who = 'Solo'
  if (lower.includes('family') || lower.includes('kids')) next.who = 'Family'
  if (lower.includes('couple') || lower.includes('two')) next.who = 'Couple'
  if (lower.includes('friend') || lower.includes('group')) next.who = 'Friends'
  if (looksLikeDateWindow(prompt)) {
    next.when = normalizeWhen(prompt, next.when || current.when)
  } else if (/sat[^\w]*sun|sat\s*[–-]\s*sun|saturday.*sunday/i.test(prompt)) {
    next.when = prompt.trim().length <= 42 ? prompt.trim() : 'Sat–Sun (this weekend)'
  } else if (lower.includes('weekend') || lower.includes('may 29') || lower.includes('may 30') || lower.includes('month')) {
    next.when = normalizeWhen(prompt, next.when || current.when)
  }
  if (lower.includes('overnight')) next.when = normalizeWhen(prompt, next.when || current.when)
  if (lower.includes('budget') || lower.includes('cheap') || lower.includes('50 sgd') || lower.includes('under 50')) {
    next.budgetLevel = 'budget'
  }
  if (lower.includes('relax') || lower.includes('local activit') || lower.includes('cafe') || lower.includes('activities')) {
    next.intent = lower.includes('cafe') ? 'Cafe hopping and local activities' : 'Relaxation and local activities'
  }
  if (lower.includes('food') || lower.includes('shopping')) next.intent = 'Food and shopping'
  if (next.whereTo.includes('Johor') && next.who && next.when && !next.whereFrom) next.whereFrom = 'Singapore'

  return next
}

function summaryPrompt(context: TripContext) {
  const ctx = ensureActivitiesFromIntent(context)
  const activityLine =
    ctx.activities.length > 0
      ? `Activities (${ctx.activities.length}/${MAX_TRIP_ACTIVITIES}): ${ctx.activities.join(' · ')}`
      : `Purpose: ${ctx.intent || 'Relaxation and local activities'}`

  return [
    `Route: ${context.whereFrom || 'Singapore'} -> ${displayValue(context, 'whereTo') || 'Johor Bahru'} (via Land)`,
    `Dates: ${context.when || 'Dates to confirm'}`,
    `Style: ${context.who || 'Solo'}, ${context.budgetLevel === 'budget' ? 'Budget-friendly (~50 SGD/night)' : 'Flexible budget'}`,
    activityLine,
  ]
}

function composePlanPrompt(context: TripContext) {
  const ctx = ensureActivitiesFromIntent(context)
  const activityFocus =
    ctx.activities.length > 0
      ? ctx.activities.join('; ')
      : ctx.intent || 'relaxation and local activities'

  return `Plan a ${context.who || 'solo'} ${displayValue(context, 'whereTo') || 'Johor Bahru'} trip from ${
    context.whereFrom || 'Singapore'
  }. Dates: ${context.when || 'flexible dates'}. Trip activities (max ${MAX_TRIP_ACTIVITIES}): ${activityFocus}. Budget level: ${
    context.budgetLevel || 'mid'
  }. Build it as a realistic dream itinerary with route, stay, local activities, and booking-style handoff.`
}

function fallbackAssistantMessage(context: TripContext, userText?: string): ChatMessage {
  if (capturedCount(context) >= 5) {
    if (userText && /more activit|more ideas|more recommend/i.test(userText.toLowerCase())) {
      return {
        id: nextId(),
        role: 'assistant',
        content: 'Here are a few more ideas:',
        suggestions: withSuggestMoreChip(resolveSuggestions('intent', [], context), 'intent', false, context),
        suggestionField: 'intent',
      }
    }
    return buildSummaryAssistantMessage(context)
  }

  const field = nextMissingField(context) ?? 'intent'
  const label = checklist.find((item) => item.key === field)?.label.toLowerCase() ?? 'the next detail'

  return {
    id: nextId(),
    role: 'assistant',
    content: `Got it — I still need ${label} before I can build your trip card.`,
    suggestions: resolveSuggestions(field, [], context),
    suggestionField: field,
  }
}

function isSummaryConfirmation(value: string) {
  const lower = value.toLowerCase()
  return lower.includes('confirm') || lower.includes('sounds good') || lower.includes('looks good') || lower.includes('go ahead')
}

function LaylaTopBar({ onNewTrip, onBack }: { onNewTrip?: () => void; onBack?: () => void }) {
  return (
    <div className="layla-topbar">
      <div className="layla-topbar-start">
        {onBack ? (
          <button type="button" className="layla-top-back" aria-label="Back to home" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <strong>Layla.</strong>
      </div>
      <div className="layla-top-actions">
        <button type="button" aria-label="New trip" onClick={onNewTrip}>
          <Plus size={21} />
        </button>
        <button type="button" aria-label="Account">
          <UserRound size={18} />
        </button>
      </div>
    </div>
  )
}

function TripChecklistBar({
  context,
  expanded,
  onToggle,
}: {
  context: TripContext
  expanded: boolean
  onToggle: () => void
}) {
  const progress = capturedCount(context)
  return (
    <button
      type="button"
      className="trip-checklist-bar-v2"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse trip checklist' : 'Expand trip checklist'}
    >
      <div>
        <span>Trip checklist</span>
        <strong>{progress} of 5 captured</strong>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      <span className="checklist-progress-track">
        <span style={{ width: `${(progress / 5) * 100}%` }} />
      </span>
    </button>
  )
}

function TripChecklistSheet({ context }: { context: TripContext }) {
  const progress = capturedCount(context)
  return (
    <section className="trip-checklist-sheet-v2">
      <div className="checklist-sheet-head">
        <div className="radial-progress" style={{ ['--progress' as string]: `${progress / 5}turn` }}>
          <span>{progress}/5</span>
        </div>
        <div>
          <span>Trip checklist</span>
          <h2>Your trip is taking shape</h2>
          <p>{progress} of 5 captured</p>
        </div>
      </div>
      <div className="checklist-stepper">
        {checklist.map((item) => {
          const Icon = item.icon
          const value = displayValue(context, item.key)
          const ctx = ensureActivitiesFromIntent(context)
          const activityItems = item.key === 'intent' ? ctx.activities : []
          const done = Boolean(value) || (item.key === 'intent' && activityItems.length > 0)
          return (
            <div key={item.key} className={done ? 'checklist-step done' : 'checklist-step'}>
              <span className="step-status">{done ? <Check size={16} /> : null}</span>
              <div>
                <span className="step-label">
                  <Icon size={15} />
                  {item.label}
                  {item.key === 'intent' ? (
                    <span className="step-activity-count">
                      {activityItems.length}/{MAX_TRIP_ACTIVITIES}
                    </span>
                  ) : null}
                </span>
                <strong>{value || item.empty}</strong>
                {item.key === 'intent' ? (
                  <div className="checklist-activity-block">
                    <p className="checklist-activity-hint">{activitySlotsMessage(ctx)}</p>
                    {activityItems.length > 0 ? (
                      <ol className="checklist-activity-subitems">
                        {activityItems.map((activity) => (
                          <li key={activity}>{activity}</li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ChatBubble({
  message,
  inlineSuggestions,
  archivedSuggestions,
  onSuggestionClick,
  suggestionsDisabled,
}: {
  message: ChatMessage
  inlineSuggestions?: string[]
  archivedSuggestions?: string[]
  onSuggestionClick?: (value: string, field?: FieldKey) => void
  suggestionsDisabled?: boolean
}) {
  const chips = inlineSuggestions?.length ? inlineSuggestions : archivedSuggestions
  const chipsLabel = inlineSuggestions?.length ? 'Suggested replies' : 'Earlier suggestions'

  const chipRowClass = message.summaryActions
    ? 'layla-message-chips is-active is-summary'
    : inlineSuggestions?.length
      ? 'layla-message-chips is-active'
      : 'layla-message-chips is-archived'

  return (
    <div className={`layla-message ${message.role}`}>
      <div className="layla-message-stack">
        <div className="layla-bubble">{message.content}</div>
        {message.role === 'user' ? (
          <button type="button" className="copy-message" aria-label="Copy message">
            <Copy size={15} />
          </button>
        ) : null}
      </div>
      {chips && chips.length > 0 ? (
        <div className={chipRowClass} role="group" aria-label={chipsLabel}>
          {chips.map((suggestion) => (
            <button
              key={`${message.id}-${suggestion}`}
              type="button"
              className={
                suggestion === SUGGEST_MORE_LABEL || suggestion === ACTIVITY_ADD_MORE_LABEL ? 'is-suggest-more' : undefined
              }
              disabled={suggestionsDisabled}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (suggestionsDisabled) return
                onSuggestionClick?.(suggestion, message.suggestionField)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StickyComposer({
  input,
  setInput,
  onSubmit,
  disabled,
  home = false,
}: {
  input: string
  setInput: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  home?: boolean
}) {
  return (
    <div className={home ? 'layla-composer-v2 home' : 'layla-composer-v2'}>
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={home ? 'i want to plan a trip to johor bahru' : 'Ask anything...'}
        aria-label="Ask Layla anything"
        rows={home ? 4 : 1}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          if (event.shiftKey) return
          event.preventDefault()
          onSubmit()
        }}
      />
      <div className="layla-composer-actions">
        <button type="button" aria-label="Attach inspiration">
          <Paperclip size={19} />
        </button>
        {!home ? (
          <button type="button" aria-label="Pick dates">
            <Calendar size={19} />
          </button>
        ) : null}
        <button type="button" aria-label="Use voice">
          <Mic size={19} />
        </button>
        <button type="button" className="layla-send" aria-label="Send message" onClick={onSubmit} disabled={disabled || !input.trim()}>
          {home ? <Send size={20} /> : <ArrowUp size={20} />}
        </button>
      </div>
    </div>
  )
}

function HomePrompt({
  input,
  setInput,
  onStart,
}: {
  input: string
  setInput: (value: string) => void
  onStart: (value?: string) => void
}) {
  const helpRef = useRef<HTMLElement>(null)

  const scrollToHelp = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = helpRef.current
    if (!target) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    window.history.replaceState(null, '', '#layla-help')
  }

  return (
    <div className="layla-home-screen">
      <div className="layla-home-hero">
        <div className="travel-clover" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <h1>Your trip. Planned in minutes.</h1>
        <StickyComposer input={input} setInput={setInput} onSubmit={() => onStart()} home />
        <div className="home-quick-chips">
          <button type="button" onClick={() => onStart(input || 'i want to plan a trip to johor bahru')}>
            Create a new trip
          </button>
          <button type="button" onClick={() => onStart('inspire me where to go for a quick budget weekend from Singapore')}>
            Inspire me where to go
          </button>
        </div>
        <a href="#layla-help" className="see-help" onClick={scrollToHelp}>
          See how I can help you
          <ArrowDown size={18} aria-hidden="true" />
        </a>
      </div>

      <section ref={helpRef} id="layla-help" className="layla-help-section" aria-label="How Layla helps">
        <h2>From idea to itinerary</h2>
        <p>I guide you through five quick decisions, then turn the answers into a trip card.</p>
        <div className="help-steps">
          {checklist.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={item.key} className="help-step">
                <span>{index + 1}</span>
                <Icon size={18} />
                <strong>{item.label}</strong>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function GenerationScreen({
  context,
  lastTrip,
  isPending,
  onOpenTrip,
}: {
  context: TripContext
  lastTrip: TripDetail | null
  isPending: boolean
  onOpenTrip: () => void
}) {
  return (
    <section className="layla-generation-screen">
      <h1>{displayValue(context, 'whereTo') || 'Johor Bahru'} Budget Trip</h1>
      <div className="generation-card-stack" aria-hidden="true">
        <span className="gen-card card-one" />
        <span className="gen-card card-two" />
        <span className="gen-card card-three" />
        <span className="gen-card card-four" />
      </div>
      <div className="generation-steps-v2">
        {generationSteps.map((step, index) => {
          const done = lastTrip || index < 3
          const pending = !lastTrip && index >= 3
          return (
            <div key={step} className={pending ? 'generation-row pending' : 'generation-row done'}>
              {done ? <Check size={18} /> : <Circle size={18} />}
              <span>{step}</span>
            </div>
          )
        })}
      </div>
      {lastTrip ? (
        <button type="button" className="generation-open-trip" onClick={onOpenTrip}>
          Open full trip card
        </button>
      ) : (
        <div className="generation-loading">
          <Loader2 size={18} className={isPending ? 'spin' : ''} />
          Building your itinerary
        </div>
      )}
    </section>
  )
}

export function PlannerPanel({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const assistantReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelAssistantReply = useRef<(() => void) | null>(null)
  const pendingBootstrapped = useRef(false)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const [homeInput, setHomeInput] = useState('i want to plan a trip to johor bahru')
  const [input, setInput] = useState('')
  const [context, setContext] = useState<TripContext>(emptyContext)
  const [activeField, setActiveField] = useState<FieldKey>('whereTo')
  const [stage, setStage] = useState<Stage>('collecting')
  const [checklistExpanded, setChecklistExpanded] = useState(false)
  const [lastTrip, setLastTrip] = useState<TripDetail | null>(null)
  const [toolTrace, setToolTrace] = useState<AgentTrace[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [assistantTyping, setAssistantTyping] = useState(false)

  const progress = capturedCount(context)

  function clearAssistantReplyTimer() {
    cancelAssistantReply.current?.()
    cancelAssistantReply.current = null
    if (assistantReplyTimer.current) {
      clearTimeout(assistantReplyTimer.current)
      assistantReplyTimer.current = null
    }
  }

  function deliverAssistantReply(assistant: ChatMessage, options?: { delayMs?: number }) {
    clearAssistantReplyTimer()

    const delay = options?.delayMs ?? assistantReplyDelay(assistant.content)
    if (delay <= 0) {
      setMessages((current) => [...current, assistant])
      setAssistantTyping(false)
      return
    }

    setAssistantTyping(true)
    let active = true
    cancelAssistantReply.current = () => {
      active = false
    }

    assistantReplyTimer.current = setTimeout(() => {
      if (!active) return
      setMessages((current) => [...current, assistant])
      setAssistantTyping(false)
      cancelAssistantReply.current = null
      assistantReplyTimer.current = null
    }, delay)
  }

  const runChat = useMutation({
    mutationFn: (payload: {
      message: string
      context: TripContext
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      moreSuggestions?: { field: FieldKey; exclude: string[] }
    }) => api.agentChat(payload),
  })

  async function processChatTurn(
    userText: string,
    options?: { seedContext?: TripContext; skipUserMessage?: boolean; allowWhilePending?: boolean },
  ) {
    if (!options?.allowWhilePending && (assistantTyping || runChat.isPending || runAgent.isPending)) return

    const previousContext = options?.seedContext ?? context
    const userMessage: ChatMessage = { id: nextId(), role: 'user', content: userText }
    const transcript = options?.skipUserMessage ? messages : [...messages, userMessage]

    if (!options?.skipUserMessage) {
      setMessages((current) => [...current, userMessage])
    }
    setAssistantTyping(true)

    const history = transcript
      .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }))

    try {
      const result = await runChat.mutateAsync({
        message: userText,
        context: previousContext,
        history,
      })
      const merged = mergeTripContext(
        mergeTripContext(previousContext, result.contextPatch),
        inferContextFromPrompt(userText, previousContext),
      )
      setContext(merged)
      setToolTrace(result.trace)
      const assistant = buildAssistantFromAgentResponse(result, merged)
      setActiveField(assistant.suggestionField ?? nextMissingField(merged) ?? 'intent')
      if (capturedCount(merged) >= 5) setChecklistExpanded(false)
      deliverAssistantReply(assistant, { delayMs: result.mode === 'model' ? 0 : undefined })
    } catch {
      const nextContext = inferContextFromPrompt(userText, previousContext)
      setContext(nextContext)
      const assistant = fallbackAssistantMessage(nextContext, userText)
      setActiveField(nextMissingField(nextContext) ?? assistant.suggestionField ?? 'intent')
      if (capturedCount(nextContext) >= 5) setChecklistExpanded(false)
      deliverAssistantReply(assistant)
    }
  }
  const latestAssistantWithSuggestions = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === 'assistant' && message.suggestions?.length)
  }, [messages])
  const activeSuggestionField = useMemo(() => {
    return nextMissingField(context) ?? latestAssistantWithSuggestions?.suggestionField ?? activeField
  }, [activeField, context, latestAssistantWithSuggestions])

  const latestSuggestions = useMemo(() => {
    const latest = latestAssistantWithSuggestions
    if (latest?.summaryActions && latest.suggestions?.length) {
      return latest.suggestions
    }

    const missingField = nextMissingField(context)
    const field = missingField ?? latest?.suggestionField ?? activeField
    const fromMessage =
      latest?.suggestionField === field || (!missingField && latest?.suggestionField) ? (latest?.suggestions ?? []) : []
    const resolved = resolveSuggestions(field, fromMessage, context)
    return withSuggestMoreChip(resolved, field, latest?.summaryActions, context)
  }, [activeField, context, latestAssistantWithSuggestions])

  function deliverActivityLimitReply(contextForReply: TripContext) {
    const ctx = ensureActivitiesFromIntent(contextForReply)
    deliverAssistantReply({
      id: nextId(),
      role: 'assistant',
      content: `${activitySlotsMessage(ctx)} Confirm the summary when you're ready, or change dates if you want to adjust the trip window.`,
      suggestions: [...summaryActionSuggestions],
      summaryActions: true,
    })
  }

  function isActivityRefinementFlow(ctx: TripContext) {
    return isActivityRefinementContext(ctx)
  }

  function deliverActivityPicker(
    seedContext: TripContext,
    transcript: ChatMessage[],
    fromModel: string[] = [],
    justAdded?: string,
  ) {
    const options = pickActivityOptions(seedContext, transcript, fromModel)
    setActiveField('intent')

    if (options.length === 0) {
      if (ensureActivitiesFromIntent(seedContext).activities.length >= MAX_TRIP_ACTIVITIES) {
        deliverActivityLimitReply(seedContext)
        return
      }
      deliverAssistantReply({
        id: nextId(),
        role: 'assistant',
        content: `I don't have fresh ideas left — ${activitySlotsMessage(seedContext)} Tap "${ACTIVITY_IM_GOOD_LABEL}" when you're ready.`,
        suggestions: [ACTIVITY_IM_GOOD_LABEL],
        suggestionField: 'intent',
      })
      return
    }

    deliverAssistantReply(
      {
        id: nextId(),
        role: 'assistant',
        content: activityPickerIntro(seedContext, justAdded),
        suggestions: buildActivityPickerSuggestions(seedContext, options),
        suggestionField: 'intent',
      },
      { delayMs: 0 },
    )
  }

  async function offerNextActivityPick(options?: { userLabel?: string }) {
    if (assistantTyping || runChat.isPending || runAgent.isPending) return

    const ctx = ensureActivitiesFromIntent(context)
    if (ctx.activities.length >= MAX_TRIP_ACTIVITIES) {
      deliverActivityLimitReply(ctx)
      return
    }

    const userLabel = options?.userLabel ?? ACTIVITY_ADD_MORE_LABEL
    const userMessage: ChatMessage = { id: nextId(), role: 'user', content: userLabel }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setAssistantTyping(true)

    const exclude = [...collectExcludedSuggestions(nextMessages, 'intent'), ...ctx.activities, ...(ctx.intent ? [ctx.intent] : [])]
    const history = nextMessages
      .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }))

    let fromModel: string[] = []

    try {
      const result = await runChat.mutateAsync({
        message: userLabel,
        context,
        history,
        moreSuggestions: { field: 'intent', exclude },
      })
      setToolTrace(result.trace)
      fromModel = result.suggestedReplies.filter((suggestion) => !isActivityFlowLabel(suggestion))
    } catch {
      // local pool fallback
    }

    setContext(context)
    deliverActivityPicker(ctx, nextMessages, fromModel)
  }

  async function requestMoreSuggestions(field: FieldKey, options?: { userLabel?: string }) {
    if (assistantTyping || runChat.isPending || runAgent.isPending) return

    if (field === 'intent' && isActivityRefinementFlow(context)) {
      await offerNextActivityPick(options)
      return
    }

    const ctx = ensureActivitiesFromIntent(context)
    const userLabel = options?.userLabel ?? SUGGEST_MORE_LABEL
    const exclude = [
      ...collectExcludedSuggestions(messages, field),
      ...ctx.activities,
      ...(ctx.intent ? [ctx.intent] : []),
    ]
    const userMessage: ChatMessage = { id: nextId(), role: 'user', content: userLabel }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setAssistantTyping(true)

    const history = nextMessages
      .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }))

    try {
      const result = await runChat.mutateAsync({
        message: userLabel,
        context,
        history,
        moreSuggestions: { field, exclude },
      })
      setToolTrace(result.trace)
      setActiveField(field)
      const suggestions = withSuggestMoreChip(
        resolveSuggestions(field, result.suggestedReplies, context).filter((suggestion) => !exclude.includes(suggestion)),
        field,
        false,
        context,
      )
      const leadIn = result.assistantMessage || 'Here are a few more ideas:'
      deliverAssistantReply(
        {
          id: nextId(),
          role: 'assistant',
          content: leadIn,
          suggestions,
          suggestionField: field,
        },
        { delayMs: result.mode === 'model' ? 0 : undefined },
      )
    } catch {
      const suggestions = withSuggestMoreChip(
        resolveSuggestions(field, [], context).filter((suggestion) => !exclude.includes(suggestion)),
        field,
        false,
        context,
      )
      deliverAssistantReply({
        id: nextId(),
        role: 'assistant',
        content: 'Here are a few more ideas:',
        suggestions: suggestions.length >= 2 ? suggestions : fieldSuggestions.intent,
        suggestionField: field,
      })
    }
  }

  const runAgent = useMutation({
    mutationFn: (payload: { prompt: string; context: TripContext }) => api.agentPlan(payload),
    onSuccess: async (result) => {
      setLastTrip(result.trip)
      setToolTrace(result.trace)
      setStage('ready')
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => {
      setStage('collecting')
      deliverAssistantReply({
        id: nextId(),
        role: 'assistant',
        content: 'I could not build the trip card right now. Your checklist is still saved here, so confirm again when you are ready.',
      })
    },
  })

  function startFromHome(value?: string) {
    const prompt = (value ?? homeInput).trim() || 'i want to plan a trip to johor bahru'
    window.sessionStorage.setItem('layla_pending_prompt', prompt)
    navigate({ to: '/chat' })
  }

  function resetChat() {
    clearAssistantReplyTimer()
    window.sessionStorage.removeItem('layla_pending_prompt')
    setInput('')
    setContext(emptyContext)
    setActiveField('whereTo')
    setStage('collecting')
    setChecklistExpanded(false)
    setLastTrip(null)
    setToolTrace([])
    setMessages([])
    setAssistantTyping(false)
    pendingBootstrapped.current = false
  }

  function submitMessage() {
    const trimmed = input.trim()
    if (!trimmed || runAgent.isPending) return

    clearAssistantReplyTimer()
    setAssistantTyping(false)
    if (progress >= 5 && isSummaryConfirmation(trimmed)) {
      setInput('')
      startGeneration(trimmed)
      return
    }
    if (progress < 5 && isSummaryConfirmation(trimmed)) {
      const missingField = nextMissingField(context) ?? activeField
      const missingLabel = checklist.find((item) => item.key === missingField)?.label.toLowerCase() ?? 'the next detail'
      setActiveField(missingField)
      setMessages((current) => [...current, { id: nextId(), role: 'user', content: trimmed }])
      deliverAssistantReply({
        id: nextId(),
        role: 'assistant',
        content: `Almost there. Before I build the itinerary, I still need ${missingLabel}. Answer that and the checklist can move to the final summary.`,
        suggestions: resolveSuggestions(missingField, [], context),
        suggestionField: missingField,
      })
      setInput('')
      return
    }
    setInput('')
    void processChatTurn(trimmed, { allowWhilePending: true })
  }

  function chooseSuggestion(value: string, field?: FieldKey) {
    if (runAgent.isPending) return
    if (value === ACTIVITY_IM_GOOD_LABEL) {
      setMessages((current) => [...current, { id: nextId(), role: 'user', content: value }])
      setChecklistExpanded(false)
      deliverAssistantReply(buildSummaryAssistantMessage(context), { delayMs: 0 })
      return
    }
    if (value === ACTIVITY_ADD_MORE_LABEL) {
      void offerNextActivityPick({ userLabel: value })
      return
    }
    if (value === SUGGEST_MORE_LABEL) {
      if (isActivityRefinementFlow(context)) {
        void offerNextActivityPick({ userLabel: value })
        return
      }
      void requestMoreSuggestions(field ?? activeSuggestionField)
      return
    }

    const selectedField = field ?? activeSuggestionField
    const prior = ensureActivitiesFromIntent(context)
    const isAddingMoreActivity =
      selectedField === 'intent' && capturedCount(context) >= 5 && prior.activities.length > 0
    const userMessage: ChatMessage = { id: nextId(), role: 'user', content: value }

    setMessages((current) => [...current, userMessage])

    if (isAddingMoreActivity) {
      const { context: withActivity, added, reason } = addTripActivity(prior, value)
      const seedContext = inferContextFromPrompt(value, withActivity)
      setContext(seedContext)

      if (!added && reason === 'max') {
        deliverActivityLimitReply(seedContext)
        return
      }
      if (!added && reason === 'duplicate') {
        deliverAssistantReply({
          id: nextId(),
          role: 'assistant',
          content: `"${value}" is already on your list. ${activitySlotsMessage(seedContext)}`,
          suggestions: [...summaryActionSuggestions],
          summaryActions: true,
        })
        return
      }

      if (seedContext.activities.length >= MAX_TRIP_ACTIVITIES) {
        deliverActivityLimitReply(seedContext)
        return
      }

      deliverActivityPicker(seedContext, [...messages, userMessage], [], value)
      return
    }

    const seedContext = inferContextFromPrompt(value, applyFieldValue(context, selectedField, value))
    setContext(seedContext)
    setActiveField(nextMissingField(seedContext) ?? 'intent')

    if (capturedCount(seedContext) >= 5) {
      deliverAssistantReply(buildSummaryAssistantMessage(seedContext), { delayMs: 0 })
      return
    }

    void processChatTurn(value, { seedContext, skipUserMessage: true, allowWhilePending: true })
  }

  function handleSummaryAction(value: string) {
    if (assistantTyping || runAgent.isPending || runChat.isPending) return
    if (value === 'Confirm summary') {
      startGeneration(value)
      return
    }
    if (value === 'Change dates') {
      const revised = { ...context, when: '' }
      setContext(revised)
      setActiveField('when')
      setChecklistExpanded(false)
      void processChatTurn('I want to change my travel dates — what windows do you recommend?', { seedContext: revised })
      return
    }
    if (value === 'Add more activities') {
      const ctx = ensureActivitiesFromIntent(context)
      setChecklistExpanded(false)
      if (ctx.activities.length >= MAX_TRIP_ACTIVITIES) {
        setMessages((current) => [...current, { id: nextId(), role: 'user', content: value }])
        deliverActivityLimitReply(ctx)
        return
      }
      void offerNextActivityPick({ userLabel: value })
      return
    }
    void processChatTurn(value, { seedContext: context, allowWhilePending: true })
  }

  function startGeneration(userText?: string) {
    const finalContext = context.whereFrom ? context : { ...context, whereFrom: 'Singapore' }
    setContext(finalContext)
    setChecklistExpanded(false)
    if (userText) {
      setMessages((current) => [...current, { id: nextId(), role: 'user', content: userText }])
    }
    setStage('generating')
    setToolTrace([
      {
        name: 'trip_brief',
        label: 'Build itinerary brief',
        status: 'complete',
        result: summaryPrompt(finalContext).join('; '),
      },
    ])
    runAgent.mutate({
      prompt: composePlanPrompt(finalContext),
      context: finalContext,
    })
  }

  useEffect(() => {
    if (compact || pendingBootstrapped.current) return
    const pendingPrompt = window.sessionStorage.getItem('layla_pending_prompt')
    if (!pendingPrompt) return

    pendingBootstrapped.current = true
    window.sessionStorage.removeItem('layla_pending_prompt')
    void processChatTurn(pendingPrompt)
  }, [compact])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scrollNode = chatScrollRef.current
      if (!scrollNode) return
      scrollNode.scrollTo({ top: scrollNode.scrollHeight, behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [assistantTyping, checklistExpanded, messages.length])

  if (compact) {
    return (
      <section className="layla-v2-route home-route">
        <div className="layla-phone-frame home">
          <LaylaTopBar onNewTrip={() => setHomeInput('')} />
          <HomePrompt input={homeInput} setInput={setHomeInput} onStart={startFromHome} />
        </div>
      </section>
    )
  }

  return (
    <section className="layla-v2-route chat">
      <div className="layla-phone-frame chat">
        <LaylaTopBar onNewTrip={resetChat} onBack={() => navigate({ to: '/' })} />
        {stage === 'generating' || stage === 'ready' ? (
          <GenerationScreen
            context={context}
            lastTrip={lastTrip}
            isPending={runAgent.isPending}
            onOpenTrip={() => {
              if (lastTrip) navigate({ to: '/trips/$tripId', params: { tripId: lastTrip.id } })
            }}
          />
        ) : (
          <div className="layla-chat-screen">
            <div className={`trip-checklist-panel${checklistExpanded ? ' is-expanded' : ''}`}>
              <TripChecklistBar context={context} expanded={checklistExpanded} onToggle={() => setChecklistExpanded((value) => !value)} />
              {checklistExpanded ? <TripChecklistSheet context={context} /> : null}
            </div>

            <div className="layla-chat-body">
              {checklistExpanded ? <div className="trip-checklist-backdrop" aria-hidden="true" /> : null}
              <div className="layla-chat-main" ref={chatScrollRef}>
                <div className="layla-chat-scroll">
              {messages.length === 0 ? (
                <div className="layla-empty-chat">
                  <CheckCircle2 size={20} />
                  <strong>Tell me the trip you want.</strong>
                  <span>I will guide you through five quick decisions and build the itinerary from there.</span>
                </div>
              ) : null}
              {messages.map((message) => {
                const isLatestSuggestionMessage = message.id === latestAssistantWithSuggestions?.id
                const inlineSuggestions =
                  isLatestSuggestionMessage && latestSuggestions.length > 0 && !assistantTyping
                    ? latestSuggestions
                    : undefined
                const archivedSuggestions =
                  message.role === 'assistant' &&
                  message.suggestions?.length &&
                  !isLatestSuggestionMessage &&
                  !message.summaryActions
                    ? message.suggestions.filter((suggestion) => suggestion !== SUGGEST_MORE_LABEL)
                    : undefined

                return (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    inlineSuggestions={inlineSuggestions}
                    archivedSuggestions={archivedSuggestions}
                    suggestionsDisabled={runAgent.isPending}
                    onSuggestionClick={(value, suggestionField) => {
                      if (message.summaryActions) {
                        handleSummaryAction(value)
                        return
                      }
                      chooseSuggestion(value, suggestionField ?? activeSuggestionField)
                    }}
                  />
                )
              })}
              {assistantTyping ? <TypingIndicator /> : null}
              {toolTrace.length > 0 ? <span className="sr-only">{toolTrace.length} agent steps queued</span> : null}
                </div>
              </div>
            </div>

            <div className="layla-chat-footer">
              <StickyComposer
                input={input}
                setInput={setInput}
                onSubmit={submitMessage}
                disabled={runAgent.isPending}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
