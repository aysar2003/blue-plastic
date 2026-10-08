import { ODOO } from '@/lib/odoo-brand'

export type SheetMarkColors = {
  markA: string
  markB: string
  markC: string
  markD: string
}

const DEFAULT_MARKS: SheetMarkColors = {
  markA: ODOO.purpleDeep,
  markB: ODOO.purple,
  markC: ODOO.teal,
  markD: '#8fd4d7',
}

/** Corner marks shared by the sales sheet template and the printed document. */
export function SheetMarks({ colors = DEFAULT_MARKS }: { colors?: SheetMarkColors }) {
  return (
    <>
      <svg
        className="pointer-events-none absolute left-0 top-0 h-28 w-40 sm:h-36 sm:w-52"
        viewBox="0 0 220 150"
        aria-hidden
      >
        <polygon points="0,0 86,0 0,68" fill={colors.markA} />
        <polygon points="36,0 158,0 96,82 0,30" fill={colors.markB} />
        <polygon points="72,0 206,0 136,64 22,14" fill={colors.markC} />
        <polygon points="118,0 220,0 176,40 86,6" fill={colors.markD} />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-0 right-0 h-20 w-40 sm:h-28 sm:w-52"
        viewBox="0 0 210 120"
        aria-hidden
      >
        <polygon points="210,120 124,120 210,52" fill={colors.markA} />
        <polygon points="210,120 62,120 128,46 210,78" fill={colors.markB} />
        <polygon points="210,120 8,120 86,58 210,34" fill={colors.markC} />
      </svg>
    </>
  )
}
