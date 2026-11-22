import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { withDatabasePage } from '@/lib/page-guard'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { isSelfServeEnabled } from '@/lib/self-serve'
import { needsSetup } from '@/server/services/setup.service'
import { RegisterForm } from './register-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Create your organisation' }

/**
 * Self-serve organisation creation for SOM ERP — each school, shop, hospital, or
 * firm gets its own workspace, features, users, and books.
 */
export default async function RegisterPage() {
  return withDatabasePage(async () => {
    const empty = await needsSetup()
    if (!empty && !isSelfServeEnabled()) {
      redirect('/login/company')
    }

    return (
      <div className="flex w-full max-w-xl flex-col gap-4">
        <Card className="w-full border-border bg-card text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle>Start your organisation</CardTitle>
            <CardDescription>
              Tell us what you do — {PRODUCT_NAME} sets up the right workspace (school, shop,
              hospital, and more). 14-day free trial; pay rent later from Billing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login/company" className="font-medium text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    )
  })
}
