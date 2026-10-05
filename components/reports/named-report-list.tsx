import Link from 'next/link'

/** Two columns of report names, the same shape as the favourites list. */
export function NamedReportList({ reports }: { reports: { label: string; href: string }[] }) {
  const midpoint = Math.ceil(reports.length / 2)
  const columns = [reports.slice(0, midpoint), reports.slice(midpoint)]

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid md:grid-cols-2">
        {columns.map((column, index) => (
          <ul key={index} className={index === 0 ? 'md:border-r' : undefined}>
            {column.map((report) => (
              <li key={report.href + report.label} className="border-b px-4 py-2.5 last:border-b-0">
                <Link href={report.href} className="text-sm hover:text-primary hover:underline">
                  {report.label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
