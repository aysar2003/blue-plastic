'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import * as barcodeService from '@/server/services/barcode.service'

export const generateMissingBarcodes = action
  .requires('item:update')
  .handler(async (ctx) => {
    const result = await barcodeService.generateMissing(ctx)
    revalidatePath('/barcodes')
    revalidatePath('/items')
    revalidatePath('/pos')
    return result
  })

export const generateOneBarcode = action
  .requires('item:update')
  .input(z.object({ id: cuid, replace: z.boolean().optional() }))
  .handler(async (ctx, input) => {
    const result = await barcodeService.generateOne(ctx, input.id, input.replace ?? false)
    revalidatePath('/barcodes')
    revalidatePath('/items')
    revalidatePath('/pos')
    return result
  })
