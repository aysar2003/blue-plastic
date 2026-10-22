import { describe, expect, it } from 'vitest'

import { approvalDocumentLinks } from '@/lib/approval-links'

describe('approval document links', () => {
  it('gives view, edit, and print for an invoice', () => {
    expect(approvalDocumentLinks('/sales/invoices/abc')).toEqual({
      view: '/sales/invoices/abc',
      edit: '/sales/invoices/abc/edit',
      print: '/sales/invoices/abc/print',
    })
  })

  it('gives view and edit for a customer payment, print on the record', () => {
    expect(approvalDocumentLinks('/payments/pmt1')).toEqual({
      view: '/payments/pmt1',
      edit: '/payments/pmt1/edit',
      print: '/payments/pmt1',
    })
  })

  it('does not invent edit/print for a banking hash link', () => {
    expect(approvalDocumentLinks('/banking#transfers')).toEqual({
      view: '/banking#transfers',
      edit: null,
      print: null,
    })
  })

  it('does not invent edit for a bill-payment search link', () => {
    expect(approvalDocumentLinks('/bill-payments?q=BP-1')).toEqual({
      view: '/bill-payments?q=BP-1',
      edit: null,
      print: null,
    })
  })
})
