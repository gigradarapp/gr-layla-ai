export function extractResponseText(body: Record<string, unknown>) {
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
