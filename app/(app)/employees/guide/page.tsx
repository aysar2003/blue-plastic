import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Employees guide' }

export default async function EmployeesGuidePage() {
  await requireOrgContext('hr:read')

  return (
    <>
      <PageHeader
        title="Guide"
        description="Sida Employees / Leave / Attendance / Payroll / Settings / Budget / Policies u shaqeeyaan."
      />
      <div className="prose prose-sm dark:prose-invert max-w-3xl space-y-8 text-foreground">
        <section className="space-y-2">
          <h2 className="text-base font-semibold">1. Directory (employee card)</h2>
          <p className="text-muted-foreground">
            Qofka shirkadda: magac, job, manager, cinwaan, emergency, skills, iyo{' '}
            <strong className="text-foreground">Wage</strong> (Monthly / Daily / Hourly + expense account).
          </p>
          <p>
            <Link href="/employees" className="text-primary hover:underline">
              Fur Directory →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">2. Settings (saacad & OT)</h2>
          <p className="text-muted-foreground">
            Hours/day, work days/week, overtime after hours, overtime multiplier. Hourly payroll iyo unpaid leave →
            hours conversion waxay ka akhriyaan halkan.
          </p>
          <p>
            <Link href="/employees/settings" className="text-primary hover:underline">
              Fur Settings →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">3. Contracts</h2>
          <p className="text-muted-foreground">
            Heshiis + PDF. <strong className="text-foreground">Open + sync wage</strong> → employee card.
          </p>
          <p>
            <Link href="/employees/contracts" className="text-primary hover:underline">
              Fur Contracts →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">4. Leave</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Leave type (paid / unpaid).</li>
            <li>Allocation → request → approve.</li>
            <li>Unpaid leave waxay saamaysaa payroll (monthly lacag; hourly saacado).</li>
          </ol>
          <p>
            <Link href="/employees/leave" className="text-primary hover:underline">
              Fur Leave →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">5. Attendance & Devices</h2>
          <p className="text-muted-foreground">
            Manual check-in/out ama hours. Devices (fingerprint clocks): register → map badge → POST punches to{' '}
            <code className="text-foreground">/api/attendance/punches</code> (Bearer token). Kinds: Generic HTTP,
            ZKTeco, Anviz, Other.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link href="/employees/attendance" className="text-primary hover:underline">
              Fur Attendance →
            </Link>
            <Link href="/employees/attendance/devices" className="text-primary hover:underline">
              Fur Devices →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">6. Payroll (xisaabinta)</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Monthly:</strong> mushahar − unpaid leave (maalmo × daily rate).
            </li>
            <li>
              <strong className="text-foreground">Daily:</strong> wage × (attendance days − unpaid days).
            </li>
            <li>
              <strong className="text-foreground">Hourly:</strong> attendance hours − (unpaid days × hours/day);
              regular vs OT from Settings (after hours/day × multiplier).
            </li>
          </ul>
          <p>
            <Link href="/employees/payroll" className="text-primary hover:underline">
              Fur Payroll →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">7. Budget (sanad / bil)</h2>
          <p className="text-muted-foreground">
            Planned wage + headcount 12 months. Ma aha Accounting Budget (ledger) — midkan waa HR plan.
          </p>
          <p>
            <Link href="/employees/budget" className="text-primary hover:underline">
              Fur Budget →
            </Link>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">8. Policies (siyasada shirkadda)</h2>
          <p className="text-muted-foreground">Qoraal + PDF optional. Publish marka shaqaalaha arkaan.</p>
          <p>
            <Link href="/employees/policies" className="text-primary hover:underline">
              Fur Policies →
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}