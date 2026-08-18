'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Lock, ChevronRight, Pencil, Plus, PowerOff, RotateCcw, Trash2,
  MoreHorizontal, BookOpenText, AlertTriangle, History,
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
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-xs font-medium text-end', mono && 'font-mono')}>{value ?? '—'}</span>
    </div>
  )
}

function InfoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-muted/20 p-4', className)}>
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
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0"
        dir={dir}
      >
        {isLoading || !account ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {/* Sheet header */}
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
              {/* Breadcrumb */}
              {account.breadcrumb && account.breadcrumb.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap mb-2">
                  {account.breadcrumb.slice(0, -1).map((bc, i) => (
                    <span key={bc.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className={cn('size-3 text-muted-foreground', isRTL && 'rotate-180')} />}
                      <span className="text-xs text-muted-foreground font-mono">{bc.code}</span>
                    </span>
                  ))}
                  <ChevronRight className={cn('size-3 text-muted-foreground', isRTL && 'rotate-180')} />
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold" dir="ltr">{account.code}</span>
                    {classMeta && (
                      <Badge variant="outline" className={cn('text-[10px]', classMeta.badgeClass)}>
                        {isRTL ? classMeta.labelAr : classMeta.labelEn}
                      </Badge>
                    )}
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
                    {account.isSystem && (
                      <Badge className="gap-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">
                        <Lock className="size-2.5" />{t('coa.systemBadge')}
                      </Badge>
                    )}
                    {!account.active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {t('coa.inactiveBadge')}
                      </Badge>
                    )}
                  </div>
                  <SheetTitle className="text-base font-bold leading-tight">{account.nameAr}</SheetTitle>
                  {account.nameEn && (
                    <SheetDescription className="text-xs" dir="ltr">{account.nameEn}</SheetDescription>
                  )}
                </div>

                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="size-8 shrink-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} className="w-48">
                    <DropdownMenuItem onClick={() => onViewLedger(account)} className="gap-2 text-xs">
                      <BookOpenText className="size-3.5 text-violet-600" />
                      {t('coa.action.viewLedger')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(account)} className="gap-2 text-xs">
                      <Pencil className="size-3.5" />{t('coa.action.edit')}
                    </DropdownMenuItem>
                    {!account.isPosting && (
                      <DropdownMenuItem onClick={() => onAddChild(account)} className="gap-2 text-xs">
                        <Plus className="size-3.5" />{t('coa.action.createChild')}
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
                    {account.canDelete && !account.isSystem && (
                      <DropdownMenuItem
                        onClick={() => onHardDelete(account)}
                        className="gap-2 text-xs text-rose-600 focus:text-rose-700"
                      >
                        <Trash2 className="size-3.5" />{t('coa.action.hardDelete')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Balance summary bar */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">{t('coa.detail.ownBalance')}</p>
                  <p className={cn('text-sm font-bold tabular-nums', classMeta?.color)} dir="ltr">
                    {formatCurrency(account.ownBalance ?? account.balance ?? 0)}
                  </p>
                </div>
                {!account.isPosting && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">{t('coa.detail.aggregateBalance')}</p>
                      <p className={cn('text-sm font-bold tabular-nums', classMeta?.color)} dir="ltr">
                        {formatCurrency(account.aggregateBalance ?? 0)}
                      </p>
                    </div>
                  </>
                )}
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">{t('coa.detail.childCount')}</p>
                  <p className="text-sm font-bold tabular-nums" dir="ltr">{account.childCount ?? 0}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">{t('coa.detail.lineCount')}</p>
                  <p className="text-sm font-bold tabular-nums" dir="ltr">{account.lineCount ?? 0}</p>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="border-b border-border px-1 shrink-0">
                <ScrollArea className="w-full" type="scroll">
                  <TabsList className="h-10 bg-transparent rounded-none gap-0 p-0 w-max">
                    {[
                      { value: 'overview', label: t('coa.tab.overview') },
                      { value: 'accounting', label: t('coa.tab.accounting') },
                      { value: 'reporting', label: t('coa.tab.reporting') },
                      { value: 'dimensions', label: t('coa.tab.dimensions') },
                      { value: 'transactions', label: t('coa.tab.transactions') },
                      { value: 'audit', label: t('coa.tab.audit') },
                    ].map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="h-10 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none font-medium"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Overview */}
                <TabsContent value="overview" className="m-0 p-5 space-y-4">
                  <InfoCard>
                    <DetailRow label={t('coa.detail.code')} value={<span dir="ltr" className="font-mono">{account.code}</span>} />
                    <DetailRow label={t('coa.detail.nameAr')} value={account.nameAr} />
                    {account.nameEn && <DetailRow label={t('coa.detail.nameEn')} value={<span dir="ltr">{account.nameEn}</span>} />}
                    {account.shortName && <DetailRow label={t('coa.detail.shortName')} value={account.shortName} />}
                    <DetailRow label={t('coa.detail.class')} value={
                      classMeta && (
                        <Badge variant="outline" className={cn('text-[10px]', classMeta.badgeClass)}>
                          {isRTL ? classMeta.labelAr : classMeta.labelEn}
                        </Badge>
                      )
                    } />
                    {account.subtype && <DetailRow label={t('coa.detail.subtype')} value={account.subtype} />}
                    <DetailRow label={t('coa.detail.isPosting')} value={
                      <Badge variant="outline" className={cn('text-[10px]', account.isPosting ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-300')}>
                        {account.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                      </Badge>
                    } />
                    <DetailRow label={t('coa.detail.parent')} value={
                      account.parent
                        ? <span><span className="font-mono me-1">{account.parent.code}</span>{account.parent.nameAr}</span>
                        : t('coa.noParent')
                    } />
                    <DetailRow label={t('coa.detail.active')} value={
                      <span className={cn('text-xs font-semibold', account.active ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {account.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </span>
                    } />
                    {account.lastMovementDate && (
                      <DetailRow label={t('coa.detail.lastMovement')} value={formatDate(account.lastMovementDate)} />
                    )}
                  </InfoCard>

                  {/* System roles */}
                  {account.roles && account.roles.length > 0 && (
                    <InfoCard>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{t('coa.tab.systemMapping')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {account.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-[10px] font-mono bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </InfoCard>
                  )}
                </TabsContent>

                {/* Accounting Settings */}
                <TabsContent value="accounting" className="m-0 p-5 space-y-4">
                  <InfoCard>
                    <DetailRow label={t('coa.detail.normalBalance')} value={account.normalBalance ? t(`coa.balance.${account.normalBalance}`) : '—'} />
                    <DetailRow label={t('coa.detail.currency')} value={account.currency ? `${account.currency.code} — ${account.currency.nameAr}` : L('الافتراضية', 'Default')} />
                    <DetailRow label={t('coa.detail.allowReconciliation')} value={account.allowReconciliation ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.allowManualEntry')} value={account.allowManualEntry ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.descendantCount')} value={<span dir="ltr">{account.descendantCount ?? 0}</span>} />
                  </InfoCard>
                  {/* Balances */}
                  <InfoCard>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{t('field.balance')}</p>
                    <DetailRow label={t('coa.detail.ownBalance')} value={<span dir="ltr" className={cn('font-semibold tabular-nums', classMeta?.color)}>{formatCurrency(account.ownBalance ?? 0)}</span>} />
                    <DetailRow label={t('coa.detail.aggregateBalance')} value={<span dir="ltr" className={cn('font-semibold tabular-nums', classMeta?.color)}>{formatCurrency(account.aggregateBalance ?? 0)}</span>} />
                    {account.sumDebit !== undefined && <DetailRow label={t('field.totalDebit')} value={<span dir="ltr" className="tabular-nums">{formatCurrency(account.sumDebit)}</span>} />}
                    {account.sumCredit !== undefined && <DetailRow label={t('field.totalCredit')} value={<span dir="ltr" className="tabular-nums">{formatCurrency(account.sumCredit)}</span>} />}
                  </InfoCard>
                </TabsContent>

                {/* Reporting */}
                <TabsContent value="reporting" className="m-0 p-5 space-y-4">
                  <InfoCard>
                    <DetailRow label={t('coa.detail.fsSection')} value={account.fsSection ? t(`coa.fs.${account.fsSection}`) : '—'} />
                    <DetailRow label={t('coa.detail.reportCategory')} value={account.reportCategory} />
                    <DetailRow label={t('coa.detail.taxBehavior')} value={account.taxBehavior ? t(`coa.tax.${account.taxBehavior}`) : '—'} />
                    {account.taxCode && (
                      <DetailRow label={t('coa.detail.taxCode')} value={`${account.taxCode.code} — ${account.taxCode.nameAr} (${account.taxCode.rate}%)`} />
                    )}
                  </InfoCard>
                </TabsContent>

                {/* Dimensions */}
                <TabsContent value="dimensions" className="m-0 p-5 space-y-4">
                  <InfoCard>
                    <DetailRow label={t('coa.detail.requireCostCenter')} value={account.requireCostCenter ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.requireBranch')} value={account.requireBranch ? t('misc.yes') : t('misc.no')} />
                    <DetailRow label={t('coa.detail.requireProject')} value={account.requireProject ? t('misc.yes') : t('misc.no')} />
                  </InfoCard>
                </TabsContent>

                {/* Transactions */}
                <TabsContent value="transactions" className="m-0 p-5 space-y-3">
                  {!txData ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (txData.data?.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2 text-center">
                      <AlertTriangle className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">{t('coa.empty.noTransactions')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {txData.data.map((tx) => (
                        <div key={tx.id} className="rounded-lg border border-border p-3 space-y-1 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold" dir="ltr">{tx.code}</span>
                            <Badge variant="outline" className="text-[10px]">{tx.state}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">{formatDate(tx.postingDate)}</span>
                            {tx.totalDebit !== undefined && (
                              <span className="text-blue-600 tabular-nums" dir="ltr">{formatCurrency(tx.totalDebit)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Audit */}
                <TabsContent value="audit" className="m-0 p-5 space-y-3">
                  {!auditData ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : (auditData.data?.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2 text-center">
                      <History className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">{t('coa.empty.noAudit')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditData.data.map((record) => (
                        <div key={record.id} className="rounded-lg border border-border p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {t(`coa.audit.${record.action}` as Parameters<typeof t>[0]) || record.action}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatDateTime(record.createdAt)}</span>
                          </div>
                          {record.user && (
                            <p className="text-xs text-muted-foreground">
                              {t('coa.audit.by')}: {record.user.nameAr || record.user.username}
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
