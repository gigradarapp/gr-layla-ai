import type {
  CreateTripPayload,
  AgentChatResponse,
  AgentPlanResponse,
  DashboardSummary,
  Destination,
  Offer,
  Trip,
  TripDetail,
  ChatMessage,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      message = body.error ?? message
    } catch {
      // keep HTTP message
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  destinations(params?: { vibe?: string; budget?: string; travelerType?: string }) {
    const search = new URLSearchParams()
    if (params?.vibe) search.set('vibe', params.vibe)
    if (params?.budget) search.set('budget', params.budget)
    if (params?.travelerType) search.set('travelerType', params.travelerType)
    const suffix = search.toString() ? `?${search}` : ''
    return request<Destination[]>(`/api/destinations${suffix}`)
  },
  trips(params?: { q?: string; status?: string }) {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.status) search.set('status', params.status)
    const suffix = search.toString() ? `?${search}` : ''
    return request<Trip[]>(`/api/trips${suffix}`)
  },
  trip(id: string) {
    return request<TripDetail>(`/api/trips/${id}`)
  },
  createTrip(payload: CreateTripPayload) {
    return request<TripDetail>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  agentPlan(payload: {
    prompt: string
    context: {
      whereTo?: string
      whereFrom?: string
      who?: string
      when?: string
      intent?: string
      budgetLevel?: string
      pace?: string
    }
  }) {
    return request<AgentPlanResponse>('/api/agent/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  agentChat(payload: {
    message: string
    context: {
      whereTo?: string
      whereFrom?: string
      who?: string
      when?: string
      intent?: string
      budgetLevel?: string
      pace?: string
    }
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  }) {
    return request<AgentChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  refineTrip(id: string, refinement: string) {
    return request<{ resultSummary: string; trip: TripDetail }>(`/api/trips/${id}/refine`, {
      method: 'POST',
      body: JSON.stringify({ refinement }),
    })
  },
  messages(id: string) {
    return request<ChatMessage[]>(`/api/trips/${id}/messages`)
  },
  offers(params?: { tripId?: string; destinationId?: string; type?: string }) {
    const search = new URLSearchParams()
    if (params?.tripId) search.set('tripId', params.tripId)
    if (params?.destinationId) search.set('destinationId', params.destinationId)
    if (params?.type) search.set('type', params.type)
    const suffix = search.toString() ? `?${search}` : ''
    return request<Offer[]>(`/api/offers${suffix}`)
  },
  dashboardSummary() {
    return request<DashboardSummary>('/api/dashboard/summary')
  },
  dashboardTrips() {
    return request<Trip[]>('/api/dashboard/trips')
  },
  dashboardMessages() {
    return request<ChatMessage[]>('/api/dashboard/messages')
  },
}
