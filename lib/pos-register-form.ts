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
  const ids = (key: string) => [
    ...new Set(
      formData
        .getAll(key)
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ]
  const paymentMethodIds = ids('paymentMethodIds')
  // Absent on a caller that predates the setting. Present (even with nothing
  // checked) means the till named exactly which accounts may return change.
  const changeConfigured = formData.get('changeReturnConfigured') === 'true'
  return {
    id: text('id'),
    name: text('name'),
    defaultCustomerId: text('defaultCustomerId'),
    storeId: text('storeId'),
    paymentMethodIds,
    isActive: formData.get('isActive') === 'true',
    // Blank on edit means "keep the current PIN". Never echo a stored PIN back.
    pin: text('pin'),
    allowWalletChangeReturn: formData.get('allowWalletChangeReturn') === 'true',
    defaultChangeMethodId: text('defaultChangeMethodId'),
    changeMethodIds: changeConfigured ? ids('changeMethodIds') : undefined,
  }
}
