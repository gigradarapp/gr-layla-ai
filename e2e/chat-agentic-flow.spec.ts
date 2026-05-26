import { expect, test } from '@playwright/test'
import { chatResponse, johorChatScript } from './fixtures/chat-agent'

type ChatPayload = {
  message: string
  context?: Record<string, string>
  moreSuggestions?: { field: string; exclude: string[] }
}

function replyForPayload(payload: ChatPayload) {
  const message = payload.message.toLowerCase()
  const [whenStep, whoStep, intentStep, whereFromStep, summaryStep] = johorChatScript()

  if (payload.moreSuggestions || /add more activit/i.test(message)) {
    return chatResponse({
      assistantMessage: 'Add what you like:',
      activeField: 'intent',
      suggestedReplies: ['Culture & heritage', 'Night food crawl', 'Hidden local gems'],
      shouldFinish: false,
    })
  }

  const ctx = payload.context ?? {}

  if (/fri 29 may|sat 30 may|thu 4 jun/.test(message)) return whoStep
  if (payload.message.trim().toLowerCase() === 'solo trip') return intentStep
  if (/café-hop|cafe hopping|cafe hop/.test(message)) return whereFromStep
  if (message.includes('singapore') && ctx.intent) return summaryStep
  if (/johor|plan a trip|plan trip/.test(message)) return whenStep

  return whenStep
}

test.describe('Layla chat — agentic UI flow (mocked API)', () => {
  test('completes Johor checklist with flat scrollable pills and summary actions', async ({ page }) => {
    await page.route('**/api/agent/chat', async (route) => {
      const payload = route.request().postDataJSON() as ChatPayload
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: replyForPayload(payload),
      })
    })

    await page.route('**/api/agent/plan', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        json: {
          mode: 'model',
          trace: [],
          trip: {
            id: 'trip_test',
            title: 'Johor Bahru Weekend',
            destination: 'Johor Bahru',
            heroImageUrl: 'https://example.com/jb.jpg',
            days: [],
          },
        },
      })
    })

    await page.goto('/chat')
    await expect(page.getByText('Layla.')).toBeVisible()

    const composer = page.getByRole('textbox', { name: 'Ask Layla anything' })
    await composer.fill('plan a trip to johor bahru')
    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page.getByText(/weekend window|when would you like to go/i)).toBeVisible({ timeout: 20_000 })

    const datePill = page.getByRole('button', { name: 'Fri 29 May – Sun 31 May' })
    await expect(datePill).toBeVisible()
    await expect(datePill).toHaveCSS('white-space', 'nowrap')
    await datePill.click()

    await expect(page.getByText(/who is joining/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Solo trip' }).click()

    await expect(page.getByText(/what should this trip feel like/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Eat & café-hop' }).click()

    // JB trips infer Singapore as origin once who/when/intent are set — summary is shown without a whereFrom turn.
    await expect(page.getByText(/plan so far/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Confirm summary' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Change dates' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add more activities' })).toBeVisible()

    await page.getByRole('button', { name: 'Add more activities' }).click()
    await expect(page.getByText('Add more activities', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: "I'm good" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Culture & heritage' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Night food crawl' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add more suggestions...' })).toBeVisible()

    await page.getByRole('button', { name: 'Culture & heritage' }).click()
    await expect(page.getByText(/added "culture & heritage"/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Suggested replies').getByRole('button', { name: "I'm good" })).toBeVisible()

    await page.getByLabel('Suggested replies').getByRole('button', { name: "I'm good" }).click()
    await expect(page.getByRole('button', { name: 'Confirm summary' }).last()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Expand trip checklist' }).click()
    await expect(page.locator('.checklist-activity-subitems').getByText('Culture & heritage')).toBeVisible()
    await expect(page.locator('.step-activity-count').filter({ hasText: '2/5' })).toBeVisible()
  })

  test('send button works while a chat request is in flight', async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let callIndex = 0

    await page.route('**/api/agent/chat', async (route) => {
      if (callIndex === 0) {
        callIndex += 1
        await gate
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: chatResponse({
          assistantMessage: 'When would you like to go?',
          activeField: 'when',
          contextPatch: { whereTo: 'Johor Bahru' },
          suggestedReplies: ['Fri 29 May – Sun 31 May'],
        }),
      })
    })

    await page.goto('/chat')
    await expect(page.getByText('Layla.')).toBeVisible()
    const composer = page.getByRole('textbox', { name: 'Ask Layla anything' })
    await composer.fill('plan johor bahru trip')
    await page.getByRole('button', { name: 'Send message' }).click()

    await composer.fill('would u recommend another weekend?')

    const send = page.getByRole('button', { name: 'Send message' })
    await expect(send).toBeEnabled()
    release()
    await send.click()
    await expect(page.getByText('would u recommend another weekend?', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
  })
})
