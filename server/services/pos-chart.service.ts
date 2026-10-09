import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'

const POS_PARENT_CODE = '1020'
const POS_PARENT_MARKER = 'pos-parent'
const registerMarker = (registerId: string) => `pos-register:${registerId}`

/**
 * Ensure a Point of Sale heading exists on the chart, with one cash sub-account
 * per till — named after the register, indented under the POS parent.
 */
export async function ensurePosParentAccount(tx: Tx, orgId: string) {
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      orgId,
      OR: [{ code: POS_PARENT_CODE }, { description: POS_PARENT_MARKER }],
    },
    select: { id: true, code: true, name: true },
  })
  if (existing) return existing

  return tx.ledgerAccount.create({
    data: {
      orgId,
      code: POS_PARENT_CODE,
      name: 'Point of Sale',
      type: 'ASSET',
      subtype: 'OTHER_CURRENT_ASSET',
      detailType: 'Cash and wallets at the tills',
      description: POS_PARENT_MARKER,
      isSystem: false,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  })
}

export async function ensureRegisterCashAccount(
  tx: Tx,
  orgId: string,
  registerId: string,
  registerName: string,
) {
  const parent = await ensurePosParentAccount(tx, orgId)
  const marker = registerMarker(registerId)
  const existing = await tx.ledgerAccount.findFirst({
    where: { orgId, description: marker },
    select: { id: true, code: true, name: true },
  })
  if (existing) {
    await tx.ledgerAccount.update({
      where: { id: existing.id },
      data: { name: registerName, parentId: parent.id },
    })
    return { ...existing, name: registerName }
  }

  const siblings = await tx.ledgerAccount.findMany({
    where: { orgId, parentId: parent.id },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1,
  })
  const nextCode = nextChildCode(parent.code, siblings[0]?.code)

  return tx.ledgerAccount.create({
    data: {
      orgId,
      code: nextCode,
      name: registerName,
      type: 'ASSET',
      subtype: 'OTHER_CURRENT_ASSET',
      detailType: 'POS till cash / wallet',
      description: marker,
      parentId: parent.id,
      isSystem: false,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  })
}

/** Sync POS parent + one sub-account per active register (settings / repair). */
export async function syncPosChartAccounts(ctx: OrgContext) {
  const registers = await db.posRegister.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  await db.$transaction(async (tx) => {
    await ensurePosParentAccount(tx, ctx.orgId)
    for (const register of registers) {
      await ensureRegisterCashAccount(tx, ctx.orgId, register.id, register.name)
    }
  })

  return { registers: registers.length }
}

function nextChildCode(parentCode: string, lastChildCode?: string) {
  if (lastChildCode && lastChildCode.startsWith(parentCode)) {
    const suffix = lastChildCode.slice(parentCode.length).replace(/^\D+/, '')
    const n = Number(suffix)
    if (Number.isFinite(n) && n >= 0) {
      return `${parentCode}${String(n + 1).padStart(2, '0')}`
    }
  }
  return `${parentCode}01`
}
