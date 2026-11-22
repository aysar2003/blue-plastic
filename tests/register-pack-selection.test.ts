import { describe, expect, it } from 'vitest'

import { modulesFromPack, getPack } from '@/lib/packs'
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

  it('accepts school packId and derives school modules (no Apps wall)', () => {
    const parsed = setupSchema.parse({ ...base, packId: 'school' })
    expect(parsed.packId).toBe('school')
    const pack = getPack('school')!
    expect(parsed.requestedModules).toEqual(modulesFromPack(pack))
    expect(parsed.requestedModules.sales).toBe(true)
    expect(parsed.requestedModules.pos).toBe(false)
    expect(parsed.requestedModules.employees).toBe(true)
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
