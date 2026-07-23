'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  delta?: number
  deltaLabel?: string
  icon?: React.ReactNode
  accent?: 'blue' | 'amber' | 'rose' | 'violet' | 'sky'
}

const ACCENTS: Record<string, { bg: string; text: string; ring: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200/50 dark:ring-blue-800/50' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200/50 dark:ring-amber-800/50' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200/50 dark:ring-rose-800/50' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200/50 dark:ring-violet-800/50' },
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-200/50 dark:ring-sky-800/50' },
}

export function KpiCard({ title, value, delta, deltaLabel, icon, accent = 'blue' }: KpiCardProps) {
  const a = ACCENTS[accent]
  const isUp = (delta ?? 0) > 0
  const isDown = (delta ?? 0) < 0
  const isFlat = (delta ?? 0) === 0
  return (
    <Card className="p-5 gap-4 hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        {icon && (
          <div className={cn('shrink-0 size-10 rounded-lg flex items-center justify-center ring-1', a.bg, a.text, a.ring)}>
            {icon}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md',
              isUp && 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
              isDown && 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
              isFlat && 'bg-gray-100 text-gray-500'
            )}
          >
            {isUp && <ArrowUpRight className="size-3" />}
            {isDown && <ArrowDownRight className="size-3" />}
            {isFlat && <Minus className="size-3" />}
            <span className="num">{Math.abs(delta).toFixed(1)}%</span>
          </span>
          {deltaLabel && <span className="text-gray-400">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  )
}
