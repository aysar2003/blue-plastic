import { Decimal, toMoneyString, ZERO } from '@/lib/money'

export type Candle = {
  key: string
  open: string
  high: string
  low: string
  close: string
}

export type AnalyticsMetric = {
  label: string
  value: string
  unit: 'money' | 'count' | 'percent'
  prior?: string
  changePercent?: string | null
}

export type AnalyticsBrief = {
  version: 1
  generatedAt: string
  org: { id: string; name: string; currency: string; timeZone: string }
  period: { month: string; from: string; to: string; label: string }
  summary: string
  narrative: {
    profit: string
    cash: string
    sales: string
    receivables: string
    spending: string
  }
  highlights: { id: string; title: string; detail: string; metricKey?: string }[]
  risks: { id: string; severity: 'low' | 'medium' | 'high'; title: string; detail: string }[]
  actions: { id: string; title: string; detail: string; href?: string }[]
  metrics: Record<string, AnalyticsMetric>
  series: {
    cashMonths: { label: string; amount: string }[]
    salesDays: { day: string; amount: string }[]
    candlesDaily: Candle[]
    candlesWeekly: Candle[]
  }
  charts: {
    id: string
    title: string
    caption: string
    type: 'bars' | 'line' | 'candles' | 'share'
  }[]
}

/** ISO week key YYYY-Www from a calendar date. */
export function isoWeekKey(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`)
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Turn a ordered daily total series into OHLC candles.
 * Open = prior close (0 on first day); close = day total; high/low = max/min of open & close.
 */
export function dailyCandlesFromTotals(
  days: readonly { day: string; amount: string }[],
): Candle[] {
  let prior = ZERO
  return days.map((row) => {
    const close = new Decimal(row.amount)
    const open = prior
    const high = Decimal.max(open, close)
    const low = Decimal.min(open, close)
    prior = close
    return {
      key: row.day,
      open: toMoneyString(open, 2),
      high: toMoneyString(high, 2),
      low: toMoneyString(low, 2),
      close: toMoneyString(close, 2),
    }
  })
}

/** Aggregate daily closes into weekly OHLC candles. */
export function weeklyCandlesFromDaily(daily: readonly Candle[]): Candle[] {
  const groups = new Map<string, Candle[]>()
  for (const candle of daily) {
    const week = isoWeekKey(candle.key)
    const list = groups.get(week) ?? []
    list.push(candle)
    groups.set(week, list)
  }
  return [...groups.entries()].map(([week, rows]) => {
    const open = new Decimal(rows[0]!.open)
    const close = new Decimal(rows[rows.length - 1]!.close)
    let high = open
    let low = open
    for (const row of rows) {
      high = Decimal.max(high, new Decimal(row.high))
      low = Decimal.min(low, new Decimal(row.low))
    }
    return {
      key: week,
      open: toMoneyString(open, 2),
      high: toMoneyString(high, 2),
      low: toMoneyString(low, 2),
      close: toMoneyString(close, 2),
    }
  })
}

function moneyLabel(value: string, currency: string) {
  return `${currency} ${value}`
}

function changeWords(change: string | null | undefined, priorLabel: string) {
  if (change == null) return `no ${priorLabel} to compare`
  const n = Number(change)
  if (n === 0) return `flat vs ${priorLabel}`
  return `${n > 0 ? 'up' : 'down'} ${Math.abs(n)}% vs ${priorLabel}`
}

export function buildAnalyticsBrief(input: {
  org: AnalyticsBrief['org']
  period: AnalyticsBrief['period']
  currency: string
  profit: { net: string; income: string; expenses: string; change: string | null }
  bankTotal: string
  cashMonths: { label: string; amount: string }[]
  invoices: { unpaid: string; overdue: string; paid: string }
  spending: { total: string; costOfSales: string; other: string; change: string | null }
  sales: { total: string; days: { day: string; amount: string }[] }
  candlesDaily: Candle[]
  candlesWeekly: Candle[]
  generatedAt?: string
}): AnalyticsBrief {
  const unpaid = new Decimal(input.invoices.unpaid)
  const overdue = new Decimal(input.invoices.overdue)
  const overdueShare = unpaid.isZero()
    ? '0'
    : overdue.dividedBy(unpaid).times(100).toDecimalPlaces(0).toString()
  const peakCash = input.cashMonths.reduce(
    (best, row) => (Math.abs(Number(row.amount)) > Math.abs(Number(best.amount)) ? row : best),
    input.cashMonths[0] ?? { label: '—', amount: '0.00' },
  )
  const weakCash = [...input.cashMonths]
    .filter((row) => Number(row.amount) < 0)
    .sort((a, b) => Number(a.amount) - Number(b.amount))[0]

  const priorLabel = 'prior period'

  const narrative = {
    profit: `Net profit for ${input.period.label} is ${moneyLabel(input.profit.net, input.currency)} (${changeWords(input.profit.change, priorLabel)}), on income ${moneyLabel(input.profit.income, input.currency)} and expenses ${moneyLabel(input.profit.expenses, input.currency)}.`,
    cash: `Bank and undeposited funds total ${moneyLabel(input.bankTotal, input.currency)}. Strongest cash month movement this year: ${peakCash.label} at ${moneyLabel(peakCash.amount, input.currency)}.${weakCash ? ` Weakest outflow month: ${weakCash.label} (${moneyLabel(weakCash.amount, input.currency)}).` : ''}`,
    sales: `Sales for ${input.period.label} total ${moneyLabel(input.sales.total, input.currency)} across ${input.sales.days.length} active day${input.sales.days.length === 1 ? '' : 's'}. Candles show day-to-day closes so models can read momentum without raw ledgers.`,
    receivables: `Customers still owe ${moneyLabel(input.invoices.unpaid, input.currency)}; overdue share is ${overdueShare}% (${moneyLabel(input.invoices.overdue, input.currency)}). Collections this period: ${moneyLabel(input.invoices.paid, input.currency)}.`,
    spending: `Spending is ${moneyLabel(input.spending.total, input.currency)} (${changeWords(input.spending.change, priorLabel)}): cost of sales ${moneyLabel(input.spending.costOfSales, input.currency)}, other ${moneyLabel(input.spending.other, input.currency)}.`,
  }

  const highlights: AnalyticsBrief['highlights'] = [
    {
      id: 'profit',
      title: `Profit · ${input.period.label}`,
      detail: narrative.profit,
      metricKey: 'profitNet',
    },
    {
      id: 'sales',
      title: 'Sales momentum',
      detail: narrative.sales,
      metricKey: 'salesTotal',
    },
  ]
  if (Number(input.bankTotal) > 0) {
    highlights.push({
      id: 'cash',
      title: 'Cash on hand',
      detail: narrative.cash,
      metricKey: 'bankTotal',
    })
  }

  const risks: AnalyticsBrief['risks'] = []
  const overduePct = Number(overdueShare)
  if (overduePct >= 40) {
    risks.push({
      id: 'ar-overdue',
      severity: 'high',
      title: 'High overdue receivables',
      detail: `${overdueShare}% of open AR is overdue (${moneyLabel(input.invoices.overdue, input.currency)}). Prioritise collection calls.`,
    })
  } else if (overduePct >= 20) {
    risks.push({
      id: 'ar-overdue',
      severity: 'medium',
      title: 'Rising overdue share',
      detail: `${overdueShare}% of open AR is overdue. Watch aging before month close.`,
    })
  }
  if (Number(input.profit.net) < 0) {
    risks.push({
      id: 'loss',
      severity: 'high',
      title: 'Loss this period',
      detail: `Net is negative at ${moneyLabel(input.profit.net, input.currency)}. Review expenses and margin.`,
    })
  }
  if (weakCash && Number(weakCash.amount) < 0) {
    risks.push({
      id: 'cash-outflow',
      severity: 'low',
      title: `Cash outflow in ${weakCash.label}`,
      detail: `Largest negative cash movement was ${moneyLabel(weakCash.amount, input.currency)} in ${weakCash.label}.`,
    })
  }

  const actions: AnalyticsBrief['actions'] = [
    {
      id: 'ar',
      title: 'Review who still owes',
      detail: 'Open AR aging and chase overdue invoices.',
      href: '/reports/ar-aging',
    },
    {
      id: 'pnl',
      title: 'Open profit and loss',
      detail: 'Drill into income and expense lines for this month.',
      href: `/reports/profit-loss?period=custom&from=${input.period.from}&to=${input.period.to}`,
    },
  ]
  if (Number(input.sales.total) > 0) {
    actions.push({
      id: 'sales',
      title: 'Check sales documents',
      detail: 'Confirm invoices and receipts match the candle closes.',
      href: '/sales/invoices?status=open',
    })
  }

  const summary = [
    narrative.profit,
    Number(overdueShare) > 0
      ? `Overdue AR is ${overdueShare}% of what customers still owe.`
      : 'No overdue AR flagged in this snapshot.',
    `Sales closed the period at ${moneyLabel(input.sales.total, input.currency)}.`,
  ].join(' ')

  return {
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    org: input.org,
    period: input.period,
    summary,
    narrative,
    highlights,
    risks,
    actions,
    metrics: {
      profitNet: {
        label: 'Profit',
        value: input.profit.net,
        unit: 'money',
        changePercent: input.profit.change,
      },
      income: { label: 'Income', value: input.profit.income, unit: 'money' },
      expenses: { label: 'Expenses', value: input.profit.expenses, unit: 'money' },
      salesTotal: { label: 'Sales', value: input.sales.total, unit: 'money' },
      bankTotal: { label: 'Bank total', value: input.bankTotal, unit: 'money' },
      openAr: { label: 'Customers still owe', value: input.invoices.unpaid, unit: 'money' },
      overdueAr: { label: 'Overdue AR', value: input.invoices.overdue, unit: 'money' },
      overdueShare: { label: 'Overdue share', value: overdueShare, unit: 'percent' },
      collected: { label: 'Collected this period', value: input.invoices.paid, unit: 'money' },
      spendingTotal: {
        label: 'Spending',
        value: input.spending.total,
        unit: 'money',
        changePercent: input.spending.change,
      },
      costOfSales: { label: 'Cost of sales', value: input.spending.costOfSales, unit: 'money' },
      otherSpend: { label: 'Other spending', value: input.spending.other, unit: 'money' },
    },
    series: {
      cashMonths: input.cashMonths,
      salesDays: input.sales.days,
      candlesDaily: input.candlesDaily,
      candlesWeekly: input.candlesWeekly,
    },
    charts: [
      {
        id: 'candles',
        title: 'Sales candles',
        caption:
          'Each candle is a day or week of sales: body from open to close, wick from low to high. Green means close ≥ open; red means close < open.',
        type: 'candles',
      },
      {
        id: 'cash',
        title: 'Cash movement',
        caption: 'Monthly net movement through bank and undeposited funds for the calendar year.',
        type: 'bars',
      },
      {
        id: 'sales-line',
        title: 'Daily sales',
        caption: 'Day-by-day sales totals for the selected month — the same series behind the candles.',
        type: 'line',
      },
      {
        id: 'spend',
        title: 'Spending mix',
        caption: 'How this month’s spending splits between cost of sales and other expenses.',
        type: 'share',
      },
    ],
  }
}
