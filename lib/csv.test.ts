import { describe, expect, it } from 'vitest'

import { normaliseHeader, parseCsv, pick } from './csv'

describe('parseCsv', () => {
  it('skips the title rows a QuickBooks report puts above the columns', () => {
    const { headers, rows } = parseCsv(
      'Blue Plastic Center\nCustomer Contact List\n\nCustomer,Email,Open Balance\nHodan,hodan@test.com,"$1,200.00"',
    )
    expect(headers).toEqual(['customer', 'email', 'openbalance'])
    expect(rows).toEqual([{ customer: 'Hodan', email: 'hodan@test.com', openbalance: '$1,200.00' }])
  })

  it('reads a plain file', () => {
    const { headers, rows } = parseCsv('name,email\nAcme,acme@test.com\nBeta,beta@test.com')
    expect(headers).toEqual(['name', 'email'])
    expect(rows).toEqual([
      { name: 'Acme', email: 'acme@test.com' },
      { name: 'Beta', email: 'beta@test.com' },
    ])
  })

  it('handles quoted fields containing commas', () => {
    const { rows } = parseCsv('name,address\n"Acme, Inc.","1 High St, Nairobi"')
    expect(rows[0].address).toBe('1 High St, Nairobi')
    expect(rows[0].name).toBe('Acme, Inc.')
  })

  it('handles escaped quotes', () => {
    const { rows } = parseCsv('name\n"He said ""hello"""')
    expect(rows[0].name).toBe('He said "hello"')
  })

  it('handles newlines inside a quoted field', () => {
    const { rows } = parseCsv('name,notes\nAcme,"line one\nline two"')
    expect(rows[0].notes).toBe('line one\nline two')
  })

  it('strips a byte-order mark, which Excel loves to add', () => {
    const { headers } = parseCsv('﻿name,email\nAcme,a@test.com')
    expect(headers[0]).toBe('name')
  })

  it('handles CRLF line endings', () => {
    const { rows } = parseCsv('name\r\nAcme\r\nBeta')
    expect(rows.map((r) => r.name)).toEqual(['Acme', 'Beta'])
  })

  it('skips blank lines rather than importing empty rows', () => {
    const { rows } = parseCsv('name\nAcme\n\n\nBeta\n')
    expect(rows).toHaveLength(2)
  })

  it('tolerates rows shorter than the header', () => {
    const { rows } = parseCsv('name,email,phone\nAcme,a@test.com')
    expect(rows[0]).toEqual({ name: 'Acme', email: 'a@test.com', phone: '' })
  })

  it('returns nothing for an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
    expect(parseCsv('\n\n')).toEqual({ headers: [], rows: [] })
  })
})

describe('header matching', () => {
  it('treats case, spaces and punctuation as noise', () => {
    expect(normaliseHeader('Display Name')).toBe('displayname')
    expect(normaliseHeader('display_name')).toBe('displayname')
    expect(normaliseHeader('  DISPLAY-NAME  ')).toBe('displayname')
    expect(normaliseHeader('Product/Service Name')).toBe('productservicename')
  })

  it('picks the first alias that is present and non-empty', () => {
    const { rows } = parseCsv('Display Name,Company\nAcme,')
    expect(pick(rows[0], 'displayName', 'company')).toBe('Acme')
    expect(pick(rows[0], 'company', 'displayName')).toBe('Acme')
    expect(pick(rows[0], 'missing')).toBe('')
  })
})
