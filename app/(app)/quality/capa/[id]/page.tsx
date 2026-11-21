import type { Metadata } from 'next'
import Link from 'next/link'

import { setCapaStatusAction, updateCapaAction } from '@/app/(app)/quality/capa/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { canCloseCapa, type CapaStatus } from '@/lib/erp/capa'
import { toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as capaService from '@/server/services/capa.service'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ close?: string }>
}

export default async function CapaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const ctx = await requireOrgContext('audit:read')
  const note = await capaService.get(ctx, id)
  const canEdit = ctx.permissions.has('docs:update')
  const showClose = query.close === '1' || query.close === 'true'
  const [members, vendors] = await Promise.all([
    db.membership.findMany({
      where: { orgId: ctx.orgId },
      select: { user: { select: { id: true, name: true } } },
      take: 100,
    }),
    db.vendor.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 300,
    }),
  ])

  return (
    <>
      <PageHeader
        title={`${note.number} · ${note.title}`}
        description={note.status}
        actions={
          <Link href="/quality/capa" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back
          </Link>
        }
      />
      <Card>
        <CardContent className="space-y-4 p-4 text-sm">
          {note.body ? <p className="whitespace-pre-wrap">{note.body}</p> : null}
          {note.rootCause ? <p>Root cause: {note.rootCause}</p> : null}
          {note.owner ? <p>Owner: {note.owner.name}</p> : null}
          {note.dueDate ? <p>Due: {toCalendarDate(note.dueDate)}</p> : null}
          {note.effectivenessDate ? <p>Effectiveness: {toCalendarDate(note.effectivenessDate)}</p> : null}
          {note.vendor ? <p>Vendor: {note.vendor.displayName}</p> : null}
          {note.lotNumber ? <p>Lot: {note.lotNumber}</p> : null}
          {note.workspaceDocument ? <p>File: {note.workspaceDocument.title}</p> : null}
          {note.signRequest ? (
            <p>
              Sign: {note.signRequest.title} ({note.signRequest.status})
            </p>
          ) : null}

          {canEdit ? (
            <form action={updateCapaAction} className="grid gap-2 border-t pt-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={note.id} />
              <Input name="title" defaultValue={note.title} required />
              <Input name="body" defaultValue={note.body ?? ''} placeholder="Details" />
              <NativeSelect name="ownerId" defaultValue={note.ownerId ?? ''}>
                <option value="">Owner</option>
                {members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </NativeSelect>
              <Input
                name="dueDate"
                type="date"
                defaultValue={note.dueDate ? toCalendarDate(note.dueDate) : ''}
              />
              <Input name="rootCause" defaultValue={note.rootCause ?? ''} placeholder="Root cause" />
              <Input
                name="effectivenessDate"
                type="date"
                defaultValue={note.effectivenessDate ? toCalendarDate(note.effectivenessDate) : ''}
              />
              <NativeSelect name="vendorId" defaultValue={note.vendorId ?? ''}>
                <option value="">Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.displayName}
                  </option>
                ))}
              </NativeSelect>
              <Input name="lotNumber" defaultValue={note.lotNumber ?? ''} placeholder="Lot / batch" />
              <div>
                <Button type="submit" size="sm" variant="outline">
                  Save CAPA
                </Button>
              </div>
            </form>
          ) : null}

          {canEdit ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {note.status === 'OPEN' ? (
                <form action={setCapaStatusAction}>
                  <input type="hidden" name="id" value={note.id} />
                  <input type="hidden" name="status" value="IN_PROGRESS" />
                  <input type="hidden" name="returnTo" value={`/quality/capa/${note.id}`} />
                  <Button type="submit" size="sm" variant="outline">
                    Mark in progress
                  </Button>
                </form>
              ) : null}
              {canCloseCapa(note.status as CapaStatus) && note.status !== 'CLOSED' ? (
                <form action={setCapaStatusAction} className="w-full max-w-md space-y-2">
                  <input type="hidden" name="id" value={note.id} />
                  <input type="hidden" name="status" value="CLOSED" />
                  <input type="hidden" name="returnTo" value="/quality/capa" />
                  <Label htmlFor="closeNote">Closing note (required)</Label>
                  <Input
                    id="closeNote"
                    name="closeNote"
                    required
                    defaultValue={showClose ? '' : undefined}
                    placeholder="What was done to resolve this?"
                  />
                  <Label htmlFor="effectivenessDate">Effectiveness date</Label>
                  <Input id="effectivenessDate" name="effectivenessDate" type="date" />
                  <Button type="submit" size="sm">
                    Close CAPA
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `CAPA ${id.slice(0, 8)}` }
}