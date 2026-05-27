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
  suggestionField?: AgentField
  messageIntent?: 'checklist_step' | 'add_activity' | 'confirm_trip' | 'change_checklist' | 'clarify'
  addActivities?: string[]
  shouldFinish?: boolean
  confidence?: number
}) {
  return {
    assistantMessage: input.assistantMessage,
    contextPatch: { ...emptyPatch(), ...input.contextPatch },
    activeField: input.activeField,
    suggestionField: input.suggestionField ?? input.activeField,
    messageIntent: input.messageIntent ?? 'checklist_step',
    addActivities: input.addActivities ?? [],
    suggestedReplies: input.suggestedReplies,
    shouldFinish: input.shouldFinish ?? false,
    confidence: input.confidence ?? 88,
  }
}

/** Scripted model turns for a Johor Bahru weekend flow (matches checklist order). */
export function johorWeekendModelTurns() {
  return [
    modelTurn({
      assistantMessage: 'Johor Bahru is a great pick. Where are you setting off from?',
      activeField: 'whereFrom',
      contextPatch: { whereTo: 'Johor Bahru' },
      suggestedReplies: ['Singapore', 'Kuala Lumpur', 'Batam'],
    }),
    modelTurn({
      assistantMessage: 'Singapore works. When would you like to go?',
      activeField: 'when',
      contextPatch: { whereFrom: 'Singapore' },
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
      assistantMessage: 'All set — I can build your trip card whenever you confirm.',
      activeField: 'intent',
      contextPatch: { intent: 'Cafe hopping' },
      suggestedReplies: ['Confirm summary', 'Change dates', 'Add more activities'],
      shouldFinish: true,
    }),
  ]
}
