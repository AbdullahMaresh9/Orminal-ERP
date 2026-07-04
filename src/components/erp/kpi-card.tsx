'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  delta?: number // percentage change, e.g. +12.5 or -5
  deltaLabel?: string
  icon?: React.ReactNode
  accent?: 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'teal'
}

const ACCENTS: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200/60 dark:ring-emerald-900' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200/60 dark:ring-amber-900' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200/60 dark:ring-rose-900' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200/60 dark:ring-violet-900' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-200/60 dark:ring-sky-900' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-200/60 dark:ring-teal-900' },
}

export function KpiCard({ title, value, delta, deltaLabel, icon, accent = 'emerald' }: KpiCardProps) {
  const a = ACCENTS[accent]
  const isUp = (delta ?? 0) > 0
  const isDown = (delta ?? 0) < 0
  const isFlat = (delta ?? 0) === 0
  return (
    <Card className="p-5 gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        </div>
        {icon && (
          <div className={cn('shrink-0 size-10 rounded-xl flex items-center justify-center ring-1', a.bg, a.text, a.ring)}>
            {icon}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md',
              isUp && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
              isDown && 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
              isFlat && 'bg-muted text-muted-foreground'
            )}
          >
            {isUp && <ArrowUpRight className="size-3" />}
            {isDown && <ArrowDownRight className="size-3" />}
            {isFlat && <Minus className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  )
}
