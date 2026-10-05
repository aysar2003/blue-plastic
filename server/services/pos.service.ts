import 'server-only'

import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import { today } from '@/lib/date'
import type { PosCheckoutInput, PosPaymentMethodInput, PosRegisterInput } from '@/lib/validation/pos'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

export async function listRegisters(ctx: OrgContext) {
  return db.posRegister.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      store: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function registerForTerminal(ctx: OrgContext, registerId: string) {
  const register = await db.posRegister.findFirst({
    where: { id: registerId, orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      storeId: true,
      defaultCustomerId: true,
      methods: {
        select: {
          paymentMethod: {
            select: {
              id: true,
              name: true,
              ledgerAccountId: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  })
  if (!register) throw notFound('Register')

  const methods = register.methods
    .map((row) => row.paymentMethod)
    .filter((method) => method)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  if (methods.length === 0) {
    throw precondition('This register has no payment methods. Add them under POS settings.')
  }

  return {
    id: register.id,
    name: register.name,
    storeId: register.storeId,
    defaultCustomerId: register.defaultCustomerId,
    paymentMethods: methods,
  }
}

export async function catalog(ctx: OrgContext, _storeId: string | null) {
  const items = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      deletedAt: null,
      availableInPos: true,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      salesPrice: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    take: 2000,
  })

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    category: item.category?.name ?? null,
    price: item.salesPrice?.toString() ?? '0',
  }))
}

export async function checkout(ctx: OrgContext, input: PosCheckoutInput) {
  const register = await registerForTerminal(ctx, input.registerId)

  const methodById = new Map(register.paymentMethods.map((method) => [method.id, method]))

  let paymentTotal = ZERO
  const resolvedPayments: salesService.PosCheckoutMeta['payments'] = []

  for (const payment of input.payments) {
    const method = methodById.get(payment.paymentMethodId)
    if (!method) throw validation('One of the payment methods is not allowed on this register.')
    const amount = new Decimal(payment.amount)
    if (amount.isZero() || amount.isNegative()) {
      throw validation('Each payment must be a positive amount.')
    }
    paymentTotal = paymentTotal.plus(amount)
    resolvedPayments.push({
      paymentMethodId: method.id,
      ledgerAccountId: method.ledgerAccountId,
      amount: amount.toFixed(4),
    })
  }

  const lines = input.lines.map((line) => ({
    itemId: line.itemId,
    quantity: line.quantity,
    unitPrice: '',
    storeId: register.storeId,
  }))

  const priced = await salesService.quoteLines(ctx, lines)
  if (!paymentTotal.equals(priced.total)) {
    throw validation(
      `Payments (${toMoneyString(paymentTotal, 2)}) must equal the sale total (${toMoneyString(priced.total, 2)}).`,
    )
  }

  const receiptDate = today(ctx.organization.timeZone)
  const primaryDeposit = resolvedPayments[0]!.ledgerAccountId

  const document = await salesService.create(
    ctx,
    'SALES_RECEIPT',
    {
      number: undefined,
      customerId: register.defaultCustomerId,
      date: receiptDate,
      depositAccountId: primaryDeposit,
      lines,
      saveAsDraft: false,
      discountKind: 'percent',
    },
    {
      pos: {
        registerId: register.id,
        payments: resolvedPayments,
      },
    },
  )

  return {
    id: document.id,
    number: document.number,
    total: toMoneyString(priced.total, 2),
  }
}

/* --- Settings ------------------------------------------------------------- */

export async function settingsOverview(ctx: OrgContext) {
  const [methods, registers, assetAccounts] = await Promise.all([
    db.posPaymentMethod.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        isActive: true,
        sortOrder: true,
        account: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.posRegister.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        isActive: true,
        store: { select: { name: true } },
        defaultCustomer: { select: { displayName: true } },
        methods: { select: { paymentMethodId: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.ledgerAccount.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        type: { in: ['ASSET'] },
        subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'] },
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
  ])

  return {
    methods: methods.map((method) => ({
      id: method.id,
      name: method.name,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
      accountLabel: `${method.account.code} · ${method.account.name}`,
      accountId: method.account.id,
    })),
    registers: registers.map((register) => ({
      id: register.id,
      name: register.name,
      isActive: register.isActive,
      storeName: register.store?.name ?? null,
      customerName: register.defaultCustomer.displayName,
      paymentMethodIds: register.methods.map((row) => row.paymentMethodId),
    })),
    assetAccounts,
    customers: await db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 200,
    }),
    stores: await db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  }
}

export async function upsertPaymentMethod(ctx: OrgContext, input: PosPaymentMethodInput) {
  await assertAssetAccount(ctx.orgId, input.ledgerAccountId)

  if (input.id) {
    const existing = await db.posPaymentMethod.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Payment method')

    await db.posPaymentMethod.update({
      where: { id: input.id },
      data: {
        name: input.name,
        ledgerAccountId: input.ledgerAccountId,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    })
    return { id: input.id }
  }

  const created = await db.posPaymentMethod.create({
    data: {
      orgId: ctx.orgId,
      name: input.name,
      ledgerAccountId: input.ledgerAccountId,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
    select: { id: true },
  })
  return created
}

export async function upsertRegister(ctx: OrgContext, input: PosRegisterInput) {
  const customer = await db.customer.findFirst({
    where: { id: input.defaultCustomerId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')

  if (input.storeId) {
    const store = await db.store.findFirst({
      where: { id: input.storeId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!store) throw notFound('Store')
  }

  const methods = await db.posPaymentMethod.findMany({
    where: { orgId: ctx.orgId, id: { in: input.paymentMethodIds }, isActive: true },
    select: { id: true },
  })
  if (methods.length !== input.paymentMethodIds.length) {
    throw validation('Every payment method on a register must exist and be active.')
  }

  if (input.id) {
    const existing = await db.posRegister.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Register')

    await db.$transaction(async (tx) => {
      await tx.posRegister.update({
        where: { id: input.id },
        data: {
          name: input.name,
          storeId: input.storeId ?? null,
          defaultCustomerId: input.defaultCustomerId,
          isActive: input.isActive,
        },
      })
      await syncRegisterMethods(tx, input.id!, input.paymentMethodIds)
    })
    return { id: input.id }
  }

  const created = await db.$transaction(async (tx) => {
    const register = await tx.posRegister.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        storeId: input.storeId ?? null,
        defaultCustomerId: input.defaultCustomerId,
        isActive: input.isActive,
      },
      select: { id: true },
    })
    await syncRegisterMethods(tx, register.id, input.paymentMethodIds)
    return register
  })

  return created
}

async function syncRegisterMethods(tx: Tx, registerId: string, paymentMethodIds: string[]) {
  await tx.posRegisterMethod.deleteMany({ where: { registerId } })
  await tx.posRegisterMethod.createMany({
    data: paymentMethodIds.map((paymentMethodId) => ({ registerId, paymentMethodId })),
  })
}

async function assertAssetAccount(orgId: string, accountId: string) {
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, orgId, isActive: true },
    select: { type: true, subtype: true },
  })
  if (!account) throw notFound('Account')
  if (account.type !== 'ASSET') {
    throw validation('Payment methods must post to an asset account (bank, cash, or wallet).')
  }
}
