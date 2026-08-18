'use client'

import { useState, useCallback, useEffect } from 'react'
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

const SECTION_CLS = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-3.5 text-start'
const LABEL_CLS = 'text-xs font-semibold text-slate-700 dark:text-slate-300 text-start block mb-1'
const INPUT_CLS = 'h-9 border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 text-start'
const SELECT_TRIGGER_CLS = 'h-9 border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-start'

function SectionHead({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 text-start">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>{children}</div>
}

function FieldBlock({
  id, label, required, error, children, fullWidth,
}: {
  id?: string; label: string; required?: boolean; error?: string; children: React.ReactNode; fullWidth?: boolean
}) {
  return (
    <div className={cn('space-y-1 text-start', fullWidth && 'col-span-1 sm:col-span-2')}>
      <Label htmlFor={id} className={LABEL_CLS}>
        {label}{required && <span className="text-rose-500 ms-1 font-bold">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1 text-start">
          <AlertCircle className="size-3.5 shrink-0" />{error}
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
    accountClass: parentAccount?.accountClass ?? editing?.accountClass ?? 'asset',
    subtype: editing?.subtype ?? '',
    parentId: editing?.parentId ?? parentAccount?.id ?? '',
    isPosting: forceGroup ? false : (editing?.isPosting ?? !forceGroup),
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

  // Sync state whenever dialog opens or editing/parent target changes
  useEffect(() => {
    if (open) {
      const defaultClass: AccountClass = parentAccount?.accountClass ?? editing?.accountClass ?? 'asset'
      const defaultIsPosting = forceGroup ? false : (editing?.isPosting ?? !forceGroup)

      setForm({
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
    }
  }, [open, editing, parentAccount, forceGroup])

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
      <DialogContent className="max-w-2xl p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800" dir={dir}>
        <form onSubmit={handleSubmit} dir={dir} className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-6 py-5 shrink-0 bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-700/40 text-start relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/70 border border-blue-100 dark:border-blue-400/30 text-blue-600 dark:text-blue-100 flex items-center justify-center shadow-sm shrink-0">
                <BookOpen className="size-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0 text-start">
                <DialogTitle className="text-xl font-bold text-[#1a3a5f] dark:text-white">
                  {title}
                </DialogTitle>
                {parentAccount && (
                  <DialogDescription className="text-sm text-[#4a6a8f] dark:text-blue-100/90 flex items-center gap-1.5 flex-wrap">
                    <span>{L('ضمن:', 'Under:')}</span>
                    <span className="font-mono bg-blue-100/70 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs font-semibold" dir="ltr">
                      {parentAccount.code}
                    </span>
                    <span>—</span>
                    <span>{isRTL ? parentAccount.nameAr : (parentAccount.nameEn || parentAccount.nameAr)}</span>
                  </DialogDescription>
                )}
                {isSystem && (
                  <div className="flex items-center gap-1.5 mt-1 text-start">
                    <Lock className="size-3.5 text-amber-500 dark:text-amber-300 shrink-0" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-200">
                      {t('coa.detail.systemHint')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-0 dark:bg-slate-950">
            <ScrollArea className="max-h-[60vh]">
              <div className="p-6 space-y-5 text-start" dir={dir}>

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
                        dir={dir}
                      />
                    </FieldBlock>
                    <FieldBlock id="shortName" label={t('coa.detail.shortName')} error={fieldError('shortName')}>
                      <Input
                        id="shortName"
                        value={form.shortName}
                        onChange={(e) => set('shortName', e.target.value)}
                        className={INPUT_CLS}
                        dir={dir}
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
                        dir={dir as 'ltr' | 'rtl'}
                      >
                        <SelectTrigger id="accountClass" className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
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
                        <Select value={form.subtype || '__none'} onValueChange={(v) => set('subtype', v === '__none' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
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
                          dir={dir}
                        />
                      )}
                    </FieldBlock>
                    <FieldBlock id="parentId" label={t('coa.detail.parent')} error={fieldError('parentId')} fullWidth>
                      <Select value={form.parentId || '__none'} onValueChange={(v) => set('parentId', v === '__none' ? '' : v)} disabled={isSystem} dir={dir as 'ltr' | 'rtl'}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                          <SelectValue placeholder={t('coa.noParent')} />
                        </SelectTrigger>
                        <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                          <SelectItem value="__none">{t('coa.noParent')}</SelectItem>
                          {flatAccounts
                            .filter((a) => a.id !== editing?.id)
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="font-mono text-xs me-1.5" dir="ltr">{a.code}</span>
                                <span>{isRTL ? a.nameAr : (a.nameEn || a.nameAr)}</span>
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
                  <div className="space-y-3.5">
                    {/* isPosting toggle */}
                    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-start">
                      <Switch
                        id="isPosting"
                        checked={form.isPosting}
                        onCheckedChange={(v) => set('isPosting', v)}
                        disabled={isSystem || isGroupLocked}
                        className="data-[state=checked]:bg-blue-600 mt-0.5 shrink-0"
                      />
                      <div className="space-y-0.5 flex-1 min-w-0 text-start">
                        <Label htmlFor="isPosting" className="text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-200 block">
                          {form.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
                        </Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {form.isPosting ? t('coa.dialog.postingAccount') : t('coa.dialog.groupAccount')}
                        </p>
                      </div>
                    </div>

                    <FieldRow>
                      <FieldBlock id="normalBalance" label={t('coa.detail.normalBalance')} error={fieldError('normalBalance')}>
                        <Select value={form.normalBalance || '__auto'} onValueChange={(v) => set('normalBalance', v === '__auto' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                            <SelectValue placeholder={L('تلقائي حسب النوع', 'Auto by class')} />
                          </SelectTrigger>
                          <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                            <SelectItem value="__auto">{L('تلقائي', 'Auto')}</SelectItem>
                            <SelectItem value="debit">{t('coa.balance.debit')}</SelectItem>
                            <SelectItem value="credit">{t('coa.balance.credit')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                      <FieldBlock id="currencyId" label={t('coa.detail.currency')} error={fieldError('currencyId')}>
                        <Select value={form.currencyId || '__default'} onValueChange={(v) => set('currencyId', v === '__default' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                            <SelectValue placeholder={L('الافتراضية', 'Default')} />
                          </SelectTrigger>
                          <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                            <SelectItem value="__default">{L('الافتراضية', 'Default')}</SelectItem>
                            {(meta?.currencies ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="font-mono me-1.5" dir="ltr">{c.code}</span>
                                <span>{c.nameAr}</span>
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
                          <FieldBlock id="role" label={t('coa.detail.role')} error={fieldError('role')} fullWidth>
                            <Select value={form.role || '__none'} onValueChange={(v) => set('role', v === '__none' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                              <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                                <SelectValue placeholder={L('بدون دور مفروض', 'No mandatory role')} />
                              </SelectTrigger>
                              <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                                <SelectItem value="__none">{L('بدون دور مفروض', 'No mandatory role')}</SelectItem>
                                {allowedRoles.map((r) => (
                                  <SelectItem key={r.code} value={r.code}>
                                    <div className="flex items-center gap-2">
                                      <span>{isRTL ? r.nameAr : r.nameEn}</span>
                                      {r.required && (
                                        <Badge className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 px-1.5 py-0">
                                          {t('coa.roles.required')}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldBlock>
                        </FieldRow>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-start">
                            <Switch
                              checked={form.allowReconciliation}
                              onCheckedChange={(v) => set('allowReconciliation', v)}
                              className="data-[state=checked]:bg-blue-600 shrink-0"
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('coa.detail.allowReconciliation')}</span>
                          </label>
                          <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-start">
                            <Switch
                              checked={form.allowManualEntry}
                              onCheckedChange={(v) => set('allowManualEntry', v)}
                              className="data-[state=checked]:bg-blue-600 shrink-0"
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
                        <Select value={form.taxBehavior} onValueChange={(v) => set('taxBehavior', v as TaxBehavior)} dir={dir as 'ltr' | 'rtl'}>
                          <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                            <SelectItem value="none">{t('coa.tax.none')}</SelectItem>
                            <SelectItem value="taxable">{t('coa.tax.taxable')}</SelectItem>
                            <SelectItem value="exempt">{t('coa.tax.exempt')}</SelectItem>
                            <SelectItem value="zero_rated">{t('coa.tax.zero_rated')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldBlock>
                      {form.taxBehavior !== 'none' && (
                        <FieldBlock id="taxCodeId" label={t('coa.detail.taxCode')} error={fieldError('taxCodeId')}>
                          <Select value={form.taxCodeId || '__none'} onValueChange={(v) => set('taxCodeId', v === '__none' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                            <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                              <SelectItem value="__none">—</SelectItem>
                              {(meta?.taxCodes ?? []).map((tc) => (
                                <SelectItem key={tc.id} value={tc.id}>
                                  <span className="font-mono me-1.5" dir="ltr">{tc.code}</span>
                                  <span>{tc.nameAr} ({tc.rate}%)</span>
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
                      <Select value={form.fsSection || '__none'} onValueChange={(v) => set('fsSection', v === '__none' ? '' : v)} dir={dir as 'ltr' | 'rtl'}>
                        <SelectTrigger className={SELECT_TRIGGER_CLS} dir={dir as 'ltr' | 'rtl'}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent dir={dir as 'ltr' | 'rtl'} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
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
                        dir={dir}
                      />
                    </FieldBlock>
                  </FieldRow>
                </div>

                {/* Dimensions */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.dimensions')} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { key: 'requireCostCenter', label: t('coa.detail.requireCostCenter') },
                      { key: 'requireBranch', label: t('coa.detail.requireBranch') },
                      { key: 'requireProject', label: t('coa.detail.requireProject') },
                    ] as const).map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-start">
                        <Switch
                          checked={form[key]}
                          onCheckedChange={(v) => set(key, v)}
                          className="data-[state=checked]:bg-blue-600 shrink-0"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className={SECTION_CLS}>
                  <SectionHead label={t('coa.section.status')} />
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-start">
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(v) => set('active', v)}
                      className="data-[state=checked]:bg-blue-600 mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5 flex-1 min-w-0 text-start">
                      <Label htmlFor="active" className="text-sm font-semibold cursor-pointer text-slate-800 dark:text-slate-200 block">
                        {form.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
                      </Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {form.active
                          ? L('الحساب نشط ويقبل العمليات القياسية', 'Account is active and accepts standard operations')
                          : L('الحساب موقوف ولا يقبل قيوداً جديدة', 'Account is inactive and does not accept new entries')}
                      </p>
                    </div>
                  </label>
                </div>

              </div>
            </ScrollArea>
          </DialogBody>

          <DialogFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium shadow-sm"
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
