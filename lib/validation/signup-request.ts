import { z } from 'zod'

const boolFlag = z
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('on')])
  .transform((v) => v === true || v === 'true' || v === 'on')

/**
 * System owner reviews a public /register request.
 * On approve, apps may be edited (add or remove from what the applicant asked for).
 */
export const reviewSignupRequestSchema = z
  .object({
    id: z.string().cuid(),
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).optional(),
    moduleSales: boolFlag.optional(),
    modulePurchases: boolFlag.optional(),
    moduleBanking: boolFlag.optional(),
    moduleInventory: boolFlag.optional(),
    modulePos: boolFlag.optional(),
    moduleAccounting: boolFlag.optional(),
    moduleReports: boolFlag.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'approve') return
    const keys = [
      v.moduleSales,
      v.modulePurchases,
      v.moduleBanking,
      v.moduleInventory,
      v.modulePos,
      v.moduleAccounting,
      v.moduleReports,
    ]
    // When the owner sends an apps override, at least one must stay on.
    if (keys.every((value) => value === undefined)) return
    if (!keys.some((value) => value === true)) {
      ctx.addIssue({
        code: 'custom',
        path: ['moduleSales'],
        message: 'Leave at least one app on for this company.',
      })
    }
  })

export type ReviewSignupRequestInput = z.infer<typeof reviewSignupRequestSchema>
