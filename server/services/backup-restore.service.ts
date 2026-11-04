import 'server-only'

import { createHash, randomBytes } from 'crypto'

import { Prisma } from '@prisma/client'

import type { CompanyBackup } from '@/lib/backup-format'
import type { OrgContext } from '@/server/auth/context'
import { wipeCompanyBooks } from '@/server/company-wipe'
import { db, type Tx } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'

function newId(): string {
  return `c${randomBytes(12).toString('hex')}`
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
}

function dateOrNull(value: unknown): Date | null {
  if (value == null || value === '') return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function dateRequired(value: unknown, fallback = new Date()): Date {
  return dateOrNull(value) ?? fallback
}

function dec(value: unknown, fallback = '0'): string {
  if (value == null || value === '') return fallback
  return String(value)
}

function str(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

function strOrNull(value: unknown): string | null {
  if (value == null || value === '') return null
  return String(value)
}

function bool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

type IdMaps = {
  map: (old: unknown) => string | null
  mapReq: (old: unknown) => string
}

function makeIdMaps(mode: 'identity' | 'remap', seed: [string, string][]): IdMaps {
  const idMap = new Map<string, string>(seed)
  const map = (old: unknown): string | null => {
    if (old == null || old === '') return null
    const key = String(old)
    let next = idMap.get(key)
    if (!next) {
      next = mode === 'identity' ? key : newId()
      idMap.set(key, next)
    }
    return next
  }
  const mapReq = (old: unknown): string => {
    const next = map(old)
    if (!next) throw validation('Backup row is missing an id.')
    return next
  }
  return { map, mapReq }
}

/**
 * Wipe one company and reload it from a backup taken of that same company.
 * Everything after the backup date is discarded. Memberships for people who
 * still exist are put back; the system owner always remains owner.
 */
export async function replaceCompanyFromBackup(
  ctx: OrgContext,
  input: { targetOrgId: string; confirmName: string; backup: CompanyBackup },
): Promise<{ orgId: string; name: string; takenAt: string | null }> {
  if (!ctx.isSystemOwner) throw forbidden('Only the system owner can restore a company from backup.')
  if (!ctx.permissions.has('org:update')) throw forbidden('Only an owner can restore a backup.')

  const org = input.backup.organization
  if (!org || typeof org.name !== 'string') throw validation('Backup has no organisation.')

  const target = await db.organization.findUnique({
    where: { id: input.targetOrgId },
    select: { id: true, name: true },
  })
  if (!target) throw notFound('Company')

  const typed = input.confirmName.trim()
  if (typed.toLowerCase() !== target.name.trim().toLowerCase()) {
    throw validation('Type the company name exactly to confirm restore.')
  }

  // Same company backup (by id), or a backup whose name matches this company.
  const backupOrgId = String(org.id)
  const sameId = backupOrgId === target.id
  const sameName = String(org.name).trim().toLowerCase() === target.name.trim().toLowerCase()
  if (!sameId && !sameName) {
    throw validation(
      'This backup is not for this company. Choose a backup taken from this company, or import it as a new database.',
    )
  }

  const memberships = await db.membership.findMany({
    where: { orgId: target.id },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      canConnect: true,
      permissionsOverride: true,
      acceptedAt: true,
      invitedAt: true,
    },
  })

  const mode: 'identity' | 'remap' = sameId ? 'identity' : 'remap'
  const { map, mapReq } = makeIdMaps(mode, [[backupOrgId, target.id]])

  await db.$transaction(
    async (tx) => {
      await wipeCompanyBooks(tx, target.id)
      await tx.organization.delete({ where: { id: target.id } })

      await tx.organization.create({
        data: {
          id: target.id,
          name: target.name,
          legalName: (org.legalName as string | null) ?? null,
          baseCurrency: typeof org.baseCurrency === 'string' ? org.baseCurrency : 'USD',
          fiscalYearStartMonth:
            typeof org.fiscalYearStartMonth === 'number' ? org.fiscalYearStartMonth : 1,
          taxRegistrationNumber: (org.taxRegistrationNumber as string | null) ?? null,
          addressLine1: (org.addressLine1 as string | null) ?? null,
          addressLine2: (org.addressLine2 as string | null) ?? null,
          city: (org.city as string | null) ?? null,
          region: (org.region as string | null) ?? null,
          postalCode: (org.postalCode as string | null) ?? null,
          country: (org.country as string | null) ?? null,
          phone: (org.phone as string | null) ?? null,
          email: (org.email as string | null) ?? null,
          website: (org.website as string | null) ?? null,
          timeZone: typeof org.timeZone === 'string' ? org.timeZone : 'UTC',
          allowNegativeStock: org.allowNegativeStock !== false,
          featureFlags: (org.featureFlags as object | null) ?? undefined,
          documentTemplate: (org.documentTemplate as object | null) ?? undefined,
          brandMark: (org.brandMark as string | null) ?? null,
        },
      })

      // Put people back. Actor is always OWNER so restore cannot lock them out.
      const seen = new Set<string>()
      for (const row of memberships) {
        seen.add(row.userId)
        await tx.membership.create({
          data: {
            id: row.id,
            orgId: target.id,
            userId: row.userId,
            role: row.userId === ctx.userId ? 'OWNER' : row.role,
            status: row.status,
            canConnect: row.canConnect,
            permissionsOverride: row.permissionsOverride,
            acceptedAt: row.acceptedAt,
            invitedAt: row.invitedAt,
          },
        })
      }
      if (!seen.has(ctx.userId)) {
        await tx.membership.create({
          data: {
            orgId: target.id,
            userId: ctx.userId,
            role: 'OWNER',
            status: 'ACTIVE',
            acceptedAt: new Date(),
          },
        })
      }

      await insertBackupRows(tx, target.id, input.backup, { map, mapReq })

      await tx.auditLog.create({
        data: {
          orgId: target.id,
          actorId: ctx.userId,
          entity: 'Organization',
          entityId: target.id,
          action: 'UPDATE',
          after: {
            restoredFromBackup: true,
            backupTakenAt: input.backup.takenAt ?? null,
            backupOrgId,
            fingerprint: createHash('sha256').update(backupOrgId).digest('hex').slice(0, 12),
          },
        },
      })
    },
    { maxWait: 20_000, timeout: 300_000 },
  )

  return {
    orgId: target.id,
    name: target.name,
    takenAt: typeof input.backup.takenAt === 'string' ? input.backup.takenAt : null,
  }
}

/** Pre-register every backup row id so polymorphic sourceId links remap correctly. */
function seedEntityIds(backup: CompanyBackup, mapReq: IdMaps['mapReq']): void {
  const bags = [
    'sequences',
    'accounts',
    'fiscalYears',
    'periods',
    'paymentTerms',
    'taxAgencies',
    'taxRates',
    'taxCodes',
    'taxCodeRates',
    'customers',
    'vendors',
    'itemCategories',
    'items',
    'journals',
    'journalLines',
    'salesDocuments',
    'salesDocumentLines',
    'customerPayments',
    'salesApplications',
    'purchaseDocuments',
    'purchaseDocumentLines',
    'billPayments',
    'purchaseApplications',
    'bankTransfers',
    'deposits',
    'depositLines',
    'importedTransactions',
    'reconciliations',
    'reconciliationEntries',
    'inventoryAdjustments',
    'inventoryAdjustmentLines',
    'inventoryTransactions',
    'bankRules',
    'reportNotes',
    'customerFiles',
    'ledgerFiles',
    'bookmarks',
    'stores',
    'posPaymentMethods',
    'posRegisters',
    'itemComponents',
    'employees',
    'leaveTypes',
    'leaveAllocations',
    'planningAssignments',
    'shareholders',
    'equityEvents',
    'jobOpenings',
    'applicants',
    'appraisals',
    'payrollRuns',
    'payslips',
    'payslipLines',
    'fxHedges',
    'kitchenTickets',
    'stockBins',
    'pickTasks',
    'trainingCourses',
    'trainingEnrollments',
    'signRequests',
    'surveys',
    'surveyResponses',
    'crmOpportunities',
    'crmActivities',
    'discussChannels',
    'discussMessages',
    'appointmentTypes',
    'appointments',
  ] as const
  for (const key of bags) {
    for (const row of asRows(backup[key])) {
      if (row.id != null && row.id !== '') mapReq(row.id)
    }
  }
}

/** Load master + transactional rows from a backup into an existing empty org. */
export async function insertBackupRows(
  tx: Tx,
  orgId: string,
  backup: CompanyBackup,
  ids: IdMaps,
): Promise<void> {
  const { map, mapReq } = ids
  seedEntityIds(backup, mapReq)

  const sequences = asRows(backup.sequences)
  if (sequences.length) {
    await tx.documentSequence.createMany({
      data: sequences.map((row) => ({
        id: mapReq(row.id),
        orgId,
        docType: row.docType as never,
        prefix: str(row.prefix),
        nextNumber: num(row.nextNumber, 1),
        padding: num(row.padding ?? row.padLength, 5),
      })),
      skipDuplicates: true,
    })
  }

  const accounts = asRows(backup.accounts)
  if (accounts.length) {
    const ordered = [...accounts].sort(
      (a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)),
    )
    await tx.ledgerAccount.createMany({
      data: ordered.map((row) => ({
        id: mapReq(row.id),
        orgId,
        code: str(row.code),
        name: str(row.name),
        description: strOrNull(row.description),
        type: row.type as never,
        subtype: row.subtype as never,
        parentId: null,
        systemKey: (row.systemKey as never) ?? null,
        isSystem: Boolean(row.isSystem),
        isActive: bool(row.isActive, true),
        currencyCode: strOrNull(row.currencyCode ?? row.currency),
        detailType: strOrNull(row.detailType),
      })),
      skipDuplicates: true,
    })
    for (const row of ordered) {
      if (!row.parentId) continue
      await tx.ledgerAccount.update({
        where: { id: mapReq(row.id) },
        data: { parentId: map(row.parentId) },
      })
    }
  }

  const fiscalYears = asRows(backup.fiscalYears)
  if (fiscalYears.length) {
    await tx.fiscalYear.createMany({
      data: fiscalYears.map((row) => ({
        id: mapReq(row.id),
        orgId,
        year: num(row.year),
        startDate: dateRequired(row.startDate),
        endDate: dateRequired(row.endDate),
        status: (row.status as never) ?? 'OPEN',
        closingJournalId: null,
      })),
      skipDuplicates: true,
    })
  }

  const periods = asRows(backup.periods)
  if (periods.length) {
    await tx.accountingPeriod.createMany({
      data: periods.map((row) => ({
        id: mapReq(row.id),
        orgId,
        fiscalYearId: mapReq(row.fiscalYearId),
        periodNumber: num(row.periodNumber, 1),
        startDate: dateRequired(row.startDate),
        endDate: dateRequired(row.endDate),
        status: (row.status as never) ?? 'OPEN',
      })),
      skipDuplicates: true,
    })
  }

  const paymentTerms = asRows(backup.paymentTerms)
  if (paymentTerms.length) {
    await tx.paymentTerm.createMany({
      data: paymentTerms.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        type: (row.type as never) ?? 'NET_DAYS',
        dueDays: num(row.dueDays ?? row.days, 30),
        discountDays: row.discountDays != null ? num(row.discountDays) : null,
        discountPercent: row.discountPercent != null ? dec(row.discountPercent) : null,
        isDefault: Boolean(row.isDefault),
        isActive: bool(row.isActive, true),
      })),
      skipDuplicates: true,
    })
  }

  const taxAgencies = asRows(backup.taxAgencies)
  if (taxAgencies.length) {
    await tx.taxAgency.createMany({
      data: taxAgencies.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
      })),
      skipDuplicates: true,
    })
  }

  const taxRates = asRows(backup.taxRates)
  if (taxRates.length) {
    await tx.taxRate.createMany({
      data: taxRates.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        rate: dec(row.rate),
        agencyId: mapReq(row.agencyId),
        appliesTo: (row.appliesTo as never) ?? 'BOTH',
        salesAccountId: map(row.salesAccountId),
        purchaseAccountId: map(row.purchaseAccountId),
        isActive: bool(row.isActive, true),
      })),
      skipDuplicates: true,
    })
  }

  const taxCodes = asRows(backup.taxCodes)
  if (taxCodes.length) {
    await tx.taxCode.createMany({
      data: taxCodes.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        description: strOrNull(row.description),
        isInclusive: Boolean(row.isInclusive),
        isActive: bool(row.isActive, true),
      })),
      skipDuplicates: true,
    })
  }

  const taxCodeRates = asRows(backup.taxCodeRates)
  if (taxCodeRates.length) {
    await tx.taxCodeRate.createMany({
      data: taxCodeRates.map((row) => ({
        id: mapReq(row.id),
        orgId,
        taxCodeId: mapReq(row.taxCodeId),
        taxRateId: mapReq(row.taxRateId),
        sequence: num(row.sequence, 1),
        isCompound: Boolean(row.isCompound),
      })),
      skipDuplicates: true,
    })
  }

  const customers = asRows(backup.customers)
  if (customers.length) {
    await tx.customer.createMany({
      data: customers.map((row) => ({
        id: mapReq(row.id),
        orgId,
        displayName: str(row.displayName),
        companyName: strOrNull(row.companyName),
        firstName: strOrNull(row.firstName),
        lastName: strOrNull(row.lastName),
        email: strOrNull(row.email),
        phone: strOrNull(row.phone),
        mobile: strOrNull(row.mobile),
        taxRegistrationNumber: strOrNull(row.taxRegistrationNumber),
        billingLine1: strOrNull(row.billingLine1),
        billingLine2: strOrNull(row.billingLine2),
        billingCity: strOrNull(row.billingCity),
        billingRegion: strOrNull(row.billingRegion),
        billingPostalCode: strOrNull(row.billingPostalCode),
        billingCountry: strOrNull(row.billingCountry),
        shippingLine1: strOrNull(row.shippingLine1),
        shippingLine2: strOrNull(row.shippingLine2),
        shippingCity: strOrNull(row.shippingCity),
        shippingRegion: strOrNull(row.shippingRegion),
        shippingPostalCode: strOrNull(row.shippingPostalCode),
        shippingCountry: strOrNull(row.shippingCountry),
        isActive: bool(row.isActive, true),
        paymentTermId: map(row.paymentTermId),
        creditLimit: row.creditLimit != null ? dec(row.creditLimit) : null,
        notes: strOrNull(row.notes),
        salesPerson: strOrNull(row.salesPerson),
        agreementDate: dateOrNull(row.agreementDate),
        balanceDate: dateOrNull(row.balanceDate),
        balanceTime: strOrNull(row.balanceTime),
        reminderDays: row.reminderDays != null ? num(row.reminderDays) : null,
      })),
      skipDuplicates: true,
    })
  }

  const vendors = asRows(backup.vendors)
  if (vendors.length) {
    await tx.vendor.createMany({
      data: vendors.map((row) => ({
        id: mapReq(row.id),
        orgId,
        displayName: str(row.displayName),
        companyName: strOrNull(row.companyName),
        email: strOrNull(row.email),
        phone: strOrNull(row.phone),
        isActive: bool(row.isActive, true),
        paymentTermId: map(row.paymentTermId),
        defaultExpenseAccountId: map(row.defaultExpenseAccountId ?? row.payableAccountId),
        notes: strOrNull(row.notes),
        agreementDate: dateOrNull(row.agreementDate),
        balanceDate: dateOrNull(row.balanceDate),
        balanceTime: strOrNull(row.balanceTime),
        reminderDays: row.reminderDays != null ? num(row.reminderDays) : null,
      })),
      skipDuplicates: true,
    })
  }

  const itemCategories = asRows(backup.itemCategories)
  if (itemCategories.length) {
    await tx.itemCategory.createMany({
      data: itemCategories.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        parentId: null,
      })),
      skipDuplicates: true,
    })
    for (const row of itemCategories) {
      if (!row.parentId) continue
      await tx.itemCategory.update({
        where: { id: mapReq(row.id) },
        data: { parentId: map(row.parentId) },
      })
    }
  }

  const stores = asRows(backup.stores)
  if (stores.length) {
    await tx.store.createMany({
      data: stores.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        inventoryAccountId: mapReq(row.inventoryAccountId),
        isActive: bool(row.isActive, true),
        isOffice: Boolean(row.isOffice),
        address: strOrNull(row.address),
        phone: strOrNull(row.phone),
        keyHolderName: strOrNull(row.keyHolderName),
        keyHolderPhone: strOrNull(row.keyHolderPhone),
        notes: strOrNull(row.notes),
      })),
      skipDuplicates: true,
    })
  }

  const posPaymentMethods = asRows(backup.posPaymentMethods)
  if (posPaymentMethods.length) {
    await tx.posPaymentMethod.createMany({
      data: posPaymentMethods.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        ledgerAccountId: mapReq(row.ledgerAccountId),
        allowsChangeReturn: bool(row.allowsChangeReturn, true),
        isActive: bool(row.isActive, true),
        sortOrder: num(row.sortOrder),
      })),
      skipDuplicates: true,
    })
  }

  const items = asRows(backup.items)
  if (items.length) {
    await tx.item.createMany({
      data: items.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        sku: strOrNull(row.sku),
        barcode: strOrNull(row.barcode),
        type: (row.type as never) ?? 'NON_INVENTORY',
        isActive: bool(row.isActive, true),
        categoryId: map(row.categoryId),
        salesPrice: row.salesPrice != null ? dec(row.salesPrice) : null,
        purchaseCost:
          row.purchaseCost != null
            ? dec(row.purchaseCost)
            : row.purchasePrice != null
              ? dec(row.purchasePrice)
              : null,
        incomeAccountId: map(row.incomeAccountId),
        expenseAccountId: map(row.expenseAccountId),
        inventoryAccountId: map(row.inventoryAccountId ?? row.assetAccountId),
        cogsAccountId: map(row.cogsAccountId),
        salesTaxCodeId: map(row.salesTaxCodeId),
        purchaseTaxCodeId: map(row.purchaseTaxCodeId),
        description: strOrNull(row.description),
        storeId: map(row.storeId),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
      })),
      skipDuplicates: true,
    })
  }

  const posRegisters = asRows(backup.posRegisters)
  if (posRegisters.length) {
    await tx.posRegister.createMany({
      data: posRegisters
        .filter((row) => row.defaultCustomerId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          name: str(row.name),
          storeId: map(row.storeId),
          defaultCustomerId: mapReq(row.defaultCustomerId),
          ledgerAccountId: map(row.ledgerAccountId),
          isActive: bool(row.isActive, true),
          defaultChangeMethodId: map(row.defaultChangeMethodId),
          allowWalletChangeReturn: bool(row.allowWalletChangeReturn, true),
          pinHash: strOrNull(row.pinHash),
        })),
      skipDuplicates: true,
    })
  }

  // Journals first without reversal links, then patch reversals.
  const journals = asRows(backup.journals)
  if (journals.length) {
    await tx.journal.createMany({
      data: journals.map((row) => ({
        id: mapReq(row.id),
        orgId,
        journalNumber: str(row.journalNumber),
        date: dateRequired(row.date),
        periodId: mapReq(row.periodId),
        memo: strOrNull(row.memo),
        sourceType: row.sourceType as never,
        sourceId: map(row.sourceId),
        status: (row.status as never) ?? 'POSTED',
        isAdjusting: Boolean(row.isAdjusting),
        isClosingEntry: Boolean(row.isClosingEntry),
        reversalOfId: null,
        reversalReason: strOrNull(row.reversalReason),
        currencyCode: str(row.currencyCode, 'USD'),
        exchangeRate: dec(row.exchangeRate, '1'),
        idempotencyKey: strOrNull(row.idempotencyKey),
        postedAt: dateRequired(row.postedAt),
        createdById: strOrNull(row.createdById),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
      })),
      skipDuplicates: true,
    })
    for (const row of journals) {
      if (!row.reversalOfId) continue
      await tx.journal.update({
        where: { id: mapReq(row.id) },
        data: { reversalOfId: map(row.reversalOfId) },
      })
    }
    for (const row of fiscalYears) {
      if (!row.closingJournalId) continue
      await tx.fiscalYear.update({
        where: { id: mapReq(row.id) },
        data: { closingJournalId: map(row.closingJournalId) },
      })
    }
  }

  const journalLines = asRows(backup.journalLines)
  if (journalLines.length) {
    await tx.journalLine.createMany({
      data: journalLines.map((row) => ({
        id: mapReq(row.id),
        journalId: mapReq(row.journalId),
        orgId,
        lineNumber: num(row.lineNumber, 1),
        accountId: mapReq(row.accountId),
        debit: dec(row.debit),
        credit: dec(row.credit),
        description: strOrNull(row.description),
        journalDate: dateRequired(row.journalDate ?? row.date),
        customerId: map(row.customerId),
        vendorId: map(row.vendorId),
        foreignDebit: row.foreignDebit != null ? dec(row.foreignDebit) : null,
        foreignCredit: row.foreignCredit != null ? dec(row.foreignCredit) : null,
      })),
      skipDuplicates: true,
    })
  }

  const salesDocuments = asRows(backup.salesDocuments)
  if (salesDocuments.length) {
    await tx.salesDocument.createMany({
      data: salesDocuments.map((row) => ({
        id: mapReq(row.id),
        orgId,
        type: row.type as never,
        number: str(row.number),
        customerId: mapReq(row.customerId),
        date: dateRequired(row.date),
        dueDate: dateOrNull(row.dueDate),
        paymentTermId: map(row.paymentTermId),
        expiryDate: dateOrNull(row.expiryDate),
        status: (row.status as never) ?? 'DRAFT',
        reference: strOrNull(row.reference),
        memo: strOrNull(row.memo),
        customerMessage: strOrNull(row.customerMessage),
        subtotal: dec(row.subtotal),
        discountAmount: dec(row.discountAmount),
        taxTotal: dec(row.taxTotal),
        total: dec(row.total),
        currencyCode: str(row.currencyCode, 'USD'),
        exchangeRate: dec(row.exchangeRate, '1'),
        depositAccountId: map(row.depositAccountId),
        journalId: map(row.journalId),
        version: num(row.version, 1),
        convertedFromId: null,
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
    for (const row of salesDocuments) {
      if (!row.convertedFromId) continue
      await tx.salesDocument.update({
        where: { id: mapReq(row.id) },
        data: { convertedFromId: map(row.convertedFromId) },
      })
    }
  }

  const salesDocumentLines = asRows(backup.salesDocumentLines)
  if (salesDocumentLines.length) {
    await tx.salesDocumentLine.createMany({
      data: salesDocumentLines.map((row) => ({
        id: mapReq(row.id),
        documentId: mapReq(row.documentId),
        orgId,
        lineNumber: num(row.lineNumber, 1),
        itemId: map(row.itemId),
        description: strOrNull(row.description),
        quantity: dec(row.quantity, '1'),
        unitPrice: dec(row.unitPrice),
        discountPercent: row.discountPercent != null ? dec(row.discountPercent) : null,
        amount: dec(row.amount),
        taxCodeId: map(row.taxCodeId),
        taxAmount: dec(row.taxAmount),
        incomeAccountId: map(row.incomeAccountId),
        storeId: map(row.storeId),
        serviceDate: dateOrNull(row.serviceDate),
      })),
      skipDuplicates: true,
    })
  }

  const customerPayments = asRows(backup.customerPayments)
  if (customerPayments.length) {
    await tx.customerPayment.createMany({
      data: customerPayments.map((row) => ({
        id: mapReq(row.id),
        orgId,
        number: str(row.number),
        customerId: mapReq(row.customerId),
        date: dateRequired(row.date),
        amount: dec(row.amount),
        method: (row.method as never) ?? 'BANK_TRANSFER',
        reference: strOrNull(row.reference),
        memo: strOrNull(row.memo),
        depositAccountId: mapReq(row.depositAccountId),
        currencyCode: str(row.currencyCode, 'USD'),
        exchangeRate: dec(row.exchangeRate, '1'),
        journalId: map(row.journalId),
        status: (row.status as never) ?? 'OPEN',
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const salesApplications = asRows(backup.salesApplications)
  if (salesApplications.length) {
    await tx.salesApplication.createMany({
      data: salesApplications.map((row) => ({
        id: mapReq(row.id),
        orgId,
        paymentId: map(row.paymentId),
        creditDocumentId: map(row.creditDocumentId),
        invoiceId: mapReq(row.invoiceId),
        amount: dec(row.amount),
        appliedAt: dateRequired(row.appliedAt),
      })),
      skipDuplicates: true,
    })
  }

  const purchaseDocuments = asRows(backup.purchaseDocuments)
  if (purchaseDocuments.length) {
    await tx.purchaseDocument.createMany({
      data: purchaseDocuments.map((row) => ({
        id: mapReq(row.id),
        orgId,
        type: row.type as never,
        number: str(row.number),
        vendorId: mapReq(row.vendorId),
        date: dateRequired(row.date),
        dueDate: dateOrNull(row.dueDate),
        paymentTermId: map(row.paymentTermId),
        expiryDate: dateOrNull(row.expiryDate),
        status: (row.status as never) ?? 'DRAFT',
        reference: strOrNull(row.reference),
        memo: strOrNull(row.memo),
        subtotal: dec(row.subtotal),
        taxTotal: dec(row.taxTotal),
        total: dec(row.total),
        currencyCode: str(row.currencyCode, 'USD'),
        exchangeRate: dec(row.exchangeRate, '1'),
        paymentAccountId: map(row.paymentAccountId),
        offsetCustomerId: map(row.offsetCustomerId),
        journalId: map(row.journalId),
        version: num(row.version, 1),
        convertedFromId: null,
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
    for (const row of purchaseDocuments) {
      if (!row.convertedFromId) continue
      await tx.purchaseDocument.update({
        where: { id: mapReq(row.id) },
        data: { convertedFromId: map(row.convertedFromId) },
      })
    }
  }

  const purchaseDocumentLines = asRows(backup.purchaseDocumentLines)
  if (purchaseDocumentLines.length) {
    await tx.purchaseDocumentLine.createMany({
      data: purchaseDocumentLines.map((row) => ({
        id: mapReq(row.id),
        documentId: mapReq(row.documentId),
        orgId,
        lineNumber: num(row.lineNumber, 1),
        itemId: map(row.itemId),
        description: strOrNull(row.description),
        quantity: dec(row.quantity, '1'),
        unitPrice: dec(row.unitPrice),
        quantityReceived: dec(row.quantityReceived),
        discountPercent: row.discountPercent != null ? dec(row.discountPercent) : null,
        amount: dec(row.amount),
        taxCodeId: map(row.taxCodeId),
        taxAmount: dec(row.taxAmount),
        expenseAccountId: map(row.expenseAccountId),
        storeId: map(row.storeId),
      })),
      skipDuplicates: true,
    })
  }

  const billPayments = asRows(backup.billPayments)
  if (billPayments.length) {
    await tx.billPayment.createMany({
      data: billPayments.map((row) => ({
        id: mapReq(row.id),
        orgId,
        number: str(row.number),
        vendorId: mapReq(row.vendorId),
        date: dateRequired(row.date),
        amount: dec(row.amount),
        method: (row.method as never) ?? 'BANK_TRANSFER',
        reference: strOrNull(row.reference),
        memo: strOrNull(row.memo),
        paymentAccountId: mapReq(row.paymentAccountId),
        currencyCode: str(row.currencyCode, 'USD'),
        exchangeRate: dec(row.exchangeRate, '1'),
        journalId: map(row.journalId),
        status: (row.status as never) ?? 'OPEN',
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const purchaseApplications = asRows(backup.purchaseApplications)
  if (purchaseApplications.length) {
    await tx.purchaseApplication.createMany({
      data: purchaseApplications.map((row) => ({
        id: mapReq(row.id),
        orgId,
        paymentId: map(row.paymentId),
        creditDocumentId: map(row.creditDocumentId),
        billId: mapReq(row.billId),
        amount: dec(row.amount),
        appliedAt: dateRequired(row.appliedAt),
      })),
      skipDuplicates: true,
    })
  }

  const bankTransfers = asRows(backup.bankTransfers)
  if (bankTransfers.length) {
    await tx.bankTransfer.createMany({
      data: bankTransfers.map((row) => ({
        id: mapReq(row.id),
        orgId,
        number: str(row.number),
        date: dateRequired(row.date),
        fromAccountId: mapReq(row.fromAccountId),
        toAccountId: mapReq(row.toAccountId),
        amount: dec(row.amount),
        memo: strOrNull(row.memo),
        reference: strOrNull(row.reference),
        currencyCode: str(row.currencyCode, 'USD'),
        journalId: map(row.journalId),
        status: (row.status as never) ?? 'POSTED',
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const deposits = asRows(backup.deposits)
  if (deposits.length) {
    await tx.deposit.createMany({
      data: deposits.map((row) => ({
        id: mapReq(row.id),
        orgId,
        number: str(row.number),
        date: dateRequired(row.date),
        bankAccountId: mapReq(row.bankAccountId),
        total: dec(row.total),
        memo: strOrNull(row.memo),
        reference: strOrNull(row.reference),
        currencyCode: str(row.currencyCode, 'USD'),
        journalId: map(row.journalId),
        status: (row.status as never) ?? 'POSTED',
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const depositLines = asRows(backup.depositLines)
  if (depositLines.length) {
    await tx.depositLine.createMany({
      data: depositLines.map((row) => ({
        id: mapReq(row.id),
        depositId: mapReq(row.depositId),
        orgId,
        lineNumber: num(row.lineNumber, 1),
        customerPaymentId: map(row.customerPaymentId),
        accountId: map(row.accountId),
        description: strOrNull(row.description),
        amount: dec(row.amount),
      })),
      skipDuplicates: true,
    })
  }

  const importedTransactions = asRows(backup.importedTransactions)
  if (importedTransactions.length) {
    await tx.importedTransaction.createMany({
      data: importedTransactions.map((row) => ({
        id: mapReq(row.id),
        orgId,
        accountId: mapReq(row.accountId),
        date: dateRequired(row.date),
        description: str(row.description),
        reference: strOrNull(row.reference),
        amount: dec(row.amount),
        externalId: strOrNull(row.externalId),
        status: (row.status as never) ?? 'PENDING',
        matchedJournalLineId: map(row.matchedJournalLineId),
        matchedAt: dateOrNull(row.matchedAt),
        categoryAccountId: map(row.categoryAccountId),
        vendorId: map(row.vendorId),
        customerId: map(row.customerId),
        importedAt: dateRequired(row.importedAt),
        importedById: strOrNull(row.importedById),
      })),
      skipDuplicates: true,
    })
  }

  const reconciliations = asRows(backup.reconciliations)
  if (reconciliations.length) {
    await tx.bankReconciliation.createMany({
      data: reconciliations.map((row) => ({
        id: mapReq(row.id),
        orgId,
        accountId: mapReq(row.accountId),
        statementDate: dateRequired(row.statementDate),
        statementEndingBalance: dec(row.statementEndingBalance),
        beginningBalance: dec(row.beginningBalance),
        status: (row.status as never) ?? 'IN_PROGRESS',
        notes: strOrNull(row.notes),
        startedAt: dateRequired(row.startedAt),
        startedById: strOrNull(row.startedById),
        completedAt: dateOrNull(row.completedAt),
        completedById: strOrNull(row.completedById),
      })),
      skipDuplicates: true,
    })
  }

  const reconciliationEntries = asRows(backup.reconciliationEntries)
  if (reconciliationEntries.length) {
    await tx.reconciliationEntry.createMany({
      data: reconciliationEntries.map((row) => ({
        id: mapReq(row.id),
        orgId,
        reconciliationId: mapReq(row.reconciliationId),
        journalLineId: mapReq(row.journalLineId),
        clearedAt: dateRequired(row.clearedAt),
      })),
      skipDuplicates: true,
    })
  }

  const inventoryAdjustments = asRows(backup.inventoryAdjustments)
  if (inventoryAdjustments.length) {
    await tx.inventoryAdjustment.createMany({
      data: inventoryAdjustments.map((row) => ({
        id: mapReq(row.id),
        orgId,
        number: str(row.number),
        date: dateRequired(row.date),
        accountId: mapReq(row.accountId),
        memo: strOrNull(row.memo),
        reason: strOrNull(row.reason),
        status: (row.status as never) ?? 'POSTED',
        journalId: map(row.journalId),
        voidedAt: dateOrNull(row.voidedAt),
        voidReason: strOrNull(row.voidReason),
        deletedAt: dateOrNull(row.deletedAt),
        deletedById: strOrNull(row.deletedById),
        deleteReason: strOrNull(row.deleteReason),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const inventoryAdjustmentLines = asRows(backup.inventoryAdjustmentLines)
  if (inventoryAdjustmentLines.length) {
    await tx.inventoryAdjustmentLine.createMany({
      data: inventoryAdjustmentLines.map((row) => ({
        id: mapReq(row.id),
        adjustmentId: mapReq(row.adjustmentId),
        orgId,
        lineNumber: num(row.lineNumber, 1),
        itemId: mapReq(row.itemId),
        countedQuantity: dec(row.countedQuantity ?? row.quantity),
        previousQuantity: dec(row.previousQuantity),
        quantityChange: dec(
          row.quantityChange ??
            (row.countedQuantity != null && row.previousQuantity != null
              ? Number(row.countedQuantity) - Number(row.previousQuantity)
              : row.quantity),
        ),
        unitCost: dec(row.unitCost),
        value: dec(row.value),
        description: strOrNull(row.description),
      })),
      skipDuplicates: true,
    })
  }

  const inventoryTransactions = asRows(backup.inventoryTransactions)
  if (inventoryTransactions.length) {
    await tx.inventoryTransaction.createMany({
      data: inventoryTransactions.map((row) => ({
        id: mapReq(row.id),
        orgId,
        itemId: mapReq(row.itemId),
        date: dateRequired(row.date),
        type: row.type as never,
        sourceType: row.sourceType as never,
        sourceId: map(row.sourceId),
        sourceLineId: map(row.sourceLineId),
        quantity: dec(row.quantity),
        unitCost: dec(row.unitCost),
        value: dec(row.value),
        runningQuantity: dec(row.runningQuantity),
        runningValue: dec(row.runningValue),
        sequence: num(row.sequence),
        journalId: map(row.journalId),
        storeId: map(row.storeId),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const bankRules = asRows(backup.bankRules).filter((row) => Boolean(row.categoryAccountId))
  if (bankRules.length) {
    await tx.bankRule.createMany({
      data: bankRules
        .map((row) => {
          const categoryAccountId = map(row.categoryAccountId)
          if (!categoryAccountId) return null
          return {
            id: mapReq(row.id),
            orgId,
            name: str(row.name),
            contains: str(row.contains ?? row.pattern),
            accountId: map(row.accountId),
            categoryAccountId,
            vendorId: map(row.vendorId),
            customerId: map(row.customerId),
            active: bool(row.active ?? row.isActive, true),
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
      skipDuplicates: true,
    })
  }

  const reportNotes = asRows(backup.reportNotes)
  if (reportNotes.length) {
    await tx.reportNote.createMany({
      data: reportNotes.map((row) => ({
        id: mapReq(row.id),
        orgId,
        reportKey: str(row.reportKey ?? row.key),
        body: str(row.body ?? row.note),
      })),
      skipDuplicates: true,
    })
  }

  const customerFiles = asRows(backup.customerFiles)
  if (customerFiles.length) {
    await tx.customerFile.createMany({
      data: customerFiles
        .filter((row) => row.customerId && row.id)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          customerId: mapReq(row.customerId),
          kind: (row.kind === 'AGREEMENT' ? 'AGREEMENT' : 'PHOTO') as 'AGREEMENT' | 'PHOTO',
          originalName: str(row.originalName ?? row.fileName ?? row.name, 'file'),
          contentType: str(row.contentType, 'application/octet-stream'),
          byteSize: num(row.byteSize ?? row.sizeBytes ?? row.size),
          storageKey: str(row.storageKey ?? row.path),
          createdById: strOrNull(row.createdById ?? row.uploadedById),
        })),
      skipDuplicates: true,
    })
  }

  const ledgerFiles = asRows(backup.ledgerFiles)
  if (ledgerFiles.length) {
    await tx.ledgerFile.createMany({
      data: ledgerFiles
        .filter((row) => row.id && (row.storageKey || row.originalName))
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          originalName: str(row.originalName, 'file'),
          contentType: str(row.contentType, 'application/octet-stream'),
          byteSize: num(row.byteSize),
          storageKey: str(row.storageKey),
          importedTransactionId: map(row.importedTransactionId),
          journalId: map(row.journalId),
          purchaseDocumentId: map(row.purchaseDocumentId),
          createdById: strOrNull(row.createdById),
        })),
      skipDuplicates: true,
    })
  }

  const bookmarks = asRows(backup.bookmarks)
  if (bookmarks.length) {
    const userIds = new Set(
      (
        await tx.user.findMany({
          where: { id: { in: bookmarks.map((row) => str(row.userId)).filter(Boolean) } },
          select: { id: true },
        })
      ).map((row) => row.id),
    )
    const rows = bookmarks
      .filter((row) => row.id && userIds.has(str(row.userId)))
      .map((row) => ({
        id: mapReq(row.id),
        orgId,
        userId: str(row.userId),
        label: str(row.label),
        href: str(row.href),
        kind: str(row.kind, 'pin'),
      }))
    if (rows.length) {
      await tx.workspaceBookmark.createMany({ data: rows, skipDuplicates: true })
    }
  }

  await restoreOperatingExtras(tx, backup, orgId, map, mapReq)
}

async function restoreOperatingExtras(
  tx: Tx,
  backup: CompanyBackup,
  orgId: string,
  map: IdMaps['map'],
  mapReq: IdMaps['mapReq'],
) {
  const itemComponents = asRows(backup.itemComponents)
  if (itemComponents.length) {
    await tx.itemComponent.createMany({
      data: itemComponents
        .filter((row) => row.parentItemId && row.componentItemId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          parentItemId: mapReq(row.parentItemId),
          componentItemId: mapReq(row.componentItemId),
          quantity: dec(row.quantity, '1'),
          sortOrder: num(row.sortOrder),
        })),
      skipDuplicates: true,
    })
  }

  const employees = asRows(backup.employees)
  const employeeOldIds = new Set(employees.map((row) => str(row.id)).filter(Boolean))
  if (employees.length) {
    const wantedUserIds = employees.map((row) => str(row.userId)).filter(Boolean)
    const userIds = new Set(
      wantedUserIds.length
        ? (
            await tx.user.findMany({
              where: { id: { in: wantedUserIds } },
              select: { id: true },
            })
          ).map((row) => row.id)
        : [],
    )
    await tx.employee.createMany({
      data: employees.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        jobTitle: strOrNull(row.jobTitle),
        department: strOrNull(row.department),
        photoUrl: strOrNull(row.photoUrl),
        workEmail: strOrNull(row.workEmail),
        workPhone: strOrNull(row.workPhone),
        mobile: strOrNull(row.mobile),
        workStreet: strOrNull(row.workStreet),
        workCity: strOrNull(row.workCity),
        workCountry: strOrNull(row.workCountry),
        privateStreet: strOrNull(row.privateStreet),
        privateCity: strOrNull(row.privateCity),
        privateCountry: strOrNull(row.privateCountry),
        emergencyContact: strOrNull(row.emergencyContact),
        emergencyPhone: strOrNull(row.emergencyPhone),
        skills: strOrNull(row.skills),
        notes: strOrNull(row.notes),
        active: bool(row.active, true),
        lifecycleStatus: (['DRAFT', 'ACTIVE', 'LEFT'] as const).includes(row.lifecycleStatus as never)
          ? (row.lifecycleStatus as 'DRAFT' | 'ACTIVE' | 'LEFT')
          : 'ACTIVE',
        employmentType: (['EMPLOYEE', 'CONTRACTOR', 'INTERN'] as const).includes(
          row.employmentType as never,
        )
          ? (row.employmentType as 'EMPLOYEE' | 'CONTRACTOR' | 'INTERN')
          : 'EMPLOYEE',
        hiredAt: dateOrNull(row.hiredAt),
        leftAt: dateOrNull(row.leftAt),
        managerId: employeeOldIds.has(str(row.managerId)) ? map(row.managerId) : null,
        userId: userIds.has(str(row.userId)) ? str(row.userId) : null,
        wageType: (['MONTHLY', 'DAILY', 'HOURLY'] as const).includes(row.wageType as never)
          ? (row.wageType as 'MONTHLY' | 'DAILY' | 'HOURLY')
          : 'MONTHLY',
        wageAmount: dec(row.wageAmount),
        expenseAccountId: map(row.expenseAccountId),
        payableAccountId: map(row.payableAccountId),
        payMethod: (['CASH', 'BANK', 'MOBILE'] as const).includes(row.payMethod as never)
          ? (row.payMethod as 'CASH' | 'BANK' | 'MOBILE')
          : 'CASH',
        payAccountId: map(row.payAccountId),
        structureId: null,
      })),
      skipDuplicates: true,
    })
  }

  const payrollRuns = asRows(backup.payrollRuns)
  if (payrollRuns.length) {
    await tx.payrollRun.createMany({
      data: payrollRuns.map((row) => ({
        id: mapReq(row.id),
        orgId,
        periodStart: dateRequired(row.periodStart),
        periodEnd: dateRequired(row.periodEnd),
        memo: strOrNull(row.memo),
        status: row.status === 'POSTED' ? 'POSTED' : 'DRAFT',
        journalId: map(row.journalId),
        postedAt: dateOrNull(row.postedAt),
        settlementJournalId: map(row.settlementJournalId),
        paidAt: dateOrNull(row.paidAt),
        payFromAccountId: map(row.payFromAccountId),
        payMode: row.payMode === 'ACCRUE' ? 'ACCRUE' : 'IMMEDIATE',
        awaitingApproval: bool(row.awaitingApproval, false),
        liabilityAccountId: map(row.liabilityAccountId),
        createdById: strOrNull(row.createdById),
      })),
      skipDuplicates: true,
    })
  }

  const payslips = asRows(backup.payslips)
  if (payslips.length) {
    await tx.payslip.createMany({
      data: payslips
        .filter((row) => row.runId && employeeOldIds.has(str(row.employeeId)))
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          runId: mapReq(row.runId),
          employeeId: mapReq(row.employeeId),
          gross: dec(row.gross),
          deductions: dec(row.deductions),
          employer: dec(row.employer),
          net: dec(row.net),
          number: strOrNull(row.number),
          included: bool(row.included, true),
        })),
      skipDuplicates: true,
    })
  }

  const payslipLines = asRows(backup.payslipLines)
  if (payslipLines.length) {
    await tx.payslipLine.createMany({
      data: payslipLines
        .filter((row) => row.payslipId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          payslipId: mapReq(row.payslipId),
          code: str(row.code),
          label: str(row.label),
          amount: dec(row.amount),
          kind: (row.kind as never) ?? 'EARNING',
          sortOrder: num(row.sortOrder),
          affectsNet: bool(row.affectsNet, true),
          expenseAccountId: map(row.expenseAccountId),
          liabilityAccountId: map(row.liabilityAccountId),
        })),
      skipDuplicates: true,
    })
  }

  const fxHedges = asRows(backup.fxHedges)
  if (fxHedges.length) {
    await tx.fxHedge.createMany({
      data: fxHedges.map((row) => ({
        id: mapReq(row.id),
        orgId,
        kind: row.kind === 'FAIR_VALUE' ? 'FAIR_VALUE' : 'CASH_FLOW',
        status: (['OPEN', 'SETTLED', 'CANCELLED'] as const).includes(row.status as never)
          ? (row.status as 'OPEN' | 'SETTLED' | 'CANCELLED')
          : 'OPEN',
        currencyCode: str(row.currencyCode, 'USD'),
        contractRate: dec(row.contractRate, '1'),
        notional: dec(row.notional),
        maturityDate: dateRequired(row.maturityDate),
        risk: str(row.risk, 'FX'),
        hedgedItem: str(row.hedgedItem, 'Open AR/AP'),
        instrument: str(row.instrument, 'Forward'),
        counterpart: strOrNull(row.counterpart),
        memo: strOrNull(row.memo),
        journalId: map(row.journalId),
      })),
      skipDuplicates: true,
    })
  }

  const kitchenTickets = asRows(backup.kitchenTickets)
  if (kitchenTickets.length) {
    await tx.kitchenTicket.createMany({
      data: kitchenTickets.map((row) => ({
        id: mapReq(row.id),
        orgId,
        tableLabel: strOrNull(row.tableLabel),
        covers: num(row.covers, 1),
        status: (['OPEN', 'FIRED', 'READY', 'DONE'] as const).includes(row.status as never)
          ? (row.status as 'OPEN' | 'FIRED' | 'READY' | 'DONE')
          : 'OPEN',
        lines: (row.lines as object) ?? [],
        notes: strOrNull(row.notes),
      })),
      skipDuplicates: true,
    })
  }

  const stockBins = asRows(backup.stockBins)
  if (stockBins.length) {
    await tx.stockBin.createMany({
      data: stockBins
        .filter((row) => row.storeId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          storeId: mapReq(row.storeId),
          code: str(row.code),
          name: str(row.name, str(row.code)),
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }

  const pickTasks = asRows(backup.pickTasks)
  if (pickTasks.length) {
    await tx.pickTask.createMany({
      data: pickTasks
        .filter((row) => row.storeId && row.itemId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          storeId: mapReq(row.storeId),
          binId: map(row.binId),
          itemId: mapReq(row.itemId),
          qty: dec(row.qty, '1'),
          status: (['OPEN', 'PICKING', 'PICKED', 'CANCELLED'] as const).includes(row.status as never)
            ? (row.status as 'OPEN' | 'PICKING' | 'PICKED' | 'CANCELLED')
            : 'OPEN',
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }

  const trainingCourses = asRows(backup.trainingCourses)
  if (trainingCourses.length) {
    await tx.trainingCourse.createMany({
      data: trainingCourses.map((row) => ({
        id: mapReq(row.id),
        orgId,
        title: str(row.title),
        hours: dec(row.hours),
        description: strOrNull(row.description),
        active: bool(row.active, true),
      })),
      skipDuplicates: true,
    })
  }

  const trainingEnrollments = asRows(backup.trainingEnrollments)
  if (trainingEnrollments.length) {
    await tx.trainingEnrollment.createMany({
      data: trainingEnrollments
        .filter((row) => row.courseId && employeeOldIds.has(str(row.employeeId)))
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          courseId: mapReq(row.courseId),
          employeeId: mapReq(row.employeeId),
          status: (['ENROLLED', 'COMPLETED', 'FAILED'] as const).includes(row.status as never)
            ? (row.status as 'ENROLLED' | 'COMPLETED' | 'FAILED')
            : 'ENROLLED',
          completedAt: dateOrNull(row.completedAt),
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }

  const leaveTypes = asRows(backup.leaveTypes)
  if (leaveTypes.length) {
    await tx.leaveType.createMany({
      data: leaveTypes.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        paid: bool(row.paid, true),
        daysPerYear: dec(row.daysPerYear),
        active: bool(row.active, true),
      })),
      skipDuplicates: true,
    })
  }

  const leaveAllocations = asRows(backup.leaveAllocations)
  if (leaveAllocations.length) {
    await tx.leaveAllocation.createMany({
      data: leaveAllocations
        .filter((row) => employeeOldIds.has(str(row.employeeId)) && row.leaveTypeId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          employeeId: mapReq(row.employeeId),
          leaveTypeId: mapReq(row.leaveTypeId),
          year: num(row.year, new Date().getFullYear()),
          entitledDays: dec(row.entitledDays),
        })),
      skipDuplicates: true,
    })
  }

  const planningAssignments = asRows(backup.planningAssignments)
  if (planningAssignments.length) {
    await tx.planningAssignment.createMany({
      data: planningAssignments
        .filter((row) => employeeOldIds.has(str(row.employeeId)))
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          employeeId: mapReq(row.employeeId),
          taskId: strOrNull(row.taskId),
          workDate: dateRequired(row.workDate),
          hours: dec(row.hours),
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }

  const shareholders = asRows(backup.shareholders)
  if (shareholders.length) {
    await tx.shareholder.createMany({
      data: shareholders.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        shares: dec(row.shares),
        ownershipPercent: dec(row.ownershipPercent),
        capitalAccountId: map(row.capitalAccountId),
        notes: strOrNull(row.notes),
      })),
      skipDuplicates: true,
    })
  }

  const equityEvents = asRows(backup.equityEvents)
  if (equityEvents.length) {
    const rows = equityEvents
      .filter((row) => row.bankAccountId && row.equityAccountId)
      .map((row) => ({
        id: mapReq(row.id),
        orgId,
        shareholderId: map(row.shareholderId),
        kind: (['CONTRIBUTION', 'DRAW', 'DIVIDEND'] as const).includes(row.kind as never)
          ? (row.kind as 'CONTRIBUTION' | 'DRAW' | 'DIVIDEND')
          : 'CONTRIBUTION',
        date: dateRequired(row.date),
        amount: dec(row.amount),
        memo: strOrNull(row.memo),
        bankAccountId: mapReq(row.bankAccountId),
        equityAccountId: mapReq(row.equityAccountId),
        journalId: map(row.journalId),
      }))
    if (rows.length) {
      await tx.equityEvent.createMany({ data: rows, skipDuplicates: true })
    }
  }

  const openings = asRows(backup.jobOpenings)
  if (openings.length) {
    await tx.jobOpening.createMany({
      data: openings.map((row) => ({
        id: mapReq(row.id),
        orgId,
        title: str(row.title),
        department: strOrNull(row.department),
        description: strOrNull(row.description),
        status: (['OPEN', 'FILLED', 'CANCELLED'] as const).includes(row.status as never)
          ? (row.status as 'OPEN' | 'FILLED' | 'CANCELLED')
          : 'OPEN',
      })),
      skipDuplicates: true,
    })
  }

  const applicants = asRows(backup.applicants)
  if (applicants.length) {
    await tx.applicant.createMany({
      data: applicants
        .filter((row) => row.jobOpeningId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          jobOpeningId: mapReq(row.jobOpeningId),
          name: str(row.name),
          email: strOrNull(row.email),
          phone: strOrNull(row.phone),
          notes: strOrNull(row.notes),
          status: (['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const).includes(
            row.status as never,
          )
            ? (row.status as 'NEW' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED')
            : 'NEW',
          employeeId: employeeOldIds.has(str(row.employeeId)) ? map(row.employeeId) : null,
        })),
      skipDuplicates: true,
    })
  }

  const appraisals = asRows(backup.appraisals)
  if (appraisals.length) {
    await tx.appraisal.createMany({
      data: appraisals
        .filter((row) => employeeOldIds.has(str(row.employeeId)))
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          employeeId: mapReq(row.employeeId),
          periodLabel: str(row.periodLabel),
          score: row.score == null ? null : dec(row.score),
          notes: strOrNull(row.notes),
          goals: strOrNull(row.goals),
          competencies: (row.competencies as object) ?? undefined,
          reviewedAt: dateOrNull(row.reviewedAt),
        })),
      skipDuplicates: true,
    })
  }

  const signs = asRows(backup.signRequests)
  if (signs.length) {
    await tx.signRequest.createMany({
      data: signs.map((row) => {
        const id = mapReq(row.id)
        const keepToken = id === str(row.id)
        return {
        id,
        orgId,
        title: str(row.title),
        status: (['DRAFT', 'SENT', 'SIGNED', 'DECLINED', 'CANCELLED'] as const).includes(
          row.status as never,
        )
          ? (row.status as 'DRAFT' | 'SENT' | 'SIGNED' | 'DECLINED' | 'CANCELLED')
          : 'SENT',
        token: keepToken
          ? strOrNull(row.token)
          : strOrNull(row.token)
            ? `s${randomBytes(12).toString('hex')}`
            : null,
        message: strOrNull(row.message),
        storageKey: strOrNull(row.storageKey),
        originalName: strOrNull(row.originalName),
        signerName: strOrNull(row.signerName),
        signerEmail: strOrNull(row.signerEmail),
        signatureData: strOrNull(row.signatureData),
        signedAt: dateOrNull(row.signedAt),
        declinedAt: dateOrNull(row.declinedAt),
        declineReason: strOrNull(row.declineReason),
        cancelledAt: dateOrNull(row.cancelledAt),
        }
      }),
      skipDuplicates: true,
    })
  }

  const surveys = asRows(backup.surveys)
  if (surveys.length) {
    await tx.survey.createMany({
      data: surveys.map((row) => ({
        id: mapReq(row.id),
        orgId,
        title: str(row.title),
        description: strOrNull(row.description),
        status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
        questions: (row.questions as Prisma.InputJsonValue) ?? [],
      })),
      skipDuplicates: true,
    })
  }

  const surveyResponses = asRows(backup.surveyResponses)
  if (surveyResponses.length) {
    await tx.surveyResponse.createMany({
      data: surveyResponses
        .filter((row) => row.surveyId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          surveyId: mapReq(row.surveyId),
          respondent: strOrNull(row.respondent),
          answers: (row.answers as Prisma.InputJsonValue) ?? {},
        })),
      skipDuplicates: true,
    })
  }

  const opportunities = asRows(backup.crmOpportunities)
  const opportunityOldIds = new Set(opportunities.map((row) => str(row.id)).filter(Boolean))
  if (opportunities.length) {
    await tx.crmOpportunity.createMany({
      data: opportunities
        .filter((row) => row.customerId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          customerId: mapReq(row.customerId),
          title: str(row.title),
          amount: row.amount == null ? null : dec(row.amount),
          stage: (['LEAD', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const).includes(row.stage as never)
            ? (row.stage as 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST')
            : 'LEAD',
          expectedClose: dateOrNull(row.expectedClose),
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }

  const activities = asRows(backup.crmActivities)
  if (activities.length) {
    const wantedCreatedBy = activities.map((row) => str(row.createdById)).filter(Boolean)
    const createdByIds = new Set(
      wantedCreatedBy.length
        ? (
            await tx.user.findMany({
              where: { id: { in: wantedCreatedBy } },
              select: { id: true },
            })
          ).map((row) => row.id)
        : [],
    )
    await tx.crmActivity.createMany({
      data: activities
        .filter((row) => row.customerId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          customerId: mapReq(row.customerId),
          opportunityId: opportunityOldIds.has(str(row.opportunityId))
            ? map(row.opportunityId)
            : null,
          createdById: createdByIds.has(str(row.createdById)) ? str(row.createdById) : null,
          kind: (['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'] as const).includes(row.kind as never)
            ? (row.kind as 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE')
            : 'NOTE',
          subject: str(row.subject),
          notes: strOrNull(row.notes),
          dueAt: dateOrNull(row.dueAt),
          doneAt: dateOrNull(row.doneAt),
        })),
      skipDuplicates: true,
    })
  }

  const channels = asRows(backup.discussChannels)
  if (channels.length) {
    await tx.discussChannel.createMany({
      data: channels.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name),
        description: strOrNull(row.description),
      })),
      skipDuplicates: true,
    })
  }

  const messages = asRows(backup.discussMessages)
  if (messages.length) {
    const userIds = new Set(
      (
        await tx.user.findMany({
          where: { id: { in: messages.map((row) => str(row.authorId)).filter(Boolean) } },
          select: { id: true },
        })
      ).map((row) => row.id),
    )
    const eligible = messages.filter((row) => row.channelId && userIds.has(str(row.authorId)))
    const remaining = [...eligible]
    const restoredOldIds = new Set<string>()
    for (let pass = 0; pass < 8 && remaining.length > 0; pass += 1) {
      const batch: Record<string, unknown>[] = []
      const deferred: Record<string, unknown>[] = []
      for (const row of remaining) {
        const parentOld = strOrNull(row.parentId)
        if (parentOld && !restoredOldIds.has(parentOld)) {
          deferred.push(row)
          continue
        }
        batch.push(row)
        restoredOldIds.add(str(row.id))
      }
      if (!batch.length) break
      await tx.discussMessage.createMany({
        data: batch.map((row) => ({
          id: mapReq(row.id),
          orgId,
          channelId: mapReq(row.channelId),
          authorId: str(row.authorId),
          parentId: strOrNull(row.parentId) ? mapReq(row.parentId) : null,
          body: str(row.body),
          pinnedAt: dateOrNull(row.pinnedAt),
        })),
        skipDuplicates: true,
      })
      remaining.splice(0, remaining.length, ...deferred)
    }
  }

  const types = asRows(backup.appointmentTypes)
  if (types.length) {
    await tx.appointmentType.createMany({
      data: types.map((row) => ({
        id: mapReq(row.id),
        orgId,
        name: str(row.name, 'Meeting'),
        durationMins: num(row.durationMins, 30),
      })),
      skipDuplicates: true,
    })
  }

  const appointments = asRows(backup.appointments)
  if (appointments.length) {
    await tx.appointment.createMany({
      data: appointments
        .filter((row) => row.typeId)
        .map((row) => ({
          id: mapReq(row.id),
          orgId,
          typeId: mapReq(row.typeId),
          status: (['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const).includes(row.status as never)
            ? (row.status as 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW')
            : 'BOOKED',
          startsAt: dateRequired(row.startsAt),
          endsAt: dateRequired(row.endsAt),
          customerId: map(row.customerId),
          guestName: strOrNull(row.guestName),
          guestEmail: strOrNull(row.guestEmail),
          notes: strOrNull(row.notes),
        })),
      skipDuplicates: true,
    })
  }
}

/** Helpers for import-as-new to share the same row loader. */
export function createRemapIdMaps(backupOrgId: string, newOrgId: string): IdMaps {
  return makeIdMaps('remap', [[backupOrgId, newOrgId]])
}

export { newId, asRows, dateRequired, dateOrNull }
