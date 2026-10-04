'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as systemAccounts from '@/server/services/system-accounts.service'

const assignSchema = z.object({
  key: z.enum([
    'ACCOUNTS_RECEIVABLE',
    'ACCOUNTS_PAYABLE',
    'UNDEPOSITED_FUNDS',
    'INVENTORY_ASSET',
    'COGS',
    'SALES_TAX_PAYABLE',
    'RETAINED_EARNINGS',
    'OPENING_BALANCE_EQUITY',
    'EXCHANGE_GAIN_LOSS',
    'ROUNDING_DIFFERENCE',
    'INVENTORY_SHRINKAGE',
    'UNCATEGORISED_INCOME',
    'UNCATEGORISED_EXPENSE',
  ]),
  accountId: cuid,
})

/**
 * Changing where the system posts is an `account:update` matter, not an
 * `org:update` one: it is a decision about the chart of accounts, and the person
 * allowed to make it is the person allowed to restructure the chart.
 */
export const assignSystemAccount = action
  .requires('account:update')
  .input(assignSchema)
  .handler(async (ctx, input) => {
    const result = await systemAccounts.assign(ctx, input.key, input.accountId)

    revalidatePath('/settings/accounts')
    revalidatePath('/accounts')
    return result
  })
