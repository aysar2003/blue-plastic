'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/** Pin a report URL under Custom reports (memorized preset). */
export async function memorizeReport(input: {
  label: string
  href: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireOrgContext('report:read')
    const label = input.label.trim().slice(0, 120)
    const href = input.href.trim().slice(0, 2000)
    if (!label || !href.startsWith('/reports')) {
      return { ok: false, error: 'Only report pages can be memorized.' }
    }

    await db.workspaceBookmark.upsert({
      where: {
        orgId_userId_href_kind: {
          orgId: ctx.orgId,
          userId: ctx.userId,
          href,
          kind: 'memorized-report',
        },
      },
      create: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        label,
        href,
        kind: 'memorized-report',
        sort: 0,
      },
      update: { label },
    })

    revalidatePath('/reports/custom')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not memorize this report.' }
  }
}

export async function forgetMemorizedReport(href: string): Promise<void> {
  const ctx = await requireOrgContext('report:read')
  await db.workspaceBookmark.deleteMany({
    where: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      href,
      kind: 'memorized-report',
    },
  })
  revalidatePath('/reports/custom')
}
