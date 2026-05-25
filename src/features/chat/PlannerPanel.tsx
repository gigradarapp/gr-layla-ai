import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
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
import { api } from '../../lib/api'
import type { AgentTrace, TripDetail } from '../../lib/types'

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

type TripContext = {
  whereTo: string
  whereFrom: string
  who: string
  when: string
  intent: string
  budgetLevel: string
  pace: string
}

const emptyContext: TripContext = {
  whereTo: '',
  whereFrom: '',
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
  { key: 'whereTo', label: 'Where to', empty: "I'll help pick or confirm the destination", icon: MapPin },
  { key: 'whereFrom', label: 'Where from', empty: "I'll ask where you're setting off from", icon: PlaneTakeoff },
  { key: 'who', label: "Who's coming", empty: "I'll ask who you're travelling with", icon: Users },
  { key: 'when', label: "When you'd go", empty: "I'll ask when you'd like to travel", icon: Calendar },
  { key: 'intent', label: "What you're after", empty: 'Tell me what would make this trip yours', icon: Heart },
]

const captureOrder: FieldKey[] = ['whereTo', 'when', 'who', 'intent', 'whereFrom']

const fieldSuggestions: Record<FieldKey, string[]> = {
  whereTo: ['Johor Bahru', 'Bali', 'Tokyo + Kyoto'],
  whereFrom: ['Singapore', 'Kuala Lumpur', 'Bangkok'],
  who: ['Solo trip', 'With family', 'Couple trip'],
  when: ['This weekend', 'Next weekend', 'Just for a day'],
  intent: ['Relaxation and local activities', 'Cafe hopping', 'Food and shopping'],
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

function normalizeWhen(value: string, current: string) {
  const lower = value.toLowerCase()
  if (lower.includes('overnight') && current && !current.toLowerCase().includes('overnight')) {
    return `${current}, overnight stay`
  }
  if (lower.includes('weekend') && lower.includes('next')) return 'This weekend or next weekend'
  if (lower.includes('weekend')) return 'This weekend or next weekend'
  if (lower.includes('day')) return 'Just for a day'
  return value
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
  return { ...context, intent: value }
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
  if (lower.includes('weekend') || lower.includes('may 29') || lower.includes('may 30')) {
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
  return [
    `Route: ${context.whereFrom || 'Singapore'} -> ${displayValue(context, 'whereTo') || 'Johor Bahru'} (via Land)`,
    'Dates: May 29 - May 30 (2 days, 1 night)',
    `Style: ${context.who || 'Solo'}, ${context.budgetLevel === 'budget' ? 'Budget-friendly (~50 SGD/night)' : 'Flexible budget'}`,
    `Purpose: ${context.intent || 'Relaxation and local activities'}`,
  ]
}

function composePlanPrompt(context: TripContext) {
  return `Plan a 2-day ${context.who || 'solo'} ${displayValue(context, 'whereTo') || 'Johor Bahru'} budget trip from ${
    context.whereFrom || 'Singapore'
  }. Dates: May 29 to May 30. Stay overnight. Budget: under 50 SGD per night. Purpose: ${
    context.intent || 'relaxation and local activities'
  }. Build it as a realistic dream itinerary with route, stay, local activities, and booking-style handoff.`
}

function assistantTurn(context: TripContext, previous: TripContext, userText: string): ChatMessage {
  const captured = capturedCount(context)
  const capturedDelta = captured - capturedCount(previous)
  const activeField = nextMissingField(context) ?? 'intent'
  const lower = userText.toLowerCase()
  const justCapturedDestination = !previous.whereTo && context.whereTo

  if (captured >= 5) {
    return {
      id: nextId(),
      role: 'assistant',
      content: `Got it! A solo, budget-friendly retreat it is. Staying under 50 SGD a night is totally doable for a chic spot in JB.\nHere is the plan so far:\n\n${summaryPrompt(
        context,
      )
        .map((line) => `• ${line}`)
        .join('\n')}\n\nDoes this look like the perfect escape? Once you confirm, I'll build your full trip card.`,
      suggestions: ['Confirm summary', 'Change dates', 'Add more activities'],
      summaryActions: true,
    }
  }

  if (justCapturedDestination) {
    return {
      id: nextId(),
      role: 'assistant',
      content:
        "Johor Bahru! A classic getaway. Whether you're there for the food, the shopping, or to let the kids run wild at Legoland, we'll make it happen.\nTo get us started:\n\n• When are you thinking of heading over?\n• Who is joining the expedition?\n• How long do you want to escape for?",
      suggestions: ['Next weekend', 'Just for a day', 'With family'],
      suggestionField: 'when',
    }
  }

  if (activeField === 'who') {
    return {
      id: nextId(),
      role: 'assistant',
      content:
        "Decisions, decisions! Both are great, but let's narrow it down. Since you're likely coming from Singapore, are you planning a quick solo escape, or is this a family affair? Also, are we looking at a day trip or an overnight stay to really soak in the cafe culture?",
      suggestions: ['This weekend', 'Next weekend', 'Solo trip'],
      suggestionField: 'who',
    }
  }

  if (activeField === 'intent' || lower.includes('overnight')) {
    return {
      id: nextId(),
      role: 'assistant',
      content:
        capturedDelta > 1
          ? "Nice, you answered a couple of checklist items at once. I now have Johor Bahru, a likely Singapore start, solo travel, and an overnight weekend shape. Last piece before I build the itinerary: what would make this trip feel like yours: cafes, shopping, food, relaxation, local activities, or a bit of everything?"
          : "Perfect. I have Johor Bahru, a likely Singapore start, solo travel, and an overnight weekend shape. Last piece before I build the itinerary: what would make this trip feel like yours: cafes, shopping, food, relaxation, local activities, or a bit of everything?",
      suggestions: ['Relaxation and local activities', 'Cafe hopping', 'Food and shopping'],
      suggestionField: 'intent',
    }
  }

  return {
    id: nextId(),
    role: 'assistant',
    content: `Got it. I captured ${captured} of 5 essentials. Next I need ${checklist
      .find((item) => item.key === activeField)
      ?.label.toLowerCase()}.`,
    suggestions: fieldSuggestions[activeField],
    suggestionField: activeField,
  }
}

function isSummaryConfirmation(value: string) {
  const lower = value.toLowerCase()
  return lower.includes('confirm') || lower.includes('sounds good') || lower.includes('looks good') || lower.includes('go ahead')
}

function LaylaTopBar({ onNewTrip }: { onNewTrip?: () => void }) {
  return (
    <div className="layla-topbar">
      <strong>Layla.</strong>
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
    <button type="button" className="trip-checklist-bar-v2" onClick={onToggle} aria-expanded={expanded}>
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
          return (
            <div key={item.key} className={value ? 'checklist-step done' : 'checklist-step'}>
              <span className="step-status">{value ? <Check size={16} /> : null}</span>
              <div>
                <span className="step-label">
                  <Icon size={15} />
                  {item.label}
                </span>
                <strong>{value || item.empty}</strong>
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
}: {
  message: ChatMessage
}) {
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
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmit()
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
        <a href="#layla-help" className="see-help">
          See how I can help you
          <ArrowDown size={18} />
        </a>
      </div>

      <section id="layla-help" className="layla-help-section" aria-label="How Layla helps">
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
  const consumedPendingPrompt = useRef(false)
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

  const progress = capturedCount(context)
  const latestAssistantWithSuggestions = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === 'assistant' && message.suggestions?.length)
  }, [messages])
  const latestSuggestions = useMemo(() => {
    return latestAssistantWithSuggestions?.suggestions ?? fieldSuggestions[activeField]
  }, [activeField, latestAssistantWithSuggestions])

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
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: 'I could not build the trip card right now. Your checklist is still saved here, so confirm again when you are ready.',
        },
      ])
    },
  })

  function startFromHome(value?: string) {
    const prompt = (value ?? homeInput).trim() || 'i want to plan a trip to johor bahru'
    window.sessionStorage.setItem('layla_pending_prompt', prompt)
    navigate({ to: '/chat' })
  }

  function resetChat() {
    window.sessionStorage.removeItem('layla_pending_prompt')
    setInput('')
    setContext(emptyContext)
    setActiveField('whereTo')
    setStage('collecting')
    setChecklistExpanded(false)
    setLastTrip(null)
    setToolTrace([])
    setMessages([])
  }

  function addUserAndAssistant(userText: string, nextContext: TripContext, previousContext: TripContext) {
    const assistant = assistantTurn(nextContext, previousContext, userText)
    setMessages((current) => [...current, { id: nextId(), role: 'user', content: userText }, assistant])
    const nextField = nextMissingField(nextContext)
    setActiveField(nextField ?? assistant.suggestionField ?? 'intent')
    const captured = capturedCount(nextContext)
    if (captured === 4) setChecklistExpanded(true)
    if (captured >= 5) setChecklistExpanded(false)
  }

  function submitMessage() {
    const trimmed = input.trim()
    if (!trimmed || runAgent.isPending) return
    if (progress >= 5 && isSummaryConfirmation(trimmed)) {
      setInput('')
      startGeneration(trimmed)
      return
    }
    if (progress < 5 && isSummaryConfirmation(trimmed)) {
      const missingField = nextMissingField(context) ?? activeField
      const missingLabel = checklist.find((item) => item.key === missingField)?.label.toLowerCase() ?? 'the next detail'
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'user', content: trimmed },
        {
          id: nextId(),
          role: 'assistant',
          content: `Almost there. Before I build the itinerary, I still need ${missingLabel}. Answer that and the checklist can move to the final summary.`,
          suggestions: fieldSuggestions[missingField],
          suggestionField: missingField,
        },
      ])
      setActiveField(missingField)
      setInput('')
      return
    }
    const previousContext = context
    const nextContext = inferContextFromPrompt(trimmed, context)
    setContext(nextContext)
    addUserAndAssistant(trimmed, nextContext, previousContext)
    setInput('')
  }

  function chooseSuggestion(value: string, field?: FieldKey) {
    const selectedField = field ?? activeField
    const previousContext = context
    const withField = applyFieldValue(context, selectedField, value)
    const nextContext = inferContextFromPrompt(value, withField)
    setContext(nextContext)
    addUserAndAssistant(value, nextContext, previousContext)
  }

  function handleSummaryAction(value: string) {
    if (value === 'Confirm summary') {
      startGeneration(value)
      return
    }
    if (value === 'Change dates') {
      setActiveField('when')
      setChecklistExpanded(false)
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: 'No problem. Tell me the better date window and I will update the trip brief before building it.',
          suggestions: ['This weekend', 'Next weekend', 'May 29 - May 30'],
          suggestionField: 'when',
        },
      ])
      return
    }
    setActiveField('intent')
    setChecklistExpanded(false)
    setMessages((current) => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        content: 'Add the vibe you want and I will fold it into the itinerary brief before generation.',
        suggestions: ['Cafe hopping', 'Local food', 'Relaxing activities'],
        suggestionField: 'intent',
      },
    ])
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
    if (compact || consumedPendingPrompt.current) return
    const pendingPrompt = window.sessionStorage.getItem('layla_pending_prompt')
    if (!pendingPrompt) return
    consumedPendingPrompt.current = true
    window.sessionStorage.removeItem('layla_pending_prompt')
    const nextContext = inferContextFromPrompt(pendingPrompt, emptyContext)
    setContext(nextContext)
    addUserAndAssistant(pendingPrompt, nextContext, emptyContext)
  }, [compact])

  useEffect(() => {
    if (checklistExpanded) return
    const frame = window.requestAnimationFrame(() => {
      const scrollNode = chatScrollRef.current
      if (!scrollNode) return
      scrollNode.scrollTo({ top: scrollNode.scrollHeight, behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [checklistExpanded, messages.length])

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
        <LaylaTopBar onNewTrip={resetChat} />
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
            <TripChecklistBar context={context} expanded={checklistExpanded} onToggle={() => setChecklistExpanded((value) => !value)} />
            {checklistExpanded ? <TripChecklistSheet context={context} /> : null}

            <div className="layla-chat-scroll" ref={chatScrollRef}>
              {messages.length === 0 ? (
                <div className="layla-empty-chat">
                  <CheckCircle2 size={20} />
                  <strong>Tell me the trip you want.</strong>
                  <span>I will guide you through five quick decisions and build the itinerary from there.</span>
                </div>
              ) : null}
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {toolTrace.length > 0 ? <span className="sr-only">{toolTrace.length} agent steps queued</span> : null}
            </div>

            <div className="layla-chat-footer">
              {latestSuggestions.length > 0 ? (
                <div className="layla-footer-chips">
                  {latestSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        latestAssistantWithSuggestions?.summaryActions
                          ? handleSummaryAction(suggestion)
                          : chooseSuggestion(suggestion, latestAssistantWithSuggestions?.suggestionField ?? activeField)
                      }
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              <StickyComposer input={input} setInput={setInput} onSubmit={submitMessage} disabled={runAgent.isPending} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
