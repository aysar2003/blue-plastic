import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Contact = {
  email?: string | null
  phone?: string | null
  mobile?: string | null
  taxRegistrationNumber?: string | null
  billingLine1?: string | null
  billingLine2?: string | null
  billingCity?: string | null
  billingRegion?: string | null
  billingPostalCode?: string | null
  billingCountry?: string | null
  shippingLine1?: string | null
  shippingCity?: string | null
  shippingPostalCode?: string | null
  notes?: string | null
  shipTos?: { id: string; label: string; line1?: string | null; city?: string | null }[]
}

export function ContactDetail({ contact, side }: { contact: Contact; side: 'customer' | 'vendor' }) {
  const billing = [
    contact.billingLine1,
    contact.billingLine2,
    [contact.billingCity, contact.billingRegion, contact.billingPostalCode].filter(Boolean).join(' '),
    contact.billingCountry,
  ].filter((line) => line && line.trim() !== '')

  const shipping = [
    contact.shippingLine1,
    [contact.shippingCity, contact.shippingPostalCode].filter(Boolean).join(' '),
  ].filter((line) => line && line.trim() !== '')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={contact.email} />
          <Row label="Phone" value={contact.phone} />
          <Row label="Mobile" value={contact.mobile} />
          <Row label="Tax registration" value={contact.taxRegistrationNumber} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Billing</p>
            {billing.length > 0 ? (
              billing.map((line, index) => <p key={index}>{line}</p>)
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          {side === 'customer' ? (
            <div>
              <p className="text-xs text-muted-foreground">Shipping</p>
              {shipping.length > 0 ? (
                shipping.map((line, index) => <p key={index}>{line}</p>)
              ) : (
                <p className="text-muted-foreground">Same as billing</p>
              )}
              {contact.shipTos && contact.shipTos.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Extra ship-to</p>
                  {contact.shipTos.map((row) => (
                    <p key={row.id}>
                      <span className="font-medium">{row.label}</span>
                      {row.line1 ? ` · ${row.line1}` : ''}
                      {row.city ? ` · ${row.city}` : ''}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {contact.notes ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {contact.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? '—'}</span>
    </div>
  )
}
