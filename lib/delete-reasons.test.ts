import { describe, expect, it } from 'vitest'

import {
  filterDeleteReasons,
  parseDeleteReasons,
  rememberDeleteReason,
  uniqueReasons,
} from './delete-reasons'

describe('delete-reasons', () => {
  it('keeps the newest spelling and drops duplicates', () => {
    expect(uniqueReasons(['Entered twice', 'entered twice', 'Wrong month', ''])).toEqual([
      'Entered twice',
      'Wrong month',
    ])
  })

  it('remembers a new reason at the front', () => {
    expect(rememberDeleteReason(['Wrong month'], 'Entered twice')).toEqual([
      'Entered twice',
      'Wrong month',
    ])
  })

  it('filters while typing', () => {
    expect(filterDeleteReasons(['Entered twice', 'Wrong month', 'Duplicate'], 'tw')).toEqual([
      'Entered twice',
    ])
  })

  it('parses stored JSON', () => {
    expect(parseDeleteReasons(JSON.stringify(['A', 'B']))).toEqual(['A', 'B'])
    expect(parseDeleteReasons('not-json')).toEqual([])
  })
})
