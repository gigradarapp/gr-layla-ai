export type AgentField = 'whereTo' | 'whereFrom' | 'who' | 'when' | 'intent'

export function emptyPatch() {
  return {
    whereTo: '',
    whereFrom: '',
    who: '',
    when: '',
    intent: '',
    budgetLevel: '',
    pace: '',
  }
}

export function modelTurn(input: {
  assistantMessage: string
  activeField: AgentField
  suggestedReplies: string[]
  contextPatch?: Partial<ReturnType<typeof emptyPatch>>
  shouldFinish?: boolean
  confidence?: number
}) {
  return {
    assistantMessage: input.assistantMessage,
    contextPatch: { ...emptyPatch(), ...input.contextPatch },
    activeField: input.activeField,
    suggestedReplies: input.suggestedReplies,
    shouldFinish: input.shouldFinish ?? false,
    confidence: input.confidence ?? 88,
  }
}

/** Scripted model turns for a Johor Bahru weekend flow (matches checklist order). */
export function johorWeekendModelTurns() {
  return [
    modelTurn({
      assistantMessage:
        'Johor Bahru is a great pick for a quick escape from Singapore. When would you like to go?',
      activeField: 'when',
      contextPatch: { whereTo: 'Johor Bahru' },
      suggestedReplies: ['Fri 29 May – Sun 31 May', 'Sat 30 May – Mon 1 Jun', 'Thu 4 Jun – Fri 5 Jun'],
    }),
    modelTurn({
      assistantMessage: 'Perfect — that weekend works. Who is travelling?',
      activeField: 'who',
      contextPatch: { when: 'Fri 29 May – Sun 31 May' },
      suggestedReplies: ['Solo trip', 'Couple trip', 'Family with kids'],
    }),
    modelTurn({
      assistantMessage: 'Solo it is. What vibe are you after on this trip?',
      activeField: 'intent',
      contextPatch: { who: 'solo' },
      suggestedReplies: ['Eat & café-hop', 'Relax & unwind', 'Shopping + markets'],
    }),
    modelTurn({
      assistantMessage: 'Love it — café-hopping suits JB well. Where are you flying out from?',
      activeField: 'whereFrom',
      contextPatch: { intent: 'Cafe hopping' },
      suggestedReplies: ['Singapore', 'Kuala Lumpur', 'Batam'],
    }),
    modelTurn({
      assistantMessage: 'All set — I can build your trip card whenever you confirm.',
      activeField: 'whereFrom',
      contextPatch: { whereFrom: 'Singapore' },
      suggestedReplies: ['Confirm summary', 'Change dates', 'Add more activities'],
      shouldFinish: true,
    }),
  ]
}
