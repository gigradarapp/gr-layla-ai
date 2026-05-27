export type ChatMessageIntent = 'checklist_step' | 'add_activity' | 'confirm_trip' | 'change_checklist' | 'clarify'

export type ConversationPhase = 'checklist' | 'activities' | 'summary'

export type ChatIntentContext = {
  whereTo?: string
  whereFrom?: string
  who?: string
  when?: string
  intent?: string
}

export function conversationPhase(
  context: ChatIntentContext,
  options?: { hasSummaryActions?: boolean; activityCount?: number },
): ConversationPhase {
  if (options?.hasSummaryActions) return 'summary'
  const essentials =
    Boolean(context.whereTo?.trim()) &&
    Boolean(context.whereFrom?.trim()) &&
    Boolean(context.when?.trim()) &&
    Boolean(context.who?.trim()) &&
    Boolean(context.intent?.trim())
  if (essentials) return 'activities'
  return 'checklist'
}
