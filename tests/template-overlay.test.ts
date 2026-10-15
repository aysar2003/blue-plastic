import { describe, expect, it } from 'vitest'

import {
  createOverlayBlock,
  moveOverlayBlock,
  parseTemplateOverlay,
  resizeOverlayBlock,
} from '@/lib/template-overlay'

describe('template overlay', () => {
  it('creates styled blocks', () => {
    const block = createOverlayBlock('field', { x: 10, y: 20 })
    expect(block.kind).toBe('field')
    expect(block.x).toBe(10)
    expect(block.style.color).toMatch(/^#/)
  })

  it('moves and resizes within the paper', () => {
    const block = createOverlayBlock('text', { x: 10, y: 10, w: 20, h: 10 })
    expect(moveOverlayBlock(block, -5, 50).x).toBe(0)
    expect(resizeOverlayBlock(block, 200, 200).w).toBe(90)
  })

  it('parses saved overlays', () => {
    const parsed = parseTemplateOverlay({
      blocks: [
        {
          id: 'blk_1',
          kind: 'label',
          text: 'Total',
          x: 5,
          y: 6,
          w: 12,
          h: 5,
          style: {
            color: '#111111',
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
            borderWidth: 2,
          },
        },
      ],
    })
    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.blocks[0]?.text).toBe('Total')
    expect(parsed.blocks[0]?.style.fontWeight).toBe('bold')
    expect(parsed.blocks[0]?.style.fontFamily).toContain('Georgia')
    expect(parsed.blocks[0]?.style.borderWidth).toBe(2)
  })

  it('parses logo blocks with storage keys', () => {
    const parsed = parseTemplateOverlay({
      blocks: [
        {
          id: 'blk_logo',
          kind: 'logo',
          text: 'brand.png',
          x: 4,
          y: 4,
          w: 16,
          h: 10,
          logoKey: 'tpl_1::logo::blk_logo',
          style: { objectFit: 'cover' },
        },
      ],
    })
    expect(parsed.blocks[0]?.kind).toBe('logo')
    expect(parsed.blocks[0]?.logoKey).toBe('tpl_1::logo::blk_logo')
    expect(parsed.blocks[0]?.style.objectFit).toBe('cover')
  })
})

