import { describe, expect, it } from 'vitest'

import {
  FORM_PICKER_BOOTSTRAP,
  FORM_PICKER_SEARCH,
} from '@/server/services/sales-options'

describe('form picker caps', () => {
  it('keeps bootstrap larger than a search page so open still feels full', () => {
    expect(FORM_PICKER_BOOTSTRAP).toBeGreaterThanOrEqual(50)
    expect(FORM_PICKER_SEARCH).toBeGreaterThanOrEqual(20)
    expect(FORM_PICKER_BOOTSTRAP).toBeGreaterThan(FORM_PICKER_SEARCH)
  })
})
