import { redirect } from 'next/navigation'

/** Old / mistaken Banking URL — Insurance lives under /insurance/policies. */
export default function BankingInsuranceRedirectPage() {
  redirect('/insurance/policies')
}
