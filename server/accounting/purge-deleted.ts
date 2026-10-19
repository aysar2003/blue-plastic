import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { allowCompanyWipe } from '@/server/company-wipe'
import type { Tx } from '@/server/db'

/**
 * Permanently remove soft-deleted books rows when Trash is cleared.
 *
 * Soft-delete still hides a record from lists and balances; Clear Trash is the
 * step that removes the row from PostgreSQL. Master-data soft-deletes (items)
 * stay when live or historical documents still name them — those rows remain
 * out of pickers but keep document history readable.
 */

async function journalIdsFor(
  tx: Tx,
  orgId: string,
  seedIds: (string | null | undefined)[],
): Promise<string[]> {
  const seeds = [...new Set(seedIds.filter(Boolean) as string[])]
  if (seeds.length === 0) return []

  const related = await tx.journal.findMany({
    where: {
      orgId,
      OR: [{ id: { in: seeds } }, { reversalOfId: { in: seeds } }],
    },
    select: { id: true },
  })
  return related.map((row) => row.id)
}

/**
 * Detach Restrict FKs, drop stock movements and reconciliation marks, then
 * delete the journals (lines cascade). Requires `allowCompanyWipe` in this tx.
 */
async function hardDeleteJournals(tx: Tx, orgId: string, journalIds: string[]): Promise<void> {
  if (journalIds.length === 0) return

  const ids = await journalIdsFor(tx, orgId, journalIds)
  if (ids.length === 0) return

  await tx.salesDocument.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.customerPayment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.purchaseDocument.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.billPayment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.bankTransfer.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.deposit.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.inventoryAdjustment.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.assemblyBuild.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.storeTransfer.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.posCashMovement.updateMany({
    where: { orgId, journalId: { in: ids } },
    data: { journalId: null },
  })
  await tx.posSession.updateMany({
    where: { orgId, closingJournalId: { in: ids } },
    data: { closingJournalId: null },
  })

  await tx.inventoryTransaction.deleteMany({
    where: { orgId, journalId: { in: ids } },
  })

  const lines = await tx.journalLine.findMany({
    where: { orgId, journalId: { in: ids } },
    select: { id: true },
  })
  const lineIds = lines.map((line) => line.id)
  if (lineIds.length > 0) {
    await tx.reconciliationEntry.deleteMany({
      where: { orgId, journalLineId: { in: lineIds } },
    })
  }

  await tx.journal.updateMany({
    where: { orgId, id: { in: ids } },
    data: { reversalOfId: null },
  })
  await tx.journal.deleteMany({ where: { orgId, id: { in: ids } } })
}

async function purgeSalesDocument(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const doc = await tx.salesDocument.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!doc?.deletedAt) return

  await tx.salesApplication.deleteMany({
    where: { orgId: ctx.orgId, invoiceId: id },
  })
  await tx.salesDocument.updateMany({
    where: { orgId: ctx.orgId, convertedFromId: id },
    data: { convertedFromId: null },
  })

  const journalId = doc.journalId
  await tx.salesDocument.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgePurchaseDocument(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const doc = await tx.purchaseDocument.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!doc?.deletedAt) return

  await tx.purchaseApplication.deleteMany({
    where: { orgId: ctx.orgId, billId: id },
  })
  await tx.purchaseDocument.updateMany({
    where: { orgId: ctx.orgId, convertedFromId: id },
    data: { convertedFromId: null },
  })

  const journalId = doc.journalId
  await tx.purchaseDocument.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeCustomerPayment(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const payment = await tx.customerPayment.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!payment?.deletedAt) return

  await tx.depositLine.deleteMany({
    where: { orgId: ctx.orgId, customerPaymentId: id },
  })

  const journalId = payment.journalId
  await tx.customerPayment.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeBillPayment(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const payment = await tx.billPayment.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!payment?.deletedAt) return

  const journalId = payment.journalId
  await tx.billPayment.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeBankTransfer(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const row = await tx.bankTransfer.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!row?.deletedAt) return

  const journalId = row.journalId
  await tx.bankTransfer.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeDeposit(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const row = await tx.deposit.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!row?.deletedAt) return

  const journalId = row.journalId
  await tx.deposit.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeInventoryAdjustment(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const row = await tx.inventoryAdjustment.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!row?.deletedAt) return

  const journalId = row.journalId
  await tx.inventoryAdjustment.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeAssemblyBuild(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const row = await tx.assemblyBuild.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: undefined },
    select: { id: true, journalId: true, deletedAt: true },
  })
  if (!row?.deletedAt) return

  const journalId = row.journalId
  await tx.assemblyBuild.delete({ where: { id } })
  if (journalId) await hardDeleteJournals(tx, ctx.orgId, [journalId])
}

async function purgeJournal(tx: Tx, ctx: OrgContext, id: string): Promise<void> {
  const journal = await tx.journal.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true, deletedAt: true },
  })
  if (!journal) return
  if (journal.status !== 'DELETED' && !journal.deletedAt) return

  await hardDeleteJournals(tx, ctx.orgId, [id])
}

/**
 * Hard-delete the soft-deleted entity named by a Trash DELETE audit row.
 * No-op when the row is already gone or was never soft-deleted.
 */
export async function purgeDeletedEntity(
  tx: Tx,
  ctx: OrgContext,
  entity: string,
  entityId: string,
): Promise<void> {
  await allowCompanyWipe(tx)

  switch (entity) {
    case 'Journal':
      await purgeJournal(tx, ctx, entityId)
      break
    case 'SalesDocument':
      await purgeSalesDocument(tx, ctx, entityId)
      break
    case 'PurchaseDocument':
      await purgePurchaseDocument(tx, ctx, entityId)
      break
    case 'CustomerPayment':
      await purgeCustomerPayment(tx, ctx, entityId)
      break
    case 'BillPayment':
      await purgeBillPayment(tx, ctx, entityId)
      break
    case 'BankTransfer':
      await purgeBankTransfer(tx, ctx, entityId)
      break
    case 'Deposit':
      await purgeDeposit(tx, ctx, entityId)
      break
    case 'InventoryAdjustment':
      await purgeInventoryAdjustment(tx, ctx, entityId)
      break
    case 'AssemblyBuild':
      await purgeAssemblyBuild(tx, ctx, entityId)
      break
    default:
      // Master data / membership / etc. — already hard-deleted, or must stay
      // soft-deleted so historical documents still resolve.
      break
  }
}

/** Prefer document/payment clears before orphan journal lines in a bulk clear. */
export function trashPurgeOrder(entity: string): number {
  switch (entity) {
    case 'SalesDocument':
    case 'PurchaseDocument':
    case 'CustomerPayment':
    case 'BillPayment':
    case 'BankTransfer':
    case 'Deposit':
    case 'InventoryAdjustment':
    case 'AssemblyBuild':
      return 0
    case 'Journal':
      return 1
    default:
      return 2
  }
}
