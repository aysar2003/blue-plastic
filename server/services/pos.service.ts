import 'server-only'

import { Decimal, formatMoney, toMoneyString, ZERO } from '@/lib/money'
import { formatDate, today, toCalendarDate } from '@/lib/date'
import type {
  PosCashMoveInput,
  PosCheckoutInput,
  PosCloseSessionInput,
  PosOpenSessionInput,
  PosPaymentMethodInput,
  PosRefundInput,
  PosRegisterInput,
} from '@/lib/validation/pos'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
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

/** Dashboard cards: each register with its open session (if any). */
export async function dashboardRegisters(ctx: OrgContext) {
  const registers = await db.posRegister.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      store: { select: { id: true, name: true } },
      sessions: {
        where: { status: 'OPEN' },
        select: {
          id: true,
          openedAt: true,
          openingCash: true,
        },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })

  const currency = ctx.organization.baseCurrency
  return registers.map((register) => {
    const session = register.sessions[0] ?? null
    return {
      id: register.id,
      name: register.name,
      storeName: register.store?.name ?? null,
      session: session
        ? {
            id: session.id,
            openedAt: session.openedAt,
            dateLabel: formatDate(toCalendarDate(session.openedAt)),
            openingCash: formatMoney(session.openingCash, currency),
            openingCashRaw: session.openingCash.toString(),
          }
        : null,
    }
  })
}

export async function openSession(ctx: OrgContext, input: PosOpenSessionInput) {
  const register = await db.posRegister.findFirst({
    where: { id: input.registerId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!register) throw notFound('Register')

  const opening = new Decimal(input.openingCash)
  if (opening.isNegative()) throw validation('Opening cash cannot be negative.')

  const existing = await db.posSession.findFirst({
    where: { registerId: register.id, status: 'OPEN' },
    select: { id: true },
  })
  if (existing) {
    throw precondition('This register already has an open session. Continue selling or close it first.')
  }

  return db.posSession.create({
    data: {
      orgId: ctx.orgId,
      registerId: register.id,
      openingCash: opening.toFixed(4),
      openedByUserId: ctx.userId,
      status: 'OPEN',
    },
    select: { id: true, registerId: true },
  })
}

export async function closeSession(ctx: OrgContext, input: PosCloseSessionInput) {
  const session = await db.posSession.findFirst({
    where: { id: input.sessionId, orgId: ctx.orgId, status: 'OPEN' },
    select: { id: true, registerId: true },
  })
  if (!session) throw notFound('Session')

  const closing = new Decimal(input.closingCash)
  if (closing.isNegative()) throw validation('Closing cash cannot be negative.')

  await db.posSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closingCash: closing.toFixed(4),
      closedByUserId: ctx.userId,
    },
  })

  return { id: session.id, registerId: session.registerId }
}

export async function openSessionForRegister(ctx: OrgContext, registerId: string) {
  return db.posSession.findFirst({
    where: { orgId: ctx.orgId, registerId, status: 'OPEN' },
    select: {
      id: true,
      openedAt: true,
      openingCash: true,
      register: { select: { id: true, name: true } },
    },
  })
}

export async function listSessions(ctx: OrgContext, limit = 50) {
  const currency = ctx.organization.baseCurrency
  const rows = await db.posSession.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      openedAt: true,
      closedAt: true,
      openingCash: true,
      closingCash: true,
      register: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: 'desc' },
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    registerId: row.register.id,
    registerName: row.register.name,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    dateLabel: formatDate(toCalendarDate(row.openedAt)),
    openingCash: formatMoney(row.openingCash, currency),
    closingCash: row.closingCash ? formatMoney(row.closingCash, currency) : null,
    orderCount: row._count.orders,
  }))
}

export async function listPosOrders(ctx: OrgContext, limit = 80) {
  const currency = ctx.organization.baseCurrency
  const rows = await db.posOrder.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      createdAt: true,
      register: { select: { name: true } },
      session: { select: { id: true } },
      salesDocument: {
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
        },
      },
      payments: {
        select: {
          amount: true,
          paymentMethod: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    dateLabel: formatDate(toCalendarDate(row.createdAt)),
    registerName: row.register.name,
    sessionId: row.session?.id ?? null,
    documentId: row.salesDocument.id,
    number: row.salesDocument.number,
    status: row.salesDocument.status,
    total: formatMoney(row.salesDocument.total, currency),
    payments: row.payments
      .map((payment) => `${payment.paymentMethod.name} ${formatMoney(payment.amount, currency)}`)
      .join(' · '),
  }))
}

function isCashMethodName(name: string) {
  return /\bcash\b/i.test(name.trim())
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
    paymentMethods: methods.map((method) => ({
      ...method,
      isCash: isCashMethodName(method.name),
    })),
  }
}

/**
 * Products for the till, with on-hand for the store this register sells from
 * (register store, else the office — where store-less movements are counted).
 * One grouped query for the whole catalogue, so the cart can warn when a sale
 * takes stock below zero without asking the database per line.
 */
export async function catalog(ctx: OrgContext, storeId: string | null) {
  const [items, stores] = await Promise.all([
    db.item.findMany({
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
        type: true,
        salesPrice: true,
        category: { select: { name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      take: 2000,
    }),
    db.store.findMany({
      where: { orgId: ctx.orgId, OR: [{ isOffice: true }, ...(storeId ? [{ id: storeId }] : [])] },
      select: { id: true, name: true, isOffice: true },
    }),
  ])

  const office = stores.find((store) => store.isOffice) ?? null
  const selling = (storeId ? stores.find((store) => store.id === storeId) : null) ?? office
  const storeFilter = !selling
    ? {}
    : selling.id === office?.id
      ? { OR: [{ storeId: selling.id }, { storeId: null }] }
      : { storeId: selling.id }

  const tracked = items.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const sums =
    tracked.length === 0
      ? []
      : await db.inventoryTransaction.groupBy({
          by: ['itemId'],
          where: { orgId: ctx.orgId, itemId: { in: tracked }, ...storeFilter },
          _sum: { quantity: true },
        })
  const onHand = new Map(sums.map((row) => [row.itemId, row._sum.quantity?.toString() ?? '0']))

  return {
    storeName: selling?.name ?? null,
    products: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category?.name ?? null,
      price: item.salesPrice?.toString() ?? '0',
      /** Null for services and non-stock items: no warning for those. */
      onHand: item.type === 'INVENTORY' ? (onHand.get(item.id) ?? '0') : null,
    })),
  }
}

export async function checkout(ctx: OrgContext, input: PosCheckoutInput) {
  const register = await registerForTerminal(ctx, input.registerId)

  const session = await db.posSession.findFirst({
    where: {
      id: input.sessionId,
      orgId: ctx.orgId,
      registerId: register.id,
      status: 'OPEN',
    },
    select: { id: true },
  })
  if (!session) {
    throw precondition('Open a POS session on this register before selling.')
  }

  let customerId = register.defaultCustomerId
  if (input.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!customer) throw notFound('Customer')
    customerId = customer.id
  }

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
      customerId,
      date: receiptDate,
      depositAccountId: primaryDeposit,
      lines,
      saveAsDraft: false,
      discountKind: 'percent',
      customerMessage: input.note ?? undefined,
    },
    {
      pos: {
        registerId: register.id,
        sessionId: session.id,
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

export async function recordCashMove(ctx: OrgContext, input: PosCashMoveInput) {
  const session = await db.posSession.findFirst({
    where: { id: input.sessionId, orgId: ctx.orgId, status: 'OPEN' },
    select: { id: true },
  })
  if (!session) throw precondition('Open a session before recording cash in/out.')

  const amount = new Decimal(input.amount)
  if (amount.isZero() || amount.isNegative()) {
    throw validation('Enter a positive cash amount.')
  }

  return db.posCashMovement.create({
    data: {
      orgId: ctx.orgId,
      sessionId: session.id,
      kind: input.kind,
      amount: amount.toFixed(4),
      reason: input.reason ?? null,
      createdByUserId: ctx.userId,
    },
    select: { id: true, kind: true, amount: true },
  })
}

/** Expected drawer cash for close-register variance. */
export async function sessionCashSummary(ctx: OrgContext, sessionId: string) {
  const session = await db.posSession.findFirst({
    where: { id: sessionId, orgId: ctx.orgId },
    select: {
      id: true,
      openingCash: true,
      cashMoves: { select: { kind: true, amount: true } },
      orders: {
        select: {
          salesDocument: { select: { type: true } },
          payments: {
            select: {
              amount: true,
              paymentMethod: { select: { name: true } },
            },
          },
        },
      },
    },
  })
  if (!session) throw notFound('Session')

  let cashIn = ZERO
  let cashOut = ZERO
  for (const move of session.cashMoves) {
    const amount = new Decimal(move.amount.toString())
    if (move.kind === 'IN') cashIn = cashIn.plus(amount)
    else cashOut = cashOut.plus(amount)
  }

  let cashSales = ZERO
  let cashRefunds = ZERO
  for (const order of session.orders) {
    for (const payment of order.payments) {
      if (!isCashMethodName(payment.paymentMethod.name)) continue
      const amount = new Decimal(payment.amount.toString())
      if (order.salesDocument.type === 'SALES_RECEIPT') cashSales = cashSales.plus(amount)
      else if (order.salesDocument.type === 'REFUND_RECEIPT') cashRefunds = cashRefunds.plus(amount)
    }
  }

  const opening = new Decimal(session.openingCash.toString())
  const expected = opening.plus(cashIn).minus(cashOut).plus(cashSales).minus(cashRefunds)
  const currency = ctx.organization.baseCurrency

  return {
    openingCash: toMoneyString(opening, 2),
    cashIn: toMoneyString(cashIn, 2),
    cashOut: toMoneyString(cashOut, 2),
    cashSales: toMoneyString(cashSales, 2),
    cashRefunds: toMoneyString(cashRefunds, 2),
    expectedCash: toMoneyString(expected, 2),
    expectedCashRaw: expected.toFixed(4),
    currency,
  }
}

/** Recent sales receipts on this session — for till refunds. */
export async function recentSessionOrders(ctx: OrgContext, sessionId: string, limit = 40) {
  const currency = ctx.organization.baseCurrency
  const rows = await db.posOrder.findMany({
    where: {
      orgId: ctx.orgId,
      sessionId,
      salesDocument: { type: 'SALES_RECEIPT' },
    },
    select: {
      id: true,
      createdAt: true,
      salesDocument: {
        select: {
          id: true,
          number: true,
          total: true,
          customer: { select: { displayName: true } },
          lines: {
            select: {
              itemId: true,
              quantity: true,
              unitPrice: true,
              storeId: true,
              description: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      },
      payments: {
        select: {
          amount: true,
          paymentMethod: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    documentId: row.salesDocument.id,
    number: row.salesDocument.number,
    total: formatMoney(row.salesDocument.total, currency),
    totalRaw: row.salesDocument.total.toString(),
    customerName: row.salesDocument.customer.displayName,
    dateLabel: formatDate(toCalendarDate(row.createdAt)),
    payments: row.payments
      .map((payment) => `${payment.paymentMethod.name} ${formatMoney(payment.amount, currency)}`)
      .join(' · '),
  }))
}

/** Full refund of a POS sales receipt, paid back through till methods. */
export async function refundOrder(ctx: OrgContext, input: PosRefundInput) {
  const register = await registerForTerminal(ctx, input.registerId)

  const session = await db.posSession.findFirst({
    where: {
      id: input.sessionId,
      orgId: ctx.orgId,
      registerId: register.id,
      status: 'OPEN',
    },
    select: { id: true },
  })
  if (!session) {
    throw precondition('Open a POS session on this register before refunding.')
  }

  const order = await db.posOrder.findFirst({
    where: {
      id: input.orderId,
      orgId: ctx.orgId,
      sessionId: session.id,
      registerId: register.id,
    },
    select: {
      id: true,
      salesDocument: {
        select: {
          id: true,
          number: true,
          type: true,
          customerId: true,
          total: true,
          lines: {
            select: {
              itemId: true,
              quantity: true,
              unitPrice: true,
              storeId: true,
              description: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      },
    },
  })
  if (!order) throw notFound('Order')
  if (order.salesDocument.type !== 'SALES_RECEIPT') {
    throw precondition('Only open POS sales receipts can be refunded from the till.')
  }
  const refundableLines = order.salesDocument.lines.filter((line) => line.itemId)
  if (refundableLines.length === 0) {
    throw validation('That receipt has no lines to refund.')
  }

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

  const docTotal = new Decimal(order.salesDocument.total.toString())
  if (!paymentTotal.equals(docTotal)) {
    throw validation(
      `Refund payments (${toMoneyString(paymentTotal, 2)}) must equal the receipt total (${toMoneyString(docTotal, 2)}).`,
    )
  }

  const lines = refundableLines.map((line) => ({
    itemId: line.itemId!,
    quantity: line.quantity.toString(),
    unitPrice: line.unitPrice.toString(),
    storeId: line.storeId ?? register.storeId,
    description: line.description ?? undefined,
  }))

  const receiptDate = today(ctx.organization.timeZone)
  const primaryDeposit = resolvedPayments[0]!.ledgerAccountId

  const document = await salesService.create(
    ctx,
    'REFUND_RECEIPT',
    {
      number: undefined,
      customerId: order.salesDocument.customerId,
      date: receiptDate,
      depositAccountId: primaryDeposit,
      lines,
      saveAsDraft: false,
      discountKind: 'percent',
      reference: order.salesDocument.number,
      memo: `POS refund of ${order.salesDocument.number}`,
    },
    {
      pos: {
        registerId: register.id,
        sessionId: session.id,
        payments: resolvedPayments,
      },
    },
  )

  return {
    id: document.id,
    number: document.number,
    total: toMoneyString(docTotal, 2),
  }
}

export async function walkInCustomers(ctx: OrgContext) {
  return db.customer.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
    take: 300,
  })
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
        storeId: true,
        defaultCustomerId: true,
        store: { select: { name: true } },
        defaultCustomer: { select: { id: true, displayName: true } },
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

  const customerList = await db.customer.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
    take: 200,
  })
  // The list is capped, so make sure every till's current walk-in customer is
  // selectable in its Edit form even when it falls outside the first 200.
  const customerById = new Map(customerList.map((customer) => [customer.id, customer]))
  for (const register of registers) {
    customerById.set(register.defaultCustomer.id, register.defaultCustomer)
  }
  const customers = [...customerById.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )

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
      storeId: register.storeId,
      storeName: register.store?.name ?? null,
      defaultCustomerId: register.defaultCustomerId,
      customerName: register.defaultCustomer.displayName,
      paymentMethodIds: register.methods.map((row) => row.paymentMethodId),
    })),
    assetAccounts,
    customers,
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
  const name = input.name.trim()
  const taken = await db.posRegister.findFirst({
    where: {
      orgId: ctx.orgId,
      name: { equals: name, mode: 'insensitive' },
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true },
  })
  if (taken) throw conflict(`A register called "${name}" already exists.`)

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
      select: { id: true, isActive: true, sessions: { where: { status: 'OPEN' }, select: { id: true }, take: 1 } },
    })
    if (!existing) throw notFound('Register')
    if (existing.isActive && !input.isActive && existing.sessions.length > 0) {
      throw precondition('This register has an open session. Close the session before switching the register off.')
    }

    await db.$transaction(async (tx) => {
      await tx.posRegister.update({
        where: { id: input.id },
        data: {
          name,
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
        name,
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

/**
 * Everything the thermal receipt prints, read in one go. Works for any sales
 * receipt; the till link (register, payments) is filled in when there is one.
 */
export async function receipt(ctx: OrgContext, documentId: string) {
  const document = await db.salesDocument.findFirst({
    where: { id: documentId, orgId: ctx.orgId, type: 'SALES_RECEIPT', deletedAt: null },
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      customerMessage: true,
      subtotal: true,
      discountAmount: true,
      taxTotal: true,
      total: true,
      currencyCode: true,
      createdById: true,
      createdAt: true,
      customer: { select: { displayName: true, phone: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discountPercent: true,
          amount: true,
          item: { select: { name: true } },
        },
      },
    },
  })
  if (!document) throw notFound('Receipt')

  const [order, cashier] = await Promise.all([
    db.posOrder.findFirst({
      where: { orgId: ctx.orgId, salesDocumentId: document.id },
      select: {
        register: { select: { name: true, defaultCustomerId: true } },
        payments: {
          select: { amount: true, paymentMethod: { select: { name: true } } },
          orderBy: { id: 'asc' },
        },
      },
    }),
    document.createdById
      ? db.user.findUnique({ where: { id: document.createdById }, select: { name: true, email: true } })
      : null,
  ])

  return {
    id: document.id,
    number: document.number,
    isVoid: document.status === 'VOID',
    currency: document.currencyCode || ctx.organization.baseCurrency,
    createdAt: document.createdAt,
    note: document.customerMessage,
    subtotal: document.subtotal.toString(),
    discount: document.discountAmount.toString(),
    tax: document.taxTotal.toString(),
    total: document.total.toString(),
    registerName: order?.register.name ?? null,
    cashierName: cashier ? (cashier.name ?? cashier.email) : null,
    // The register's walk-in customer is not worth printing; a named one is.
    customer:
      order && order.register.defaultCustomerId === document.customerId
        ? null
        : { name: document.customer.displayName, phone: document.customer.phone },
    lines: document.lines.map((line) => ({
      id: line.id,
      name: line.description || line.item?.name || '',
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent ? line.discountPercent.toString() : null,
      amount: line.amount.toString(),
    })),
    payments: (order?.payments ?? []).map((payment) => ({
      method: payment.paymentMethod.name,
      amount: payment.amount.toString(),
      isCash: isCashMethodName(payment.paymentMethod.name),
    })),
  }
}
