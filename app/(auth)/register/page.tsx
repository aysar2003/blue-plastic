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

export const metadata: Metadata = { title: 'Create your company' }

/**
 * Self-serve company creation for SOM ERP — each business gets its own company,
 * features, users, and books (international multi-company model).
 */
export default async function RegisterPage() {
  return withDatabasePage(async () => {
    const empty = await needsSetup()
    if (!empty && !isSelfServeEnabled()) {
      redirect('/login/company')
    }

    return (
      <div className="flex w-full max-w-lg flex-col gap-4">
        <Card className="w-full border-border bg-card text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle>Start your company</CardTitle>
            <CardDescription>
              Create a company on {PRODUCT_NAME}. You get a 14-day free trial and can sign in right
              away. After the trial, pay rent from Billing (EVC, Zaad, or bank).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Already have a company?{' '}
          <Link href="/login/company" className="font-medium text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    )
  })
}
