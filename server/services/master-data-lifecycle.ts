import 'server-only'

import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

/**
 * Hard-delete unused master data, and merge duplicates (including ones that
 * already carry transactions) into a single survivor that keeps its name.
 */

export type MergeInput = { keepId: string; absorbId: string }

function sameOrgIds(keepId: string, absorbId: string) {
  if (keepId === absorbId) {
    throw validation('Pick two different records to merge.')
  }
}

/* --- Customers ------------------------------------------------------------ */

export async function customerUsage(tx: Tx, orgId: string, id: string) {
  const [documents, payments, journalLines, deliveryNotes, files, imported, rules, registers] =
    await Promise.all([
      tx.salesDocument.count({ where: { orgId, customerId: id } }),
      tx.customerPayment.count({ where: { orgId, customerId: id } }),
      tx.journalLine.count({ where: { orgId, customerId: id } }),
      tx.deliveryNote.count({ where: { orgId, customerId: id } }),
      tx.customerFile.count({ where: { orgId, customerId: id } }),
      tx.importedTransaction.count({ where: { orgId, customerId: id } }),
      tx.bankRule.count({ where: { orgId, customerId: id } }),
      tx.posRegister.count({ where: { orgId, defaultCustomerId: id } }),
    ])
  const transactions = documents + payments + journalLines + deliveryNotes
  return {
    documents,
    payments,
    journalLines,
    deliveryNotes,
    files,
    imported,
    rules,
    registers,
    transactions,
    total: transactions + files + imported + rules + registers,
  }
}

export async function purgeCustomer(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, displayName: true },
    })
    if (!customer) throw notFound('Customer')

    const usage = await customerUsage(tx, ctx.orgId, id)
    if (usage.transactions > 0 || usage.registers > 0) {
      throw precondition(
        `${customer.displayName} still has transactions or is the walk-in customer on a till. ` +
          `Merge them into another customer, or clear those links first.`,
      )
    }

    await tx.customerFile.deleteMany({ where: { orgId: ctx.orgId, customerId: id } })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, customerId: id },
      data: { customerId: null },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, customerId: id },
      data: { customerId: null },
    })
    await tx.customer.delete({ where: { id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Customer',
        entityId: id,
        action: 'DELETE',
        before: { displayName: customer.displayName },
        after: { deleted: true, hard: true },
      },
      meta,
    )
    return { id, displayName: customer.displayName }
  })
}

export async function mergeCustomers(ctx: OrgContext, input: MergeInput) {
  sameOrgIds(input.keepId, input.absorbId)
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const [keep, absorb] = await Promise.all([
      tx.customer.findFirst({
        where: { id: input.keepId, orgId: ctx.orgId },
        select: { id: true, displayName: true },
      }),
      tx.customer.findFirst({
        where: { id: input.absorbId, orgId: ctx.orgId },
        select: { id: true, displayName: true },
      }),
    ])
    if (!keep || !absorb) throw notFound('Customer')

    await tx.salesDocument.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.customerPayment.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.journalLine.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.deliveryNote.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.customerFile.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, customerId: absorb.id },
      data: { customerId: keep.id },
    })
    await tx.posRegister.updateMany({
      where: { orgId: ctx.orgId, defaultCustomerId: absorb.id },
      data: { defaultCustomerId: keep.id },
    })

    await tx.customer.delete({ where: { id: absorb.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Customer',
        entityId: keep.id,
        action: 'UPDATE',
        before: { absorbedId: absorb.id, absorbedName: absorb.displayName },
        after: { keepId: keep.id, keepName: keep.displayName, merged: true },
      },
      meta,
    )
    return { keepId: keep.id, keepName: keep.displayName, absorbedName: absorb.displayName }
  })
}

export async function findCustomerNameDuplicates(ctx: OrgContext) {
  const rows = await db.customer.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, displayName: true, isActive: true },
    orderBy: { displayName: 'asc' },
  })
  return groupByFoldedName(rows, (row) => row.displayName)
}

/* --- Vendors -------------------------------------------------------------- */

export async function vendorUsage(tx: Tx, orgId: string, id: string) {
  const [documents, payments, journalLines, imported, rules] = await Promise.all([
    tx.purchaseDocument.count({ where: { orgId, vendorId: id } }),
    tx.billPayment.count({ where: { orgId, vendorId: id } }),
    tx.journalLine.count({ where: { orgId, vendorId: id } }),
    tx.importedTransaction.count({ where: { orgId, vendorId: id } }),
    tx.bankRule.count({ where: { orgId, vendorId: id } }),
  ])
  const transactions = documents + payments + journalLines
  return {
    documents,
    payments,
    journalLines,
    imported,
    rules,
    transactions,
    total: transactions + imported + rules,
  }
}

export async function purgeVendor(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const vendor = await tx.vendor.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, displayName: true },
    })
    if (!vendor) throw notFound('Vendor')

    const usage = await vendorUsage(tx, ctx.orgId, id)
    if (usage.transactions > 0) {
      throw precondition(
        `${vendor.displayName} still has transactions. Merge them into another vendor first.`,
      )
    }

    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, vendorId: id },
      data: { vendorId: null },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, vendorId: id },
      data: { vendorId: null },
    })
    await tx.vendor.delete({ where: { id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Vendor',
        entityId: id,
        action: 'DELETE',
        before: { displayName: vendor.displayName },
        after: { deleted: true, hard: true },
      },
      meta,
    )
    return { id, displayName: vendor.displayName }
  })
}

export async function mergeVendors(ctx: OrgContext, input: MergeInput) {
  sameOrgIds(input.keepId, input.absorbId)
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const [keep, absorb] = await Promise.all([
      tx.vendor.findFirst({
        where: { id: input.keepId, orgId: ctx.orgId },
        select: { id: true, displayName: true },
      }),
      tx.vendor.findFirst({
        where: { id: input.absorbId, orgId: ctx.orgId },
        select: { id: true, displayName: true },
      }),
    ])
    if (!keep || !absorb) throw notFound('Vendor')

    await tx.purchaseDocument.updateMany({
      where: { orgId: ctx.orgId, vendorId: absorb.id },
      data: { vendorId: keep.id },
    })
    await tx.billPayment.updateMany({
      where: { orgId: ctx.orgId, vendorId: absorb.id },
      data: { vendorId: keep.id },
    })
    await tx.journalLine.updateMany({
      where: { orgId: ctx.orgId, vendorId: absorb.id },
      data: { vendorId: keep.id },
    })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, vendorId: absorb.id },
      data: { vendorId: keep.id },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, vendorId: absorb.id },
      data: { vendorId: keep.id },
    })

    await tx.vendor.delete({ where: { id: absorb.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Vendor',
        entityId: keep.id,
        action: 'UPDATE',
        before: { absorbedId: absorb.id, absorbedName: absorb.displayName },
        after: { keepId: keep.id, keepName: keep.displayName },
      },
      meta,
    )
    return { keepId: keep.id, keepName: keep.displayName, absorbedName: absorb.displayName }
  })
}

export async function findVendorNameDuplicates(ctx: OrgContext) {
  const rows = await db.vendor.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, displayName: true, isActive: true },
    orderBy: { displayName: 'asc' },
  })
  return groupByFoldedName(rows, (row) => row.displayName)
}

/* --- Items ---------------------------------------------------------------- */

export async function itemUsage(tx: Tx, orgId: string, id: string) {
  const [salesLines, purchaseLines, movements, adjustments, transfers, tickets, deliveryLines] =
    await Promise.all([
      tx.salesDocumentLine.count({ where: { orgId, itemId: id } }),
      tx.purchaseDocumentLine.count({ where: { orgId, itemId: id } }),
      tx.inventoryTransaction.count({ where: { orgId, itemId: id } }),
      tx.inventoryAdjustmentLine.count({ where: { orgId, itemId: id } }),
      tx.storeTransfer.count({ where: { orgId, itemId: id } }),
      tx.storeTicket.count({ where: { orgId, itemId: id } }),
      tx.deliveryNoteLine.count({ where: { orgId, itemId: id } }),
    ])
  const transactions =
    salesLines + purchaseLines + movements + adjustments + transfers + tickets + deliveryLines
  return {
    salesLines,
    purchaseLines,
    movements,
    adjustments,
    transfers,
    tickets,
    deliveryLines,
    transactions,
    total: transactions,
  }
}

export async function purgeItem(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: { id: true, name: true, sku: true },
    })
    if (!item) throw notFound('Item')

    const usage = await itemUsage(tx, ctx.orgId, id)
    if (usage.transactions > 0) {
      throw precondition(
        `"${item.name}" is on documents or stock movements. Merge it into another item instead.`,
      )
    }

    await tx.item.delete({ where: { id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Item',
        entityId: id,
        action: 'DELETE',
        before: { name: item.name, sku: item.sku },
        after: { deleted: true, hard: true },
      },
      meta,
    )
    return { id, name: item.name }
  })
}

export async function mergeItems(ctx: OrgContext, input: MergeInput) {
  sameOrgIds(input.keepId, input.absorbId)
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const [keep, absorb] = await Promise.all([
      tx.item.findFirst({
        where: { id: input.keepId, orgId: ctx.orgId, deletedAt: undefined },
        select: { id: true, name: true, sku: true },
      }),
      tx.item.findFirst({
        where: { id: input.absorbId, orgId: ctx.orgId, deletedAt: undefined },
        select: { id: true, name: true, sku: true },
      }),
    ])
    if (!keep || !absorb) throw notFound('Item')

    // Free unique sku on the row we are about to remove.
    if (absorb.sku) {
      await tx.item.update({ where: { id: absorb.id }, data: { sku: null } })
    }

    await tx.salesDocumentLine.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.purchaseDocumentLine.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.inventoryTransaction.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.inventoryAdjustmentLine.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.storeTransfer.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.storeTicket.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })
    await tx.deliveryNoteLine.updateMany({
      where: { orgId: ctx.orgId, itemId: absorb.id },
      data: { itemId: keep.id },
    })

    // Rename then delete so @@unique([orgId, name]) never collides mid-flight.
    await tx.item.update({
      where: { id: absorb.id },
      data: { name: `${absorb.name} · merged ${Date.now()}`, isActive: false },
    })
    await tx.item.delete({ where: { id: absorb.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Item',
        entityId: keep.id,
        action: 'UPDATE',
        before: { absorbedId: absorb.id, absorbedName: absorb.name },
        after: { keepId: keep.id, keepName: keep.name },
      },
      meta,
    )
    return { keepId: keep.id, keepName: keep.name, absorbedName: absorb.name }
  })
}

export async function findItemNameDuplicates(ctx: OrgContext) {
  const rows = await db.item.findMany({
    where: { orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  })
  return groupByFoldedName(rows, (row) => row.name)
}

/* --- Product categories --------------------------------------------------- */

/**
 * Fold one category into another. Every item (and any child category) moves
 * to the survivor; the absorbed row is retired so its name frees up.
 */
export async function mergeCategories(ctx: OrgContext, input: MergeInput) {
  sameOrgIds(input.keepId, input.absorbId)
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const [keep, absorb] = await Promise.all([
      tx.itemCategory.findFirst({
        where: { id: input.keepId, orgId: ctx.orgId },
        select: { id: true, name: true, parentId: true, isActive: true },
      }),
      tx.itemCategory.findFirst({
        where: { id: input.absorbId, orgId: ctx.orgId },
        select: { id: true, name: true, parentId: true, isActive: true },
      }),
    ])
    if (!keep || !absorb) throw notFound('Category')

    // Survivor must stay in the tree; if it sat under the row we absorb, lift it first.
    if (keep.parentId === absorb.id) {
      await tx.itemCategory.update({
        where: { id: keep.id },
        data: { parentId: absorb.parentId },
      })
    }

    await tx.itemCategory.updateMany({
      where: { orgId: ctx.orgId, parentId: absorb.id },
      data: { parentId: keep.id },
    })
    await tx.item.updateMany({
      where: { orgId: ctx.orgId, categoryId: absorb.id },
      data: { categoryId: keep.id },
    })

    // Free @@unique([orgId, name]) before retiring the absorbed row.
    await tx.itemCategory.update({
      where: { id: absorb.id },
      data: {
        name: `${absorb.name} · merged ${Date.now()}`,
        isActive: false,
        parentId: null,
      },
    })

    if (!keep.isActive) {
      await tx.itemCategory.update({
        where: { id: keep.id },
        data: { isActive: true },
      })
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ItemCategory',
        entityId: keep.id,
        action: 'UPDATE',
        before: { absorbedId: absorb.id, absorbedName: absorb.name },
        after: { keepId: keep.id, keepName: keep.name },
      },
      meta,
    )
    return { keepId: keep.id, keepName: keep.name, absorbedName: absorb.name }
  })
}

/* --- Ledger accounts ------------------------------------------------------ */

export async function accountUsage(tx: Tx, orgId: string, id: string) {
  const [
    journalLines,
    children,
    itemLinks,
    salesLines,
    salesDeposits,
    paymentDeposits,
    purchaseLines,
    purchasePayments,
    billPayments,
    taxRates,
    bankRules,
    posOrderPayments,
    adjustments,
    stores,
    transfersFrom,
    transfersTo,
    deposits,
    depositLines,
    imported,
    reconciliations,
    posMethods,
    posRegisters,
  ] = await Promise.all([
    tx.journalLine.count({ where: { orgId, accountId: id } }),
    tx.ledgerAccount.count({ where: { orgId, parentId: id } }),
    tx.item.count({
      where: {
        orgId,
        OR: [
          { incomeAccountId: id },
          { expenseAccountId: id },
          { inventoryAccountId: id },
          { cogsAccountId: id },
        ],
      },
    }),
    tx.salesDocumentLine.count({ where: { orgId, incomeAccountId: id } }),
    tx.salesDocument.count({ where: { orgId, depositAccountId: id } }),
    tx.customerPayment.count({ where: { orgId, depositAccountId: id } }),
    tx.purchaseDocumentLine.count({ where: { orgId, expenseAccountId: id } }),
    tx.purchaseDocument.count({ where: { orgId, paymentAccountId: id } }),
    tx.billPayment.count({ where: { orgId, paymentAccountId: id } }),
    tx.taxRate.count({
      where: { orgId, OR: [{ salesAccountId: id }, { purchaseAccountId: id }] },
    }),
    tx.bankRule.count({ where: { orgId, categoryAccountId: id } }),
    tx.posOrderPayment.count({ where: { ledgerAccountId: id } }),
    tx.inventoryAdjustment.count({ where: { orgId, accountId: id } }),
    tx.store.count({ where: { orgId, inventoryAccountId: id } }),
    tx.bankTransfer.count({ where: { orgId, fromAccountId: id } }),
    tx.bankTransfer.count({ where: { orgId, toAccountId: id } }),
    tx.deposit.count({ where: { orgId, bankAccountId: id } }),
    tx.depositLine.count({ where: { orgId, accountId: id } }),
    tx.importedTransaction.count({ where: { orgId, accountId: id } }),
    tx.bankReconciliation.count({ where: { orgId, accountId: id } }),
    tx.posPaymentMethod.count({ where: { orgId, ledgerAccountId: id } }),
    tx.posRegister.count({ where: { orgId, ledgerAccountId: id } }),
  ])

  const transactions =
    journalLines +
    salesLines +
    salesDeposits +
    paymentDeposits +
    purchaseLines +
    purchasePayments +
    billPayments +
    taxRates +
    bankRules +
    posOrderPayments +
    adjustments +
    transfersFrom +
    transfersTo +
    deposits +
    depositLines +
    imported +
    reconciliations

  return {
    journalLines,
    children,
    itemLinks,
    stores,
    posMethods,
    posRegisters,
    transactions,
    total: transactions + children + itemLinks + stores + posMethods + posRegisters,
  }
}

export async function purgeAccount(ctx: OrgContext, id: string) {
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const account = await tx.ledgerAccount.findFirst({
      where: { id, orgId: ctx.orgId },
      select: { id: true, code: true, name: true, isSystem: true, systemKey: true },
    })
    if (!account) throw notFound('Account')
    if (account.isSystem || account.systemKey) {
      throw precondition(`${account.code} ${account.name} is a system account and cannot be deleted.`)
    }

    const usage = await accountUsage(tx, ctx.orgId, id)
    if (usage.total > 0) {
      throw precondition(
        `${account.code} ${account.name} still has history or links. ` +
          `Merge it into another account, or clear those links first.`,
      )
    }

    await tx.vendor.updateMany({
      where: { orgId: ctx.orgId, defaultExpenseAccountId: id },
      data: { defaultExpenseAccountId: null },
    })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, categoryAccountId: id },
      data: { categoryAccountId: null },
    })

    await tx.ledgerAccount.delete({ where: { id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'LedgerAccount',
        entityId: id,
        action: 'DELETE',
        before: { code: account.code, name: account.name },
        after: { deleted: true, hard: true },
      },
      meta,
    )
    return { id, code: account.code, name: account.name }
  })
}

export async function mergeAccounts(ctx: OrgContext, input: MergeInput) {
  sameOrgIds(input.keepId, input.absorbId)
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const [keep, absorb] = await Promise.all([
      tx.ledgerAccount.findFirst({
        where: { id: input.keepId, orgId: ctx.orgId },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          parentId: true,
          isSystem: true,
          systemKey: true,
        },
      }),
      tx.ledgerAccount.findFirst({
        where: { id: input.absorbId, orgId: ctx.orgId },
        select: { id: true, code: true, name: true, type: true, isSystem: true, systemKey: true },
      }),
    ])
    if (!keep || !absorb) throw notFound('Account')
    if (absorb.isSystem || absorb.systemKey) {
      throw precondition(
        `${absorb.code} ${absorb.name} is a system account. Move the system role in Settings first.`,
      )
    }
    if (keep.type !== absorb.type) {
      throw conflict('Merge only accounts of the same type (assets with assets, and so on).')
    }
    if (absorb.id === keep.parentId) {
      throw validation('Cannot merge a parent into one of its own sub-accounts.')
    }

    // Re-parent children under the survivor.
    await tx.ledgerAccount.updateMany({
      where: { orgId: ctx.orgId, parentId: absorb.id },
      data: { parentId: keep.id },
    })

    await tx.journalLine.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.item.updateMany({
      where: { orgId: ctx.orgId, incomeAccountId: absorb.id },
      data: { incomeAccountId: keep.id },
    })
    await tx.item.updateMany({
      where: { orgId: ctx.orgId, expenseAccountId: absorb.id },
      data: { expenseAccountId: keep.id },
    })
    await tx.item.updateMany({
      where: { orgId: ctx.orgId, inventoryAccountId: absorb.id },
      data: { inventoryAccountId: keep.id },
    })
    await tx.item.updateMany({
      where: { orgId: ctx.orgId, cogsAccountId: absorb.id },
      data: { cogsAccountId: keep.id },
    })
    await tx.vendor.updateMany({
      where: { orgId: ctx.orgId, defaultExpenseAccountId: absorb.id },
      data: { defaultExpenseAccountId: keep.id },
    })
    await tx.salesDocumentLine.updateMany({
      where: { orgId: ctx.orgId, incomeAccountId: absorb.id },
      data: { incomeAccountId: keep.id },
    })
    await tx.salesDocument.updateMany({
      where: { orgId: ctx.orgId, depositAccountId: absorb.id },
      data: { depositAccountId: keep.id },
    })
    await tx.customerPayment.updateMany({
      where: { orgId: ctx.orgId, depositAccountId: absorb.id },
      data: { depositAccountId: keep.id },
    })
    await tx.purchaseDocumentLine.updateMany({
      where: { orgId: ctx.orgId, expenseAccountId: absorb.id },
      data: { expenseAccountId: keep.id },
    })
    await tx.purchaseDocument.updateMany({
      where: { orgId: ctx.orgId, paymentAccountId: absorb.id },
      data: { paymentAccountId: keep.id },
    })
    await tx.billPayment.updateMany({
      where: { orgId: ctx.orgId, paymentAccountId: absorb.id },
      data: { paymentAccountId: keep.id },
    })
    await tx.inventoryAdjustment.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.store.updateMany({
      where: { orgId: ctx.orgId, inventoryAccountId: absorb.id },
      data: { inventoryAccountId: keep.id },
    })
    await tx.bankTransfer.updateMany({
      where: { orgId: ctx.orgId, fromAccountId: absorb.id },
      data: { fromAccountId: keep.id },
    })
    await tx.bankTransfer.updateMany({
      where: { orgId: ctx.orgId, toAccountId: absorb.id },
      data: { toAccountId: keep.id },
    })
    await tx.deposit.updateMany({
      where: { orgId: ctx.orgId, bankAccountId: absorb.id },
      data: { bankAccountId: keep.id },
    })
    await tx.depositLine.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.importedTransaction.updateMany({
      where: { orgId: ctx.orgId, categoryAccountId: absorb.id },
      data: { categoryAccountId: keep.id },
    })
    await tx.bankReconciliation.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.taxRate.updateMany({
      where: { orgId: ctx.orgId, salesAccountId: absorb.id },
      data: { salesAccountId: keep.id },
    })
    await tx.taxRate.updateMany({
      where: { orgId: ctx.orgId, purchaseAccountId: absorb.id },
      data: { purchaseAccountId: keep.id },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, categoryAccountId: absorb.id },
      data: { categoryAccountId: keep.id },
    })
    await tx.bankRule.updateMany({
      where: { orgId: ctx.orgId, accountId: absorb.id },
      data: { accountId: keep.id },
    })
    await tx.posPaymentMethod.updateMany({
      where: { orgId: ctx.orgId, ledgerAccountId: absorb.id },
      data: { ledgerAccountId: keep.id },
    })
    await tx.posRegister.updateMany({
      where: { orgId: ctx.orgId, ledgerAccountId: absorb.id },
      data: { ledgerAccountId: keep.id },
    })
    await tx.posOrderPayment.updateMany({
      where: { ledgerAccountId: absorb.id },
      data: { ledgerAccountId: keep.id },
    })
    await tx.posOrder.updateMany({
      where: { orgId: ctx.orgId, changeLedgerAccountId: absorb.id },
      data: { changeLedgerAccountId: keep.id },
    })
    await tx.posOrder.updateMany({
      where: { orgId: ctx.orgId, depositLedgerAccountId: absorb.id },
      data: { depositLedgerAccountId: keep.id },
    })
    await tx.posCashMovement.updateMany({
      where: { orgId: ctx.orgId, counterpartyAccountId: absorb.id },
      data: { counterpartyAccountId: keep.id },
    })

    // Avoid unique code clash: rename absorb code then delete.
    await tx.ledgerAccount.update({
      where: { id: absorb.id },
      data: { code: `${absorb.code}-M${Date.now().toString(36).slice(-4)}`, parentId: null },
    })
    await tx.ledgerAccount.delete({ where: { id: absorb.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'LedgerAccount',
        entityId: keep.id,
        action: 'UPDATE',
        before: { absorbedId: absorb.id, absorbedCode: absorb.code, absorbedName: absorb.name },
        after: { keepId: keep.id, keepCode: keep.code, keepName: keep.name, merged: true },
      },
      meta,
    )
    return {
      keepId: keep.id,
      keepName: `${keep.code} ${keep.name}`,
      absorbedName: `${absorb.code} ${absorb.name}`,
    }
  })
}

export async function findAccountNameDuplicates(ctx: OrgContext) {
  const rows = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true, code: true, isActive: true },
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
  })
  return groupByFoldedName(rows, (row) => row.name)
}

/* --- Shared --------------------------------------------------------------- */

function foldName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function groupByFoldedName<T extends { id: string; isActive: boolean }>(
  rows: T[],
  nameOf: (row: T) => string,
): Array<{ name: string; rows: T[] }> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = foldName(nameOf(row))
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({ name, rows: list }))
}
