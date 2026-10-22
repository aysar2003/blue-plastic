/**
 * View / Edit / Print destinations for a document waiting in Approvals.
 * Built from the deep link stored on the request — never guessed from ids.
 */

export type ApprovalDocumentLinks = {
  view: string
  edit: string | null
  print: string | null
}

function pathOnly(href: string): string {
  return href.split('#')[0]?.split('?')[0] ?? href
}

/**
 * True when this path is a record page we can append /edit or /print to
 * (`/sales/invoices/id`, `/payments/id`, `/journals/id`, `/vendors/id`).
 */
function isRecordPath(path: string): boolean {
  const parts = path.split('/').filter(Boolean)
  if (parts.length < 2) return false
  const last = parts[parts.length - 1] ?? ''
  if (last === 'new' || last === 'edit' || last === 'print' || last === 'pack') return false
  return true
}

export function approvalDocumentLinks(href: string): ApprovalDocumentLinks {
  const view = href
  const path = pathOnly(href)
  const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : ''

  // List deep-links (transfers, stock adjustments, bill payments search).
  if (hash || path === '/bill-payments' || path === '/customers' || path === '/vendors') {
    return { view, edit: null, print: null }
  }

  if (!isRecordPath(path)) {
    return { view, edit: null, print: null }
  }

  const root = path.split('/').filter(Boolean)[0]
  const printSheet = root === 'sales' || root === 'purchases'
  const canEdit = root === 'sales' || root === 'purchases' || root === 'payments'

  return {
    view,
    edit: canEdit ? `${path}/edit` : null,
    print: printSheet ? `${path}/print` : path,
  }
}

