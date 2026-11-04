import { redirect } from 'next/navigation'

/** User-manual and bookmarks use /settings/trash; the list lives at activity. */
export default function TrashAliasPage() {
  redirect('/settings/activity')
}
