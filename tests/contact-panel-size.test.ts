import { describe, expect, it } from 'vitest'

import {
  clampFrameHeight,
  clampProfileHeight,
  defaultFrameHeight,
  defaultProfileHeight,
  FRAME_MAX,
  FRAME_MIN,
  PROFILE_MIN,
  panelHeightKey,
  parseStoredHeight,
  profileHeightKey,
  TABLE_MIN,
} from '@/lib/contact-panel-size'

describe('contact centre panel size', () => {
  it('fills the window from its top on a tall screen', () => {
    expect(defaultFrameHeight(1080, 162)).toBe(1080 - 162 - 12)
  })

  it('takes about a screenful on a 1024x576 laptop instead of a sliver', () => {
    expect(defaultFrameHeight(576, 162)).toBe(560)
    expect(defaultFrameHeight(447, 162)).toBe(431)
  })

  it('clamps dragged heights', () => {
    expect(clampFrameHeight(10)).toBe(FRAME_MIN)
    expect(clampFrameHeight(99999)).toBe(FRAME_MAX)
  })

  it('caps the information block so the table keeps its room', () => {
    const pane = 420
    expect(defaultProfileHeight(pane)).toBe(126)
    expect(clampProfileHeight(1000, pane)).toBe(pane - TABLE_MIN)
    expect(clampProfileHeight(0, pane)).toBe(PROFILE_MIN)
  })

  it('reads only sensible remembered heights', () => {
    expect(parseStoredHeight(null)).toBeNull()
    expect(parseStoredHeight('abc')).toBeNull()
    expect(parseStoredHeight('-4')).toBeNull()
    expect(parseStoredHeight('640')).toBe(640)
  })

  it('remembers customers and vendors separately', () => {
    expect(panelHeightKey('customer')).not.toBe(panelHeightKey('vendor'))
    expect(profileHeightKey('customer')).not.toBe(panelHeightKey('customer'))
  })
})
