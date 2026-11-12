import 'server-only'

import { Decimal } from '@/lib/money'
import {
  canCheckOutStay,
  folioLineAmount,
  occupancyPercent,
  roomStatusAfterCheckIn,
  roomStatusAfterCheckOut,
} from '@/lib/erp/hotel'
import { today } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

export async function listRoomTypes(ctx: OrgContext) {
  return db.roomType.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: { baseRateItem: { select: { id: true, name: true, salesPrice: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function upsertRoomType(
  ctx: OrgContext,
  input: { id?: string; name: string; baseRateItemId?: string | null; capacity?: number },
) {
  const name = input.name.trim()
  if (!name) throw validation('Room type name is required.')
  if (input.id) {
    return db.roomType.update({
      where: { id: input.id },
      data: {
        name,
        baseRateItemId: input.baseRateItemId || null,
        capacity: input.capacity ?? 2,
      },
    })
  }
  return db.roomType.create({
    data: {
      orgId: ctx.orgId,
      name,
      baseRateItemId: input.baseRateItemId || null,
      capacity: input.capacity ?? 2,
    },
  })
}

export async function listRooms(ctx: OrgContext) {
  return db.room.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: { roomType: { select: { id: true, name: true } } },
    orderBy: { code: 'asc' },
  })
}

export async function upsertRoom(
  ctx: OrgContext,
  input: { id?: string; roomTypeId: string; code: string; floor?: string | null },
) {
  const code = input.code.trim()
  if (!code) throw validation('Room code is required.')
  const type = await db.roomType.findFirst({
    where: { id: input.roomTypeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!type) throw notFound('Room type')

  if (input.id) {
    return db.room.update({
      where: { id: input.id },
      data: { roomTypeId: type.id, code, floor: input.floor?.trim() || null },
    })
  }
  try {
    return await db.room.create({
      data: {
        orgId: ctx.orgId,
        roomTypeId: type.id,
        code,
        floor: input.floor?.trim() || null,
      },
    })
  } catch {
    throw conflict('Another room already uses that code.')
  }
}

export async function setHousekeeping(
  ctx: OrgContext,
  roomId: string,
  status: 'VACANT' | 'DIRTY' | 'CLEAN' | 'OOO',
) {
  const room = await db.room.findFirst({
    where: { id: roomId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!room) throw notFound('Room')
  if (room.status === 'OCCUPIED' && status !== 'OOO') {
    throw validation('Check the guest out before changing housekeeping on an occupied room.')
  }
  return db.room.update({ where: { id: room.id }, data: { status } })
}

export async function occupancy(ctx: OrgContext) {
  const rooms = await db.room.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { status: true },
  })
  return {
    rooms: rooms.length,
    percent: occupancyPercent(rooms),
    occupied: rooms.filter((r) => r.status === 'OCCUPIED').length,
  }
}

export async function checkIn(
  ctx: OrgContext,
  input: { roomId: string; customerId: string; adults?: number; notes?: string },
) {
  const room = await db.room.findFirst({
    where: { id: input.roomId, orgId: ctx.orgId, isActive: true },
    include: {
      roomType: { select: { baseRateItemId: true, name: true } },
    },
  })
  if (!room) throw notFound('Room')
  if (room.status === 'OCCUPIED') throw precondition('That room is already occupied.')
  if (room.status === 'OOO') throw precondition('That room is out of order.')

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')

  return db.$transaction(async (tx) => {
    const stay = await tx.stay.create({
      data: {
        orgId: ctx.orgId,
        roomId: room.id,
        customerId: customer.id,
        status: 'CHECKED_IN',
        checkInAt: new Date(),
        adults: input.adults ?? 1,
        notes: input.notes?.trim() || null,
      },
    })
    const folio = await tx.folio.create({
      data: { orgId: ctx.orgId, stayId: stay.id, status: 'OPEN' },
    })
    await tx.room.update({
      where: { id: room.id },
      data: { status: roomStatusAfterCheckIn() },
    })

    if (room.roomType.baseRateItemId) {
      const item = await tx.item.findFirst({
        where: { id: room.roomType.baseRateItemId, orgId: ctx.orgId },
        select: { id: true, name: true, salesPrice: true },
      })
      if (item) {
        const unitPrice = item.salesPrice?.toString() ?? '0'
        const amount = folioLineAmount(1, unitPrice)
        const nightOf = today(ctx.organization.timeZone)
        await tx.folioLine.create({
          data: {
            folioId: folio.id,
            itemId: item.id,
            description: `${room.roomType.name} · ${item.name} · ${nightOf}`,
            quantity: '1',
            unitPrice,
            amount,
            serviceDate: new Date(`${nightOf}T00:00:00.000Z`),
          },
        })
      }
    }

    return { stayId: stay.id, folioId: folio.id }
  })
}

export async function addFolioCharge(
  ctx: OrgContext,
  input: {
    folioId: string
    itemId?: string
    description: string
    quantity: string
    unitPrice: string
  },
) {
  const folio = await db.folio.findFirst({
    where: { id: input.folioId, orgId: ctx.orgId, status: 'OPEN' },
    select: { id: true },
  })
  if (!folio) throw notFound('Open folio')

  const amount = folioLineAmount(input.quantity, input.unitPrice)
  return db.folioLine.create({
    data: {
      folioId: folio.id,
      itemId: input.itemId || null,
      description: input.description.trim(),
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount,
    },
  })
}

export async function checkOut(ctx: OrgContext, stayId: string) {
  const stay = await db.stay.findFirst({
    where: { id: stayId, orgId: ctx.orgId },
    include: {
      folio: { include: { lines: true } },
      room: { select: { id: true } },
      customer: { select: { id: true } },
    },
  })
  if (!stay) throw notFound('Stay')
  if (!canCheckOutStay(stay.status)) {
    throw precondition('Only a checked-in stay can be checked out.')
  }
  if (!stay.folio || stay.folio.status !== 'OPEN') {
    throw precondition('Stay has no open folio.')
  }
  if (stay.folio.lines.length === 0) {
    throw validation('Add at least one folio charge before checkout.')
  }

  const lines = stay.folio.lines.map((line) => {
    if (!line.itemId) {
      throw validation(`Folio line “${line.description}” needs an item for invoicing.`)
    }
    return {
      itemId: line.itemId,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      description: line.description,
    }
  })

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: stay.customerId,
    date: today(ctx.organization.timeZone),
    lines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: `Hotel stay ${stay.id}`,
  })

  const claimed = await db.stay.updateMany({
    where: { id: stay.id, status: 'CHECKED_IN' },
    data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
  })
  if (claimed.count === 0) {
    await salesService.remove(ctx, invoice.id, 'Stay already checked out by another request')
    throw conflict('This stay was already checked out.')
  }

  await db.$transaction(async (tx) => {
    await tx.folio.update({
      where: { id: stay.folio!.id },
      data: {
        status: 'CLOSED',
        salesDocumentId: invoice.id,
        lines: {
          updateMany: {
            where: { folioId: stay.folio!.id },
            data: { postedAt: new Date() },
          },
        },
      },
    })
    await tx.room.update({
      where: { id: stay.room.id },
      data: { status: roomStatusAfterCheckOut() },
    })
  })

  return { invoiceId: invoice.id, invoiceNumber: invoice.number }
}

export async function listOpenStays(ctx: OrgContext) {
  return db.stay.findMany({
    where: { orgId: ctx.orgId, status: 'CHECKED_IN' },
    include: {
      room: { select: { code: true, floor: true } },
      customer: { select: { displayName: true } },
      folio: {
        include: {
          lines: { select: { amount: true } },
        },
      },
    },
    orderBy: { checkInAt: 'desc' },
  })
}

/**
 * Post the room rate for a calendar night onto every open stay that does not
 * already have a folio line for that serviceDate (idempotent).
 */
export async function postNightlyRoomCharges(
  ctx: OrgContext,
  nightOf?: string,
): Promise<{ posted: number; skipped: number; nightOf: string }> {
  const night = nightOf?.trim() || today(ctx.organization.timeZone)
  const serviceDate = new Date(`${night}T00:00:00.000Z`)
  if (Number.isNaN(serviceDate.getTime())) throw validation('Invalid night date.')

  const stays = await db.stay.findMany({
    where: { orgId: ctx.orgId, status: 'CHECKED_IN' },
    include: {
      folio: {
        include: {
          lines: { where: { serviceDate }, select: { id: true }, take: 1 },
        },
      },
      room: {
        include: {
          roomType: {
            include: {
              baseRateItem: { select: { id: true, name: true, salesPrice: true } },
            },
          },
        },
      },
    },
  })

  let posted = 0
  let skipped = 0

  for (const stay of stays) {
    if (!stay.folio || stay.folio.status !== 'OPEN') {
      skipped += 1
      continue
    }
    if (stay.folio.lines.length > 0) {
      skipped += 1
      continue
    }
    const item = stay.room.roomType.baseRateItem
    if (!item) {
      skipped += 1
      continue
    }
    const unitPrice = item.salesPrice?.toString() ?? '0'
    const amount = folioLineAmount(1, unitPrice)
    await db.folioLine.create({
      data: {
        folioId: stay.folio.id,
        itemId: item.id,
        description: `${stay.room.roomType.name} · ${item.name} · ${night}`,
        quantity: '1',
        unitPrice,
        amount,
        serviceDate,
      },
    })
    posted += 1
  }

  return { posted, skipped, nightOf: night }
}

export function folioBalance(lines: { amount: Decimal | string }[]): string {
  return lines
    .reduce((sum, line) => sum.plus(new Decimal(line.amount.toString())), new Decimal(0))
    .toFixed(2)
}
