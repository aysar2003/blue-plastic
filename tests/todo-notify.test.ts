import { describe, expect, it } from 'vitest'

import {
  digitsOnlyPhone,
  todoAssignmentBodyText,
  todoAssignmentSubject,
  todoAssignmentWhatsappText,
  TODO_PRIORITY_LABELS,
  todoWhatsappUrl,
} from '@/lib/todo-notify'

describe('todo notify copy', () => {
  it('builds an Odoo-style subject', () => {
    expect(todoAssignmentSubject('Check stock', 'Al Furaat')).toBe(
      'To-do: Check stock — Al Furaat',
    )
  })

  it('includes assigner, deadline, and link in the body', () => {
    const body = todoAssignmentBodyText({
      orgName: 'Al Furaat',
      assignerName: 'Manager',
      assigneeName: 'Ali',
      title: 'Hubi delivery',
      notes: 'Store 1',
      dueDate: '2026-10-31',
      priority: 1,
      todosUrl: 'http://localhost:3000/todos',
    })
    expect(body).toContain('Hi Ali,')
    expect(body).toContain('Manager assigned you')
    expect(body).toContain('Priority: Important')
    expect(body).toContain(TODO_PRIORITY_LABELS[1])
    expect(body).toContain('Deadline:')
    expect(body).toContain('Store 1')
    expect(body).toContain('http://localhost:3000/todos')
  })

  it('builds a wa.me link with digits-only phone', () => {
    expect(digitsOnlyPhone('+252 61 730 5588')).toBe('252617305588')
    const text = todoAssignmentWhatsappText({
      orgName: 'Al Furaat',
      assignerName: 'Manager',
      assigneeName: 'Ali',
      title: 'Hubi delivery',
      notes: null,
      dueDate: null,
      priority: 0,
      todosUrl: 'http://localhost:3000/todos',
    })
    expect(todoWhatsappUrl('252617305588', text)).toContain('https://wa.me/252617305588?text=')
    expect(todoWhatsappUrl('252617305588', text)).toContain(encodeURIComponent('Hubi delivery'))
  })
})
