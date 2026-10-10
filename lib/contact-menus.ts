/**
 * Menu links for one customer — sales, payments, reports, and the item list.
 * Used by the left-list … menu and the information-panel actions.
 */
export function customerContactMenu(
  customerId: string,
  options: {
    canInvoice: boolean
    canPay: boolean
    canReport: boolean
    selectHref?: string
  },
): { type: 'link'; label: string; href: string }[] {
  const id = encodeURIComponent(customerId)
  const links: { type: 'link'; label: string; href: string }[] = []

  if (options.selectHref) {
    links.push({ type: 'link', label: 'Open', href: options.selectHref })
  }
  if (options.canReport) {
    links.push({
      type: 'link',
      label: 'QuickReport',
      href: `/reports/statements/customer?customerId=${id}`,
    })
  }
  if (options.canInvoice) {
    links.push(
      { type: 'link', label: 'Create invoice', href: `/sales/invoices/new?customer=${id}` },
      { type: 'link', label: 'Create estimate', href: `/sales/estimates/new?customer=${id}` },
      { type: 'link', label: 'Create quotation', href: `/sales/quotations/new?customer=${id}` },
      { type: 'link', label: 'Create sales receipt', href: `/sales/sales-receipts/new?customer=${id}` },
      { type: 'link', label: 'Create credit memo', href: `/sales/credit-memos/new?customer=${id}` },
      { type: 'link', label: 'Create refund', href: `/sales/refunds/new?customer=${id}` },
      { type: 'link', label: 'Delivery notes', href: `/sales/delivery?customerId=${id}` },
    )
  }
  if (options.canPay) {
    links.push({ type: 'link', label: 'Receive payment', href: `/payments/new?customer=${id}` })
  }
  if (options.canReport) {
    links.push(
      { type: 'link', label: 'Statement', href: `/reports/statements/customer?customerId=${id}` },
      { type: 'link', label: 'Open invoices', href: `/reports/open-invoices` },
      { type: 'link', label: 'Sales by item', href: `/reports/sales-by-item` },
    )
  }
  links.push({ type: 'link', label: 'Item list', href: '/items' })

  return links
}

export function customerQuickReportHref(customerId: string) {
  return `/reports/statements/customer?customerId=${encodeURIComponent(customerId)}`
}

/**
 * Menu links for one vendor — bills, receiving, pay, and reports.
 */
export function vendorContactMenu(
  vendorId: string,
  options: {
    canBill: boolean
    canPay: boolean
    canReport: boolean
    selectHref?: string
  },
): { type: 'link'; label: string; href: string }[] {
  const id = encodeURIComponent(vendorId)
  const links: { type: 'link'; label: string; href: string }[] = []

  if (options.selectHref) {
    links.push({ type: 'link', label: 'Open', href: options.selectHref })
  }
  if (options.canReport) {
    links.push({
      type: 'link',
      label: 'QuickReport',
      href: `/reports/statements/vendor?vendorId=${id}`,
    })
  }
  if (options.canBill) {
    links.push(
      { type: 'link', label: 'Enter bills', href: `/purchases/bills/new?vendor=${id}` },
      { type: 'link', label: 'Expense', href: `/purchases/expenses/new?vendor=${id}` },
      { type: 'link', label: 'Vendor credit', href: `/purchases/vendor-credits/new?vendor=${id}` },
      { type: 'link', label: 'Purchase order', href: `/purchases/purchase-orders/new?vendor=${id}` },
      {
        type: 'link',
        label: 'Receive items',
        href: `/purchases/purchase-orders?status=open&vendorId=${id}`,
      },
      {
        type: 'link',
        label: 'Delivery',
        href: `/purchases/delivery/outstanding?vendorId=${id}`,
      },
    )
  }
  if (options.canPay) {
    links.push({ type: 'link', label: 'Pay bills', href: `/bill-payments/new?vendor=${id}` })
  }
  if (options.canReport) {
    links.push(
      { type: 'link', label: 'Statement', href: `/reports/statements/vendor?vendorId=${id}` },
      { type: 'link', label: 'Unpaid bills', href: `/reports/unpaid-bills` },
      { type: 'link', label: 'Purchases by item', href: `/reports/purchases-by-item` },
    )
  }
  links.push({ type: 'link', label: 'Item list', href: '/items' })

  return links
}

export function vendorQuickReportHref(vendorId: string) {
  return `/reports/statements/vendor?vendorId=${encodeURIComponent(vendorId)}`
}
