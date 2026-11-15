/** Whether a purchase post must carry a fund / class label. */
export function requiresRestrictedFundClass(
  orgHasRestrictedClass: boolean,
  documentClassId: string | null | undefined,
  purchaseType: string,
  isDraft: boolean,
): boolean {
  if (isDraft) return false
  if (!orgHasRestrictedClass) return false
  if (purchaseType !== 'BILL' && purchaseType !== 'EXPENSE') return false
  return !documentClassId
}