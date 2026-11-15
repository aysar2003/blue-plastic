export type PackTaxSeed = {
  agencyName: string
  agencyRegistrationHint?: string
  filingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
  /** Headline percent (16 = 16%), stored as fraction when seeded. */
  rates: { name: string; percent: number; appliesTo: 'SALES' | 'PURCHASES' | 'BOTH' }[]
  defaultCodeName: string
  /** When true, seed creates a 0% exempt-style code as the default. */
  exemptDefault?: boolean
}

export type PackEInvoiceConfig = {
  includeLineItems: boolean
  includeTaxSummary: boolean
  /** Extra top-level stub keys (e.g. KE TIMS offline markers). */
  statutoryFields?: Record<string, string | null>
}

export type LocalizationPack = {
  id: string
  country: string
  payrollCsvHeaders: string[]
  eInvoiceFormat: 'json-stub'
  vatJurisdictionLabel: string
  /** Box id → human label for VAT return CSV/JSON. */
  vatBoxLabels: Record<'box1' | 'box2' | 'box3' | 'box4' | 'box5', string>
  taxSeed: PackTaxSeed
  eInvoice: PackEInvoiceConfig
}

const SO_PAYROLL = [
  'periodStart',
  'periodEnd',
  'payslipNumber',
  'employeeCode',
  'employeeName',
  'department',
  'gross',
  'deductions',
  'employer',
  'net',
  'lineCode',
  'lineLabel',
  'lineKind',
  'lineAmount',
] as const

export const LOCALIZATION_PACKS: LocalizationPack[] = [
  {
    id: 'so',
    country: 'SO',
    payrollCsvHeaders: [...SO_PAYROLL],
    eInvoiceFormat: 'json-stub',
    vatJurisdictionLabel: 'Somalia VAT return',
    vatBoxLabels: {
      box1: 'Taxable supplies',
      box2: 'Output VAT',
      box3: 'Taxable purchases',
      box4: 'Input VAT',
      box5: 'Net VAT due',
    },
    taxSeed: {
      agencyName: 'Tax authority',
      filingFrequency: 'MONTHLY',
      rates: [{ name: 'Exempt 0%', percent: 0, appliesTo: 'BOTH' }],
      defaultCodeName: 'Exempt',
      exemptDefault: true,
    },
    eInvoice: {
      includeLineItems: true,
      includeTaxSummary: true,
      statutoryFields: { jurisdiction: 'SO' },
    },
  },
  {
    id: 'ke',
    country: 'KE',
    payrollCsvHeaders: [
      'pay_period_from',
      'pay_period_to',
      'payslip_no',
      'staff_no',
      'full_name',
      'dept',
      'gross_pay',
      'total_deductions',
      'employer_contrib',
      'net_pay',
      'statutory_code',
      'statutory_label',
      'line_type',
      'amount',
    ],
    eInvoiceFormat: 'json-stub',
    vatJurisdictionLabel: 'Kenya VAT return',
    vatBoxLabels: {
      box1: 'Box 1 — Taxable supplies',
      box2: 'Box 2 — Output VAT',
      box3: 'Box 3 — Taxable purchases',
      box4: 'Box 4 — Input VAT',
      box5: 'Box 5 — Net VAT due',
    },
    taxSeed: {
      agencyName: 'KRA',
      agencyRegistrationHint: 'PIN',
      filingFrequency: 'MONTHLY',
      rates: [{ name: 'VAT 16%', percent: 16, appliesTo: 'BOTH' }],
      defaultCodeName: 'Standard',
    },
    eInvoice: {
      includeLineItems: true,
      includeTaxSummary: true,
      statutoryFields: { timsStatus: 'offline', qrPayload: null, invoiceType: 'standard' },
    },
  },
  {
    id: 'et',
    country: 'ET',
    payrollCsvHeaders: [
      'period_from',
      'period_to',
      'payslip_no',
      'employee_id',
      'employee_name',
      'department',
      'gross_pay',
      'total_deductions',
      'employer_contrib',
      'net_pay',
      'line_code',
      'line_label',
      'line_kind',
      'line_amount',
    ],
    eInvoiceFormat: 'json-stub',
    vatJurisdictionLabel: 'Ethiopia VAT return',
    vatBoxLabels: {
      box1: 'Taxable supplies',
      box2: 'Output VAT',
      box3: 'Taxable purchases',
      box4: 'Input VAT',
      box5: 'Net VAT due',
    },
    taxSeed: {
      agencyName: 'MoR / ERCA',
      filingFrequency: 'MONTHLY',
      rates: [{ name: 'VAT 15%', percent: 15, appliesTo: 'BOTH' }],
      defaultCodeName: 'Standard',
    },
    eInvoice: {
      includeLineItems: true,
      includeTaxSummary: true,
      statutoryFields: { jurisdiction: 'ET' },
    },
  },
  {
    id: 'dj',
    country: 'DJ',
    payrollCsvHeaders: [
      'debut_periode',
      'fin_periode',
      'numero_bulletin',
      'code_employe',
      'nom_employe',
      'departement',
      'brut',
      'retenues',
      'employeur',
      'net',
      'code_ligne',
      'libelle_ligne',
      'type_ligne',
      'montant',
    ],
    eInvoiceFormat: 'json-stub',
    vatJurisdictionLabel: 'Djibouti VAT return',
    vatBoxLabels: {
      box1: 'Livraisons taxables',
      box2: 'TVA collectée',
      box3: 'Achats taxables',
      box4: 'TVA déductible',
      box5: 'TVA nette due',
    },
    taxSeed: {
      agencyName: 'DGI',
      filingFrequency: 'MONTHLY',
      rates: [{ name: 'TVA 10%', percent: 10, appliesTo: 'BOTH' }],
      defaultCodeName: 'Standard',
    },
    eInvoice: {
      includeLineItems: true,
      includeTaxSummary: true,
      statutoryFields: { jurisdiction: 'DJ' },
    },
  },
]

export function localizationPackById(id: string | null | undefined): LocalizationPack | null {
  if (!id) return null
  return LOCALIZATION_PACKS.find((p) => p.id === id) ?? null
}

/** Map ISO country → localization pack when the org left the pack blank. */
export function localizationPackIdForCountry(
  country: string | null | undefined,
): LocalizationPack['id'] | null {
  const code = country?.trim().toUpperCase()
  if (!code) return null
  return LOCALIZATION_PACKS.find((pack) => pack.country === code)?.id ?? null
}

export type EInvoiceStubOrg = {
  name: string
  taxRegistrationNumber: string | null
  country: string | null
  localizationPackId: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
}

export type EInvoiceStubInvoice = {
  number: string
  date: string
  customerName: string
  total: string
  currencyCode: string
  subtotal?: string
  taxTotal?: string
  buyerTaxId?: string | null
  buyerCountry?: string | null
  buyerAddress?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    region?: string | null
  }
  lines?: {
    sku: string | null
    description: string
    quantity: string
    unitPrice: string
    net: string
    taxAmount: string
    taxCodeName: string | null
  }[]
}

/** JSON e-invoice stub for statutory export packs (Phase 40 deepen — still not Peppol). */
export function buildEInvoiceStub(org: EInvoiceStubOrg, invoice: EInvoiceStubInvoice): string {
  const pack = localizationPackById(org.localizationPackId)
  const eInvoice = pack?.eInvoice
  const payload: Record<string, unknown> = {
    format: pack?.eInvoiceFormat ?? 'json-stub',
    packId: pack?.id ?? null,
    country: pack?.country ?? org.country,
    ...(pack?.eInvoice.statutoryFields ?? {}),
    supplier: {
      name: org.name,
      taxId: org.taxRegistrationNumber,
      address: {
        line1: org.addressLine1 ?? null,
        line2: org.addressLine2 ?? null,
        city: org.city ?? null,
        region: org.region ?? null,
        postalCode: org.postalCode ?? null,
        country: org.country,
      },
    },
    invoice: {
      number: invoice.number,
      date: invoice.date,
      buyerName: invoice.customerName,
      buyerTaxId: invoice.buyerTaxId ?? null,
      buyerCountry: invoice.buyerCountry ?? null,
      buyerAddress: invoice.buyerAddress ?? null,
      currency: invoice.currencyCode,
      subtotal: invoice.subtotal ?? null,
      taxTotal: invoice.taxTotal ?? null,
      total: invoice.total,
    },
    generatedAt: new Date().toISOString(),
  }

  if (eInvoice?.includeLineItems && invoice.lines) {
    payload.lines = invoice.lines
  }
  if (eInvoice?.includeTaxSummary) {
    const taxTotal = invoice.taxTotal ?? '0'
    const byCode = new Map<string, { net: number; tax: number }>()
    for (const line of invoice.lines ?? []) {
      const key = line.taxCodeName ?? 'untaxed'
      const prev = byCode.get(key) ?? { net: 0, tax: 0 }
      prev.net += Number(line.net) || 0
      prev.tax += Number(line.taxAmount) || 0
      byCode.set(key, prev)
    }
    payload.taxSummary = {
      taxTotal,
      byCode: [...byCode.entries()].map(([code, amounts]) => ({
        taxCode: code,
        net: amounts.net.toFixed(2),
        tax: amounts.tax.toFixed(2),
      })),
    }
  }

  return JSON.stringify(payload, null, 0)
}
