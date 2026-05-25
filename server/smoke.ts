const baseUrl = process.env.API_URL ?? 'http://localhost:4000'

async function check(path: string) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`)
  }
  return response.json()
}

await check('/health')
await check('/api/destinations')
await check('/api/trips')
await check('/api/dashboard/summary')

const chat = await fetch(`${baseUrl}/api/agent/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'I want a 5 day Japan food trip for two from Singapore',
    context: { whereFrom: 'Singapore', budgetLevel: 'mid', pace: 'balanced' },
    history: [],
  }),
})

if (!chat.ok) {
  throw new Error(`POST /api/agent/chat failed with ${chat.status}`)
}

const created = await fetch(`${baseUrl}/api/trips`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Plan a 5 day Japan food trip for two from Singapore',
    origin: 'Singapore',
    budgetLevel: 'mid',
    travelerType: 'couple',
    pace: 'balanced',
  }),
})

if (!created.ok) {
  throw new Error(`POST /api/trips failed with ${created.status}`)
}

const trip = (await created.json()) as { id: string }
await check(`/api/trips/${trip.id}`)

const agent = await fetch(`${baseUrl}/api/agent/plan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Build an agentic Bali wellness weekend from Singapore',
    context: {
      whereFrom: 'Singapore',
      whereTo: 'Bali',
      who: 'solo',
      when: 'Long weekend',
      intent: 'wellness and beach',
      budgetLevel: 'budget',
      pace: 'slow',
    },
  }),
})

if (!agent.ok) {
  throw new Error(`POST /api/agent/plan failed with ${agent.status}`)
}

console.log('API smoke checks passed')
