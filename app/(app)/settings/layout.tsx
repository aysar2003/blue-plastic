import { requireOrgContext } from '@/server/auth/context'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOrgContext('org:read')
  return children
}
