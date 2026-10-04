import { redirect } from 'next/navigation'

/** Older links open inside the customer centre, with the list still on the left. */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/customers?id=${encodeURIComponent(id)}`)
}
