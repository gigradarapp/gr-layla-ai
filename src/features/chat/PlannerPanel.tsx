import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Bot,
  Calendar,
  CheckCircle2,
  Circle,
  Compass,
  Heart,
  Loader2,
  MapPin,
  Mic,
  Paperclip,
  PlaneTakeoff,
  Send,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { AgentTrace, TripDetail } from '../../lib/types'

type FieldKey = 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
type Stage = 'collecting' | 'generating' | 'ready'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  meta?: string
  suggestions?: string[]
  suggestionField?: FieldKey
}

type TripContext = {
  whereTo: string
  whereFrom: string
  who: string
  when: string
  intent: string
  budgetLevel: string
  pace: string
}

const initialContext: TripContext = {
  whereTo: '',
  whereFrom: 'Singapore',
  who: '',
  when: '',
  intent: '',
  budgetLevel: 'mid',
  pace: 'balanced',
}

const checklist: Array<{
  key: FieldKey
  label: string
  empty: string
  icon: typeof MapPin
}> = [
  { key: 'whereTo', label: 'Where to', empty: "Let me inspire you if you don't know", icon: MapPin },
  { key: 'whereFrom', label: 'Where from', empty: "I'll ask where you're setting off from", icon: PlaneTakeoff },
  { key: 'who', label: "Who's coming", empty: "I'll ask who you're travelling with", icon: Users },
  { key: 'when', label: "When you'd go", empty: "I'll ask when you'd like to travel", icon: Calendar },
  { key: 'intent', label: "What you're after", empty: 'Tell me what would make this trip yours', icon: Heart },
]

const fieldSuggestions: Record<FieldKey, string[]> = {
  whereTo: ['Tokyo + Kyoto', 'Bali', 'Seoul', 'Queenstown', 'Surprise me under $1.5k'],
  whereFrom: ['Singapore', 'Kuala Lumpur', 'Bangkok', 'Jakarta'],
  who: ['Solo reset', 'Couple trip', 'Friends group', 'Family with kids', 'Road trip crew'],
  when: ['Next month', 'Long weekend', 'June school holidays', 'September shoulder season'],
  intent: ['Food and culture', 'Nature adventure', 'Wellness and beach', 'Low walking family plan', 'Shopping and nightlife'],
}

const quickPrompts = [
  'Plan a 5-day Japan food trip for two from Singapore',
  'I want a crazy nature adventure on a budget',
  'Family trip with warm weather and minimal walking',
  'Last-minute Bali wellness weekend from Singapore',
]

const generationSteps = [
  'Optimizing your route, end to end',
  'Scanning flight and hotel-style offers',
  'Reading review signals for fit',
  'Balancing pace, cost, and constraints',
]

const destinationCards = [
  {
    name: 'Tokyo + Kyoto',
    detail: 'Food, rail, culture',
    price: 'from $420',
    image:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Bali',
    detail: 'Wellness, beach, cafes',
    price: 'from $160',
    image:
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Queenstown',
    detail: 'Road trip, alpine, nature',
    price: 'from $980',
    image:
      'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=800&q=80',
  },
]

function nextId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeWho(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('family') || lower.includes('kid')) return 'family'
  if (lower.includes('friend') || lower.includes('group')) return 'friends'
  if (lower.includes('solo')) return 'solo'
  if (lower.includes('road')) return 'road trippers'
  return 'couple'
}

function inferContextFromPrompt(prompt: string, current: TripContext): TripContext {
  const lower = prompt.toLowerCase()
  const next = { ...current }

  if (lower.includes('japan') || lower.includes('tokyo') || lower.includes('kyoto')) next.whereTo = 'Tokyo + Kyoto'
  if (lower.includes('bali')) next.whereTo = 'Bali'
  if (lower.includes('seoul') || lower.includes('korea')) next.whereTo = 'Seoul'
  if (lower.includes('queenstown') || lower.includes('new zealand') || lower.includes('road trip')) next.whereTo = 'Queenstown'
  if (lower.includes('lisbon') || lower.includes('portugal')) next.whereTo = 'Lisbon'
  if (lower.includes('singapore')) next.whereFrom = 'Singapore'
  if (lower.includes('budget') || lower.includes('cheap')) next.budgetLevel = 'budget'
  if (lower.includes('premium') || lower.includes('luxury')) next.budgetLevel = 'premium'
  if (lower.includes('family') || lower.includes('kids')) next.who = 'family'
  if (lower.includes('friend') || lower.includes('group')) next.who = 'friends'
  if (lower.includes('solo')) next.who = 'solo'
  if (lower.includes('two') || lower.includes('couple')) next.who = 'couple'
  if (lower.includes('slow') || lower.includes('minimal walking')) next.pace = 'slow'
  if (lower.includes('crazy') || lower.includes('adventure')) next.pace = 'fast'
  if (lower.includes('last-minute') || lower.includes('weekend')) next.when = 'Long weekend'
  if (lower.includes('5-day') || lower.includes('5 day')) next.when = '5 days'
  if (lower.includes('food')) next.intent = 'Food and culture'
  if (lower.includes('nature') || lower.includes('adventure')) next.intent = 'Nature adventure'
  if (lower.includes('wellness') || lower.includes('beach')) next.intent = 'Wellness and beach'
  if (lower.includes('minimal walking')) next.intent = 'Low walking family plan'

  return next
}

function valueForField(context: TripContext, key: FieldKey) {
  if (key === 'whereTo') return context.whereTo
  if (key === 'whereFrom') return context.whereFrom
  if (key === 'who') return context.who
  if (key === 'when') return context.when
  return context.intent
}

function applyFieldValue(context: TripContext, key: FieldKey, value: string): TripContext {
  if (key === 'whereTo') return { ...context, whereTo: value }
  if (key === 'whereFrom') return { ...context, whereFrom: value }
  if (key === 'who') return { ...context, who: normalizeWho(value) }
  if (key === 'when') return { ...context, when: value }
  return { ...context, intent: value }
}

function nextMissingField(context: TripContext): FieldKey | null {
  return checklist.find((item) => !valueForField(context, item.key))?.key ?? null
}

function capturedCount(context: TripContext) {
  return checklist.filter((item) => Boolean(valueForField(context, item.key))).length
}

function briefSummary(context: TripContext, missing: FieldKey | null) {
  const parts = [
    context.whereTo,
    context.when,
    context.who,
    context.intent,
    context.whereFrom ? `from ${context.whereFrom}` : '',
  ].filter(Boolean)
  if (parts.length > 1) return parts.slice(0, 3).join(' · ')
  if (parts.length === 1 && missing) return `${parts[0]} · next: ${checklist.find((item) => item.key === missing)?.label.toLowerCase()}`
  return "Tell me the trip you want. I'll collect the rest."
}

function composePrompt(context: TripContext, fallbackPrompt: string) {
  const destination = context.whereTo || 'a destination you recommend'
  const intent = context.intent || fallbackPrompt || 'a trip that fits my constraints'
  return `Plan ${context.when || 'a flexible'} ${destination} trip from ${context.whereFrom || 'Singapore'} for ${
    context.who || 'me'
  }. I want ${intent}. Budget: ${context.budgetLevel}. Pace: ${context.pace}.`
}

function compactSuggestions(suggestions: string[]) {
  const seen = new Set<string>()
  return suggestions
    .map((suggestion) => suggestion.trim())
    .filter((suggestion) => {
      const key = suggestion.toLowerCase()
      if (!suggestion || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

export function PlannerPanel({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [context, setContext] = useState<TripContext>(initialContext)
  const [activeField, setActiveField] = useState<FieldKey>('whereTo')
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<Stage>('collecting')
  const [lastTrip, setLastTrip] = useState<TripDetail | null>(null)
  const [agentMode, setAgentMode] = useState<'model' | 'fallback' | null>(null)
  const [toolTrace, setToolTrace] = useState<AgentTrace[]>([])
  const [showTripTools, setShowTripTools] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      content:
        "Tell me the trip you want. I'll ask only what is missing and turn it into a plan when you're ready.",
      meta: 'Layla-style planner',
    },
  ])

  const progress = capturedCount(context)
  const missing = nextMissingField(context)
  const activeSuggestions = fieldSuggestions[activeField]
  const currentBrief = briefSummary(context, missing)

  const runAgent = useMutation({
    mutationFn: (payload: { prompt: string; context: TripContext }) => api.agentPlan(payload),
    onMutate: () => setStage('generating'),
    onSuccess: async (result) => {
      setLastTrip(result.trip)
      setAgentMode(result.mode)
      setToolTrace(result.trace)
      setStage('ready')
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: result.assistantMessage,
          meta: result.mode === 'model' ? 'AI agent complete' : 'Fallback agent complete',
        },
      ])
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => setStage('collecting'),
  })

  const chatAgent = useMutation({
    mutationFn: (payload: { message: string; context: TripContext; history: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
      api.agentChat(payload),
    onSuccess: (result) => {
      setAgentMode(result.mode)
      setToolTrace(result.trace)
      setDynamicSuggestions(result.suggestedReplies)
      setActiveField(result.activeField)
      setContext((current) => ({
        ...current,
        whereTo: result.contextPatch.whereTo || current.whereTo,
        whereFrom: result.contextPatch.whereFrom || current.whereFrom,
        who: result.contextPatch.who || current.who,
        when: result.contextPatch.when || current.when,
        intent: result.contextPatch.intent || current.intent,
        budgetLevel: result.contextPatch.budgetLevel || current.budgetLevel,
        pace: result.contextPatch.pace || current.pace,
      }))
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: result.assistantMessage,
          meta: result.mode === 'model' ? 'AI chat' : 'Fallback chat',
          suggestions: compactSuggestions(result.suggestedReplies),
          suggestionField: result.activeField,
        },
      ])
    },
    onError: () => {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: 'I could not reach the travel agent right now. Try again or use Finish to build with the fallback planner.',
          meta: 'Agent unavailable',
        },
      ])
    },
  })

  const assistantHint = useMemo(() => {
    if (!missing) return 'I have the essentials. Finish the trip now, or keep chatting to refine the style.'
    const item = checklist.find((entry) => entry.key === missing)
    return item ? `${item.label}: ${item.empty}.` : 'Keep going.'
  }, [missing])

  function sendToAgent(userText: string, nextContext: TripContext) {
    const history = messages.map((message) => ({ role: message.role, content: message.content }))
    setMessages((current) => [...current, { id: nextId(), role: 'user', content: userText }])
    setToolTrace([
      {
        name: 'queued_chat',
        label: 'Queued AI chat',
        status: 'complete',
        result: 'Sending message and current trip context to the backend travel agent.',
      },
    ])
    chatAgent.mutate({ message: userText, context: nextContext, history })
  }

  function submitMessage() {
    const trimmed = input.trim()
    if (!trimmed) return
    const nextContext = inferContextFromPrompt(trimmed, context)
    setContext(nextContext)
    const nextField = nextMissingField(nextContext)
    if (nextField) setActiveField(nextField)
    sendToAgent(trimmed, nextContext)
    setInput('')
  }

  function chooseSuggestion(value: string) {
    const nextContext = applyFieldValue(context, activeField, value)
    setContext(nextContext)
    const nextField = nextMissingField(nextContext)
    if (nextField) setActiveField(nextField)
    sendToAgent(value, nextContext)
  }

  function chooseMessageSuggestion(value: string, field?: FieldKey) {
    const selectedField = field ?? activeField
    const nextContext = applyFieldValue(context, selectedField, value)
    setContext(nextContext)
    const nextField = nextMissingField(nextContext)
    setActiveField(nextField ?? selectedField)
    sendToAgent(value, nextContext)
  }

  function chooseQuickPrompt(prompt: string) {
    const nextContext = inferContextFromPrompt(prompt, context)
    setContext(nextContext)
    const nextField = nextMissingField(nextContext)
    if (nextField) setActiveField(nextField)
    sendToAgent(prompt, nextContext)
    setInput('')
  }

  function selectCandidate(destination: string) {
    const nextContext = { ...context, whereTo: destination }
    setContext(nextContext)
    const nextField = nextMissingField(nextContext)
    if (nextField) setActiveField(nextField)
    sendToAgent(destination, nextContext)
  }

  function finishTrip() {
    const inferredContext = input.trim() ? inferContextFromPrompt(input, context) : context
    setContext(inferredContext)
    const nextField = nextMissingField(inferredContext)
    if (nextField) setActiveField(nextField)
    const prompt = composePrompt(inferredContext, input)
    setToolTrace([
      {
        name: 'queued',
        label: 'Queued agent run',
        status: 'complete',
        result: 'Preparing trip context for the backend travel agent.',
      },
    ])
    runAgent.mutate({
      prompt,
      context: inferredContext,
    })
  }

  return (
    <section className={compact ? 'planner-panel smart minimal compact' : 'planner-panel smart minimal'}>
      <div className="planner-toolbar compact-planner-toolbar">
        <div>
          <span className="mini-label">AI travel planner</span>
          <h2>Plan by chat</h2>
          <p>{currentBrief}</p>
        </div>
        <span className="live-dot">{progress}/5</span>
      </div>

      <div className="brief-bar">
        <button type="button" className="brief-status" onClick={() => setShowTripTools((value) => !value)}>
          <span>{missing ? `Next: ${checklist.find((item) => item.key === missing)?.label}` : 'Ready to finish'}</span>
          <strong>{currentBrief}</strong>
        </button>
        <div className="minimal-actions">
          <button type="button" className="icon-action" aria-label="Show trip ideas" title="Ideas" onClick={() => setShowIdeas((value) => !value)}>
            <Sparkles size={15} />
            <span>Ideas</span>
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label="Edit trip details"
            title="Details"
            onClick={() => setShowTripTools((value) => !value)}
          >
            <Compass size={15} />
            <span>Details</span>
          </button>
          <button type="button" className="primary-action small" onClick={finishTrip} disabled={runAgent.isPending}>
            {runAgent.isPending ? <Loader2 size={15} className="spin" /> : <Bot size={15} />}
            Finish
          </button>
        </div>
      </div>

      {showTripTools ? (
        <div className="minimal-drawer">
          <div className="drawer-section">
            <span className="mini-label">Trip details</span>
            <div className="context-strip drawer-context" aria-label="Trip essentials">
              {checklist.map((item) => {
                const Icon = item.icon
                const value = valueForField(context, item.key)
                const active = activeField === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={active ? 'context-chip active' : 'context-chip'}
                    onClick={() => setActiveField(item.key)}
                  >
                    {value ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <Icon size={15} aria-hidden="true" />
                    <span>{value || item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="drawer-section">
            <span className="mini-label">Answer faster</span>
            <strong>{checklist.find((item) => item.key === activeField)?.label}</strong>
            <div className="suggestion-chips">
              {(dynamicSuggestions.length > 0 ? dynamicSuggestions : activeSuggestions).map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <div className="planner-settings compact-settings">
            <label>
              Budget
              <select
                value={context.budgetLevel}
                onChange={(event) => setContext((current) => ({ ...current, budgetLevel: event.target.value }))}
              >
                <option value="budget">Budget</option>
                <option value="mid">Mid</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label>
              Pace
              <select value={context.pace} onChange={(event) => setContext((current) => ({ ...current, pace: event.target.value }))}>
                <option value="slow">Slow</option>
                <option value="balanced">Balanced</option>
                <option value="fast">Fast</option>
              </select>
            </label>
          </div>
          <p>{assistantHint}</p>
        </div>
      ) : null}

      {showIdeas ? (
        <div className="ideas-panel">
          <div className="quick-prompt-row" aria-label="Quick start prompts">
            <span>Try</span>
            {quickPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => chooseQuickPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          {!context.whereTo ? (
            <div className="destination-candidates minimal-candidates">
              {destinationCards.map((candidate) => (
                <button key={candidate.name} type="button" onClick={() => selectCandidate(candidate.name)}>
                  <img src={candidate.image} alt="" />
                  <strong>{candidate.name}</strong>
                  <span>{candidate.detail}</span>
                  <small>{candidate.price}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="chat-console minimal-chat">
        <div className="chat-window smart-window">
          {messages.map((message) => (
            <div key={message.id} className={`chat-row ${message.role}`}>
              {message.role === 'assistant' ? <span className="avatar">AI</span> : null}
              <div className="chat-message-stack">
                <div className="chat-bubble">
                  {message.meta ? <span className="bubble-meta">{message.meta}</span> : null}
                  {message.content}
                </div>
                {message.role === 'assistant' && message.suggestions?.length ? (
                  <div className="reply-suggestions" aria-label="AI suggestions">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={`${message.id}-${suggestion}`}
                        type="button"
                        onClick={() => chooseMessageSuggestion(suggestion, message.suggestionField)}
                        disabled={chatAgent.isPending}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {chatAgent.isPending ? (
            <div className="planning-progress compact-generation">
              <Loader2 size={18} className="spin" aria-hidden="true" />
              <div>
                <strong>Thinking with AI...</strong>
                <span>Reading your message, updating trip essentials, and choosing the next best question.</span>
              </div>
            </div>
          ) : null}

          {stage === 'generating' || runAgent.isPending ? (
            <div className="generation-stack compact-generation">
              {(toolTrace.length > 0 ? toolTrace.map((item) => item.label) : generationSteps).map((step, index) => (
                <div key={step} className="generation-step">
                  {index === 0 ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                  <span>{step}</span>
                </div>
              ))}
            </div>
          ) : null}

          {toolTrace.length > 0 && stage !== 'generating' ? (
            <details className="agent-trace minimal-trace">
              <summary>
                <strong>{agentMode === 'model' ? 'OpenAI agent run' : 'Local fallback agent run'}</strong>
                <span>{toolTrace.length} tools</span>
              </summary>
              {toolTrace.map((item) => (
                <div key={`${item.name}-${item.label}`} className={`agent-trace-row ${item.status}`}>
                  <CheckCircle2 size={15} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.result}</span>
                  </div>
                </div>
              ))}
            </details>
          ) : null}

          {lastTrip ? (
            <div className="generated-card rich-result">
              <img src={lastTrip.heroImageUrl} alt="" />
              <div>
                <span>Your trip is ready</span>
                <strong>{lastTrip.title}</strong>
                <p>{lastTrip.summary}</p>
                <button
                  type="button"
                  className="primary-action small"
                  onClick={() => navigate({ to: '/trips/$tripId', params: { tripId: lastTrip.id } })}
                >
                  Open itinerary
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Ask Layla anything"
            placeholder="Ask anything..."
            rows={compact ? 2 : 3}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitMessage()
            }}
          />
          <div className="composer-actions">
            <button type="button" aria-label="Attach inspiration">
              <Paperclip size={17} />
            </button>
            <button type="button" aria-label="Use voice input">
              <Mic size={17} />
            </button>
            <button
              type="button"
              aria-label="Open trip details"
              onClick={() => {
                setActiveField('when')
                setShowTripTools(true)
              }}
            >
              <Calendar size={17} />
            </button>
            <button type="button" className="send-action" aria-label="Send message" onClick={submitMessage} disabled={!input.trim() || chatAgent.isPending}>
              <Send size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
