import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { hasSeedData, migrate } from '../db/sqlite.js'
import { seedDatabase } from '../db/seed.js'
import { loadLocalEnv } from '../env.js'
import { runTravelChat } from '../services/agent.js'
import { johorWeekendModelTurns, modelTurn } from './helpers/agent-fixtures.js'
import { installOpenAiMock, queueOpenAiTurns, restoreFetch } from './helpers/openai-mock.js'

type ChatResult = Awaited<ReturnType<typeof runTravelChat>>

function assertNoScriptedCopy(message: string) {
  assert.doesNotMatch(message, /Decisions, decisions/i)
  assert.doesNotMatch(message, /kids run wild at Legoland/i)
}

function assertPillsMatchField(pills: string[], field: string) {
  const lower = pills.map((pill) => pill.toLowerCase()).join('|')
  if (field === 'who') {
    assert.doesNotMatch(lower, /fri \d+|sat \d+|may –|jun –/i, 'who pills must not look like date windows')
    assert.match(lower, /solo|couple|family|friend|group/i)
  }
  if (field === 'when') {
    assert.match(lower, /may|jun|fri|sat|sun|–|-/i)
    assert.doesNotMatch(lower, /^solo trip$|^couple trip$/i)
  }
  if (field === 'intent') {
    assert.doesNotMatch(lower, /solo trip|couple trip|family with kids/i)
  }
}

function mergeContext(current: Record<string, string>, patch: Record<string, string>) {
  const next = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value) next[key] = value
  }
  return next
}

async function runScenario(
  steps: Array<{ message: string; context?: Record<string, string> }>,
  modelTurns: ReturnType<typeof modelTurn>[],
) {
  queueOpenAiTurns(modelTurns)
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let context: Record<string, string> = { budgetLevel: 'mid', pace: 'balanced' }
  const results: ChatResult[] = []

  for (const step of steps) {
    context = mergeContext(context, step.context ?? {})
    const result = await runTravelChat({
      message: step.message,
      context,
      history,
    })
    results.push(result)
    context = mergeContext(context, result.contextPatch)
    history.push({ role: 'user', content: step.message })
    history.push({ role: 'assistant', content: result.assistantMessage })
  }

  return { results, context }
}

before(() => {
  loadLocalEnv()
  process.env.OPENAI_API_KEY = 'test-key-for-agentic-suite'
  migrate()
  if (!hasSeedData()) seedDatabase()
  installOpenAiMock()
})

after(() => {
  restoreFetch()
  delete process.env.OPENAI_API_KEY
})

describe('agentic chat — Johor Bahru checklist', () => {
  it('walks whereTo → whereFrom → when → who → intent with field-correct pills', async () => {
    const modelTurns = johorWeekendModelTurns()
    const { results, context } = await runScenario(
      [
        { message: 'Plan a trip to Johor Bahru' },
        { message: 'Singapore' },
        { message: 'Fri 29 May – Sun 31 May' },
        { message: 'Solo trip' },
        { message: 'Cafe hopping' },
      ],
      modelTurns,
    )

    assert.equal(results.length, 5)
    assert.equal(results[0].mode, 'model')
    assert.equal(results[0].activeField, 'whereFrom')
    assert.match(results[0].suggestedReplies.join('|').toLowerCase(), /singapore/)

    assert.equal(results[1].activeField, 'when')
    assertPillsMatchField(results[1].suggestedReplies, 'when')
    assert.equal(context.whereFrom, 'Singapore')

    assert.equal(results[2].activeField, 'who')
    assertPillsMatchField(results[2].suggestedReplies, 'who')
    assert.match(context.when ?? '', /fri 29 may/i)

    assert.equal(results[3].activeField, 'intent')
    assertPillsMatchField(results[3].suggestedReplies, 'intent')

    assert.equal(results[4].shouldFinish, true)
    assert.equal(context.whereTo.toLowerCase(), 'johor bahru')
    assert.match(context.who ?? '', /solo/i)
    assert.match(context.intent ?? '', /cafe/i)
  })

  it('keeps date pills on when for weekends-only refinement', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Johor Bahru works. When would you like to go?',
        activeField: 'when',
        contextPatch: { whereTo: 'Johor Bahru' },
        suggestedReplies: ['Sat 31 May – Sun 1 Jun'],
      }),
      modelTurn({
        assistantMessage: 'Got it — weekends only. Which dates work best?',
        activeField: 'who',
        contextPatch: { who: 'Sat 14 Jun – Sun 15 Jun', when: 'Sat 14 Jun – Sun 15 Jun' },
        suggestedReplies: ['Sat 31 May – Sun 1 Jun', 'Sat 14 Jun – Sun 15 Jun'],
      }),
    ])

    const first = await runTravelChat({
      message: 'i want to plan a trip to johor bahru',
      context: { budgetLevel: 'mid' },
      history: [],
    })

    const second = await runTravelChat({
      message: 'i want to plan a trip between weekends only.',
      context: { ...first.contextPatch, whereTo: 'Johor Bahru, Malaysia', whereFrom: 'Singapore' },
      focusField: 'when',
      history: [
        { role: 'user', content: 'i want to plan a trip to johor bahru' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.equal(second.activeField, 'when')
    assert.equal(second.contextPatch.who, '')
    assertPillsMatchField(second.suggestedReplies, 'when')
  })

  it('stays on when when the user asks to refine weekend dates', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Johor Bahru sounds great. When would you like to go?',
        activeField: 'when',
        contextPatch: { whereTo: 'Johor Bahru' },
        suggestedReplies: ['Fri 29 May – Sun 31 May'],
      }),
      modelTurn({
        assistantMessage: 'Here are a few Sat–Sun windows for Johor Bahru:',
        activeField: 'when',
        contextPatch: { when: '' },
        suggestedReplies: ['Sat 30 May – Sun 31 May', 'Sat 6 Jun – Sun 7 Jun'],
      }),
    ])

    const first = await runTravelChat({
      message: 'Plan a trip to Johor Bahru',
      context: { budgetLevel: 'mid' },
      history: [],
    })

    const second = await runTravelChat({
      message: 'i want between sat and sun only, suggest me the dates again.',
      context: { ...first.contextPatch, whereTo: 'Johor Bahru', whereFrom: 'Singapore', when: 'Sat 30 May – Sun 31 May' },
      focusField: 'when',
      history: [
        { role: 'user', content: 'Plan a trip to Johor Bahru' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.equal(second.activeField, 'when')
    assertPillsMatchField(second.suggestedReplies, 'when')
    assert.doesNotMatch(second.assistantMessage, /who is travelling|who's coming|last one/i)
  })

  it('does not skip ahead when the user answers a later step too early', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Johor Bahru sounds great. When would you like to go?',
        activeField: 'when',
        contextPatch: { whereTo: 'Johor Bahru, Malaysia' },
        suggestedReplies: ['Sat 31 May – Sun 1 Jun'],
      }),
      modelTurn({
        assistantMessage: 'Solo works. Who is travelling?',
        activeField: 'who',
        contextPatch: { who: 'Solo' },
        suggestedReplies: ['Solo', 'Couple', 'Family with kids'],
      }),
    ])

    const first = await runTravelChat({
      message: 'i want to plan a trip to johor bahru',
      context: { budgetLevel: 'mid', pace: 'balanced' },
      history: [],
    })

    const second = await runTravelChat({
      message: 'Solo',
      context: {
        ...first.contextPatch,
        whereTo: 'Johor Bahru, Malaysia',
        budgetLevel: 'mid',
        pace: 'balanced',
      },
      history: [
        { role: 'user', content: 'i want to plan a trip to johor bahru' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.equal(second.activeField, 'whereFrom')
    assert.equal(second.contextPatch.who, '')
    assert.equal(second.contextPatch.when, '')
    assert.match(second.suggestedReplies.join('|').toLowerCase(), /singapore/)
  })

  it('stays on when after a vague timing hint like "This weekend"', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Great choice — Johor Bahru it is. When are you thinking of going?',
        activeField: 'when',
        contextPatch: { whereTo: 'Johor Bahru, Malaysia' },
        suggestedReplies: ['This weekend', 'Next weekend', 'In June'],
      }),
      modelTurn({
        assistantMessage: "Got it — this weekend. Who's travelling?",
        activeField: 'who',
        contextPatch: { when: 'This weekend' },
        suggestedReplies: ['Solo', 'Couple', 'Family with kids', 'Friends'],
      }),
    ])

    const first = await runTravelChat({
      message: 'i want to plan a trip to johor bahru',
      context: { budgetLevel: 'mid', pace: 'balanced' },
      history: [],
    })

    const second = await runTravelChat({
      message: 'This weekend',
      context: {
        ...first.contextPatch,
        whereTo: 'Johor Bahru, Malaysia',
        whereFrom: 'Singapore',
        budgetLevel: 'mid',
        pace: 'balanced',
      },
      focusField: 'when',
      history: [
        { role: 'user', content: 'i want to plan a trip to johor bahru' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.equal(second.activeField, 'when')
    assert.equal(second.contextPatch.when, '')
    assertPillsMatchField(second.suggestedReplies, 'when')
    assert.doesNotMatch(second.assistantMessage, /who(?:'s| is) (?:travelling|coming)/i)
  })

  it('captures comma-formatted date windows', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Johor Bahru works. Where are you setting off from?',
        activeField: 'whereFrom',
        contextPatch: { whereTo: 'Johor Bahru' },
        suggestedReplies: ['Singapore'],
      }),
      modelTurn({
        assistantMessage: 'Great dates. Who is travelling?',
        activeField: 'who',
        contextPatch: { whereFrom: 'Singapore', when: 'Sat, 6 Jun – Sun, 7 Jun' },
        suggestedReplies: ['Solo trip'],
      }),
    ])

    const first = await runTravelChat({
      message: 'Plan a trip to Johor Bahru',
      context: { budgetLevel: 'mid' },
      history: [],
    })
    const second = await runTravelChat({
      message: 'Sat, 6 Jun – Sun, 7 Jun',
      context: { ...first.contextPatch, whereTo: 'Johor Bahru', whereFrom: 'Singapore' },
      history: [
        { role: 'user', content: 'Plan a trip to Johor Bahru' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.match(second.contextPatch.when ?? '', /6 jun/i)
    assert.equal(second.activeField, 'who')
  })

  it('classifies "good to go" as confirm_trip via model intent', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Building your Johor Bahru itinerary now.',
        activeField: 'intent',
        contextPatch: {},
        suggestedReplies: [],
        messageIntent: 'confirm_trip',
        shouldFinish: true,
      }),
    ])

    const result = await runTravelChat({
      message: 'good to go.',
      context: {
        whereTo: 'Johor Bahru, Malaysia',
        whereFrom: 'Singapore',
        when: 'Sat 30 May – Sun 31 May',
        who: 'Solo',
        intent: 'Food and shopping',
        budgetLevel: 'mid',
        pace: 'balanced',
      },
      history: [
        { role: 'assistant', content: 'Here is your trip summary. Ready to confirm?' },
      ],
    })

    assert.equal(result.messageIntent, 'confirm_trip')
    assert.equal(result.addActivities.length, 0)
  })

  it('does not overwrite checklist fields on activity picks', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Added night markets — want another activity?',
        activeField: 'intent',
        suggestionField: 'intent',
        messageIntent: 'add_activity',
        addActivities: ['Night market exploring'],
        contextPatch: { whereFrom: 'Night market exploring', when: '' },
        suggestedReplies: ['Eat & café-hop', 'Relax & unwind', 'Shopping + markets'],
      }),
    ])

    const result = await runTravelChat({
      message: 'Night market exploring',
      context: {
        whereTo: 'Johor Bahru, Malaysia',
        whereFrom: 'Singapore',
        when: 'Sat 6 Jun – Sun 7 Jun',
        who: 'Solo',
        intent: 'Relaxation and local activities',
        budgetLevel: 'mid',
        pace: 'balanced',
      },
      history: [],
    })

    assert.equal(result.activeField, 'intent')
    assert.equal(result.contextPatch.whereFrom, 'Singapore')
    assert.match(result.contextPatch.when ?? '', /6 jun/i)
  })

  it('does not re-ask when after a date window is captured', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Locked in Johor Bahru. When would you like to go?',
        activeField: 'when',
        contextPatch: { whereTo: 'Johor Bahru' },
        suggestedReplies: ['Fri 29 May – Sun 31 May'],
      }),
      modelTurn({
        assistantMessage: 'Great dates. Who is travelling?',
        activeField: 'who',
        contextPatch: { when: 'Fri 29 May – Sun 31 May' },
        suggestedReplies: ['Solo trip', 'Couple trip'],
      }),
    ])

    const first = await runTravelChat({
      message: 'Johor Bahru weekend',
      context: { budgetLevel: 'mid' },
      history: [],
    })
    const second = await runTravelChat({
      message: 'Fri 29 May – Sun 31 May',
      context: { ...first.contextPatch, whereTo: 'Johor Bahru', whereFrom: 'Singapore' },
      history: [
        { role: 'user', content: 'Johor Bahru weekend' },
        { role: 'assistant', content: first.assistantMessage },
      ],
    })

    assert.equal(second.activeField, 'who')
    assert.doesNotMatch(second.assistantMessage, /when would you like|pick a.*weekend|sat–sun/i)
    assertPillsMatchField(second.suggestedReplies, 'who')
  })
})

describe('agentic chat — more suggestions', () => {
  it('returns fresh intent pills without repeating excluded options', async () => {
    queueOpenAiTurns([
      modelTurn({
        assistantMessage: 'Here are a few more ideas:',
        activeField: 'intent',
        contextPatch: {},
        suggestedReplies: ['Culture & heritage', 'Night food crawl', 'Hidden local gems'],
      }),
    ])

    const result = await runTravelChat({
      message: 'Suggest more recommendations',
      context: {
        whereTo: 'Johor Bahru',
        when: 'Fri 29 May – Sun 31 May',
        who: 'solo',
        budgetLevel: 'mid',
      },
      moreSuggestions: {
        field: 'intent',
        exclude: ['Eat & café-hop', 'Relax & unwind', 'Shopping + markets'],
      },
    })

    assert.equal(result.mode, 'model')
    const joined = result.suggestedReplies.join('|').toLowerCase()
    assert.doesNotMatch(joined, /eat & café-hop|relax & unwind|shopping \+ markets/)
    assert.ok(result.suggestedReplies.length >= 2)
  })
})

describe('agentic chat — offline fallback', () => {
  it('uses generic fallback copy (no canned JB script)', async () => {
    restoreFetch()
    delete process.env.OPENAI_API_KEY

    const result = await runTravelChat({
      message: 'Plan Johor Bahru solo weekend',
      context: { budgetLevel: 'mid' },
      history: [],
    })

    assert.equal(result.mode, 'fallback')
    assertNoScriptedCopy(result.assistantMessage)
    assert.ok(result.suggestedReplies.length >= 1)

    process.env.OPENAI_API_KEY = 'test-key-for-agentic-suite'
    installOpenAiMock()
  })
})
