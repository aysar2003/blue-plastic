'use server'

import { revalidatePath } from 'next/cache'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  beginTotpSetupSchema,
  changePasswordSchema,
  clearDeskPinSchema,
  disableTwoFactorSchema,
  setDeskPinSchema,
  twoFactorCodeOnlySchema,
  updateProfileSchema,
} from '@/lib/validation/user'
import { action } from '@/server/action'
import { requireOrgContext } from '@/server/auth/context'
import * as auth2fa from '@/server/services/auth-2fa.service'
import * as userService from '@/server/services/user.service'
import { isAppError } from '@/server/errors'

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

export const setDeskPin = action.input(setDeskPinSchema).handler(async (ctx, input) => {
  const result = await userService.setDeskPin(ctx, input)
  revalidatePath('/', 'layout')
  revalidatePath('/settings/profile')
  return result
})

export const clearDeskPin = action.input(clearDeskPinSchema).handler(async (ctx, input) => {
  const result = await userService.clearDeskPin(ctx, input)
  revalidatePath('/', 'layout')
  revalidatePath('/settings/profile')
  return result
})

/* --- form adapters ------------------------------------------------------- */

export async function updateProfileForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateProfile(formValues(formData)), 'Profile updated.')
}

export async function changePasswordForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await changePassword(formValues(formData)), 'Password changed.')
}

export async function setDeskPinForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await setDeskPin(formValues(formData)), 'Screen PIN turned on.')
}

export async function clearDeskPinForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await clearDeskPin(formValues(formData)), 'Screen PIN turned off.')
}

export type TotpSetupState = FormState & {
  secret?: string
  otpauthUrl?: string
  qrDataUrl?: string
}

export async function beginTotpSetupForm(
  _prev: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const parsed = beginTotpSetupSchema.safeParse(formValues(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { status: 'error', fieldErrors }
  }
  try {
    const ctx = await requireOrgContext()
    const setup = await auth2fa.beginTotpSetup(ctx.userId, parsed.data.currentPassword)
    revalidatePath('/settings/profile')
    return {
      status: 'success',
      message: 'Scan the QR code in your authenticator app, then enter the verification code.',
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
      qrDataUrl: setup.qrDataUrl,
    }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}

export async function confirmTotpSetupForm(
  _prev: TotpSetupState,
  formData: FormData,
): Promise<TotpSetupState> {
  const parsed = twoFactorCodeOnlySchema.safeParse(formValues(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { status: 'error', fieldErrors }
  }
  try {
    const ctx = await requireOrgContext()
    await auth2fa.confirmTotpSetup(ctx.userId, parsed.data.code)
    revalidatePath('/settings/profile')
    return { status: 'success', message: 'Authenticator is on.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}

export async function disableTotpForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = disableTwoFactorSchema.safeParse(formValues(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { status: 'error', fieldErrors }
  }
  try {
    const ctx = await requireOrgContext()
    await auth2fa.disableTotp(ctx.userId, parsed.data.currentPassword)
    revalidatePath('/settings/profile')
    return { status: 'success', message: 'Authenticator turned off.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}

export async function beginEmailOtpForm(_prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireOrgContext()
    await auth2fa.beginEnableEmailOtp(ctx.userId)
    return { status: 'success', message: 'We sent a code to your email. Enter it below.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}

export async function confirmEmailOtpForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = twoFactorCodeOnlySchema.safeParse(formValues(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { status: 'error', fieldErrors }
  }
  try {
    const ctx = await requireOrgContext()
    await auth2fa.confirmEnableEmailOtp(ctx.userId, parsed.data.code)
    revalidatePath('/settings/profile')
    return { status: 'success', message: 'Email codes are on for sign-in.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}

export async function disableEmailOtpForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = disableTwoFactorSchema.safeParse(formValues(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { status: 'error', fieldErrors }
  }
  try {
    const ctx = await requireOrgContext()
    await auth2fa.disableEmailOtp(ctx.userId, parsed.data.currentPassword)
    revalidatePath('/settings/profile')
    return { status: 'success', message: 'Email codes turned off.' }
  } catch (error) {
    if (isAppError(error)) {
      return { status: 'error', message: error.message, fieldErrors: error.details }
    }
    throw error
  }
}
