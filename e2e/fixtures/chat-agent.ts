import type { AgentChatResponse } from '../../src/lib/types'

function patch(partial: Partial<AgentChatResponse['contextPatch']>): AgentChatResponse['contextPatch'] {
  return {
    whereTo: '',
    whereFrom: '',
    who: '',
    when: '',
    intent: '',
    budgetLevel: '',
    pace: '',
    ...partial,
  }
}

export function chatResponse(input: {
  assistantMessage: string
  activeField: AgentChatResponse['activeField']
  suggestedReplies: string[]
  contextPatch?: Partial<AgentChatResponse['contextPatch']>
  shouldFinish?: boolean
}): AgentChatResponse {
  return {
    mode: 'model',
    assistantMessage: input.assistantMessage,
    contextPatch: patch(input.contextPatch),
    activeField: input.activeField,
    suggestedReplies: input.suggestedReplies,
    shouldFinish: input.shouldFinish ?? false,
    confidence: 90,
    trace: [{ name: 'model_chat_call', label: 'Call chat model', status: 'complete', result: 'mock' }],
  }
}

/** Full Johor Bahru checklist — one API response per user turn. */
export function johorChatScript(): AgentChatResponse[] {
  return [
    chatResponse({
      assistantMessage:
        'Johor Bahru is ideal for a quick getaway. When would you like to go — pick a weekend window?',
      activeField: 'when',
      contextPatch: { whereTo: 'Johor Bahru, Malaysia' },
      suggestedReplies: ['Fri 29 May – Sun 31 May', 'Sat 30 May – Mon 1 Jun'],
    }),
    chatResponse({
      assistantMessage: 'Those dates work. Who is joining you?',
      activeField: 'who',
      contextPatch: { when: 'Fri 29 May – Sun 31 May' },
      suggestedReplies: ['Solo trip', 'Couple trip', 'Family with kids'],
    }),
    chatResponse({
      assistantMessage: 'Solo — nice. What should this trip feel like?',
      activeField: 'intent',
      contextPatch: { who: 'Solo' },
      suggestedReplies: ['Eat & café-hop', 'Relax & unwind', 'Suggest more recommendations...'],
    }),
    chatResponse({
      assistantMessage: 'Got it. Where are you travelling from?',
      activeField: 'whereFrom',
      contextPatch: { intent: 'Cafe hopping' },
      suggestedReplies: ['Singapore', 'Kuala Lumpur'],
    }),
    chatResponse({
      assistantMessage: 'Here is the plan so far. Does this look right before I build your trip card?',
      activeField: 'whereFrom',
      contextPatch: { whereFrom: 'Singapore' },
      suggestedReplies: ['Confirm summary', 'Change dates', 'Add more activities'],
      shouldFinish: true,
    }),
  ]
}
