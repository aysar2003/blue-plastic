import 'server-only'

import { db } from '@/server/db'
import { validation } from '@/server/errors'

export async function createLead(input: {
  name: string
  email: string
  phone?: string | null
  companyName?: string | null
  message?: string | null
}) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) throw validation('Name is required.', { name: ['Required.'] })
  if (!email || !email.includes('@')) {
    throw validation('A valid email is required.', { email: ['Required.'] })
  }

  const row = await db.marketingLead.create({
    data: {
      name: name.slice(0, 120),
      email: email.slice(0, 200),
      phone: input.phone?.trim().slice(0, 40) || null,
      companyName: input.companyName?.trim().slice(0, 200) || null,
      message: input.message?.trim().slice(0, 2000) || null,
    },
    select: { id: true },
  })

  return row
}
