import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ERP_READY_LOOPS } from '@/lib/erp/readiness'

const root = process.cwd()

const REQUIRED_PAGES = [
  'app/(app)/sign/page.tsx',
  'app/sign-request/[token]/page.tsx',
  'app/(app)/discuss/page.tsx',
  'app/(app)/appointments/page.tsx',
  'app/(app)/planning/page.tsx',
  'app/(app)/surveys/page.tsx',
  'app/(app)/employees/recruitment/page.tsx',
  'app/(app)/customers/pipeline/page.tsx',
  'app/(app)/reports/consolidation/page.tsx',
  'app/(app)/accounting/equity/page.tsx',
  'app/(app)/inventory/builds/new/page.tsx',
  'app/(app)/inventory/mrp/page.tsx',
  'app/(app)/customers/tickets/page.tsx',
  'app/(portal)/portal/quotes/page.tsx',
  'app/(portal)/portal/quotes/[id]/page.tsx',
  'app/(app)/accounting/hedges/page.tsx',
  'app/(app)/pos/kitchen/page.tsx',
  'app/(app)/inventory/bins/page.tsx',
  'app/(app)/employees/training/page.tsx',
  'app/(app)/settings/(work)/marketplace/page.tsx',
  'app/(app)/sign/[id]/certificate/page.tsx',
]

describe('ERP depth readiness (general)', () => {
  it('ships a page for every completed loop surface', () => {
    for (const relative of REQUIRED_PAGES) {
      expect(existsSync(join(root, relative)), relative).toBe(true)
    }
  })

  it('no longer advertises Sign / Surveys / Recruitment as stubs in the live pages', () => {
    const sign = readFileSync(join(root, 'app/(app)/sign/page.tsx'), 'utf8')
    const surveys = readFileSync(join(root, 'app/(app)/surveys/page.tsx'), 'utf8')
    const recruitment = readFileSync(join(root, 'app/(app)/employees/recruitment/page.tsx'), 'utf8')
    expect(sign).not.toMatch(/signature stub/i)
    expect(surveys).not.toMatch(/Lite forms/i)
    expect(recruitment).not.toMatch(/not a full ATS/i)
  })

  it('keeps the operating loops named for operators', () => {
    expect(ERP_READY_LOOPS).toHaveLength(9)
  })

  it('dumps BOM and people so restore can replay the extra loops', () => {
    const backup = readFileSync(join(root, 'server/services/backup.service.ts'), 'utf8')
    const restore = readFileSync(join(root, 'server/services/backup-restore.service.ts'), 'utf8')
    expect(backup).toMatch(/itemComponent\.findMany/)
    expect(backup).toMatch(/employee\.findMany/)
    expect(backup).toMatch(/payrollRun\.findMany/)
    expect(restore).toMatch(/payrollRun\.createMany/)
    expect(backup).toMatch(/appointmentType\.findMany/)
    expect(restore).toMatch(/itemComponent\.createMany/)
    expect(restore).toMatch(/employee\.createMany/)
    expect(restore).toMatch(/equityEvent\.createMany/)
    expect(restore).toMatch(/appointmentType\.createMany/)
    expect(restore).toMatch(/crmOpportunity\.createMany/)
  })

  it('lets customers open quotes and staff add appointment types', () => {
    const portal = readFileSync(join(root, 'server/services/portal.service.ts'), 'utf8')
    expect(portal).toMatch(/export async function listQuotes/)
    expect(portal).toMatch(/type: \{ in: \['ESTIMATE', 'QUOTATION'\] \}/)
    const appointments = readFileSync(join(root, 'app/(app)/appointments/page.tsx'), 'utf8')
    expect(appointments).toMatch(/createAppointmentType/)
    expect(appointments).toMatch(/Add type/)
  })
})
