import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  Building2Icon,
  DownloadIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { companyGroupLabel } from '@/lib/company-group'
import { formatDate, formatDateTime } from '@/lib/date'
import { ASSIGNABLE_ROLES, membershipStatusLabel, ROLE_LABELS } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as companyAgreementService from '@/server/services/company-agreement.service'
import {
  canManageCompanyUsers,
  getDetail,
} from '@/server/services/company-database.service'

import { CompanyAgreementsPanel } from './company-agreements-panel'
import { CompanyMemberActions } from './company-member-actions'
import { ConnectCompanyButton } from './connect-button'
import { DeleteCompanyButton } from './delete-company-button'
import { InviteCompanyUserDialog } from './invite-company-user-dialog'

export const metadata: Metadata = { title: 'Company database' }

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'SUSPENDED') return 'destructive' as const
  if (status === 'INVITED') return 'warning' as const
  return 'secondary' as const
}

export default async function CompanyDatabasePage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const ctx = await requireOrgContext('org:update')
  const company = await getDetail(ctx, orgId).catch(() => null)
  if (!company) notFound()

  const canManage = canManageCompanyUsers(ctx, company.id)
  const canConnect = company.isCurrent || ctx.canConnect || ctx.isSystemOwner
  const billingRescue =
    company.rentExpired &&
    !company.accessRestricted &&
    (ctx.isSystemOwner || ctx.role === 'OWNER' || ctx.role === 'ADMIN')
  const staffBlocked = company.openBlocked && !ctx.isSystemOwner && !billingRescue
  const agreements = ctx.isSystemOwner
    ? await companyAgreementService.listForCompany(ctx, company.id)
    : []
  const agreementEnded = agreements.some((row) => row.status === 'ENDED')
  const emphasizeDelete = company.rentExpired || agreementEnded

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/databases"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeftIcon />
          Databases
        </Link>
      </div>

      <PageHeader
        title={company.name}
        description={
          company.legalName
            ? `${company.legalName} · ${companyGroupLabel(company.groupKind)} company on SOM ERP`
            : `${companyGroupLabel(company.groupKind)} company on SOM ERP`
        }
        actions={
          <>
            {canConnect ? (
              <ConnectCompanyButton
                orgId={company.id}
                isCurrent={company.isCurrent}
                blocked={staffBlocked}
              />
            ) : null}
            {ctx.isSystemOwner ? (
              <Link
                href={`/databases?limits=${encodeURIComponent(company.id)}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ShieldIcon />
                Limits &amp; apps
              </Link>
            ) : null}
            {company.isCurrent &&
            (ctx.role === 'OWNER' || ctx.role === 'ADMIN' || ctx.isSystemOwner) ? (
              <Link href="/billing" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Billing
              </Link>
            ) : null}
            <a
              href={`/api/backup?orgId=${encodeURIComponent(company.id)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <DownloadIcon />
              Backup
            </a>
            {ctx.isSystemOwner ? (
              <DeleteCompanyButton
                orgId={company.id}
                companyName={company.name}
                emphasize={emphasizeDelete}
              />
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{companyGroupLabel(company.groupKind)}</Badge>
        {company.isCurrent ? <Badge variant="default">Current</Badge> : null}
        {company.accessRestricted ? <Badge variant="destructive">Locked</Badge> : null}
        {company.rentExpired ? <Badge variant="warning">Rent ended</Badge> : null}
        {agreementEnded ? <Badge variant="warning">Agreement ended</Badge> : null}
        {!company.rentExpired && company.onTrial ? (
          <Badge variant="secondary">
            Trial
            {company.daysLeft != null ? ` · ${company.daysLeft}d left` : ''}
          </Badge>
        ) : null}
        {!company.rentExpired && !company.onTrial && company.rentExpiresAt ? (
          <Badge variant="secondary">Rent → {formatDate(company.rentExpiresAt.slice(0, 10))}</Badge>
        ) : null}
      </div>

      {ctx.isSystemOwner ? (
        <CompanyAgreementsPanel orgId={company.id} agreements={agreements} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Building2Icon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Company details</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Name" value={company.name} />
            <Detail label="Legal name" value={company.legalName ?? '—'} />
            <Detail label="Currency" value={company.baseCurrency} />
            <Detail label="Time zone" value={company.timeZone} />
            <Detail
              label="Fiscal year starts"
              value={`Month ${company.fiscalYearStartMonth}`}
            />
            <Detail
              label="Negative stock"
              value={company.allowNegativeStock ? 'Allowed' : 'Blocked'}
            />
            <Detail label="Phone" value={company.phone ?? '—'} />
            <Detail label="Email" value={company.email ?? '—'} />
            <Detail label="Website" value={company.website ?? '—'} />
            <Detail label="Brand mark" value={company.brandMark ?? '—'} />
            <Detail
              label="Owner"
              value={
                company.owner
                  ? `${company.owner.name} · ${company.owner.email}`
                  : '—'
              }
            />
            <Detail
              label="Parent"
              value={
                company.parentOrgId && company.parentName ? (
                  <Link
                    href={`/databases/${company.parentOrgId}`}
                    className="text-primary hover:underline"
                  >
                    {company.parentName}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <Detail
              label="Users"
              value={
                company.maxUsers != null
                  ? `${company.activeUsers} / ${company.maxUsers} active`
                  : `${company.activeUsers} active`
              }
            />
            <Detail
              label="Updated"
              value={formatDateTime(new Date(company.updatedAt), ctx.organization.timeZone)}
            />
            {company.address ? (
              <div className="sm:col-span-2">
                <Detail label="Address" value={<span className="whitespace-pre-line">{company.address}</span>} />
              </div>
            ) : null}
            {company.rentNote ? (
              <div className="sm:col-span-2">
                <Detail label="Rent note" value={company.rentNote} />
              </div>
            ) : null}
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Books snapshot</h2>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              <Count label="Customers" value={company.counts.customers} />
              <Count label="Vendors" value={company.counts.vendors} />
              <Count label="Items" value={company.counts.items} />
              <Count label="Projects" value={company.counts.projects} />
              <Count label="Sales docs" value={company.counts.sales} />
              <Count label="Purchase docs" value={company.counts.purchases} />
            </ul>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Apps granted</h2>
            <div className="flex flex-wrap gap-1.5">
              {company.apps
                .filter((app) => app.on)
                .map((app) => (
                  <span
                    key={app.key}
                    className="rounded-md bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
                  >
                    {app.label}
                  </span>
                ))}
              {company.apps.every((app) => !app.on) ? (
                <p className="text-xs text-muted-foreground">No apps on.</p>
              ) : null}
            </div>
          </Card>

          {company.children.length > 0 ? (
            <Card className="space-y-2 p-4">
              <h2 className="text-sm font-semibold">Sub-companies</h2>
              <ul className="space-y-1.5 text-sm">
                {company.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/databases/${child.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {child.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{child.baseCurrency}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Company users</h2>
              <p className="text-xs text-muted-foreground">
                Staff logins for this company only. Reset password, change role/status, or remove.
              </p>
            </div>
          </div>
          {canManage ? (
            <InviteCompanyUserDialog
              orgId={company.id}
              companyName={company.name}
              roles={[...ASSIGNABLE_ROLES]}
            />
          ) : null}
        </div>

        {company.members.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No users on this company yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connect</TableHead>
                <TableHead>Last signed in</TableHead>
                <TableHead className="w-[1%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {company.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </TableCell>
                  <TableCell>
                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(member.status)}>
                      {membershipStatusLabel(member.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {member.canConnect ? 'Yes' : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {member.user.lastLoginAt
                      ? formatDateTime(new Date(member.user.lastLoginAt), ctx.organization.timeZone)
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <CompanyMemberActions
                      orgId={company.id}
                      membershipId={member.id}
                      userId={member.user.id}
                      role={member.role}
                      status={member.status}
                      name={member.user.name}
                      email={member.user.email}
                      canConnect={member.canConnect}
                      isSelf={member.user.id === ctx.userId}
                      isSystemOwnerUser={member.user.isSystemOwner}
                      canManage={canManage}
                      isSystemOwnerViewer={ctx.isSystemOwner}
                      roles={[...ASSIGNABLE_ROLES]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <li className={cn('rounded-md border bg-muted/30 px-2.5 py-2')}>
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 tabular text-base font-semibold">{value}</p>
    </li>
  )
}
