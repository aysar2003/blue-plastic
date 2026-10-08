/**
 * Reads the register (till) form — used by both "Add register" and the Edit
 * form on /pos/settings. Kept pure so the mapping can be tested without a DB.
 *
 * - Unchecked checkboxes are omitted from FormData, so a missing `isActive`
 *   means the till is switched off (the Add form checks it by default).
 * - Payment methods arrive as repeated `paymentMethodIds` fields; blanks and
 *   duplicates are dropped.
 */
export function readRegisterForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value.trim() : ''
  }
  const paymentMethodIds = [
    ...new Set(
      formData
        .getAll('paymentMethodIds')
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ]
  return {
    id: text('id'),
    name: text('name'),
    defaultCustomerId: text('defaultCustomerId'),
    storeId: text('storeId'),
    paymentMethodIds,
    isActive: formData.get('isActive') === 'true',
  }
}
