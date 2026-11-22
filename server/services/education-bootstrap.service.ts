import 'server-only'

import { toDate } from '@/lib/date'
import {
  defaultAcademicCalendar,
  isEducationRegisterPack,
  termsToSeed,
  type AcademicCalendarInput,
} from '@/lib/packs'
import type { Tx } from '@/server/db'

/**
 * Ensure a school/university org has a General program + OPEN academic year + terms.
 * Idempotent. Never deletes prior years/history.
 */
export async function ensureEducationBootstrap(
  tx: Tx,
  orgId: string,
  packId: string | null | undefined,
  calendar?: AcademicCalendarInput | null,
) {
  if (!isEducationRegisterPack(packId)) return { seeded: false as const }

  const existingYear = await tx.academicYear.findFirst({
    where: { orgId },
    select: { id: true },
  })
  if (existingYear) {
    const program = await tx.academicProgram.findFirst({
      where: { orgId },
      select: { id: true },
    })
    if (!program) {
      await tx.academicProgram.create({
        data: { orgId, name: 'General', code: 'GEN' },
      })
    }
    return { seeded: false as const, reason: 'year-exists' as const }
  }

  const cal = calendar ?? defaultAcademicCalendar()
  const termRows = termsToSeed(cal)
  const startsOn = termRows.reduce(
    (min, row) => (row.startsOn < min ? row.startsOn : min),
    termRows[0]!.startsOn,
  )
  const endsOn = termRows.reduce(
    (max, row) => (row.endsOn > max ? row.endsOn : max),
    termRows[0]!.endsOn,
  )

  const program = await tx.academicProgram.findFirst({
    where: { orgId },
    select: { id: true },
  })
  if (!program) {
    await tx.academicProgram.create({
      data: { orgId, name: 'General', code: 'GEN' },
    })
  }

  const year = await tx.academicYear.create({
    data: {
      orgId,
      label: cal.academicYearLabel.trim(),
      startsOn: toDate(startsOn),
      endsOn: toDate(endsOn),
      status: 'OPEN',
    },
    select: { id: true },
  })

  for (const term of termRows) {
    const exists = await tx.academicTerm.findFirst({
      where: { orgId, name: term.name },
      select: { id: true },
    })
    if (exists) continue
    await tx.academicTerm.create({
      data: {
        orgId,
        academicYearId: year.id,
        name: term.name,
        startsOn: toDate(term.startsOn),
        endsOn: toDate(term.endsOn),
      },
    })
  }

  return { seeded: true as const, yearId: year.id }
}
