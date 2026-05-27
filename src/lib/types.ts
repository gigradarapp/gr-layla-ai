export type Destination = {
  id: string
  name: string
  country: string
  vibe: string
  budgetLevel: string
  weather: string
  idealDuration: string
  travelerTypes: string[]
  flightPriceFrom: number
  imageUrl: string
  summary: string
  highlights: string[]
}

export type Activity = {
  id: string
  tripDayId: string
  time: string
  title: string
  location: string
  category: string
  cost: number
  durationMinutes: number
  notes: string
  confidence: number
}

export type TripDay = {
  id: string
  tripId: string
  dayNumber: number
  date: string
  title: string
  summary: string
  imageUrl: string
  activities: Activity[]
}

export type ChatMessage = {
  id: string
  tripId: string | null
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type Offer = {
  id: string
  tripId: string | null
  destinationId: string | null
  type: 'flight' | 'hotel' | 'activity' | string
  provider: string
  title: string
  price: number
  rating: number
  perks: string[]
  url: string
  imageUrl: string
}

export type Trip = {
  id: string
  userId: string
  title: string
  destination: string
  origin: string
  startDate: string
  endDate: string
  budgetLevel: string
  travelerType: string
  pace: string
  status: string
  summary: string
  estimatedCost: number
  heroImageUrl: string
  confidence: number
  focusActivities: string[]
  createdAt: string
  updatedAt: string
}

export type TripDetail = Trip & {
  days: TripDay[]
  messages: ChatMessage[]
  offers: Offer[]
}

export type DashboardSummary = {
  trips: number
  messages: number
  readyTrips: number
  averageTripValue: number
  byBudget: Array<{ label: string; count: number }>
  byTraveler: Array<{ label: string; count: number }>
}

export type CreateTripPayload = {
  prompt: string
  origin?: string
  startDate?: string
  endDate?: string
  budgetLevel?: string
  travelerType?: string
  pace?: string
}

export type AgentTrace = {
  name: string
  label: string
  status: 'complete' | 'fallback'
  result: string
}

export type AgentPlanResponse = {
  mode: 'model' | 'fallback'
  assistantMessage: string
  plan: {
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
  trace: AgentTrace[]
  trip: TripDetail
}

export type ChatMessageIntent = 'checklist_step' | 'add_activity' | 'confirm_trip' | 'change_checklist' | 'clarify'

export type AgentChatResponse = {
  mode: 'model' | 'fallback'
  assistantMessage: string
  contextPatch: {
    whereTo: string
    whereFrom: string
    who: string
    when: string
    intent: string
    budgetLevel: string
    pace: string
  }
  activeField: 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
  suggestionField: 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'
  messageIntent: ChatMessageIntent
  addActivities: string[]
  suggestedReplies: string[]
  shouldFinish: boolean
  confidence: number
  trace: AgentTrace[]
}
