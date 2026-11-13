'use client'

import { useState } from 'react'

import { INCOME_COLOR, EXPENSE_COLOR } from '@/components/reports/figure-chart'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Candle } from '@/lib/analytics-brief'

export function SalesCandles({
  daily,
  weekly,
  currency,
}: {
  daily: Candle[]
  weekly: Candle[]
  currency: string
}) {
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily')
  const candles = mode === 'daily' ? daily : weekly

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {(['daily', 'weekly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              mode === value
                ? 'bg-foreground text-background'
                : 'bg-muted/70 text-muted-foreground hover:text-foreground',
            )}
          >
            {value === 'daily' ? 'Daily' : 'Weekly'}
          </button>
        ))}
      </div>
      <CandlePlot candles={candles} currency={currency} mode={mode} />
    </div>
  )
}

function CandlePlot({
  candles,
  currency,
  mode,
}: {
  candles: Candle[]
  currency: string
  mode: 'daily' | 'weekly'
}) {
  if (candles.length === 0) {
    return (
      <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No sales candles for this period.
      </p>
    )
  }

  const width = 640
  const height = 250
  const padX = 22
  const padTop = 14
  const volH = 36
  const padBottom = 28 + volH
  const plotH = height - padTop - padBottom
  const plotW = width - padX * 2
  const highs = candles.map((c) => Number(c.high))
  const lows = candles.map((c) => Number(c.low))
  const closes = candles.map((c) => Number(c.close))
  const max = Math.max(...highs, 1)
  const min = Math.min(...lows, 0)
  const span = Math.max(max - min, 1)
  const volPeak = Math.max(1, ...closes.map((v) => Math.abs(v)))
  const yAt = (value: number) => padTop + ((max - value) / span) * plotH
  const slot = plotW / candles.length
  const bodyW = Math.min(16, Math.max(4, slot * 0.5))
  const volTop = height - padBottom + 8

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${mode} sales candlesticks`}
      className="h-60 w-full text-muted-foreground"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padTop + plotH * t
        return (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="3 4"
          />
        )
      })}
      {candles.map((candle, index) => {
        const open = Number(candle.open)
        const close = Number(candle.close)
        const high = Number(candle.high)
        const low = Number(candle.low)
        const up = close >= open
        const color = up ? INCOME_COLOR : EXPENSE_COLOR
        const cx = padX + slot * index + slot / 2
        const yOpen = yAt(open)
        const yClose = yAt(close)
        const yHigh = yAt(high)
        const yLow = yAt(low)
        const bodyTop = Math.min(yOpen, yClose)
        const bodyH = Math.max(Math.abs(yClose - yOpen), 2)
        const volBar = Math.max(2, (Math.abs(close) / volPeak) * (volH - 6))
        const label =
          mode === 'daily' ? candle.key.slice(8) : candle.key.replace(/^\d{4}-/, '')

        return (
          <g key={candle.key} className="analytics-bar-rise" style={{ animationDelay: `${index * 20}ms` }}>
            <title>
              {`${candle.key}: O ${formatMoney(candle.open, currency)} H ${formatMoney(candle.high, currency)} L ${formatMoney(candle.low, currency)} C ${formatMoney(candle.close, currency)}`}
            </title>
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth="1.6" />
            <rect
              x={cx - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              rx="2"
              fill={color}
              opacity={up ? 0.95 : 0.8}
            />
            <rect
              x={cx - bodyW / 2}
              y={volTop + (volH - 6 - volBar)}
              width={bodyW}
              height={volBar}
              rx="1.5"
              fill={color}
              opacity="0.35"
            />
            {(index === 0 ||
              index === candles.length - 1 ||
              index % Math.ceil(candles.length / 6) === 0) && (
              <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor">
                {label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
