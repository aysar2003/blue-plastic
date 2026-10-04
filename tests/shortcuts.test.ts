import { describe, expect, it } from 'vitest'

import { SHORTCUTS } from '@/lib/shortcuts'

describe('keyboard shortcuts', () => {
  it('gives every shortcut its own two-key sequence', () => {
    const seen = new Set<string>()
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys).toHaveLength(2)
      const id = shortcut.keys.join(' ')
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })
})
