export type KnowledgeTemplate = {
  key: string
  label: string
  blurb: string
  icon: string
  title: string
  body: string
}

/** Seeded article shapes (Odoo “Browse templates”) — no DB table. */
export const KNOWLEDGE_TEMPLATES: readonly KnowledgeTemplate[] = [
  {
    key: 'onboarding',
    label: 'Onboarding',
    blurb: 'First-week checklist for a new hire',
    icon: '👋',
    title: 'Team onboarding',
    body: `<h2>Welcome</h2><p>Use this page for the first week.</p><h3>Day 1</h3><ul><li>Accounts and access</li><li>Tour of the till / desk</li><li>Read company policies</li></ul><h3>Week 1</h3><ul><li>Shadow a sale / purchase</li><li>Ask questions in To-do</li></ul>`,
  },
  {
    key: 'sop',
    label: 'SOP',
    blurb: 'Standard operating procedure',
    icon: '📋',
    title: 'Standard operating procedure',
    body: `<h2>Purpose</h2><p>What this process achieves.</p><h2>Who</h2><p>Roles responsible.</p><h2>Steps</h2><ol><li>Step one</li><li>Step two</li><li>Step three</li></ol><h2>Exceptions</h2><p>When to escalate.</p>`,
  },
  {
    key: 'meeting',
    label: 'Meeting notes',
    blurb: 'Agenda, notes, and actions',
    icon: '📝',
    title: 'Meeting notes',
    body: `<h2>Agenda</h2><ul><li>Topic A</li><li>Topic B</li></ul><h2>Notes</h2><p></p><h2>Actions</h2><ul><li>Owner — task — due date</li></ul>`,
  },
  {
    key: 'policy',
    label: 'Policy',
    blurb: 'Internal rule the team must follow',
    icon: '📜',
    title: 'Company policy',
    body: `<h2>Policy</h2><p>State the rule clearly.</p><h2>Applies to</h2><p>Who must follow it.</p><h2>Enforcement</h2><p>What happens if it is broken.</p>`,
  },
] as const

export function knowledgeTemplate(key: string): KnowledgeTemplate | null {
  return KNOWLEDGE_TEMPLATES.find((row) => row.key === key) ?? null
}

export const KNOWLEDGE_ICONS = [
  '📄',
  '📋',
  '📝',
  '📚',
  '💡',
  '✅',
  '🔧',
  '🏪',
  '💰',
  '📦',
  '👋',
  '📜',
  '⭐',
  '🔒',
  '🚀',
] as const
