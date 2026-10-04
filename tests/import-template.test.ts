import { describe, expect, it } from 'vitest'

import { CUSTOMER_TEMPLATE } from '@/lib/import-template'
import { buildImportTemplate } from '@/server/services/template-workbook'

describe('blank import sheet', () => {
  it('puts each field in its own column, and explains the columns on a second sheet', async () => {
    const bytes = await buildImportTemplate({
      sheetName: 'Customers',
      columns: CUSTOMER_TEMPLATE,
      lists: { terms: ['Net 30'] },
    })

    const excel = (await import('exceljs')) as unknown as {
      Workbook?: new () => import('exceljs').Workbook
      default?: { Workbook: new () => import('exceljs').Workbook }
    }
    const Workbook = excel.Workbook ?? excel.default?.Workbook
    if (!Workbook) throw new Error('Excel reader did not load')

    const workbook = new Workbook()
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<(typeof workbook)['xlsx']['load']>[0])

    const sheet = workbook.getWorksheet('Customers')
    expect(sheet).toBeTruthy()
    const headers = CUSTOMER_TEMPLATE.map((_, index) => sheet!.getRow(1).getCell(index + 1).value)
    expect(headers).toEqual(CUSTOMER_TEMPLATE.map((column) => column.header))
    expect(sheet!.views[0]?.state).toBe('frozen')

    const guide = workbook.getWorksheet('How to fill')
    expect(guide?.getCell(1, 1).value).toBe('How to fill Customers')
    expect(guide?.getCell(6, 1).value).toBe('Display name')
    expect(guide?.getCell(6, 2).value).toBe('Required')
    expect(guide?.getCell(7, 2).value).toBe('Optional')
    expect(guide?.getCell(6, 4).value).toBe('Hodan Trading')

    expect(workbook.getWorksheet('Lists')?.state).toBe('hidden')
  })
})
