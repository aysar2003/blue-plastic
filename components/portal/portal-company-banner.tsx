import Image from 'next/image'

import { resolveBrandMark } from '@/lib/org-brand'
import { PRODUCT_NAME } from '@/lib/product-brand'

export type PortalCompanyBannerProps = {
  name?: string | null
  legalName?: string | null
  brandMark?: string | null
  hasLogo?: boolean
  orgId?: string | null
  logoVersion?: Date | number | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  /** Show address / phone under the title (accept + login). */
  showDetails?: boolean
}

function addressLines(company: PortalCompanyBannerProps): string[] {
  return [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.region, company.postalCode].filter(Boolean).join(', ') || null,
    company.country,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

export function PortalCompanyBanner(company: PortalCompanyBannerProps) {
  const name = company.name?.trim() || PRODUCT_NAME
  const mark = resolveBrandMark(company.brandMark, name)
  const logoSrc =
    company.hasLogo && company.orgId
      ? `/api/portal/logo?company=${encodeURIComponent(company.orgId)}&v=${
          company.logoVersion instanceof Date
            ? company.logoVersion.getTime()
            : (company.logoVersion ?? 0)
        }`
      : null
  const lines = company.showDetails ? addressLines(company) : []

  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      {logoSrc ? (
        <Image
          src={logoSrc}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="size-16 rounded-md object-contain"
        />
      ) : (
        <div className="grid size-14 place-items-center rounded-md bg-primary text-sm font-bold tracking-wide text-primary-foreground">
          {mark}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Customer portal
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        {company.legalName && company.legalName !== name ? (
          <p className="text-sm text-muted-foreground">{company.legalName}</p>
        ) : null}
      </div>
      {company.showDetails && (lines.length > 0 || company.phone || company.email) ? (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {company.phone ? <p>{company.phone}</p> : null}
          {company.email ? <p>{company.email}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
