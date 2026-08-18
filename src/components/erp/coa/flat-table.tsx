'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronUp, ChevronDown, Lock, MoreHorizontal, Pencil, Plus, PowerOff, RotateCcw, Trash2, Eye, BookOpenText,
} from 'lucide-react'
import { getClassMeta } from './class-meta'
import type { FlatAccount, TreeFilters } from './types'

interface FlatTableProps {
  filters: TreeFilters
  onSelect: (account: FlatAccount) => void
  onEdit: (account: FlatAccount) => void
  onAddChild: (account: FlatAccount) => void
  onDeactivate: (account: FlatAccount) => void
  onHardDelete: (account: FlatAccount) => void
  onViewLedger: (account: FlatAccount) => void
}

type SortBy = 'code' | 'nameAr' | 'accountClass' | 'level'
type SortDir = 'asc' | 'desc'

interface FlatResponse {
  data: FlatAccount[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

const PAGE_SIZE = 25
const VISIBLE_ROWS = 5
const ROW_HEIGHT = 50
const HEADER_HEIGHT = 44

const stickyHead =
  'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))] text-xs select-none py-2.5'

function SortIcon({ sortBy, col, sortDir }: { sortBy: SortBy; col: SortBy; sortDir: SortDir }) {
  if (sortBy !== col) return <span className="size-4 inline-block" />
  return sortDir === 'asc'
    ? <ChevronUp className="size-3.5 inline" />
    : <ChevronDown className="size-3.5 inline" />
}

function TH({ col, label, className, sortBy, sortDir, onSort }: {
  col?: SortBy; label: string; className?: string
  sortBy: SortBy; sortDir: SortDir; onSort: (col: SortBy) => void
}) {
  return (
    <th
      className={cn(
        stickyHead,
        col && 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors',
        className,
      )}
      onClick={() => col && onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}{col && <SortIcon sortBy={sortBy} col={col} sortDir={sortDir} />}
      </span>
    </th>
  )
}

export function FlatTable({ filters, onSelect, onEdit, onAddChild, onDeactivate, onHardDelete, onViewLedger }: FlatTableProps) {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortBy>('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const params = new URLSearchParams()
  params.set('view', 'flat')
  params.set('page', String(page))
  params.set('pageSize', String(PAGE_SIZE))
  params.set('sortBy', sortBy)
  params.set('sortDir', sortDir)
  if (filters.search) params.set('q', filters.search)
  if (filters.accountClass !== 'all') params.set('class', filters.accountClass)
  if (filters.active !== 'all') params.set('active', filters.active === 'active' ? 'true' : 'false')
  if (filters.kind !== 'all') params.set('isPosting', filters.kind === 'posting' ? 'true' : 'false')
  if (filters.systemOnly) params.set('isSystem', 'true')

  const { data, isLoading } = useQuery<FlatResponse>({
    queryKey: ['accounts-flat', page, sortBy, sortDir, filters],
    queryFn: async () => {
      const r = await fetch(`/api/erp/accounts?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    placeholderData: (prev) => prev,
  })

  const accounts = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  function toggleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }

  return (
    <div>
      <div
        className="w-full overflow-y-auto overflow-x-auto overscroll-contain scrollbar-thin"
        style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
      >
        <table className="w-full caption-bottom text-sm min-w-[940px] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col className="w-[140px]" />
            <col className="w-[260px]" />
            <col className="w-[130px]" />
            <col className="w-[70px]" />
            <col className="w-[100px]" />
            <col className="w-[140px]" />
            <col className="w-[100px]" />
            <col className="w-[60px]" />
          </colgroup>
          <thead>
            <tr className="hover:bg-transparent border-b">
              <TH col="code" label={t('coa.col.code')} className="ps-4 text-start" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="nameAr" label={t('coa.col.name')} className="text-start" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="accountClass" label={t('coa.col.class')} className="text-start" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="level" label={t('coa.col.level')} className="text-center" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.kind')} className="text-start" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.balance')} className="text-end pe-3" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.status')} className="text-center" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.actions')} className="text-end pe-4" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-muted-foreground border-b border-border/50">
                  {t('coa.empty.noResults')}
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                const cm = getClassMeta(account.accountClass)
                const balance = account.isPosting ? (account.ownBalance ?? account.balance ?? 0) : (account.aggregateBalance ?? account.balance ?? 0)
                return (
                  <tr
                    key={account.id}
                    className={cn('hover:bg-muted/40 cursor-pointer transition-colors', !account.active && 'opacity-60')}
                    onClick={() => onSelect(account)}
                  >
                    <td className="ps-4 py-2 font-mono text-xs border-b border-slate-100 dark:border-slate-800/60" dir="ltr">
                      {account.code}
                    </td>
                    <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', !account.isPosting && 'font-semibold')}>
                          {account.nameAr}
                        </span>
                        {account.isSystem && (
                          <Badge className="gap-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] shrink-0">
                            <Lock className="size-2.5" />{t('coa.systemBadge')}
                          </Badge>
                        )}
                      </div>
                      {account.parent && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-mono">{account.parent.code}</span> — {account.parent.nameAr}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
                      <Badge variant="outline" className={cn('text-[10px]', cm.badgeClass)}>
                        {isRTL ? cm.labelAr : cm.labelEn}
                      </Badge>
                    </td>
                    <td className="py-2 pe-3 text-center border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                        {account.level ?? account.depth ?? '—'}
                      </span>
                    </td>
                    <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          account.isPosting
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {account.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                      </Badge>
                    </td>
                    <td className="py-2 pe-3 text-end border-b border-slate-100 dark:border-slate-800/60">
                      <span className={cn('text-sm font-semibold tabular-nums', cm.color)} dir="ltr">
                        {formatCurrency(balance)}
                      </span>
                    </td>
                    <td className="py-2 pe-3 text-center border-b border-slate-100 dark:border-slate-800/60">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium',
                        account.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                      )}>
                        <span className={cn('size-1.5 rounded-full', account.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                        {account.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </span>
                    </td>
                    <td className="py-2 pe-4 text-end border-b border-slate-100 dark:border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7" aria-label={t('action.actions')}>
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} className="w-44">
                          <DropdownMenuItem onClick={() => onSelect(account)} className="gap-2 text-xs">
                            <Eye className="size-3.5 text-blue-600" />{t('action.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onViewLedger(account)} className="gap-2 text-xs">
                            <BookOpenText className="size-3.5 text-violet-600" />
                            {t('coa.action.viewLedger')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 text-xs">
                            <Pencil className="size-3.5 text-slate-600" />{t('coa.action.edit')}
                          </DropdownMenuItem>
                          {!account.isPosting && (
                            <DropdownMenuItem onClick={() => onAddChild(account)} className="gap-2 text-xs">
                              <Plus className="size-3.5 text-emerald-600" />{t('coa.action.createChild')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {account.active ? (
                            <DropdownMenuItem
                              onClick={() => onDeactivate(account)}
                              className="gap-2 text-xs text-amber-600 focus:text-amber-700"
                            >
                              <PowerOff className="size-3.5" />{t('coa.action.deactivate')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => onDeactivate(account)}
                              className="gap-2 text-xs text-emerald-600 focus:text-emerald-700"
                            >
                              <RotateCcw className="size-3.5" />{t('coa.action.reactivate')}
                            </DropdownMenuItem>
                          )}
                          {!account.isSystem && (
                            <DropdownMenuItem
                              onClick={() => onHardDelete(account)}
                              className="gap-2 text-xs text-rose-600 focus:text-rose-700"
                            >
                              <Trash2 className="size-3.5" />{t('coa.action.hardDelete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {t('coa.page')} {page} {t('coa.of')} {totalPages}
            {meta && <span className="ms-1">({meta.total} {L('حساب', 'accounts')})</span>}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 px-2 text-xs"
            >
              {isRTL ? '›' : '‹'}
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="h-7 w-7 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 px-2 text-xs"
            >
              {isRTL ? '‹' : '›'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
