type MockTurn = Record<string, unknown>

const originalFetch = globalThis.fetch
let queue: MockTurn[] = []
let installed = false

function openAiBody(turn: MockTurn) {
  return {
    output_text: JSON.stringify(turn),
  }
}

export function queueOpenAiTurns(turns: MockTurn[]) {
  queue = [...turns]
}

export function installOpenAiMock() {
  if (installed) return
  installed = true

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('api.openai.com/v1/responses')) {
      const next = queue.shift()
      if (!next) {
        throw new Error('OpenAI mock queue exhausted — more model calls than queued turns.')
      }
      return new Response(JSON.stringify(openAiBody(next)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(input, init)
  }) as typeof fetch
}

export function restoreFetch() {
  if (!installed) return
  globalThis.fetch = originalFetch
  installed = false
  queue = []
}
