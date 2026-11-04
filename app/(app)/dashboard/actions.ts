'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { HomeKpiKey } from '@/lib/dashboard-prefs'
import { action } from '@/server/action'
import { db } from '@/server/db'

const kpiKey = z.enum(['profitMtd', 'openAr', 'reorder', 'pipeline', 'unpaidAp', 'followUps'])

export const saveDashboardKpiPins = action
  .requires('org:read')
  .input(z.object({ kpiPins: z.array(kpiKey) }))
  .handler(async (ctx, input) => {
    await db.user.update({
      where: { id: ctx.userId },
      data: { dashboardPrefs: { kpiPins: input.kpiPins as HomeKpiKey[] } },
    })
    revalidatePath('/dashboard')
  })
