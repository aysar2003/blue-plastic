import 'server-only'

import { DEFAULT_PAYMENT_TERMS } from '@/lib/payment-terms'
import type {
  PaymentTermInput,
  TaxCodeInput,
  TaxRateInput,
} from '@/lib/validation/master-data'
import type { TaxCodeShape } from '@/server/accounting/tax'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition } from '@/server/errors'
import { assertTaxEnabled } from '@/server/feature-guards'

/* --- Payment terms -------------------------------------------------------- */

export async function listPaymentTerms(ctx: OrgContext, options: { includeInactive?: boolean } = {}) {
  return db.paymentTerm.findMany({
    where: { orgId: ctx.orgId, ...(options.includeInactive ? {} : { isActive: true }) },
    select: {
      id: true, name: true, type: true, dueDays: true,
      discountDays: true, discountPercent: true, isDefault: true, isActive: true,
      _count: { select: { customers: true, vendors: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { dueDays: 'asc' }],
  }).then((rows) =>
    rows.map((row) => ({ ...row, discountPercent: row.discountPercent?.toString() ?? null })),
  )
}

export async function upsertPaymentTerm(ctx: OrgContext, input: PaymentTermInput) {
  const meta = await requestMeta()

  const existing = await db.paymentTerm.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name: input.name } },
    select: { id: true },
  })
  if (existing && existing.id !== input.id) {
    throw conflict(`A payment term called "${input.name}" already exists.`)
  }

  return db.$transaction(async (tx) => {
    // The partial unique index allows only one default, so the old one has to
    // stand down before the new one takes over.
    if (input.isDefault) {
      await tx.paymentTerm.updateMany({
        where: { orgId: ctx.orgId, isDefault: true, ...(input.id ? { id: { not: input.id } } : {}) },
        data: { isDefault: false },
      })
    }

    const data = {
      name: input.name,
      type: input.type,
      dueDays: input.dueDays,
      discountDays: input.discountDays ?? null,
      discountPercent: input.discountPercent ?? null,
      isDefault: input.isDefault,
    }

    const term = input.id
      ? await tx.paymentTerm.update({ where: { id: input.id }, data, select: { id: true, name: true } })
      : await tx.paymentTerm.create({
          data: { orgId: ctx.orgId, ...data },
          select: { id: true, name: true },
        })

    await writeAudit(
      tx,
      ctx,
      { entity: 'PaymentTerm', entityId: term.id, action: input.id ? 'UPDATE' : 'CREATE', after: data },
      meta,
    )
    return term
  })
}

/** The terms a business normally needs, so nobody starts by typing "Net 30". */
export async function seedPaymentTerms(tx: Tx, orgId: string) {
  const existing = await tx.paymentTerm.count({ where: { orgId } })
  if (existing > 0) return { created: 0 }

  await tx.paymentTerm.createMany({
    data: DEFAULT_PAYMENT_TERMS.map((term) => ({
      orgId,
      name: term.name,
      type: term.type,
      dueDays: term.dueDays,
      isDefault: term.isDefault ?? false,
    })),
    skipDuplicates: true,
  })

  return { created: DEFAULT_PAYMENT_TERMS.length }
}

/* --- Tax agencies --------------------------------------------------------- */

export async function listAgencies(ctx: OrgContext) {
  return db.taxAgency.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true, name: true, registrationNumber: true, filingFrequency: true, isActive: true,
      _count: { select: { rates: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertAgency(
  ctx: OrgContext,
  input: { id?: string | null; name: string; registrationNumber?: string | null; filingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' },
) {
  assertTaxEnabled(ctx)
  const meta = await requestMeta()

  const existing = await db.taxAgency.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name: input.name } },
    select: { id: true },
  })
  if (existing && existing.id !== input.id) {
    throw conflict(`A tax agency called "${input.name}" already exists.`)
  }

  return db.$transaction(async (tx) => {
    const data = {
      name: input.name,
      registrationNumber: input.registrationNumber ?? null,
      filingFrequency: input.filingFrequency,
    }

    const agency = input.id
      ? await tx.taxAgency.update({ where: { id: input.id }, data, select: { id: true, name: true } })
      : await tx.taxAgency.create({ data: { orgId: ctx.orgId, ...data }, select: { id: true, name: true } })

    await writeAudit(
      tx,
      ctx,
      { entity: 'TaxAgency', entityId: agency.id, action: input.id ? 'UPDATE' : 'CREATE', after: data },
      meta,
    )
    return agency
  })
}

/* --- Tax rates ------------------------------------------------------------ */

export async function listRates(ctx: OrgContext) {
  return db.taxRate
    .findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true, name: true, rate: true, appliesTo: true, isActive: true,
        agency: { select: { id: true, name: true } },
        salesAccount: { select: { id: true, code: true, name: true } },
        purchaseAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { components: true } },
      },
      orderBy: { name: 'asc' },
    })
    .then((rows) => rows.map((row) => ({ ...row, rate: row.rate.toString() })))
}

export async function upsertRate(ctx: OrgContext, input: TaxRateInput) {
  assertTaxEnabled(ctx)
  const meta = await requestMeta()

  const existing = await db.taxRate.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name: input.name } },
    select: { id: true },
  })
  if (existing && existing.id !== input.id) {
    throw conflict(`A tax rate called "${input.name}" already exists.`)
  }

  const agency = await db.taxAgency.findFirst({
    where: { id: input.agencyId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!agency) throw notFound('Tax agency')

  return db.$transaction(async (tx) => {
    // Sales tax collected is money held for the authority, so it defaults to the
    // Sales Tax Payable liability rather than to whatever was last selected.
    const salesAccountId =
      input.salesAccountId ?? (await systemAccountId(tx, ctx.orgId, 'SALES_TAX_PAYABLE'))

    const data = {
      name: input.name,
      rate: input.percent,
      agencyId: input.agencyId,
      appliesTo: input.appliesTo,
      salesAccountId,
      purchaseAccountId: input.purchaseAccountId ?? null,
    }

    const rate = input.id
      ? await tx.taxRate.update({ where: { id: input.id }, data, select: { id: true, name: true } })
      : await tx.taxRate.create({ data: { orgId: ctx.orgId, ...data }, select: { id: true, name: true } })

    await writeAudit(
      tx,
      ctx,
      { entity: 'TaxRate', entityId: rate.id, action: input.id ? 'UPDATE' : 'CREATE', after: data },
      meta,
    )
    return rate
  })
}

/* --- Tax codes ------------------------------------------------------------ */

export async function listCodes(ctx: OrgContext) {
  return db.taxCode
    .findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true, name: true, description: true, isInclusive: true, isActive: true,
        components: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true, sequence: true, isCompound: true,
            taxRate: { select: { id: true, name: true, rate: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        components: row.components.map((c) => ({
          ...c,
          taxRate: { ...c.taxRate, rate: c.taxRate.rate.toString() },
        })),
        // The headline percentage, for a list. Compound codes are more than the
        // sum of their parts, so this is a label, never the basis of a posting.
        effectiveRate: row.components
          .reduce((total, c) => total + Number(c.taxRate.rate), 0)
          .toFixed(6),
      })),
    )
}

export async function upsertCode(ctx: OrgContext, input: TaxCodeInput) {
  assertTaxEnabled(ctx)
  const meta = await requestMeta()

  const existing = await db.taxCode.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name: input.name } },
    select: { id: true },
  })
  if (existing && existing.id !== input.id) {
    throw conflict(`A tax code called "${input.name}" already exists.`)
  }

  const rates = await db.taxRate.findMany({
    where: { id: { in: input.components.map((c) => c.taxRateId) }, orgId: ctx.orgId },
    select: { id: true },
  })
  if (rates.length !== new Set(input.components.map((c) => c.taxRateId)).size) {
    throw notFound('Tax rate')
  }

  return db.$transaction(async (tx) => {
    const data = {
      name: input.name,
      description: input.description ?? null,
      isInclusive: input.isInclusive,
    }

    const code = input.id
      ? await tx.taxCode.update({ where: { id: input.id }, data, select: { id: true, name: true } })
      : await tx.taxCode.create({ data: { orgId: ctx.orgId, ...data }, select: { id: true, name: true } })

    // Components are replaced wholesale: they are a small ordered set, and
    // diffing them would only invent a way to leave a stale one behind.
    await tx.taxCodeRate.deleteMany({ where: { taxCodeId: code.id } })
    await tx.taxCodeRate.createMany({
      data: input.components.map((component) => ({
        orgId: ctx.orgId,
        taxCodeId: code.id,
        taxRateId: component.taxRateId,
        sequence: component.sequence,
        isCompound: component.isCompound,
      })),
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'TaxCode',
        entityId: code.id,
        action: input.id ? 'UPDATE' : 'CREATE',
        after: { ...data, components: input.components },
      },
      meta,
    )
    return code
  })
}

export async function setCodeActive(ctx: OrgContext, id: string, isActive: boolean) {
  assertTaxEnabled(ctx)
  const meta = await requestMeta()

  if (!isActive) {
    const inUse = await db.item.count({
      where: { orgId: ctx.orgId, isActive: true, OR: [{ salesTaxCodeId: id }, { purchaseTaxCodeId: id }] },
    })
    if (inUse > 0) {
      throw precondition(
        `${inUse} active item${inUse === 1 ? '' : 's'} still use this tax code. Change them first.`,
      )
    }
  }

  return db.$transaction(async (tx) => {
    const code = await tx.taxCode.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true },
    })
    await writeAudit(
      tx,
      ctx,
      { entity: 'TaxCode', entityId: id, action: isActive ? 'RESTORE' : 'ARCHIVE', after: { isActive } },
      meta,
    )
    return code
  })
}

/**
 * Load a tax code in the shape the computation expects.
 *
 * Used by Phase 4 onward when a document line is priced; kept here so there is
 * one definition of what a tax code means.
 */
export async function loadCodeForCalculation(
  client: Tx | typeof db,
  orgId: string,
  taxCodeId: string,
): Promise<TaxCodeShape | null> {
  const code = await client.taxCode.findFirst({
    where: { id: taxCodeId, orgId, isActive: true },
    select: {
      id: true,
      name: true,
      isInclusive: true,
      components: {
        orderBy: { sequence: 'asc' },
        select: {
          sequence: true,
          isCompound: true,
          taxRate: {
            select: { id: true, name: true, rate: true, salesAccountId: true, purchaseAccountId: true },
          },
        },
      },
    },
  })

  if (!code) return null

  return {
    id: code.id,
    name: code.name,
    isInclusive: code.isInclusive,
    components: code.components.map((component) => ({
      taxRateId: component.taxRate.id,
      name: component.taxRate.name,
      rate: component.taxRate.rate.toString(),
      sequence: component.sequence,
      isCompound: component.isCompound,
      salesAccountId: component.taxRate.salesAccountId,
      purchaseAccountId: component.taxRate.purchaseAccountId,
    })),
  }
}
