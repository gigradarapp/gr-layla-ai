import { extractResponseText } from './openaiText.js'

/** Ask the model for a Wikimedia-friendly photo search phrase for a specific place. */
export async function suggestImageSearchQuery(input: {
  label: string
  destination: string
  kind: 'hotel' | 'day'
  hints?: string[]
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL || 'gpt-5.2'
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
            'Return one short English search phrase for Openverse/Wikimedia photo search. Name the exact hotel building, restaurant street, or landmark — never a person, ruler, bird, flag, or city-only query. JSON only: {"query":"..."}',
        },
        {
          role: 'user',
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'image_search_query',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['query'],
            properties: {
              query: { type: 'string' },
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
    const parsed = JSON.parse(text) as { query?: string }
    const query = parsed.query?.trim()
    return query && query.length > 3 ? query : null
  } catch {
    return null
  }
}
