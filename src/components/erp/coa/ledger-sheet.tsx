'use client'

// Account Statement / General Ledger view (كشف حساب).
// Consumes GET /api/erp/accounts/:id/ledger, which returns the opening balance,
// the period movement, a running balance per line and the closing balance.
// For a GROUP account the endpoint aggregates the whole subtree, so this view
// doubles as a consolidated statement for a branch of the chart.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { BookOpenText, Printer, Layers, ArrowRight, ArrowLeft } from 'lucide-react'
import { getClassMeta } from './class-meta'
import type { LedgerData } from './types'

interface LedgerSheetProps {
  accountId: string | null
  isRTL: boolean
  onClose: () => void
}

const PAGE_SIZE = 50

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: 'neutral' | 'debit' | 'credit'
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          'text-sm font-bold tabular-nums mt-1 truncate',
          accent === 'debit' && 'text-blue-600 dark:text-blue-400',
          accent === 'credit' && 'text-rose-600 dark:text-rose-400'
        )}
        dir="ltr"
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  )
}

export function LedgerSheet({ accountId, isRTL, onClose }: LedgerSheetProps) {
  const { t, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [page, setPage] = useState(1)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    p.set('includeChildren', String(includeChildren))
    p.set('page', String(page))
    p.set('pageSize', String(PAGE_SIZE))
    return p.toString()
  }, [from, to, includeChildren, page])

  const { data, isLoading, isError, error } = useQuery<{ data: LedgerData }>({
    queryKey: ['account-ledger', accountId, query],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const r = await fetch(`/api/erp/accounts/${accountId}/ledger?${query}`)
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e?.error?.message ?? t('coa.error.generic'))
      }
      return r.json()
    },
  })

  const ledger = data?.data
  const account = ledger?.account
  const meta = account ? getClassMeta(account.accountClass) : null
  const isGroup = account ? !account.isPosting : false
  const pagination = ledger?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const handlePrint = () => window.print()

  return (
    <Sheet open={Boolean(accountId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isRTL ? 'left' : 'right'}
        dir={dir}
        className="w-full sm:max-w-3xl lg:max-w-5xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="p-5 pb-4 border-b border-border shrink-0 text-start">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
              <BookOpenText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold truncate">{t('coa.ledger.title')}</SheetTitle>
              <SheetDescription className="text-xs mt-0.5 truncate">
                {account ? (
                  <span className="inline-flex items-center gap-2 flex-wrap">
                    <span className="font-mono" dir="ltr">{account.code}</span>
                    <span>—</span>
                    <span>{isRTL ? account.nameAr : account.nameEn || account.nameAr}</span>
                    {meta && (
                      <Badge variant="outline" className={cn('text-[10px]', meta.badgeClass)}>
                        {isRTL ? meta.labelAr : meta.labelEn}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <Skeleton className="h-3 w-40" />
                )}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 shrink-0" aria-label={t('action.print')}>
              <Printer className="size-4" />
              <span className="hidden sm:inline">{t('action.print')}</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border bg-muted/20 shrink-0 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label htmlFor="ledger-from" className="text-[11px] font-semibold text-muted-foreground">
              {t('coa.ledger.from')}
            </Label>
            <Input
              id="ledger-from"
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="h-9 w-full sm:w-40 text-xs"
              dir="ltr"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ledger-to" className="text-[11px] font-semibold text-muted-foreground">
              {t('coa.ledger.to')}
            </Label>
            <Input
              id="ledger-to"
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="h-9 w-full sm:w-40 text-xs"
              dir="ltr"
            />
          </div>
          {isGroup && (
            <div className="flex items-center gap-2 pb-1.5">
              <Switch
                id="ledger-children"
                checked={includeChildren}
                onCheckedChange={(v) => { setIncludeChildren(v); setPage(1) }}
              />
              <Label htmlFor="ledger-children" className="text-xs font-medium cursor-pointer select-none flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground" />
                {t('coa.ledger.includeChildren')}
              </Label>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="px-5 py-3 border-b border-border shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading || !ledger ? (
            <>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </>
          ) : (
            <>
              <SummaryCard label={t('coa.ledger.opening')} value={formatCurrency(ledger.opening.balance)} />
              <SummaryCard label={t('field.totalDebit')} value={formatCurrency(ledger.period.debit)} accent="debit" />
              <SummaryCard label={t('field.totalCredit')} value={formatCurrency(ledger.period.credit)} accent="credit" />
              <SummaryCard
                label={t('coa.ledger.closing')}
                value={formatCurrency(ledger.closing.balance)}
                hint={`${t('coa.ledger.period')}: ${formatCurrency(ledger.period.movement)}`}
              />
            </>
          )}
        </div>

        {/* Lines */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 pt-3">
            {isError ? (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300">
                {(error as Error)?.message ?? t('coa.error.generic')}
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
              </div>
            ) : !ledger?.lines.length ? (
              <div className="py-14 text-center">
                <BookOpenText className="size-9 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium mt-3">{t('coa.empty.noTransactions')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-start text-[11px]">{t('field.date')}</TableHead>
                    <TableHead className="text-start text-[11px]">{t('coa.ledger.entry')}</TableHead>
                    <TableHead className="text-start text-[11px]">{t('coa.ledger.description')}</TableHead>
                    {includeChildren && isGroup && (
                      <TableHead className="text-start text-[11px]">{t('coa.col.code')}</TableHead>
                    )}
                    <TableHead className="text-end text-[11px]">{t('field.debit')}</TableHead>
                    <TableHead className="text-end text-[11px]">{t('field.credit')}</TableHead>
                    <TableHead className="text-end text-[11px]">{t('coa.ledger.runningBalance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.lines.map((line) => (
                    <TableRow key={line.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs whitespace-nowrap">
                        {line.entry ? formatDate(line.entry.postingDate, isRTL ? 'ar' : 'en') : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono" dir="ltr">{line.entry?.code ?? '—'}</TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate">
                        {line.description || line.entry?.description || '—'}
                      </TableCell>
                      {includeChildren && isGroup && (
                        <TableCell className="text-[11px] font-mono text-muted-foreground" dir="ltr">
                          {line.account?.code ?? '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-end text-xs tabular-nums text-blue-600 dark:text-blue-400" dir="ltr">
                        {line.debit ? formatCurrency(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-end text-xs tabular-nums text-rose-600 dark:text-rose-400" dir="ltr">
                        {line.credit ? formatCurrency(line.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-end text-xs tabular-nums font-semibold" dir="ltr">
                        {formatCurrency(line.runningBalance ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>

        {/* Pagination */}
        {pagination && pagination.total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {L(
                `صفحة ${pagination.page} من ${totalPages} — ${pagination.total} حركة`,
                `Page ${pagination.page} of ${totalPages} — ${pagination.total} entries`
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t('action.previous')}
              >
                {isRTL ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t('action.next')}
              >
                {isRTL ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default LedgerSheet
