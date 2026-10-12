import { z } from 'zod'

export const reviewSignupRequestSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export type ReviewSignupRequestInput = z.infer<typeof reviewSignupRequestSchema>
