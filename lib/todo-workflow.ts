export const TODO_STAGES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'DONE'] as const
export type TodoStage = (typeof TODO_STAGES)[number]

export const TODO_STAGE_LABELS: Record<TodoStage, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  DONE: 'Done',
}

export const TODO_COMPLETIONS = ['COMPLETED', 'PARTIAL', 'BLOCKED', 'REPORT'] as const
export type TodoCompletion = (typeof TODO_COMPLETIONS)[number]

export const TODO_COMPLETION_LABELS: Record<TodoCompletion, string> = {
  COMPLETED: 'Completed',
  PARTIAL: 'Partly done',
  BLOCKED: 'Blocked',
  REPORT: 'Complaint / report',
}
