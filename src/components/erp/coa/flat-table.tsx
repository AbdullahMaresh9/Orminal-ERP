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
    <TableHead
      className={cn(
        'whitespace-nowrap text-xs font-semibold select-none',
        col && 'cursor-pointer hover:bg-muted/60 transition-colors',
        className,
      )}
      onClick={() => col && onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}{col && <SortIcon sortBy={sortBy} col={col} sortDir={sortDir} />}
      </span>
    </TableHead>
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
      <div className="overflow-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TH col="code" label={t('coa.col.code')} className="ps-4 w-[130px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="nameAr" label={t('coa.col.name')} sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="accountClass" label={t('coa.col.class')} className="w-[150px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH col="level" label={t('coa.col.level')} className="text-center w-[80px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.kind')} className="w-[100px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.balance')} className="text-end w-[150px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.status')} className="w-[90px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <TH label={t('coa.col.actions')} className="text-end pe-4 w-[60px]" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  {t('coa.empty.noResults')}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const cm = getClassMeta(account.accountClass)
                const balance = account.isPosting ? (account.ownBalance ?? account.balance ?? 0) : (account.aggregateBalance ?? account.balance ?? 0)
                return (
                  <TableRow
                    key={account.id}
                    className={cn('hover:bg-muted/40 cursor-pointer', !account.active && 'opacity-60')}
                    onClick={() => onSelect(account)}
                  >
                    <TableCell className="ps-4 font-mono text-xs" dir="ltr">
                      {account.code}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', cm.badgeClass)}>
                        {isRTL ? cm.labelAr : cm.labelEn}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                        {account.level ?? account.depth ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-end">
                      <span className={cn('text-sm font-semibold tabular-nums', cm.color)} dir="ltr">
                        {formatCurrency(balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium',
                        account.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                      )}>
                        <span className={cn('size-1.5 rounded-full', account.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                        {account.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </span>
                    </TableCell>
                    <TableCell className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
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
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
