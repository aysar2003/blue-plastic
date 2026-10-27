'use server'

import {
  documentEmailSignatureHtml,
  documentEmailSignatureText,
  plainBodyToHtml,
} from '@/lib/document-email'
import { sendDocumentEmailSchema } from '@/lib/validation/organization'
import { action } from '@/server/action'
import { validation } from '@/server/errors'
import * as mailService from '@/server/services/mail.service'

/** Status for the Email dialog — any signed-in company user. */
export const getOutboundMailStatus = action.handler(async (ctx) => {
  return mailService.getOutboundSettings(ctx)
})

export const sendDocumentEmail = action
  .input(sendDocumentEmailSchema)
  .handler(async (ctx, input) => {
    const content = Buffer.from(input.contentBase64, 'base64')
    if (content.length < 20) {
      throw validation('Attachment is empty.')
    }
    if (content.length > 8_000_000) {
      throw validation('Attachment is too large to email (max about 6 MB).')
    }

    const userMessage =
      input.body.trim() ||
      `Please find your ${input.filename} attached.`
    const signatureText = documentEmailSignatureText({
      senderName: ctx.user.name,
      role: ctx.role,
      organization: ctx.organization,
    })
    const signatureHtml = documentEmailSignatureHtml({
      senderName: ctx.user.name,
      role: ctx.role,
      organization: ctx.organization,
    })

    const text = `${userMessage}\n\n${signatureText}`
    const html = `${plainBodyToHtml(userMessage)}${signatureHtml}`

    return mailService.sendOrgMail(ctx, {
      to: input.to,
      subject: input.subject,
      text,
      html,
      fromName: ctx.user.name,
      attachments: [
        {
          filename: input.filename,
          content,
          contentType: input.contentType,
        },
      ],
    })
  })
