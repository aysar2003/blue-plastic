import 'server-only'

import {
  planPosRegisterAccounts,
  PosRegisterAccountPlanError,
  POS_BANKS_DESCRIPTION,
  POS_BANKS_DETAIL,
  POS_BANKS_NAME,
  POS_REGISTER_DETAIL,
} from '@/lib/pos-register-account'
import type { Tx } from '@/server/db'
import { conflict } from '@/server/errors'

/**
 * Give every register in the organisation a BANK sub-account under POS Banks.
 * Safe to call again: registers that already have their account are left as they
 * are, apart from a rename when the till name changed.
 */
export async function ensurePosRegisterAccounts(tx: Tx, orgId: string) {
  const [accounts, registers] = await Promise.all([
    tx.ledgerAccount.findMany({
      where: { orgId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        detailType: true,
        parentId: true,
      },
    }),
    tx.posRegister.findMany({
      where: { orgId },
      select: { id: true, name: true, ledgerAccountId: true },
    }),
  ])

  let actions
  try {
    actions = planPosRegisterAccounts(accounts, registers)
  } catch (error) {
    if (error instanceof PosRegisterAccountPlanError) throw conflict(error.message)
    throw error
  }
  if (actions.length === 0) return

  let parentId = accounts.find((account) => account.detailType === POS_BANKS_DETAIL)?.id ?? null

  for (const action of actions) {
    if (action.type === 'create-parent') {
      const created = await tx.ledgerAccount.create({
        data: {
          orgId,
          code: action.code,
          name: POS_BANKS_NAME,
          description: POS_BANKS_DESCRIPTION,
          type: 'ASSET',
          subtype: 'BANK',
          detailType: POS_BANKS_DETAIL,
        },
        select: { id: true },
      })
      parentId = created.id
      continue
    }

    if (action.type === 'create-account') {
      if (!parentId) {
        throw conflict('POS Banks is missing, so the register account cannot be filed under it.')
      }
      const created = await tx.ledgerAccount.create({
        data: {
          orgId,
          code: action.code,
          name: action.name,
          description: action.description,
          type: 'ASSET',
          subtype: 'BANK',
          detailType: POS_REGISTER_DETAIL,
          parentId,
        },
        select: { id: true },
      })
      await tx.posRegister.update({
        where: { id: action.registerId },
        data: { ledgerAccountId: created.id },
      })
      continue
    }

    if (action.type === 'link') {
      await tx.posRegister.update({
        where: { id: action.registerId },
        data: { ledgerAccountId: action.accountId },
      })
      continue
    }

    if (action.type === 'rename') {
      await tx.ledgerAccount.update({
        where: { id: action.accountId },
        data: { name: action.name },
      })
      continue
    }

    if (action.type === 'retag') {
      await tx.ledgerAccount.update({
        where: { id: action.accountId },
        data: { detailType: POS_REGISTER_DETAIL },
      })
      continue
    }

    if (!parentId) {
      throw conflict('POS Banks is missing, so the register account cannot be filed under it.')
    }
    await tx.ledgerAccount.update({
      where: { id: action.accountId },
      data: { parentId },
    })
  }
}
