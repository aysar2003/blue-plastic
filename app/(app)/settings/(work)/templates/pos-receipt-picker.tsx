'use client'

import { FormLayoutPicker } from '@/app/(app)/settings/(work)/templates/form-layout-picker'
import {
  DEFAULT_RECEIPT_PAPER,
  parseReceiptPaper,
  RECEIPT_PAPER_KEY,
  RECEIPT_PAPERS,
} from '@/lib/pos-receipt'

const OPTIONS = [
  {
    id: '80' as const,
    label: '80 mm',
    blurb: `Standard counter roll — ${RECEIPT_PAPERS['80'].widthMm} mm wide.`,
  },
  {
    id: '58' as const,
    label: '58 mm',
    blurb: `Narrow till roll — ${RECEIPT_PAPERS['58'].widthMm} mm wide.`,
  },
]

export function PosReceiptPicker() {
  return (
    <FormLayoutPicker
      title="POS thermal receipt"
      description="Width of the slip the till printer cuts. Match the paper in your printer. View shows the roll; Edit lets you tune font, border, and logo frame for this preview."
      storageKey={RECEIPT_PAPER_KEY}
      options={OPTIONS}
      defaultId={DEFAULT_RECEIPT_PAPER}
      parse={(raw) => parseReceiptPaper(raw ?? DEFAULT_RECEIPT_PAPER)}
      persistHint="Saved in this browser. The till printer uses the width you pick here."
    />
  )
}
