import 'server-only'

import { Decimal, formatMoney, toMoneyString, ZERO } from '@/lib/money'
import { formatDateTime, formatTransactionDate, today, toCalendarDate, toDate } from '@/lib/date'
import {
  accountTenderTotals,
  drawerCashMovement,
  resolvePosTender,
  type PosSaleTender,
} from '@/lib/pos-change'
import { isCashMethodName } from '@/lib/pos-payment'
import {
  posOrderListLimit,
  summarizePosWallets,
  type PosOrderListFilters,
  type PosOrderSummaryPayment,
} from '@/lib/pos-order-report'
import { POS_BANKS_DETAIL, POS_REGISTER_DETAIL } from '@/lib/pos-register-account'
import { chooseLineStore } from '@/lib/pos-line-store'
import { CASHIER_PIN_REQUIRED, CASHIER_PIN_WRONG } from '@/lib/pos-pin'
import { receiptCashierName } from '@/lib/pos-receipt'
import { foldStoreQuantities } from '@/lib/store-stock'
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
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { db, type Tx } from '@/server/db'
import { registerUnlockMatches } from '@/server/pos/cashier-unlock'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { ensurePosRegisterAccounts } from '@/server/services/pos-register-account'
import * as salesDelivery from '@/server/services/sales-delivery.service'
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
      pinHash: true,
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
      hasPin: Boolean(register.pinHash),
      session: session
        ? {
            id: session.id,
            openedAt: session.openedAt,
            dateLabel: formatDateTime(session.openedAt, ctx.organization.timeZone),
            openingCash: formatMoney(session.openingCash, currency),
            openingCashRaw: session.openingCash.toString(),
          }
        : null,
    }
  })
}

/**
 * Checks the PIN the cashier just typed. Registers with no PIN stay open
 * (`required: false`) so existing tills are not locked out.
 */
export async function assertCashierPin(
  ctx: OrgContext,
  registerId: string,
  pin: string | undefined,
): Promise<{ required: boolean }> {
  const register = await db.posRegister.findFirst({
    where: { id: registerId, orgId: ctx.orgId, isActive: true },
    select: { pinHash: true },
  })
  if (!register) throw notFound('Register')
  if (!register.pinHash) return { required: false }
  if (!pin || !(await verifyPassword(pin, register.pinHash))) {
    throw validation(CASHIER_PIN_WRONG)
  }
  return { required: true }
}

/** Blocks a sale or refund until this browser has entered this register's PIN. */
export async function requireCashierUnlock(ctx: OrgContext, registerId: string) {
  const register = await db.posRegister.findFirst({
    where: { id: registerId, orgId: ctx.orgId, isActive: true },
    select: { pinHash: true },
  })
  if (!register) throw notFound('Register')
  if (!register.pinHash) return
  if (await registerUnlockMatches(ctx.orgId, registerId)) return
  throw validation(CASHIER_PIN_REQUIRED)
}

/** Name and whether a PIN is set. The hash never leaves the server. */
export async function registerPinState(ctx: OrgContext, registerId: string) {
  const register = await db.posRegister.findFirst({
    where: { id: registerId, orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, pinHash: true },
  })
  if (!register) throw notFound('Register')
  return { id: register.id, name: register.name, hasPin: Boolean(register.pinHash) }
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
      orders: {
        select: {
          salesDocument: { select: { type: true } },
          changeAmount: true,
          changePaymentMethodId: true,
          changeLedgerAccountId: true,
          changePaymentMethod: { select: { name: true } },
          payments: {
            select: {
              amount: true,
              ledgerAccountId: true,
              paymentMethod: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { openedAt: 'desc' },
    take: limit,
  })

  return rows.map((row) => {
    const totals = accountTenderTotals(
      row.orders.map((order) => tenderFromOrder(order, order.salesDocument.type === 'REFUND_RECEIPT')),
    )
    const changeLabel =
      totals
        .filter((total) => Number(total.change) > 0)
        .map((total) => `${total.methodName} ${formatMoney(total.change, currency)}`)
        .join(' · ') || null
    return {
      id: row.id,
      status: row.status,
      registerId: row.register.id,
      registerName: row.register.name,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      dateLabel: formatDateTime(row.openedAt, ctx.organization.timeZone),
      openingCash: formatMoney(row.openingCash, currency),
      closingCash: row.closingCash ? formatMoney(row.closingCash, currency) : null,
      orderCount: row._count.orders,
      changeLabel,
      netByAccount: totals.map((total) => ({
        name: total.methodName,
        net: formatMoney(total.net, currency),
      })),
    }
  })
}

function tenderFromOrder(
  order: {
    payments: { amount: { toString(): string }; ledgerAccountId: string; paymentMethod: { id: string; name: string } }[]
    changeAmount: { toString(): string }
    changePaymentMethodId: string | null
    changeLedgerAccountId: string | null
    changePaymentMethod: { name: string } | null
  },
  refund = false,
): PosSaleTender {
  const sign = refund ? -1 : 1
  return {
    payments: order.payments.map((payment) => ({
      methodId: payment.paymentMethod.id,
      methodName: payment.paymentMethod.name,
      accountId: payment.ledgerAccountId,
      amount: new Decimal(payment.amount.toString()).times(sign).toFixed(4),
    })),
    changeAmount: refund ? '0' : order.changeAmount.toString(),
    changeMethodId: refund ? null : order.changePaymentMethodId,
    changeMethodName: refund ? null : (order.changePaymentMethod?.name ?? null),
    changeAccountId: refund ? null : order.changeLedgerAccountId,
  }
}

export async function listPosOrders(ctx: OrgContext, filters: PosOrderListFilters = {}) {
  const currency = ctx.organization.baseCurrency
  const limit = posOrderListLimit(filters)
  const date =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: toDate(filters.from) } : {}),
          ...(filters.to ? { lte: toDate(filters.to) } : {}),
        }
      : undefined

  const [rows, registers, methods] = await Promise.all([
    db.posOrder.findMany({
      where: {
        orgId: ctx.orgId,
        ...(filters.registerId ? { registerId: filters.registerId } : {}),
        ...(filters.paymentMethodId
          ? {
              OR: [
                { payments: { some: { paymentMethodId: filters.paymentMethodId } } },
                { changePaymentMethodId: filters.paymentMethodId },
              ],
            }
          : {}),
        salesDocument: {
          deletedAt: null,
          ...(date ? { date } : {}),
        },
      },
      select: {
        id: true,
        createdAt: true,
        changeAmount: true,
        changePaymentMethodId: true,
        changeLedgerAccountId: true,
        changePaymentMethod: { select: { name: true } },
        register: { select: { name: true } },
        session: { select: { id: true } },
        salesDocument: {
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            type: true,
            date: true,
          },
        },
        payments: {
          select: {
            amount: true,
            ledgerAccountId: true,
            paymentMethod: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    }),
    db.posRegister.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    db.posPaymentMethod.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, name: true, isActive: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const truncated = rows.length > limit
  const visible = truncated ? rows.slice(0, limit) : rows
  const tenders = visible.map((row) => tenderFromOrder(row, row.salesDocument.type === 'REFUND_RECEIPT'))
  const summary = summarizePosWallets(
    visible.map((row, index) => ({ payments: netWalletPayments(row, tenders[index]!) })),
    methods,
  )
  const totals = accountTenderTotals(tenders).map((total) => ({
    name: total.methodName,
    tendered: formatMoney(total.tendered, currency),
    change: formatMoney(total.change, currency),
    net: formatMoney(total.net, currency),
  }))

  return {
    truncated,
    limit,
    registers,
    methods: methods.map((method) => ({
      id: method.id,
      name: method.name,
      isActive: method.isActive,
    })),
    summary: {
      orderCount: summary.orderCount,
      total: formatMoney(summary.total, currency),
      wallets: summary.wallets.map((wallet) => ({
        methodId: wallet.methodId,
        name: wallet.name,
        total: formatMoney(wallet.amount, currency),
      })),
    },
    totals,
    orders: visible.map((row, index) => {
      const refund = row.salesDocument.type === 'REFUND_RECEIPT'
      const signedTotal = refund
        ? new Decimal(row.salesDocument.total.toString()).negated()
        : row.salesDocument.total
      const tender = tenders[index]!
      const change = new Decimal(tender.changeAmount)
      return {
        id: row.id,
        createdAt: row.createdAt,
        dateLabel: formatTransactionDate(
          toCalendarDate(row.salesDocument.date),
          row.createdAt,
          ctx.organization.timeZone,
        ),
        registerName: row.register.name,
        sessionId: row.session?.id ?? null,
        documentId: row.salesDocument.id,
        number: row.salesDocument.number,
        status: row.salesDocument.status,
        total: formatMoney(signedTotal, currency),
        payments: row.payments
          .map((payment) => {
            const amount = refund ? new Decimal(payment.amount.toString()).negated() : payment.amount
            return `${payment.paymentMethod.name} ${formatMoney(amount, currency)}`
          })
          .join(' · '),
        changeLabel:
          tender.changeMethodName && change.gt(0)
            ? `${tender.changeMethodName} ${formatMoney(change, currency)}`
            : null,
      }
    }),
  }
}

function netWalletPayments(
  row: {
    payments: { ledgerAccountId: string; paymentMethod: { id: string; name: string; sortOrder: number } }[]
    changePaymentMethodId: string | null
    changeLedgerAccountId: string | null
    changePaymentMethod: { name: string } | null
  },
  tender: PosSaleTender,
): PosOrderSummaryPayment[] {
  return accountTenderTotals([tender]).flatMap((total) => {
    const net = new Decimal(total.net)
    if (net.isZero()) return []
    const payment = row.payments.find(
      (item) => item.paymentMethod.name === total.methodName || item.ledgerAccountId === total.accountId,
    )
    const methodId =
      payment?.paymentMethod.id ??
      (row.changePaymentMethod?.name === total.methodName ? row.changePaymentMethodId : null) ??
      total.accountId
    return [
      {
        methodId: methodId || total.methodName,
        methodName: total.methodName,
        sortOrder: payment?.paymentMethod.sortOrder ?? 0,
        amount: net.abs().toFixed(4),
        refund: net.isNegative(),
      },
    ]
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
      defaultChangeMethodId: true,
      allowWalletChangeReturn: true,
      methods: {
        select: {
          allowsChangeReturn: true,
          paymentMethod: {
            select: {
              id: true,
              name: true,
              ledgerAccountId: true,
              sortOrder: true,
              allowsChangeReturn: true,
            },
          },
        },
      },
    },
  })
  if (!register) throw notFound('Register')

  const methods = register.methods
    .map((row) => ({ ...row.paymentMethod, linkAllowsChange: row.allowsChangeReturn }))
    .filter((method) => method.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  if (methods.length === 0) {
    throw precondition('This register has no payment methods. Add them under POS settings.')
  }

  return {
    id: register.id,
    name: register.name,
    storeId: register.storeId,
    defaultCustomerId: register.defaultCustomerId,
    defaultChangeMethodId: register.defaultChangeMethodId,
    allowWalletChangeReturn: register.allowWalletChangeReturn,
    paymentMethods: methods.map((method) => ({
      id: method.id,
      name: method.name,
      ledgerAccountId: method.ledgerAccountId,
      sortOrder: method.sortOrder,
      isCash: isCashMethodName(method.name),
      allowsChangeReturn: method.allowsChangeReturn && method.linkAllowsChange,
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
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true, isOffice: true },
      orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
    }),
  ])

  const office = stores.find((store) => store.isOffice) ?? null
  const selling = (storeId ? stores.find((store) => store.id === storeId) : null) ?? office

  // On hand per store for every tracked product (store-less movements count at
  // the office), so a cart line can show — and take from — another store.
  const tracked = items.filter((item) => item.type === 'INVENTORY').map((item) => item.id)
  const groups =
    tracked.length === 0
      ? []
      : await db.inventoryTransaction.groupBy({
          by: ['itemId', 'storeId'],
          where: { orgId: ctx.orgId, itemId: { in: tracked } },
          _sum: { quantity: true },
        })
  const byItem = foldStoreQuantities(
    groups.map((row) => ({
      itemId: row.itemId,
      storeId: row.storeId,
      quantity: row._sum.quantity?.toString() ?? '0',
    })),
    office?.id ?? '',
  )

  return {
    storeName: selling?.name ?? null,
    storeId: selling?.id ?? null,
    stores: stores.map((store) => ({ id: store.id, name: store.name })),
    products: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category?.name ?? null,
      price: item.salesPrice?.toString() ?? '0',
      /** Null for services and non-stock items: no warning for those. */
      onHand:
        item.type === 'INVENTORY'
          ? (selling ? (byItem[item.id]?.[selling.id] ?? '0') : '0')
          : null,
      /** store id → on hand; null for services and non-stock items. */
      stock: item.type === 'INVENTORY' ? (byItem[item.id] ?? {}) : null,
    })),
  }
}

/**
 * Decides each cart line's store (see chooseLineStore): the cashier's pick,
 * else the counter's store, else another store that holds enough.
 */
async function lineStoreResolver(
  ctx: OrgContext,
  registerStoreId: string | null,
  cartLines: { itemId: string; quantity: string; storeId?: string }[],
) {
  const itemIds = [...new Set(cartLines.map((line) => line.itemId))]
  const [counter, stores, items] = await Promise.all([
    salesDelivery.posCounterStoreId(db, ctx.orgId, registerStoreId),
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, isOffice: true },
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, id: { in: itemIds } },
      select: { id: true, type: true },
    }),
  ])
  for (const line of cartLines) {
    if (line.storeId && !stores.some((store) => store.id === line.storeId)) {
      throw notFound('Store')
    }
  }
  const tracked = new Set(items.filter((item) => item.type === 'INVENTORY').map((item) => item.id))
  const trackedIds = itemIds.filter((id) => tracked.has(id))
  const officeId = stores.find((store) => store.isOffice)?.id ?? ''
  const groups =
    trackedIds.length === 0
      ? []
      : await db.inventoryTransaction.groupBy({
          by: ['itemId', 'storeId'],
          where: { orgId: ctx.orgId, itemId: { in: trackedIds } },
          _sum: { quantity: true },
        })
  const byItem = foldStoreQuantities(
    groups.map((row) => ({
      itemId: row.itemId,
      storeId: row.storeId,
      quantity: row._sum.quantity?.toString() ?? '0',
    })),
    officeId,
  )
  const activeStoreIds = stores.map((store) => store.id)

  return (line: { itemId: string; quantity: string; storeId?: string }) =>
    chooseLineStore({
      requested: line.storeId ?? null,
      counterStoreId: counter,
      tracked: tracked.has(line.itemId),
      quantity: Number(line.quantity),
      onHandByStore: byItem[line.itemId] ?? {},
      activeStoreIds,
    })
}

export async function checkout(ctx: OrgContext, input: PosCheckoutInput) {
  await requireCashierUnlock(ctx, input.registerId)
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

  const storeOf = await lineStoreResolver(ctx, register.storeId, input.lines)
  const lines = input.lines.map((line) => ({
    itemId: line.itemId,
    quantity: line.quantity,
    unitPrice: '',
    // Always explicit, so the stock movement and the item history show the
    // store (the office when the register says "Office default").
    storeId: storeOf(line),
  }))

  const priced = await salesService.quoteLines(ctx, lines)
  const resolved = resolvePosTender({
    due: priced.total.toString(),
    methods: register.paymentMethods.map((method) => ({
      id: method.id,
      name: method.name,
      isCash: method.isCash,
      allowsChangeReturn: method.allowsChangeReturn,
    })),
    payments: input.payments,
    changeMethodId: input.changeMethodId,
    allowWalletChangeReturn: register.allowWalletChangeReturn,
  })
  if (!resolved.ok) throw validation(resolved.message)

  const resolvedPayments: salesService.PosCheckoutMeta['payments'] = resolved.tender.tenders.map((tender) => {
    const method = methodById.get(tender.paymentMethodId)
    if (!method) throw validation('One of the payment methods is not allowed on this register.')
    return {
      paymentMethodId: method.id,
      ledgerAccountId: method.ledgerAccountId,
      amount: new Decimal(tender.amount).toFixed(4),
    }
  })
  const changeMethod = resolved.tender.changeMethodId
    ? methodById.get(resolved.tender.changeMethodId)
    : null
  if (resolved.tender.changeMethodId && !changeMethod) {
    throw validation('Change cannot be returned from that account.')
  }
  const change = changeMethod
    ? {
        paymentMethodId: changeMethod.id,
        ledgerAccountId: changeMethod.ledgerAccountId,
        amount: new Decimal(resolved.tender.change).toFixed(4),
      }
    : null

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
        change,
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
          changeAmount: true,
          changePaymentMethod: { select: { name: true } },
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
    const kind = order.salesDocument.type === 'REFUND_RECEIPT' ? 'REFUND' : 'SALE'
    if (kind === 'SALE' && order.salesDocument.type !== 'SALES_RECEIPT') continue
    const movement = drawerCashMovement({
      kind,
      payments: order.payments.map((payment) => ({
        isCash: isCashMethodName(payment.paymentMethod.name),
        amount: payment.amount.toString(),
      })),
      changeAmount: order.changeAmount.toString(),
      changeIsCash: order.changePaymentMethod
        ? isCashMethodName(order.changePaymentMethod.name)
        : false,
    })
    cashSales = cashSales.plus(movement.sales)
    cashRefunds = cashRefunds.plus(movement.refunds)
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

/**
 * How often each method was used on sales at this register.
 *
 * One grouped count, loaded with the till — opening Payment does not query.
 * Refunds and voided or draft receipts are left out; a split sale counts once
 * for each method that took money.
 */
export async function paymentMethodUseCounts(ctx: OrgContext, registerId: string) {
  const rows = await db.posOrderPayment.groupBy({
    by: ['paymentMethodId'],
    where: {
      order: {
        orgId: ctx.orgId,
        registerId,
        salesDocument: {
          type: 'SALES_RECEIPT',
          deletedAt: null,
          status: { notIn: ['VOID', 'DRAFT'] },
        },
      },
    },
    _count: { _all: true },
  })
  return rows.map((row) => ({ methodId: row.paymentMethodId, count: row._count._all }))
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
    dateLabel: formatDateTime(row.createdAt, ctx.organization.timeZone),
    payments: row.payments
      .map((payment) => `${payment.paymentMethod.name} ${formatMoney(payment.amount, currency)}`)
      .join(' · '),
  }))
}

/** Full refund of a POS sales receipt, paid back through till methods. */
export async function refundOrder(ctx: OrgContext, input: PosRefundInput) {
  await requireCashierUnlock(ctx, input.registerId)
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
        change: null,
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
  await db.$transaction(async (tx) => {
    await ensurePosRegisterAccounts(tx, ctx.orgId)
  })

  const [methods, registers, assetAccounts] = await Promise.all([
    db.posPaymentMethod.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        isActive: true,
        sortOrder: true,
        allowsChangeReturn: true,
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
        pinHash: true,
        storeId: true,
        defaultCustomerId: true,
        defaultChangeMethodId: true,
        allowWalletChangeReturn: true,
        store: { select: { name: true } },
        defaultCustomer: { select: { id: true, displayName: true } },
        methods: { select: { paymentMethodId: true, allowsChangeReturn: true } },
        account: { select: { code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.ledgerAccount.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        type: { in: ['ASSET'] },
        subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'] },
        // Wallet setup posts the sale. Register bank accounts stay out of that
        // list so a till's account is not used as a payment method.
        NOT: {
          OR: [
            { detailType: { in: [POS_BANKS_DETAIL, POS_REGISTER_DETAIL] } },
            { children: { some: {} } },
          ],
        },
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
      allowsChangeReturn: method.allowsChangeReturn,
      accountLabel: `${method.account.code} · ${method.account.name}`,
      accountId: method.account.id,
    })),
    registers: registers.map((register) => ({
      id: register.id,
      name: register.name,
      isActive: register.isActive,
      hasPin: Boolean(register.pinHash),
      storeId: register.storeId,
      storeName: register.store?.name ?? null,
      defaultCustomerId: register.defaultCustomerId,
      customerName: register.defaultCustomer.displayName,
      paymentMethodIds: register.methods.map((row) => row.paymentMethodId),
      accountLabel: register.account ? `${register.account.code} · ${register.account.name}` : null,
      changeMethodIds: register.methods.filter((row) => row.allowsChangeReturn).map((row) => row.paymentMethodId),
      defaultChangeMethodId: register.defaultChangeMethodId,
      allowWalletChangeReturn: register.allowWalletChangeReturn,
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
        allowsChangeReturn: input.allowsChangeReturn,
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
      allowsChangeReturn: input.allowsChangeReturn,
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
    select: { id: true, name: true, allowsChangeReturn: true },
  })
  if (methods.length !== input.paymentMethodIds.length) {
    throw validation('Every payment method on a register must exist and be active.')
  }

  // A blank PIN leaves the stored hash alone. A new PIN replaces it.
  const pinHash = input.pin ? await hashPassword(input.pin) : null
  const changeMethodIds = input.changeMethodIds ?? input.paymentMethodIds
  if (changeMethodIds.some((id) => !input.paymentMethodIds.includes(id))) {
    throw validation('Change can only be returned from a payment method on this till.')
  }
  const defaultChangeMethodId = input.defaultChangeMethodId ?? null
  if (defaultChangeMethodId) {
    const method = methods.find((row) => row.id === defaultChangeMethodId)
    if (!method || !changeMethodIds.includes(defaultChangeMethodId) || !method.allowsChangeReturn) {
      throw validation('The default change account has to be allowed for change on this till.')
    }
    if (!input.allowWalletChangeReturn && !isCashMethodName(method.name)) {
      throw validation('Pick a cash account as the default while change from wallets is off.')
    }
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
          ...(pinHash ? { pinHash } : {}),
          defaultChangeMethodId,
          allowWalletChangeReturn: input.allowWalletChangeReturn,
        },
      })
      await syncRegisterMethods(tx, input.id!, input.paymentMethodIds, changeMethodIds)
      await ensurePosRegisterAccounts(tx, ctx.orgId)
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
        pinHash,
        defaultChangeMethodId,
        allowWalletChangeReturn: input.allowWalletChangeReturn,
      },
      select: { id: true },
    })
    await syncRegisterMethods(tx, register.id, input.paymentMethodIds, changeMethodIds)
    await ensurePosRegisterAccounts(tx, ctx.orgId)
    return register
  })

  return created
}

async function syncRegisterMethods(
  tx: Tx,
  registerId: string,
  paymentMethodIds: string[],
  changeMethodIds: string[],
) {
  const change = new Set(changeMethodIds)
  await tx.posRegisterMethod.deleteMany({ where: { registerId } })
  await tx.posRegisterMethod.createMany({
    data: paymentMethodIds.map((paymentMethodId) => ({
      registerId,
      paymentMethodId,
      allowsChangeReturn: change.has(paymentMethodId),
    })),
  })
}

async function assertAssetAccount(orgId: string, accountId: string) {
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, orgId, isActive: true },
    select: {
      type: true,
      detailType: true,
      _count: { select: { children: true } },
    },
  })
  if (!account) throw notFound('Account')
  if (account.type !== 'ASSET') {
    throw validation('Payment methods must post to an asset account (bank, cash, or wallet).')
  }
  if (account._count.children > 0 || account.detailType === POS_BANKS_DETAIL) {
    throw validation('That account is a grouping heading. Choose an account you can post to.')
  }
  if (account.detailType === POS_REGISTER_DETAIL) {
    throw validation(
      'A register bank account sits under POS Banks. Payment methods keep their own wallet accounts.',
    )
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
        changeAmount: true,
        changePaymentMethod: { select: { name: true } },
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
    cashierName: receiptCashierName(order?.register.name ?? null, cashier),
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
    change: order?.changeAmount.toString() ?? '0',
    changeFrom: order?.changePaymentMethod?.name ?? null,
    /** Gross tenders were stored once change started being recorded on the order. */
    tendered: order ? new Decimal(order.changeAmount.toString()).gt(0) : false,
  }
}
