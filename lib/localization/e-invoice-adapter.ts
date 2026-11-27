/**
 * Pluggable e-invoice builders (Wave G). Default remains json-stub — no Peppol,
 * no live eTIMS submit. Adapters only shape the download payload.
 */
import {
  buildEInvoiceStub,
  localizationPackById,
  type EInvoiceStubInvoice,
  type EInvoiceStubOrg,
} from '@/lib/localization/packs'

export type EInvoiceAdapter = {
  packId: string | null
  contentType: 'application/json'
  /** Still offline — adapters never call government portals. */
  mode: 'stub' | 'tims-shaped' | 'et-shaped'
  build(org: EInvoiceStubOrg, invoice: EInvoiceStubInvoice): string
}

function defaultAdapter(packId: string | null): EInvoiceAdapter {
  return {
    packId,
    contentType: 'application/json',
    mode: 'stub',
    build: (org, invoice) => buildEInvoiceStub(org, invoice),
  }
}

function keTimsShapedAdapter(): EInvoiceAdapter {
  return {
    packId: 'ke',
    contentType: 'application/json',
    mode: 'tims-shaped',
    build(org, invoice) {
      const base = JSON.parse(buildEInvoiceStub(org, invoice)) as Record<string, unknown>
      return JSON.stringify(
        {
          ...base,
          adapter: 'ke-tims-shaped',
          submission: {
            channel: 'offline-stub',
            // Live eTIMS integrator would replace this block.
            status: base.timsStatus ?? 'offline',
            qrPayload: base.qrPayload ?? null,
          },
        },
        null,
        2,
      )
    },
  }
}

function etShapedAdapter(): EInvoiceAdapter {
  return {
    packId: 'et',
    contentType: 'application/json',
    mode: 'et-shaped',
    build(org, invoice) {
      const base = JSON.parse(buildEInvoiceStub(org, invoice)) as Record<string, unknown>
      return JSON.stringify(
        {
          ...base,
          adapter: 'et-directive-shaped',
          submission: {
            channel: 'offline-stub',
            // Directive 1142 middleware would sign + submit here.
            status: 'offline',
            authority: 'MoR',
          },
        },
        null,
        2,
      )
    },
  }
}

export function eInvoiceAdapterFor(packId: string | null | undefined): EInvoiceAdapter {
  const id = packId ?? localizationPackById(null)?.id ?? null
  if (id === 'ke') return keTimsShapedAdapter()
  if (id === 'et') return etShapedAdapter()
  return defaultAdapter(id)
}

export function buildEInvoicePayload(
  org: EInvoiceStubOrg,
  invoice: EInvoiceStubInvoice,
): { json: string; contentType: string; mode: EInvoiceAdapter['mode'] } {
  const adapter = eInvoiceAdapterFor(org.localizationPackId)
  return {
    json: adapter.build(org, invoice),
    contentType: adapter.contentType,
    mode: adapter.mode,
  }
}
