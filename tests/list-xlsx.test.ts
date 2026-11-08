import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { moneyHeaderLabel, moneyNumFmt, renderListXlsx } from '@/server/reports/list-xlsx'

describe('renderListXlsx', () => {
  it('writes a centered letterhead workbook with dollar money', async () => {
    const bytes = await renderListXlsx({
      org: {
        name: 'Tijaabo Trading',
        addressLine1: 'Hargeisa',
        phone: '0614000000',
        email: 'books@tijaabo.test',
      },
      title: 'Customers',
      currency: 'USD',
      exportedAt: '2026-11-07',
      columns: [
        { header: 'Display name', width: 24, kind: 'text' },
        { header: 'Phone', width: 16, kind: 'text' },
        { header: 'Open balance', width: 14, kind: 'money' },
      ],
      rows: [
        ['Acme Plastics', '0612345678', '1500.00'],
        ['Blue Pipe Co', '0630001111', ''],
      ],
    })

    expect(bytes.byteLength).toBeGreaterThan(800)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    // ExcelJS typings expect Node Buffer; Uint8Array is accepted at runtime.
    await workbook.xlsx.load(Uint8Array.from(bytes) as never)
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell(1, 1).value).toBe('Tijaabo Trading')
    expect(sheet.getCell(1, 1).alignment?.horizontal).toBe('center')

    let moneyHeader = ''
    let moneyFmt = ''
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (String(cell.value).includes('Open balance')) moneyHeader = String(cell.value)
        if (cell.value === 1500 || cell.value === 1500.0) moneyFmt = String(cell.numFmt ?? '')
      })
    })
    expect(moneyHeader).toBe('Open balance (USD)')
    expect(moneyFmt).toContain('$')
  })

  it('labels money headers and formats USD with a dollar sign', () => {
    expect(moneyHeaderLabel('Open balance', 'money', 'USD')).toBe('Open balance (USD)')
    expect(moneyHeaderLabel('Open balance (USD)', 'money', 'USD')).toBe('Open balance (USD)')
    expect(moneyHeaderLabel('Phone', 'text', 'USD')).toBe('Phone')
    expect(moneyNumFmt('USD')).toContain('$')
  })
})
