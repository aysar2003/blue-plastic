'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import { changePasswordSchema, updateProfileSchema } from '@/lib/validation/user'
import { action } from '@/server/action'
import * as userService from '@/server/services/user.service'

export const updateProfile = action
  .input(updateProfileSchema)
  .handler(async (ctx, input) => {
    const user = await userService.updateProfile(ctx, input)
    revalidatePath('/', 'layout')
    return user
  })

export const changePassword = action
  .input(changePasswordSchema)
  .handler((ctx, input) => userService.changePassword(ctx, input))

/* --- form adapters ------------------------------------------------------- */

export async function updateProfileForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateProfile(formValues(formData)), 'Profile updated.')
}

export async function changePasswordForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await changePassword(formValues(formData)), 'Password changed.')
}
