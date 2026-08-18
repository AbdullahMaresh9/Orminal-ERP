'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { BookOpen, Lock, AlertCircle } from 'lucide-react'
import type { AccountNode, AccountMeta, CreateAccountPayload, AccountClass, TaxBehavior } from './types'
import { CLASS_META, ALL_CLASSES } from './class-meta'

interface FieldError { field: string; code: string; message: string }

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: AccountNode | null
  parentAccount?: AccountNode | null
  forceGroup?: boolean
  onSubmit: (payload: CreateAccountPayload) => Promise<void>
  isPending: boolean
  serverErrors?: FieldError[]
  meta: AccountMeta | null
}

const SECTION_CLS = 'rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-3'
const LABEL_CLS = 'text-xs font-semibold text-slate-700 dark:text-slate-300'
const INPUT_CLS = 'h-9 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus-visible:ring-blue-500'
const SELECT_TRIGGER_CLS = 'h-9 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus:ring-blue-500'

function SectionHead({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>
}

function FieldBlock({
  id, label, required, error, children, fullWidth,
}: {
  id?: string; label: string; required?: boolean; error?: string; children: React.ReactNode; fullWidth?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', fullWidth && 'col-span-2')}>
      <Label htmlFor={id} className={LABEL_CLS}>
        {label}{required && <span className="text-rose-500 ms-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle className="size-3 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

export function AccountFormDialog({
  open,
  onOpenChange,
  editing,
  parentAccount,
  forceGroup,
  onSubmit,
  isPending,
  serverErrors = [],
  meta,
}: AccountFormDialogProps) {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  const isEdit = !!editing
  const isSystem = editing?.isSystem ?? false

  // Derive defaults
  const defaultClass: AccountClass = parentAccount?.accountClass ?? editing?.accountClass ?? 'asset'
  const defaultIsPosting = forceGroup ? false : (editing?.isPosting ?? !forceGroup)

  const [form, setForm] = useState<{
    code: string
    nameAr: string
    nameEn: string
    shortName: string
    accountClass: AccountClass
    subtype: string
    parentId: string
    isPosting: boolean
    normalBalance: string
    currencyId: string
    allowReconciliation: boolean
    allowManualEntry: boolean
    taxBehavior: TaxBehavior
    taxCodeId: string
    fsSection: string
    reportCategory: string
    requireCostCenter: boolean
    requireBranch: boolean
    requireProject: boolean
    active: boolean
    role: string
  }>({
    code: editing?.code ?? '',
    nameAr: editing?.nameAr ?? '',
    nameEn: editing?.nameEn ?? '',
    shortName: editing?.shortName ?? '',
    accountClass: defaultClass,
    subtype: editing?.subtype ?? '',
    parentId: editing?.parentId ?? parentAccount?.id ?? '',
    isPosting: defaultIsPosting,
    normalBalance: editing?.normalBalance ?? '',
    currencyId: editing?.currencyId ?? '',
    allowReconciliation: editing?.allowReconciliation ?? false,
    allowManualEntry: editing?.allowManualEntry ?? true,
    taxBehavior: editing?.taxBehavior ?? 'none',
    taxCodeId: editing?.taxCodeId ?? '',
    fsSection: editing?.fsSection ?? '',
    reportCategory: editing?.reportCategory ?? '',
    requireCostCenter: editing?.requireCostCenter ?? false,
    requireBranch: editing?.requireBranch ?? false,
    requireProject: editing?.requireProject ?? false,
    active: editing?.active ?? true,
    role: editing?.roles?.[0] ?? '',
  })


  // Flat accounts for parent picker
  const { data: flatData } = useQuery<{ data: AccountNode[] }>({
    queryKey: ['accounts-flat-for-picker'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts?view=flat&pageSize=500&sortBy=code&sortDir=asc')
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: open,
  })
  const flatAccounts = flatData?.data ?? []

  const classMeta = meta?.classes.find((c) => c.code === form.accountClass)
  const subtypes = classMeta?.subtypes ?? []
  const allowedRoles = (meta?.roles ?? []).filter(
    (r) => r.allowedClasses.includes(form.accountClass) && form.isPosting
  )

  const fieldError = useCallback(
    (field: string) => serverErrors.find((e) => e.field === field)?.message,
    [serverErrors]
  )

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreateAccountPayload = {
      nameAr: form.nameAr,
      accountClass: form.accountClass,
      isPosting: form.isPosting,
    }
    if (form.code) payload.code = form.code
    if (form.nameEn) payload.nameEn = form.nameEn
    if (form.shortName) payload.shortName = form.shortName
    if (form.subtype) payload.subtype = form.subtype
    if (form.parentId) payload.parentId = form.parentId
    if (form.normalBalance) payload.normalBalance = form.normalBalance as 'debit' | 'credit'
    if (form.currencyId) payload.currencyId = form.currencyId
    payload.allowReconciliation = form.allowReconciliation
    payload.allowManualEntry = form.allowManualEntry
    payload.taxBehavior = form.taxBehavior
    if (form.taxBehavior !== 'none' && form.taxCodeId) payload.taxCodeId = form.taxCodeId
    if (form.fsSection) payload.fsSection = form.fsSection as typeof payload.fsSection
    if (form.reportCategory) payload.reportCategory = form.reportCategory
    if (form.isPosting && form.role) payload.role = form.role
    payload.requireCostCenter = form.requireCostCenter
    payload.requireBranch = form.requireBranch
    payload.requireProject = form.requireProject
    payload.active = form.active
    await onSubmit(payload)
  }

  const title = isEdit
    ? t('coa.dialog.editAccount')
    : forceGroup
      ? t('coa.dialog.createGroup')
      : t('coa.dialog.createAccount')

  const isGroupLocked = forceGroup && !isEdit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" dir={dir}>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-6 py-5 shrink-0">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shrink-0">
                <BookOpen className="size-6" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <DialogTitle>{title}</DialogTitle>
                {parentAccount && (
                  <DialogDescription>
                    {L('ضمن:', 'Under:')} <span className="font-mono">{parentAccount.code}</span> — {parentAccount.nameAr}
                  </DialogDescription>
                )}
                {isSystem && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Lock className="size-3 text-amber-500" />
                    <span className="text-xs text-amber-600 dark:text-amber-400">{t('coa.detail.systemHint')}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-0">
            <ScrollArea className="max-h-[60vh]">
              <div className="p-6 space-y-5">

                {/* Basic Info */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.basic')} />
                  <FieldRow>
                    <FieldBlock id="code" label={t('coa.detail.code')} error={fieldError('code')}>
                      <Input
                        id="code"
                        value={form.code}
                        onChange={(e) => set('code', e.target.value)}
                        placeholder={t('coa.dialog.autoCode')}
                        disabled={isSystem}
                        className={cn(INPUT_CLS, 'font-mono')}
                        dir="ltr"
                      />
                    </FieldBlock>
                    <FieldBlock id="shortName" label={t('coa.detail.shortName')} error={fieldError('shortName')}>
                      <Input
                        id="shortName"
                        value={form.shortName}
                        onChange={(e) => set('shortName', e.target.value)}
                        className={INPUT_CLS}
                      />
                    </FieldBlock>
                    <FieldBlock id="nameAr" label={t('coa.detail.nameAr')} required error={fieldError('nameAr')}>
                      <Input
                        id="nameAr"
                        value={form.nameAr}
                        onChange={(e) => set('nameAr', e.target.value)}
                        required
                        className={INPUT_CLS}
                        dir="rtl"
                      />
                    </FieldBlock>
                    <FieldBlock id="nameEn" label={t('coa.detail.nameEn')} error={fieldError('nameEn')}>
                      <Input
                        id="nameEn"
                        value={form.nameEn}
                        onChange={(e) => set('nameEn', e.target.value)}
                        className={INPUT_CLS}
                        dir="ltr"
                      />
                    </FieldBlock>
                    <FieldBlock id="accountClass" label={t('coa.detail.class')} required error={fieldError('accountClass')}>
                      <Select
                        value={form.accountClass}
                        onValueChange={(v) => set('accountClass', v as AccountClass)}
                        disabled={isSystem}
                      >
                        <SelectTrigger id="accountClass" className={SELECT_TRIGGER_CLS} dir={dir}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {ALL_CLASSES.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              <span className={cn('text-xs font-semibold', CLASS_META[cls].color)}>
                                {isRTL ? CLASS_META[cls].labelAr : CLASS_META[cls].labelEn}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                    <FieldBlock id="subtype" label={t('coa.detail.subtype')} error={fieldError('subtype')}>
                      {subtypes.length > 0 ? (
                        <Select value={form.subtype || '__none'} onValueChange={(v) => set('subtype', v === '__none' ? '' : v)}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent dir={dir}>
                            <SelectItem value="__none">—</SelectItem>
                            {subtypes.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={form.subtype}
                          onChange={(e) => set('subtype', e.target.value)}
                          className={INPUT_CLS}
                          dir="ltr"
                        />
                      )}
                    </FieldBlock>
                    <FieldBlock id="parentId" label={t('coa.detail.parent')} error={fieldError('parentId')} fullWidth>
                      <Select value={form.parentId || '__none'} onValueChange={(v) => set('parentId', v === '__none' ? '' : v)} disabled={isSystem}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                          <SelectValue placeholder={t('coa.noParent')} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          <SelectItem value="__none">{t('coa.noParent')}</SelectItem>
                          {flatAccounts
                            .filter((a) => a.id !== editing?.id)
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="font-mono text-xs me-1" dir="ltr">{a.code}</span>
                                <span>{a.nameAr}</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                  </FieldRow>
                </div>

                {/* Accounting Behavior */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.accounting')} />
                  <div className="space-y-3">
                    {/* isPosting toggle */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                      <Switch
                        id="isPosting"
                        checked={form.isPosting}
                        onCheckedChange={(v) => set('isPosting', v)}
                        disabled={isSystem || isGroupLocked}
                        className="data-[state=checked]:bg-blue-600 mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor="isPosting" className="text-sm font-semibold cursor-pointer">
                          {form.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {form.isPosting ? t('coa.dialog.postingAccount') : t('coa.dialog.groupAccount')}
                        </p>
                      </div>
                    </div>

                    <FieldRow>
                      <FieldBlock id="normalBalance" label={t('coa.detail.normalBalance')} error={fieldError('normalBalance')}>
                        <Select value={form.normalBalance || '__auto'} onValueChange={(v) => set('normalBalance', v === '__auto' ? '' : v)}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                            <SelectValue placeholder={L('تلقائي حسب النوع', 'Auto by class')} />
                          </SelectTrigger>
                          <SelectContent dir={dir}>
                            <SelectItem value="__auto">{L('تلقائي', 'Auto')}</SelectItem>
                            <SelectItem value="debit">{t('coa.balance.debit')}</SelectItem>
                            <SelectItem value="credit">{t('coa.balance.credit')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                      <FieldBlock id="currencyId" label={t('coa.detail.currency')} error={fieldError('currencyId')}>
                        <Select value={form.currencyId || '__default'} onValueChange={(v) => set('currencyId', v === '__default' ? '' : v)}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                            <SelectValue placeholder={L('الافتراضية', 'Default')} />
                          </SelectTrigger>
                          <SelectContent dir={dir}>
                            <SelectItem value="__default">{L('الافتراضية', 'Default')}</SelectItem>
                            {(meta?.currencies ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="font-mono me-1">{c.code}</span>{c.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                    </FieldRow>

                    {/* Posting-only fields */}
                    {form.isPosting && (
                      <>
                        <FieldRow>
                          <FieldBlock id="role" label={t('coa.detail.role')} error={fieldError('role')}>
                            <Select value={form.role || '__none'} onValueChange={(v) => set('role', v === '__none' ? '' : v)}>
                              <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                                <SelectValue placeholder={L('بدون دور', 'No role')} />
                              </SelectTrigger>
                              <SelectContent dir={dir}>
                                <SelectItem value="__none">{L('بدون دور', 'No role')}</SelectItem>
                                {allowedRoles.map((r) => (
                                  <SelectItem key={r.code} value={r.code}>
                                    <span>{isRTL ? r.nameAr : r.nameEn}</span>
                                    {r.required && <Badge className="ms-1 text-[10px] bg-rose-50 text-rose-700 border-rose-200">{t('coa.roles.required')}</Badge>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldBlock>
                          <div />
                        </FieldRow>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch
                              checked={form.allowReconciliation}
                              onCheckedChange={(v) => set('allowReconciliation', v)}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('coa.detail.allowReconciliation')}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch
                              checked={form.allowManualEntry}
                              onCheckedChange={(v) => set('allowManualEntry', v)}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('coa.detail.allowManualEntry')}</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tax — posting only */}
                {form.isPosting && (
                  <div className={SECTION_CLS}>
                    <SectionHead label={t('coa.tab.taxes')} />
                    <FieldRow>
                      <FieldBlock id="taxBehavior" label={t('coa.detail.taxBehavior')} error={fieldError('taxBehavior')}>
                        <Select value={form.taxBehavior} onValueChange={(v) => set('taxBehavior', v as TaxBehavior)}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir={dir}>
                            <SelectItem value="none">{t('coa.tax.none')}</SelectItem>
                            <SelectItem value="taxable">{t('coa.tax.taxable')}</SelectItem>
                            <SelectItem value="exempt">{t('coa.tax.exempt')}</SelectItem>
                            <SelectItem value="zero_rated">{t('coa.tax.zero_rated')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                      {form.taxBehavior !== 'none' && (
                        <FieldBlock id="taxCodeId" label={t('coa.detail.taxCode')} error={fieldError('taxCodeId')}>
                          <Select value={form.taxCodeId || '__none'} onValueChange={(v) => set('taxCodeId', v === '__none' ? '' : v)}>
                            <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent dir={dir}>
                              <SelectItem value="__none">—</SelectItem>
                              {(meta?.taxCodes ?? []).map((tc) => (
                                <SelectItem key={tc.id} value={tc.id}>
                                  <span className="font-mono me-1">{tc.code}</span>{tc.nameAr} ({tc.rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldBlock>
                      )}
                    </FieldRow>
                  </div>
                )}

                {/* Reporting */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.reporting')} />
                  <FieldRow>
                    <FieldBlock id="fsSection" label={t('coa.detail.fsSection')} error={fieldError('fsSection')}>
                      <Select value={form.fsSection || '__none'} onValueChange={(v) => set('fsSection', v === '__none' ? '' : v)}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          <SelectItem value="__none">—</SelectItem>
                          <SelectItem value="balance_sheet">{t('coa.fs.balance_sheet')}</SelectItem>
                          <SelectItem value="income_statement">{t('coa.fs.income_statement')}</SelectItem>
                          <SelectItem value="cash_flow">{t('coa.fs.cash_flow')}</SelectItem>
                          <SelectItem value="equity_statement">{t('coa.fs.equity_statement')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                    <FieldBlock id="reportCategory" label={t('coa.detail.reportCategory')} error={fieldError('reportCategory')}>
                      <Input
                        id="reportCategory"
                        value={form.reportCategory}
                        onChange={(e) => set('reportCategory', e.target.value)}
                        className={INPUT_CLS}
                      />
                    </FieldBlock>
                  </FieldRow>
                </div>

                {/* Dimensions */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.dimensions')} />
                  <div className="flex flex-wrap gap-4">
                    {([
                      { key: 'requireCostCenter', label: t('coa.detail.requireCostCenter') },
                      { key: 'requireBranch', label: t('coa.detail.requireBranch') },
                      { key: 'requireProject', label: t('coa.detail.requireProject') },
                    ] as const).map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={form[key]}
                          onCheckedChange={(v) => set(key, v)}
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.status')} />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(v) => set('active', v)}
                      className="data-[state=checked]:bg-blue-600"
                    />
                    <div>
                      <Label htmlFor="active" className="text-sm font-semibold cursor-pointer">
                        {form.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.active
                          ? L('الحساب نشط ويقبل العمليات', 'Account is active and accepts operations')
                          : L('الحساب موقوف ولا يقبل قيوداً جديدة', 'Account is inactive and does not accept new entries')}
                      </p>
                    </div>
                  </label>
                </div>

              </div>
            </ScrollArea>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('action.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending
                ? L('جاري الحفظ...', 'Saving...')
                : isEdit ? t('action.save') : t('action.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
