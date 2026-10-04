import 'server-only'

import type { Workbook as ExcelWorkbook } from 'exceljs'

import {
  COUNTRY_CHOICES,
  ITEM_TYPE_CHOICES,
  type TemplateColumn,
  type TemplateList,
} from '@/lib/import-template'

const FILL_ROWS = 1000

export type TemplateLists = Partial<Record<TemplateList, string[]>>

/**
 * A blank workbook a person fills in later.
 *
 * The first sheet is the data, one column per field, with the header frozen.
 * Dropdowns offer the values this organisation already has (payment terms,
 * account names) plus the fixed choices (Yes/No, item type, country). A second
 * sheet says what each column means, with an example, so the data sheet itself
 * stays empty.
 */
export async function buildImportTemplate(input: {
  sheetName: string
  columns: TemplateColumn[]
  lists?: TemplateLists
  /** Up to three finished rows. The blank sheet leaves this out. */
  examples?: string[][]
}): Promise<Uint8Array> {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')

  const workbook = new Workbook()
  const lists = {
    yesno: ['Yes', 'No'],
    itemType: ITEM_TYPE_CHOICES,
    country: COUNTRY_CHOICES,
    terms: [],
    income: [],
    expense: [],
    inventory: [],
    store: [],
    ...input.lists,
  }

  const data = workbook.addWorksheet(input.sheetName)
  const guide = workbook.addWorksheet('How to fill')
  const listSheet = workbook.addWorksheet('Lists')

  writeLists(listSheet, lists)
  writeDataSheet(data, input.columns, lists, input.examples ?? [])
  writeGuide(guide, input.sheetName, input.columns, (input.examples ?? []).length > 0)

  listSheet.state = 'hidden'

  const raw = await workbook.xlsx.writeBuffer()
  return raw instanceof Uint8Array ? new Uint8Array(raw) : new Uint8Array(raw as ArrayBuffer)
}

const LIST_COLUMN: Record<TemplateList, number> = {
  yesno: 1,
  itemType: 2,
  country: 3,
  terms: 4,
  income: 5,
  expense: 6,
  inventory: 7,
  store: 8,
}

function writeLists(sheet: ExcelWorkbook['worksheets'][number], lists: Record<TemplateList, string[]>) {
  for (const key of Object.keys(LIST_COLUMN) as TemplateList[]) {
    const values = lists[key]
    values.forEach((value, index) => {
      sheet.getCell(index + 1, LIST_COLUMN[key]).value = value
    })
  }
}

function writeDataSheet(
  sheet: ExcelWorkbook['worksheets'][number],
  columns: TemplateColumn[],
  lists: Record<TemplateList, string[]>,
  examples: string[][],
) {
  const header = sheet.getRow(1)
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1)
    cell.value = column.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F6C' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.note = column.required ? `${column.hint} Required.` : column.hint

    const excelColumn = sheet.getColumn(index + 1)
    excelColumn.width = Math.min(36, Math.max(14, column.header.length + 4))
    if (column.entry === 'money') excelColumn.numFmt = '#,##0.00'
    if (column.entry === 'date') excelColumn.numFmt = 'yyyy-mm-dd'

    const choices = column.entry && column.entry in LIST_COLUMN ? lists[column.entry as TemplateList] : undefined
    if (choices && choices.length > 0) {
      const letter = columnLetter(LIST_COLUMN[column.entry as TemplateList] - 1)
      const withValidation = sheet as ExcelWorkbook['worksheets'][number] & {
        dataValidations: { add: (address: string, validation: object) => void }
      }
      withValidation.dataValidations.add(`${columnLetter(index)}2:${columnLetter(index)}${FILL_ROWS + 1}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`Lists!$${letter}$1:$${letter}$${choices.length}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: column.header,
        error: column.hint,
        showInputMessage: true,
        promptTitle: column.header,
        prompt: column.hint,
      })
    }
  })

  header.height = 22
  examples.slice(0, 3).forEach((example, rowIndex) => {
    const row = sheet.getRow(rowIndex + 2)
    columns.forEach((_, index) => {
      const cell = row.getCell(index + 1)
      cell.value = example[index] ?? ''
      cell.font = { italic: true, color: { argb: 'FF3D4C5C' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E6' } }
    })
  })
  if (examples.length > 0) {
    sheet.getCell(2, 1).note = 'These rows are examples. Replace them with your own before you import.'
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }
}

function writeGuide(
  sheet: ExcelWorkbook['worksheets'][number],
  sheetName: string,
  columns: TemplateColumn[],
  hasExamples: boolean,
) {
  sheet.getCell(1, 1).value = `How to fill ${sheetName}`
  sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF0B4F6C' } }
  sheet.mergeCells(1, 1, 1, 4)

  const exampleNote = hasExamples
    ? ' The tinted rows are examples. Replace them with your own data before you import.'
    : ''
  sheet.getCell(3, 1).value =
    `Type on the sheet named "${sheetName}". One row is one record. Do not rename or delete the column headings — the import reads each heading and puts that cell in the matching field. A column marked Required must be filled. A column marked Optional can be left blank.${exampleNote} Save this file and import it. A CSV of the same headings imports the same way.`
  sheet.getCell(3, 1).alignment = { wrapText: true, vertical: 'top' }
  sheet.mergeCells(3, 1, 3, 4)
  sheet.getRow(3).height = 72

  const headings = ['Column', 'Required', 'What to write', 'Example']
  headings.forEach((heading, index) => {
    const cell = sheet.getCell(5, index + 1)
    cell.value = heading
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F6C' } }
  })

  columns.forEach((column, index) => {
    const row = sheet.getRow(6 + index)
    row.getCell(1).value = column.header
    row.getCell(2).value = column.required ? 'Required' : 'Optional'
    row.getCell(3).value = column.hint
    row.getCell(4).value = column.example
    row.getCell(3).alignment = { wrapText: true }
  })

  sheet.getColumn(1).width = 28
  sheet.getColumn(2).width = 14
  sheet.getColumn(3).width = 72
  sheet.getColumn(4).width = 22
}

function columnLetter(index: number): string {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}
