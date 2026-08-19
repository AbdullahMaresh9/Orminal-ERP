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
  className?: string
}

const ACCENTS: Record<string, { bg: string; text: string; ring: string; border: string }> = {
  blue: {
    bg: 'bg-blue-50/80 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-200/60 dark:ring-blue-800/60',
    border: 'border-blue-100 dark:border-blue-900/50',
  },
  amber: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-200/60 dark:ring-amber-800/60',
    border: 'border-amber-100 dark:border-amber-900/50',
  },
  rose: {
    bg: 'bg-rose-50/80 dark:bg-rose-950/40',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-200/60 dark:ring-rose-800/60',
    border: 'border-rose-100 dark:border-rose-900/50',
  },
  violet: {
    bg: 'bg-violet-50/80 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-400',
    ring: 'ring-violet-200/60 dark:ring-violet-800/60',
    border: 'border-violet-100 dark:border-violet-900/50',
  },
  sky: {
    bg: 'bg-sky-50/80 dark:bg-sky-950/40',
    text: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-200/60 dark:ring-sky-800/60',
    border: 'border-sky-100 dark:border-sky-900/50',
  },
}

export function KpiCard({ title, value, delta, deltaLabel, icon, accent = 'blue', className }: KpiCardProps) {
  const a = ACCENTS[accent] ?? ACCENTS.blue
  const isUp = (delta ?? 0) > 0
  const isDown = (delta ?? 0) < 0
  const isFlat = (delta ?? 0) === 0

  return (
    <Card className={cn(
      'p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border bg-card/95 backdrop-blur-xs relative overflow-hidden h-auto',
      a.border,
      className
    )}>
      {/* Top row: Icon + title */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1 flex-1 leading-tight" title={title}>
          {title}
        </p>
        {icon && (
          <div className={cn('shrink-0 size-7 sm:size-8 rounded-lg flex items-center justify-center ring-1 shadow-2xs [&_svg]:size-3.5 sm:[&_svg]:size-4', a.bg, a.text, a.ring)}>
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="min-w-0">
        <p className="text-sm sm:text-base lg:text-lg font-bold tracking-tight tabular-nums text-foreground truncate font-mono leading-snug" title={value}>
          {value}
        </p>
      </div>

      {/* Optional Delta indicator */}
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 text-[10px] pt-1 border-t border-border/30">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold px-1 py-0.5 rounded-md text-[9px]',
              isUp && 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
              isDown && 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
              isFlat && 'bg-gray-100 text-gray-500'
            )}
          >
            {isUp && <ArrowUpRight className="size-2.5" />}
            {isDown && <ArrowDownRight className="size-2.5" />}
            {isFlat && <Minus className="size-2.5" />}
            <span className="font-mono">{Math.abs(delta).toFixed(1)}%</span>
          </span>
          {deltaLabel && <span className="text-muted-foreground/70 truncate text-[10px]">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  )
}
