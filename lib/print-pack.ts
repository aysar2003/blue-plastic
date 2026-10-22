/**
 * Page breaks for multi-paper print packs (sales, purchases, project
 * quotations, statement invoices). Each paper starts clean; totals stay with
 * their sheet instead of orphaning onto the next quotation.
 */
export function printPackSectionClass(index: number, total: number): string {
  const first = index === 0
  const last = index === total - 1
  return [
    'scroll-mt-20 print:mt-0',
    first ? '' : 'mt-8 break-before-page',
    last ? '' : 'break-after-page',
  ]
    .filter(Boolean)
    .join(' ')
}
