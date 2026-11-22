import { describe, expect, it } from 'vitest'

import { defaultAcademicCalendar, modulesFromPack, getPack } from '@/lib/packs'
import { setupSchema } from '@/lib/validation/auth'

describe('register pack selection (setupSchema)', () => {
  const base = {
    organizationName: 'FAANOOLE PRIMARY SCHOOL',
    baseCurrency: 'USD',
    fiscalYearStartMonth: '1',
    fiscalYearStartDay: '1',
    name: 'Admin User',
    email: 'admin@school.test',
    phone: '',
    password: 'secret1',
    confirmPassword: 'secret1',
  }

  const schoolYear = defaultAcademicCalendar(new Date('2026-03-01T00:00:00Z'))

  it('accepts school packId and derives school modules (no Apps wall)', () => {
    const parsed = setupSchema.parse({
      ...base,
      packId: 'school',
      academicYearLabel: schoolYear.academicYearLabel,
      termCount: String(schoolYear.termCount),
      term1StartsOn: schoolYear.term1StartsOn,
      term1EndsOn: schoolYear.term1EndsOn,
      term2StartsOn: schoolYear.term2StartsOn,
      term2EndsOn: schoolYear.term2EndsOn,
      midVacationStartsOn: schoolYear.midVacationStartsOn,
      midVacationEndsOn: schoolYear.midVacationEndsOn,
      endVacationStartsOn: schoolYear.endVacationStartsOn,
      endVacationEndsOn: schoolYear.endVacationEndsOn,
    })
    expect(parsed.packId).toBe('school')
    const pack = getPack('school')!
    expect(parsed.requestedModules).toEqual(modulesFromPack(pack))
    expect(parsed.requestedModules.sales).toBe(true)
    expect(parsed.requestedModules.pos).toBe(false)
    expect(parsed.requestedModules.employees).toBe(true)
    expect(parsed.academicCalendar?.term1StartsOn).toBe(schoolYear.term1StartsOn)
    expect(parsed.fiscalYearStartMonth).toBe(1)
    expect(parsed.fiscalYearStartDay).toBe(15)
  })

  it('requires school year dates for school pack', () => {
    const result = setupSchema.safeParse({ ...base, packId: 'school' })
    expect(result.success).toBe(false)
  })

  it('refuses submit with no pack and no modules', () => {
    const result = setupSchema.safeParse({ ...base })
    expect(result.success).toBe(false)
  })

  it('accepts hospital_admin pack', () => {
    const parsed = setupSchema.parse({ ...base, packId: 'hospital_admin' })
    expect(parsed.packId).toBe('hospital_admin')
    expect(parsed.requestedModules.sales).toBe(true)
  })
})
