import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/**
 * A copy of one company's books, ready to download.
 *
 * Memberships carry the person's name and email. Passwords, sessions, and
 * sign-in tokens stay out of the file.
 */
export async function companyBackup(ctx: OrgContext) {
  const where = { orgId: ctx.orgId }

  const [
    organization,
    memberships,
    sequences,
    accounts,
    fiscalYears,
    periods,
    journals,
    journalLines,
    paymentTerms,
    customers,
    customerFiles,
    vendors,
    itemCategories,
    items,
    taxAgencies,
    taxRates,
    taxCodes,
    taxCodeRates,
    salesDocuments,
    salesDocumentLines,
    customerPayments,
    salesApplications,
    purchaseDocuments,
    purchaseDocumentLines,
    billPayments,
    purchaseApplications,
    bankTransfers,
    deposits,
    depositLines,
    importedTransactions,
    reconciliations,
    reconciliationEntries,
    inventoryTransactions,
    inventoryAdjustments,
    inventoryAdjustmentLines,
    bookmarks,
    bankRules,
    reportNotes,
    ledgerFiles,
    auditLogs,
  ] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } }),
    db.membership.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.documentSequence.findMany({ where, orderBy: { docType: 'asc' } }),
    db.ledgerAccount.findMany({ where, orderBy: { code: 'asc' } }),
    db.fiscalYear.findMany({ where, orderBy: { year: 'asc' } }),
    db.accountingPeriod.findMany({ where, orderBy: { startDate: 'asc' } }),
    db.journal.findMany({ where, orderBy: { date: 'asc' } }),
    db.journalLine.findMany({ where, orderBy: [{ journalDate: 'asc' }, { id: 'asc' }] }),
    db.paymentTerm.findMany({ where, orderBy: { name: 'asc' } }),
    db.customer.findMany({ where, orderBy: { displayName: 'asc' } }),
    db.customerFile.findMany({ where, orderBy: { createdAt: 'asc' } }),
    db.vendor.findMany({ where, orderBy: { displayName: 'asc' } }),
    db.itemCategory.findMany({ where, orderBy: { name: 'asc' } }),
    db.item.findMany({ where, orderBy: { name: 'asc' } }),
    db.taxAgency.findMany({ where, orderBy: { name: 'asc' } }),
    db.taxRate.findMany({ where, orderBy: { name: 'asc' } }),
    db.taxCode.findMany({ where, orderBy: { name: 'asc' } }),
    db.taxCodeRate.findMany({ where }),
    db.salesDocument.findMany({ where, orderBy: { date: 'asc' } }),
    db.salesDocumentLine.findMany({ where, orderBy: [{ documentId: 'asc' }, { lineNumber: 'asc' }] }),
    db.customerPayment.findMany({ where, orderBy: { date: 'asc' } }),
    db.salesApplication.findMany({ where }),
    db.purchaseDocument.findMany({ where, orderBy: { date: 'asc' } }),
    db.purchaseDocumentLine.findMany({ where, orderBy: [{ documentId: 'asc' }, { lineNumber: 'asc' }] }),
    db.billPayment.findMany({ where, orderBy: { date: 'asc' } }),
    db.purchaseApplication.findMany({ where }),
    db.bankTransfer.findMany({ where, orderBy: { date: 'asc' } }),
    db.deposit.findMany({ where, orderBy: { date: 'asc' } }),
    db.depositLine.findMany({ where, orderBy: [{ depositId: 'asc' }, { lineNumber: 'asc' }] }),
    db.importedTransaction.findMany({ where, orderBy: { date: 'asc' } }),
    db.bankReconciliation.findMany({ where, orderBy: { statementDate: 'asc' } }),
    db.reconciliationEntry.findMany({ where }),
    db.inventoryTransaction.findMany({ where, orderBy: { createdAt: 'asc' } }),
    db.inventoryAdjustment.findMany({ where, orderBy: { date: 'asc' } }),
    db.inventoryAdjustmentLine.findMany({ where, orderBy: [{ adjustmentId: 'asc' }, { lineNumber: 'asc' }] }),
    db.workspaceBookmark.findMany({ where, orderBy: { createdAt: 'asc' } }),
    db.bankRule.findMany({ where, orderBy: { name: 'asc' } }),
    db.reportNote.findMany({ where }),
    db.ledgerFile.findMany({ where, orderBy: { createdAt: 'asc' } }),
    db.auditLog.findMany({ where, orderBy: { at: 'asc' } }),
  ])

  return {
    version: 1,
    takenAt: new Date().toISOString(),
    organization,
    memberships,
    sequences,
    accounts,
    fiscalYears,
    periods,
    journals,
    journalLines,
    paymentTerms,
    customers,
    customerFiles,
    vendors,
    itemCategories,
    items,
    taxAgencies,
    taxRates,
    taxCodes,
    taxCodeRates,
    salesDocuments,
    salesDocumentLines,
    customerPayments,
    salesApplications,
    purchaseDocuments,
    purchaseDocumentLines,
    billPayments,
    purchaseApplications,
    bankTransfers,
    deposits,
    depositLines,
    importedTransactions,
    reconciliations,
    reconciliationEntries,
    inventoryTransactions,
    inventoryAdjustments,
    inventoryAdjustmentLines,
    bookmarks,
    bankRules,
    reportNotes,
    ledgerFiles,
    auditLogs,
  }
}

/** Dates and money become plain text so the file opens anywhere. */
export function backupJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (item instanceof Date) return item.toISOString()
      if (typeof item === 'bigint') return item.toString()
      if (isDecimal(item)) return item.toString()
      return item
    },
    2,
  )
}

function isDecimal(value: unknown): value is { toString(): string } {
  if (!value || typeof value !== 'object') return false
  const name = value.constructor?.name
  return name === 'Decimal' && typeof (value as { toFixed?: unknown }).toFixed === 'function'
}
