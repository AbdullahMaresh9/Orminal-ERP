'use client'

import { cn } from '@/lib/utils'
import { Search, Plus, Download, Printer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { ReactNode } from 'react'

interface ModuleShellProps {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  onSearch?: (q: string) => void
  searchValue?: string
  searchPlaceholder?: string
  onAdd?: () => void
  addLabel?: string
  onExport?: () => void
  onPrint?: () => void
  filters?: ReactNode
  children: ReactNode
  className?: string
}

export function ModuleShell({
  title,
  description,
  icon,
  actions,
  onSearch,
  searchValue,
  searchPlaceholder,
  onAdd,
  addLabel,
  onExport,
  onPrint,
  filters,
  children,
  className,
}: ModuleShellProps) {
  const { isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  // القيم الافتراضية ثنائية اللغة (تُحسب داخل المكوّن لا في توقيع الدالة)
  const searchPlaceholderText = searchPlaceholder ?? L('بحث...', 'Search...')
  const addLabelText = addLabel ?? L('إضافة', 'Add')

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="shrink-0 size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
              <Printer className="size-4" />
              <span className="hidden sm:inline">{L('طباعة', 'Print')}</span>
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
              <Download className="size-4" />
              <span className="hidden sm:inline">{L('تصدير', 'Export')}</span>
            </Button>
          )}
          {actions}
          {onAdd && (
            <Button size="sm" onClick={onAdd} className="gap-1.5">
              <Plus className="size-4" />
              {addLabelText}
            </Button>
          )}
        </div>
      </div>

      {/* Search + filters */}
      {(onSearch || filters) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {onSearch && (
            <div className="relative sm:max-w-xs w-full">
              <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchValue ?? ''}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholderText}
                className="ps-9"
              />
            </div>
          )}
          {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
        </div>
      )}

      {/* Content */}
      <div className={cn('flex-1 min-w-0', className)}>{children}</div>
    </div>
  )
}