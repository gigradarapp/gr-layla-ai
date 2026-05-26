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
  it('walks whereTo → when → who → intent → whereFrom with field-correct pills', async () => {
    const modelTurns = johorWeekendModelTurns()
    const { results, context } = await runScenario(
      [
        { message: 'Plan a trip to Johor Bahru from Singapore, mid budget' },
        { message: 'Fri 29 May – Sun 31 May' },
        { message: 'Solo trip' },
        { message: 'Cafe hopping' },
        { message: 'Singapore' },
      ],
      modelTurns,
    )

    assert.equal(results.length, 5)
    assert.equal(results[0].mode, 'model')
    assert.equal(results[0].activeField, 'when')
    assertPillsMatchField(results[0].suggestedReplies, 'when')
    assertNoScriptedCopy(results[0].assistantMessage)

    assert.equal(results[1].activeField, 'who')
    assertPillsMatchField(results[1].suggestedReplies, 'who')
    assert.match(context.when ?? '', /fri 29 may/i)

    assert.equal(results[2].activeField, 'intent')
    assertPillsMatchField(results[2].suggestedReplies, 'intent')

    assert.equal(results[3].activeField, 'whereFrom')

    assert.equal(results[4].shouldFinish, true)
    assert.equal(context.whereTo.toLowerCase(), 'johor bahru')
    assert.equal(context.whereFrom, 'Singapore')
    assert.match(context.who ?? '', /solo/i)
    assert.match(context.intent ?? '', /cafe/i)
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
      context: { ...first.contextPatch, whereTo: 'Johor Bahru' },
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
