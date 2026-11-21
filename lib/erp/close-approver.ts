/** Optional second checker on hard-gate month close (Wave D, reuses approvals). */
export function closeSecondApproverRequired(flags: {
  closeHardGates?: boolean
  closeSecondApprover?: boolean
}): boolean {
  return Boolean(flags.closeHardGates && flags.closeSecondApprover)
}

/** Two people must approve before the period actually closes. */
export function closeApprovalLevels(): number {
  return 2
}
