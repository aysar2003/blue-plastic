import { redirect } from 'next/navigation'

/** Databases moved to its own app. Keep this path for old bookmarks. */
export default function BackupPage() {
  redirect('/databases')
}
