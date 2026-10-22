'use server'

import { z } from 'zod'

import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { action } from '@/server/action'
import { db } from '@/server/db'
import * as accountService from '@/server/services/account.service'
import * as contactService from '@/server/services/contact.service'
import * as itemService from '@/server/services/item.service'
import * as taxService from '@/server/services/tax.service'

/**
 * What a create dialog needs, fetched at the moment somebody asks for it.
 *
 * A picker on an invoice does not know about payment terms or expense accounts,
 * and the invoice page should not be loading them on the chance that a customer
 * turns out to be missing. So the lists are fetched once, when the user clicks
 * "Add" — one round trip, on a path that ends in a dialog anyway.
 */
export const contactDialogOptions = action
  .requires('customer:read')
  .handler(async (ctx) => {
    const [terms, accounts] = await Promise.all([
      db.paymentTerm.findMany({
        where: { orgId: ctx.orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: [{ isDefault: 'desc' }, { dueDays: 'asc' }],
      }),
      accountService.selectableAccounts(ctx),
    ])

    return {
      terms: terms.map((term) => ({ id: term.id, label: term.name })),
      // The whole chart. A vendor's usual category is normally an expense, but a
      // landlord's deposit is an asset and a lender's is a liability — so the
      // list is ordered, not filtered (see lib/account-options.ts).
      expenseAccounts: accountOptions(accounts, { preferTypes: ['EXPENSE'] }),
      today: today(ctx.organization.timeZone),
      currency: ctx.organization.baseCurrency,
    }
  })

/** Vendors (or customers) available to link as the same trading party. */
export const linkPartyOptions = action
  .input(z.object({ side: z.enum(['customer', 'vendor']) }))
  .requires('customer:read')
  .handler(async (ctx, input) => {
    // Editing a customer needs vendor targets; editing a vendor needs customers.
    const targets = await contactService.listLinkTargets(
      ctx,
      input.side === 'customer' ? 'customer' : 'vendor',
    )
    return { options: targets }
  })

export const itemDialogOptions = action
  .requires('item:read')
  .handler(async (ctx) => {
    const [accounts, taxCodes, categories] = await Promise.all([
      accountService.selectableAccounts(ctx),
      taxService.listCodes(ctx),
      itemService.listCategories(ctx),
    ])

    return {
      accounts,
      taxCodes: ctx.features.enableTax
        ? taxCodes.filter((code) => code.isActive).map((code) => ({ id: code.id, label: code.name }))
        : [],
      categories: categories.map((category) => ({ id: category.id, label: category.name })),
      today: today(ctx.organization.timeZone),
      currency: ctx.organization.baseCurrency,
    }
  })
