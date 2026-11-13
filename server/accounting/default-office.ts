import 'server-only'

import { DEFAULT_CHART } from '@/server/accounting/chart-of-accounts'
import type { Tx } from '@/server/db'

/** The shelf a new company starts with. Its chart account uses the original chart's inventory type. */
export const OFFICE_NAME = 'Xafiiska'

const ORIGINAL_INVENTORY = DEFAULT_CHART.find((account) => account.systemKey === 'INVENTORY_ASSET')

/** Same classification as Inventory Asset on the original chart. Not a custom office type. */
const ORIGINAL_INVENTORY_TYPE = {
  type: ORIGINAL_INVENTORY?.type ?? 'ASSET',
  subtype: ORIGINAL_INVENTORY?.subtype ?? 'INVENTORY',
  description: ORIGINAL_INVENTORY?.description ?? 'Stock on hand, at weighted-average cost.',
} as const

export function officeWhere() {
  return { OR: [{ isOffice: true as const }, { name: OFFICE_NAME }] }
}

const GENERATED_DESCRIPTIONS = [
  'Inventory held at',
  'Default place for this company.',
]

/** Put a generated account back on the original chart's inventory type. Leave an edited one alone. */
export function generatedOfficeWording(account: {
  description: string | null
  detailType: string | null
}): { description?: string; detailType?: null } {
  const patch: { description?: string; detailType?: null } = {}
  const description = account.description ?? ''
  if (GENERATED_DESCRIPTIONS.some((prefix) => description.startsWith(prefix))) {
    patch.description = ORIGINAL_INVENTORY_TYPE.description
  }
  if (account.detailType === 'Store' || account.detailType === OFFICE_NAME) patch.detailType = null
  return patch
}

export function officeWordingChanged(patch: { description?: string; detailType?: null }): boolean {
  return patch.description !== undefined || patch.detailType !== undefined
}

/** The original Inventory Asset. The office does not get an account of its own on the chart. */
async function ensureOfficeAccount(tx: Tx, orgId: string): Promise<string> {
  const original = await tx.ledgerAccount.findFirst({
    where: {
      orgId,
      OR: [{ systemKey: 'INVENTORY_ASSET' }, { code: '1200', name: 'Inventory Asset' }],
    },
    select: { id: true },
  })
  if (original) return original.id

  const account = await tx.ledgerAccount.create({
    data: {
      orgId,
      code: '1200',
      name: 'Inventory Asset',
      description: ORIGINAL_INVENTORY_TYPE.description,
      type: ORIGINAL_INVENTORY_TYPE.type,
      subtype: ORIGINAL_INVENTORY_TYPE.subtype,
      systemKey: 'INVENTORY_ASSET',
      isSystem: true,
    },
    select: { id: true },
  })
  return account.id
}

/**
 * Give a company its default place. Stock posts to Inventory Asset, not a separate chart line.
 * Does nothing when that default was removed, and does not create a second one.
 */
export async function seedDefaultOffice(tx: Tx, orgId: string): Promise<{ id: string } | null> {
  const removed = await tx.store.findFirst({
    where: { orgId, isActive: false, ...officeWhere() },
    select: { id: true },
  })
  if (removed) return null

  const existing = await tx.store.findFirst({
    where: { orgId, isActive: true, ...officeWhere() },
    select: { id: true, isOffice: true, inventoryAccountId: true },
  })
  if (existing) {
    if (!existing.isOffice) {
      await tx.store.update({ where: { id: existing.id }, data: { isOffice: true } })
    }
    const account = await tx.ledgerAccount.findFirst({
      where: { id: existing.inventoryAccountId, orgId },
      select: { id: true, name: true, description: true, detailType: true, isActive: true },
    })
    if (account?.name === OFFICE_NAME) {
      const wording = generatedOfficeWording(account)
      if (!account.isActive || officeWordingChanged(wording)) {
        await tx.ledgerAccount.update({
          where: { id: account.id },
          data: { isActive: true, ...wording },
        })
      }
    }
    return { id: existing.id }
  }

  const inventoryAccountId = await ensureOfficeAccount(tx, orgId)
  return tx.store.create({
    data: { orgId, name: OFFICE_NAME, isOffice: true, inventoryAccountId },
    select: { id: true },
  })
}
