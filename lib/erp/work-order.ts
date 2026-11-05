/**
 * SME work orders — planned builds that complete into assembly posting.
 * Not MES, not routings, not shop-floor terminals.
 */

export const WORK_ORDER_STATUSES = ['DRAFT', 'RELEASED', 'DONE', 'CANCELLED'] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return (WORK_ORDER_STATUSES as readonly string[]).includes(value)
}

export function canReleaseWorkOrder(status: WorkOrderStatus): boolean {
  return status === 'DRAFT'
}

export function canCompleteWorkOrder(status: WorkOrderStatus): boolean {
  return status === 'RELEASED'
}

export function canCancelWorkOrder(status: WorkOrderStatus): boolean {
  return status === 'DRAFT' || status === 'RELEASED'
}
