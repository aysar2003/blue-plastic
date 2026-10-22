import { describe, expect, it } from 'vitest'

import { customerContactMenu, vendorContactMenu } from '@/lib/contact-menus'
import { customerSchema, vendorSchema } from '@/lib/validation/master-data'

describe('customer ↔ vendor link', () => {
  it('accepts a linked supplier on the customer form', () => {
    const parsed = customerSchema.safeParse({
      displayName: 'Mall Group',
      linkedVendorId: 'cm123456789012345678901234',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.linkedVendorId).toBe('cm123456789012345678901234')
  })

  it('accepts a linked customer on the vendor form', () => {
    const parsed = vendorSchema.safeParse({
      displayName: 'Mall Group',
      linkedCustomerId: 'cm123456789012345678901234',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.linkedCustomerId).toBe('cm123456789012345678901234')
  })

  it('adds supplier statement links on the customer menu when linked', () => {
    const links = customerContactMenu('cust-1', {
      canInvoice: false,
      canPay: false,
      canReport: true,
      linkedVendorId: 'vend-9',
    })
    expect(links.some((link) => link.label === 'Linked supplier' && link.href.includes('vend-9'))).toBe(
      true,
    )
    expect(
      links.some((link) => link.label === 'Supplier statement' && link.href.includes('vendorId=vend-9')),
    ).toBe(true)
  })

  it('adds customer statement links on the vendor menu when linked', () => {
    const links = vendorContactMenu('vend-1', {
      canBill: false,
      canPay: false,
      canReport: true,
      linkedCustomerId: 'cust-9',
    })
    expect(links.some((link) => link.label === 'Linked customer' && link.href.includes('cust-9'))).toBe(
      true,
    )
    expect(
      links.some((link) => link.label === 'Customer statement' && link.href.includes('customerId=cust-9')),
    ).toBe(true)
  })

  it('keeps menus clean when nothing is linked', () => {
    const customer = customerContactMenu('cust-1', {
      canInvoice: false,
      canPay: false,
      canReport: true,
    })
    const vendor = vendorContactMenu('vend-1', {
      canBill: false,
      canPay: false,
      canReport: true,
    })
    expect(customer.some((link) => link.label === 'Linked supplier')).toBe(false)
    expect(vendor.some((link) => link.label === 'Linked customer')).toBe(false)
  })
})
