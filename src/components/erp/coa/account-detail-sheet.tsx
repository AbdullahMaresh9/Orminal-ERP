'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Lock, ChevronRight, Pencil, Plus, PowerOff, RotateCcw, Trash2,
  MoreHorizontal, BookOpenText, AlertTriangle, History, Info,
  Calculator, FileBarChart, Layers, SlidersHorizontal
} from 'lucide-react'
import { getClassMeta } from './class-meta'
import type { AccountDetail, AuditRecord, TransactionRecord } from './types'

interface AccountDetailSheetProps {
  accountId: string | null
  isRTL: boolean
  onClose: () => void
  onEdit: (account: AccountDetail) => void
  onAddChild: (account: AccountDetail) => void
  onDeactivate: (account: AccountDetail) => void
  onHardDelete: (account: AccountDetail) => void
  onViewLedger: (account: AccountDetail) => void
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-md hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-xs font-semibold text-end text-foreground', mono && 'font-mono')}>{value ?? '—'}</span>
    </div>
  )
}

function InfoCard({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-1', className)}>
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 px-1">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

export function AccountDetailSheet({
  accountId,
  isRTL,
  onClose,
  onEdit,
  onAddChild,
  onDeactivate,
  onHardDelete,
  onViewLedger,
}: AccountDetailSheetProps) {
  const { t, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const [activeTab, setActiveTab] = useState('overview')

  const { data: detailData, isLoading } = useQuery<{ data: AccountDetail }>({
    queryKey: ['account-detail', accountId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/accounts/${accountId}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: !!accountId,
  })
  const account = detailData?.data

  const { data: auditData } = useQuery<{ data: AuditRecord[] }>({
    queryKey: ['account-audit', accountId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/accounts/${accountId}/audit?pageSize=20`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: !!accountId && activeTab === 'audit',
  })

  const { data: txData } = useQuery<{ data: TransactionRecord[] }>({
    queryKey: ['account-transactions', accountId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/accounts/${accountId}/transactions?pageSize=20`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: !!accountId && activeTab === 'transactions',
  })

  const classMeta = account ? getClassMeta(account.accountClass) : null
  const sheetSide = isRTL ? 'left' : 'right'

  return (
    <Sheet open={!!accountId} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side={sheetSide}
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0 border-s bg-background shadow-2xl"
        dir={dir}
      >
        {isLoading || !account ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Sheet Header Card */}
            <SheetHeader className="px-5 pt-6 pb-4 border-b border-border/80 bg-muted/20 shrink-0 space-y-3 relative">
              {/* Breadcrumb Path */}
              {account.breadcrumb && account.breadcrumb.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap pe-10">
                  {account.breadcrumb.slice(0, -1).map((bc, i) => (
                    <span key={bc.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className={cn('size-3 text-muted-foreground/60', isRTL && 'rotate-180')} />}
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{bc.code}</span>
                    </span>
                  ))}
                  <ChevronRight className={cn('size-3 text-muted-foreground/60', isRTL && 'rotate-180')} />
                </div>
              )}

              {/* Title & Actions Bar */}
              <div className="flex items-start justify-between gap-3 pe-8">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20" dir="ltr">
                      {account.code}
                    </span>
                    {classMeta && (
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', classMeta.badgeClass)}>
                        {isRTL ? classMeta.labelAr : classMeta.labelEn}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-semibold',
                        account.isPosting
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
                      )}
                    >
                      {account.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                    </Badge>
                    {account.isSystem && (
                      <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">
                        <Lock className="size-2.5" />{t('coa.systemBadge')}
                      </Badge>
                    )}
                    {!account.active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40">
                        {t('coa.inactiveBadge')}
                      </Badge>
                    )}
                  </div>

                  <SheetTitle className="text-lg font-bold leading-tight text-foreground">{account.nameAr}</SheetTitle>
                  {account.nameEn && (
                    <SheetDescription className="text-xs text-muted-foreground font-mono" dir="ltr">{account.nameEn}</SheetDescription>
                  )}
                </div>

                {/* Actions dropdown button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-lg shadow-2xs hover:bg-muted">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} className="w-52">
                    <DropdownMenuItem onClick={() => onViewLedger(account)} className="gap-2 text-xs font-medium cursor-pointer">
                      <BookOpenText className="size-4 text-violet-600 dark:text-violet-400" />
                      {t('coa.action.viewLedger')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 text-xs font-medium cursor-pointer">
                      <Pencil className="size-4 text-blue-600 dark:text-blue-400" />
                      {t('coa.action.edit')}
                    </DropdownMenuItem>
                    {!account.isPosting && (
                      <DropdownMenuItem onClick={() => onAddChild(account)} className="gap-2 text-xs font-medium cursor-pointer">
                        <Plus className="size-4 text-emerald-600 dark:text-emerald-400" />
                        {t('coa.action.createChild')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {account.active ? (
                      <DropdownMenuItem
                        onClick={() => onDeactivate(account)}
                        className="gap-2 text-xs font-medium text-amber-600 focus:text-amber-700 cursor-pointer"
                      >
                        <PowerOff className="size-4" />
                        {t('coa.action.deactivate')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => onDeactivate(account)}
                        className="gap-2 text-xs font-medium text-emerald-600 focus:text-emerald-700 cursor-pointer"
                      >
                        <RotateCcw className="size-4" />
                        {t('coa.action.reactivate')}
                      </DropdownMenuItem>
                    )}
                    {account.canDelete && !account.isSystem && (
                      <DropdownMenuItem
                        onClick={() => onHardDelete(account)}
                        className="gap-2 text-xs font-medium text-rose-600 focus:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                        {t('coa.action.hardDelete')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Metrics Bar - Structured 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60">
                <div className="p-2.5 rounded-lg bg-card border border-border/50 text-start space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{t('coa.detail.ownBalance')}</p>
                  <p className={cn('text-sm font-bold tabular-nums font-mono', classMeta?.color)} dir="ltr">
                    {formatCurrency(account.ownBalance ?? account.balance ?? 0)}
                  </p>
                </div>

                {!account.isPosting ? (
                  <div className="p-2.5 rounded-lg bg-card border border-border/50 text-start space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">{t('coa.detail.aggregateBalance')}</p>
                    <p className={cn('text-sm font-bold tabular-nums font-mono', classMeta?.color)} dir="ltr">
                      {formatCurrency(account.aggregateBalance ?? 0)}
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-card border border-border/50 text-start space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">{t('coa.detail.lineCount')}</p>
                    <p className="text-sm font-bold tabular-nums font-mono text-foreground" dir="ltr">
                      {account.lineCount ?? 0}
                    </p>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-card border border-border/50 text-start space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{t('coa.detail.childCount')}</p>
                  <p className="text-sm font-bold tabular-nums font-mono text-foreground" dir="ltr">
                    {account.childCount ?? 0}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-card border border-border/50 text-start space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">{t('coa.detail.lastMovement')}</p>
                  <p className="text-xs font-semibold tabular-nums text-foreground" dir="ltr">
                    {account.lastMovementDate ? formatDate(account.lastMovementDate) : '—'}
                  </p>
                </div>
              </div>
            </SheetHeader>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="border-b border-border bg-muted/10 px-3 shrink-0">
                <TabsList className="h-11 bg-transparent rounded-none gap-1 p-0 flex overflow-x-auto no-scrollbar">
                  {[
                    { value: 'overview', label: t('coa.tab.overview'), icon: Info },
                    { value: 'accounting', label: t('coa.tab.accounting'), icon: Calculator },
                    { value: 'reporting', label: t('coa.tab.reporting'), icon: FileBarChart },
                    { value: 'dimensions', label: t('coa.tab.dimensions'), icon: SlidersHorizontal },
                    { value: 'transactions', label: t('coa.tab.transactions'), icon: Layers },
                    { value: 'audit', label: t('coa.tab.audit'), icon: History },
                  ].map((tab) => {
                    const IconComp = tab.icon
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="h-11 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-background/80 font-semibold gap-1.5 shrink-0 transition-all"
                      >
                        <IconComp className="size-3.5" />
                        {tab.label}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {/* Scrollable Tab Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {/* Overview */}
                <TabsContent value="overview" className="m-0 space-y-4">
                  <InfoCard title={t('coa.tab.overview')}>
                    <DetailRow label={t('coa.detail.code')} value={<span dir="ltr" className="font-mono">{account.code}</span>} />
                    <DetailRow label={t('coa.detail.nameAr')} value={account.nameAr} />
                    {account.nameEn && <DetailRow label={t('coa.detail.nameEn')} value={<span dir="ltr" className="font-mono">{account.nameEn}</span>} />}
                    {account.shortName && <DetailRow label={t('coa.detail.shortName')} value={account.shortName} />}
                    <DetailRow label={t('coa.detail.class')} value={
                      classMeta && (
                        <Badge variant="outline" className={cn('text-[10px] font-semibold', classMeta.badgeClass)}>
                          {isRTL ? classMeta.labelAr : classMeta.labelEn}
                        </Badge>
                      )
                    } />
                    {account.subtype && <DetailRow label={t('coa.detail.subtype')} value={account.subtype} />}
                    <DetailRow label={t('coa.detail.isPosting')} value={
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', account.isPosting ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-300')}>
                        {account.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                      </Badge>
                    } />
                    <DetailRow label={t('coa.detail.parent')} value={
                      account.parent
                        ? <span className="flex items-center gap-1"><span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-[11px]">{account.parent.code}</span><span>{account.parent.nameAr}</span></span>
                        : t('coa.noParent')
                    } />
                    <DetailRow label={t('coa.detail.active')} value={
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', account.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200')}>
                        {account.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </span>
                    } />
                  </InfoCard>

                  {/* System roles mapping */}
                  {account.roles && account.roles.length > 0 && (
                    <InfoCard title={t('coa.tab.systemMapping')}>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {account.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-[11px] font-mono bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </InfoCard>
                  )}
                </TabsContent>

                {/* Accounting Settings */}
                <TabsContent value="accounting" className="m-0 space-y-4">
                  <InfoCard title={t('coa.tab.accounting')}>
                    <DetailRow label={t('coa.detail.normalBalance')} value={account.normalBalance ? t(`coa.balance.${account.normalBalance}`) : '—'} />
                    <DetailRow label={t('coa.detail.currency')} value={account.currency ? `${account.currency.code} — ${account.currency.nameAr}` : L('الافتراضية', 'Default')} />
                    <DetailRow label={t('coa.detail.allowReconciliation')} value={account.allowReconciliation ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.allowManualEntry')} value={account.allowManualEntry ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.descendantCount')} value={<span dir="ltr" className="font-mono">{account.descendantCount ?? 0}</span>} />
                  </InfoCard>
                  {/* Balances detailed */}
                  <InfoCard title={t('field.balance')}>
                    <DetailRow label={t('coa.detail.ownBalance')} value={<span dir="ltr" className={cn('font-semibold font-mono tabular-nums', classMeta?.color)}>{formatCurrency(account.ownBalance ?? 0)}</span>} />
                    <DetailRow label={t('coa.detail.aggregateBalance')} value={<span dir="ltr" className={cn('font-semibold font-mono tabular-nums', classMeta?.color)}>{formatCurrency(account.aggregateBalance ?? 0)}</span>} />
                    {account.sumDebit !== undefined && <DetailRow label={t('field.totalDebit')} value={<span dir="ltr" className="tabular-nums font-mono text-emerald-600">{formatCurrency(account.sumDebit)}</span>} />}
                    {account.sumCredit !== undefined && <DetailRow label={t('field.totalCredit')} value={<span dir="ltr" className="tabular-nums font-mono text-rose-600">{formatCurrency(account.sumCredit)}</span>} />}
                  </InfoCard>
                </TabsContent>

                {/* Reporting */}
                <TabsContent value="reporting" className="m-0 space-y-4">
                  <InfoCard title={t('coa.tab.reporting')}>
                    <DetailRow label={t('coa.detail.fsSection')} value={account.fsSection ? t(`coa.fs.${account.fsSection}`) : '—'} />
                    <DetailRow label={t('coa.detail.reportCategory')} value={account.reportCategory} />
                    <DetailRow label={t('coa.detail.taxBehavior')} value={account.taxBehavior ? t(`coa.tax.${account.taxBehavior}`) : '—'} />
                    {account.taxCode && (
                      <DetailRow label={t('coa.detail.taxCode')} value={`${account.taxCode.code} — ${account.taxCode.nameAr} (${account.taxCode.rate}%)`} />
                    )}
                  </InfoCard>
                </TabsContent>

                {/* Dimensions */}
                <TabsContent value="dimensions" className="m-0 space-y-4">
                  <InfoCard title={t('coa.tab.dimensions')}>
                    <DetailRow label={t('coa.detail.requireCostCenter')} value={account.requireCostCenter ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.requireBranch')} value={account.requireBranch ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.requireProject')} value={account.requireProject ? t('misc.yes') : t('misc.no')} />
                  </InfoCard>
                </TabsContent>

                {/* Transactions */}
                <TabsContent value="transactions" className="m-0 space-y-3">
                  {!txData ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                    </div>
                  ) : (txData.data?.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2 text-center border border-dashed rounded-xl p-6">
                      <AlertTriangle className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">{t('coa.empty.noTransactions')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {txData.data.map((tx) => (
                        <div key={tx.id} className="rounded-xl border border-border/80 p-3.5 space-y-1.5 hover:bg-muted/40 transition-all bg-card">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-primary" dir="ltr">{tx.code}</span>
                            <Badge variant="outline" className="text-[10px] font-semibold">{tx.state}</Badge>
                          </div>
                          <p className="text-xs text-foreground/80 truncate font-medium">{tx.description}</p>
                          <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-border/40">
                            <span className="text-muted-foreground text-[11px]">{formatDate(tx.postingDate)}</span>
                            {tx.totalDebit !== undefined && (
                              <span className="text-emerald-600 font-mono font-bold tabular-nums" dir="ltr">{formatCurrency(tx.totalDebit)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Audit */}
                <TabsContent value="audit" className="m-0 space-y-3">
                  {!auditData ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                    </div>
                  ) : (auditData.data?.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2 text-center border border-dashed rounded-xl p-6">
                      <History className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">{t('coa.empty.noAudit')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditData.data.map((record) => (
                        <div key={record.id} className="rounded-xl border border-border/80 p-3.5 space-y-1.5 bg-card">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {t(`coa.audit.${record.action}` as Parameters<typeof t>[0]) || record.action}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground font-mono">{formatDateTime(record.createdAt)}</span>
                          </div>
                          {record.user && (
                            <p className="text-xs text-muted-foreground">
                              {t('coa.audit.by')}: <span className="font-semibold text-foreground">{record.user.nameAr || record.user.username}</span>
                            </p>
                          )}
                          {record.reason && (
                            <p className="text-xs text-muted-foreground">
                              {t('coa.audit.reason')}: {record.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
