import type { Router } from 'express'
import { z } from 'zod'
import { runTravelAgent, runTravelChat } from '../services/agent.js'

const agentPlanSchema = z.object({
  prompt: z.string().min(4),
  context: z
    .object({
      whereTo: z.string().optional(),
      whereFrom: z.string().optional(),
      who: z.string().optional(),
      when: z.string().optional(),
      intent: z.string().optional(),
      budgetLevel: z.string().optional(),
      pace: z.string().optional(),
    })
    .optional(),
})

const agentChatSchema = z.object({
  message: z.string().min(1),
  context: z
    .object({
      whereTo: z.string().optional(),
      whereFrom: z.string().optional(),
      who: z.string().optional(),
      when: z.string().optional(),
      intent: z.string().optional(),
      budgetLevel: z.string().optional(),
      pace: z.string().optional(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
  moreSuggestions: z
    .object({
      field: z.enum(['whereTo', 'whereFrom', 'who', 'when', 'intent']),
      exclude: z.array(z.string()),
    })
    .optional(),
})

export function registerAgentRoutes(router: Router) {
  router.post('/agent/chat', async (req, res) => {
    const result = agentChatSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid agent chat request', details: result.error.flatten() })
      return
    }

    try {
      const output = await runTravelChat(result.data)
      res.status(200).json(output)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Agent chat failed' })
    }
  })

  router.post('/agent/plan', async (req, res) => {
    const result = agentPlanSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid agent request', details: result.error.flatten() })
      return
    }

    try {
      const output = await runTravelAgent(result.data)
      res.status(201).json(output)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Agent planner failed' })
    }
  })
}
