'use client'

// =============================================================================
// تهيئة النظام — شاشة المتغيرات العامة
//
// Standalone module for تهيئة النظام → الإعدادات العامة → المتغيرات العامة.
//
// Sources of truth:
//   • /api/erp/config  (GET → bundle, PUT → validated save)
//   • CONFIG_REGISTRY  (used locally for grouping metadata)
//
// Design principles:
//   • Every field shows an enforcement badge (Enforced / Not Enforced Yet).
//   • System-critical changes require a confirmation dialog.
//   • Bilingual (AR/EN) — isRTL drives layout direction.
//   • Dark-mode aware via Tailwind / shadcn tokens.
//   • No duplication of CurrenciesModule or OrgStructureModule.
// =============================================================================

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Save, RotateCcw, Loader2, ShieldCheck, CircleDashed, ShieldAlert,
  KeyRound, BookOpen, Coins, FileText, Hash, Globe, Lock, Sparkles,
} from 'lucide-react'

// ─── Types (mirror of /api/erp/config) ────────────────────────────────────────
interface Enforcement {
  status: 'enforced' | 'ui_only'
  readBy?: string[]
  plannedPhase?: number
  effectAr?: string
  effectEn?: string
}
interface Definition {
  key: string
  category: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret'
  labelAr: string
  labelEn: string
  descriptionAr?: string
  descriptionEn?: string
  defaultValue: string
  options?: string[]
  scope: 'global' | 'company' | 'branch'
  isSystem: boolean
  secret: boolean
  number?: { min?: number; max?: number; integer?: boolean }
  sortOrder: number
  enforcement: Enforcement
}
interface ValueEntry { value: string; isSecret: boolean; hasValue: boolean }
interface ConfigBundle {
  tree: unknown[]
  definitions: Definition[]
  values: Record<string, ValueEntry>
}

// ─── The keys we own (subset of general + security leaves) ────────────────────
const GENERAL_VARS_KEYS = new Set([
  'coa.subAccountGrade',
  'coa.accountCodeNumericOnly',
  'coa.includeParentInCode',
  'coa.codeMinLength',
  'coa.codeMaxLength',
  'finance.enableForeignCurrencies',
  'finance.taxPostingPolicy',
  'finance.decimalPlaces',
  'display.showForeignName',
  'display.weekStartDay',
  'security.passwordComplexityPolicy',
  'ai.enabled',
  'ai.googleApiKey',
])

// ─── Domain grouping ──────────────────────────────────────────────────────────
interface DomainGroup {
  id: string
  labelAr: string
  labelEn: string
  icon: React.ReactNode
  keys: string[]
}

const DOMAIN_GROUPS: DomainGroup[] = [
  {
    id: 'coa',
    labelAr: 'دليل الحسابات',
    labelEn: 'Chart of Accounts',
    icon: <BookOpen className="size-4" />,
    keys: [
      'coa.subAccountGrade',
      'coa.accountCodeNumericOnly',
      'coa.includeParentInCode',
      'coa.codeMinLength',
      'coa.codeMaxLength',
    ],
  },
  {
    id: 'finance',
    labelAr: 'المالية والعملات والضرائب',
    labelEn: 'Finance, Currencies & Tax',
    icon: <Coins className="size-4" />,
    keys: [
      'finance.enableForeignCurrencies',
      'finance.taxPostingPolicy',
      'finance.decimalPlaces',
    ],
  },
  {
    id: 'display',
    labelAr: 'العرض واللغة',
    labelEn: 'Display & Language',
    icon: <Globe className="size-4" />,
    keys: ['display.showForeignName', 'display.weekStartDay'],
  },
  {
    id: 'security',
    labelAr: 'الأمان',
    labelEn: 'Security',
    icon: <Lock className="size-4" />,
    keys: ['security.passwordComplexityPolicy'],
  },
  {
    id: 'ai',
    labelAr: 'الذكاء الاصطناعي',
    labelEn: 'Artificial Intelligence',
    icon: <Sparkles className="size-4" />,
    keys: ['ai.enabled', 'ai.googleApiKey'],
  },
]

// ─── Select option labels ─────────────────────────────────────────────────────
const OPTION_LABELS: Record<string, Record<string, { ar: string; en: string }>> = {
  'finance.taxPostingPolicy': {
    net:   { ar: 'صافي (حساب ضريبة منفصل)', en: 'Net (separate tax account)' },
    gross: { ar: 'إجمالي (مدمج مع المبلغ)', en: 'Gross (included in base amount)' },
  },
  'display.weekStartDay': {
    '0': { ar: 'الأحد', en: 'Sunday' },
    '1': { ar: 'الاثنين', en: 'Monday' },
    '6': { ar: 'السبت', en: 'Saturday' },
  },
  'security.passwordComplexityPolicy': {
    basic:    { ar: 'أساسي (حروف وأرقام)', en: 'Basic (letters + digits)' },
    standard: { ar: 'قياسي (كبير + صغير + أرقام)', en: 'Standard (upper+lower+digits)' },
    strict:   { ar: 'صارم (كبير + صغير + أرقام + رموز)', en: 'Strict (upper+lower+digits+symbols)' },
  },
  'appearance.theme': {
    light:  { ar: 'فاتح', en: 'Light' },
    dark:   { ar: 'داكن', en: 'Dark' },
    system: { ar: 'تلقائي', en: 'System' },
  },
  'appearance.language': {
    ar: { ar: 'العربية', en: 'Arabic' },
    en: { ar: 'الإنجليزية', en: 'English' },
  },
  'appearance.dateCalendar': {
    gregorian: { ar: 'ميلادي', en: 'Gregorian' },
    hijri:     { ar: 'هجري', en: 'Hijri' },
  },
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchBundle(): Promise<ConfigBundle> {
  const r = await fetch('/api/erp/config')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  return j.data ?? j
}

// ─── Component ─────────────────────────────────────────────────────────────────
interface Props {
  /** When true the module is rendered inside SystemConfigModule (no outer card). */
  embedded?: boolean
}

export default function GeneralVarsModule({ embedded = false }: Props) {
  const { isRTL, locale } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()

  const [dirty, setDirty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [confirmSave, setConfirmSave] = useState(false)

  const { data, isLoading } = useQuery<ConfigBundle>({
    queryKey: ['system-config'],
    queryFn: fetchBundle,
  })

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const r = await fetch('/api/erp/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changes, reason: reason || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message ?? j.error ?? L('فشل الحفظ', 'Save failed'))
      return j
    },
    onSuccess: () => {
      toast.success(L('تم حفظ المتغيرات العامة وتسجيلها في سجل التدقيق', 'General variables saved and audited'))
      setDirty({})
      setReason('')
      qc.invalidateQueries({ queryKey: ['system-config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const r = await fetch('/api/erp/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message ?? L('فشل الإعادة', 'Reset failed'))
      return j
    },
    onSuccess: (_j, key) => {
      toast.success(L(`تمت إعادة «${key}» إلى الافتراضي`, `"${key}" reset to default`))
      setDirty((d) => { const n = { ...d }; delete n[key]; return n })
      qc.invalidateQueries({ queryKey: ['system-config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Filter definitions to only our keys
  const ourDefs = useMemo<Record<string, Definition>>(() => {
    const m: Record<string, Definition> = {}
    for (const d of data?.definitions ?? []) {
      if (GENERAL_VARS_KEYS.has(d.key)) m[d.key] = d
    }
    return m
  }, [data])

  const currentValue = (key: string): string => {
    if (key in dirty) return dirty[key]
    return data?.values[key]?.value ?? ourDefs[key]?.defaultValue ?? ''
  }

  const setValue = (key: string, value: string) => {
    setDirty((prev) => {
      const next = { ...prev }
      const server = data?.values[key]?.value ?? ''
      if (value === server) delete next[key]
      else next[key] = value
      return next
    })
  }

  const dirtyCount = Object.keys(dirty).length
  const dirtyHasSystem = Object.keys(dirty).some((k) => ourDefs[k]?.isSystem)

  if (isLoading) {
    return (
      <Card className="p-10 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        {L('جارٍ تحميل المتغيرات العامة…', 'Loading general variables…')}
      </Card>
    )
  }

  const content = (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="outline" className="gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          <ShieldCheck className="size-3.5" />
          {L(
            `${Object.values(ourDefs).filter((d) => d.enforcement.status === 'enforced').length} متغير نافذ في منطق العمل`,
            `${Object.values(ourDefs).filter((d) => d.enforcement.status === 'enforced').length} variables enforced in business logic`
          )}
        </Badge>
        <Badge variant="outline" className="gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30">
          <CircleDashed className="size-3.5" />
          {L(
            `${Object.values(ourDefs).filter((d) => d.enforcement.status === 'ui_only').length} متغير لا يؤثر بعد`,
            `${Object.values(ourDefs).filter((d) => d.enforcement.status === 'ui_only').length} not enforced yet`
          )}
        </Badge>
      </div>

      {/* Domain groups */}
      {DOMAIN_GROUPS.map((group) => {
        const groupDefs = group.keys
          .map((k) => ourDefs[k])
          .filter(Boolean)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        if (!groupDefs.length) return null

        return (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-primary">{group.icon}</span>
                {L(group.labelAr, group.labelEn)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-5">
                {groupDefs.map((def) => (
                  <FieldRow
                    key={def.key}
                    def={def}
                    value={currentValue(def.key)}
                    serverEntry={data?.values?.[def.key]}
                    isDirty={def.key in dirty}
                    onChange={(v) => setValue(def.key, v)}
                    onReset={() => resetMutation.mutate(def.key)}
                    L={L}
                    isRTL={isRTL}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* ── Sticky save bar ── */}
      {dirtyCount > 0 && (
        <Card className="sticky bottom-3 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-primary/40 shadow-xl bg-card/95 backdrop-blur z-20">
          <Badge variant="secondary" className="self-center shrink-0">
            {L(`${dirtyCount} تغيير غير محفوظ`, `${dirtyCount} unsaved change(s)`)}
          </Badge>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={L('سبب التغيير (يُسجَّل في سجل التدقيق)…', 'Reason for change (recorded in audit)…')}
            className="h-9 flex-1 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDirty({}); setReason('') }}
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={saveMutation.isPending}
              onClick={() =>
                dirtyHasSystem ? setConfirmSave(true) : saveMutation.mutate(dirty)
              }
            >
              {saveMutation.isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <Save className="size-4" />}
              {L('حفظ التغييرات', 'Save changes')}
            </Button>
          </div>
        </Card>
      )}

      {/* Confirmation for system-critical keys */}
      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {L('تأكيد تعديل متغيرات نظامية', 'Confirm critical variable change')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {L(
                'بعض المتغيرات التي تعدّلها نظامية حساسة تؤثر مباشرة في منطق العمل (دليل الحسابات، الترحيل، الأمان…). سيُسجَّل التغيير باسمك في سجل التدقيق.',
                'Some of your changes touch critical system variables that directly affect business logic (chart of accounts, posting, security…). The change will be recorded under your name in the audit log.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L('تراجع', 'Back')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmSave(false); saveMutation.mutate(dirty) }}
            >
              {L('تأكيد الحفظ', 'Confirm save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  if (embedded) return content

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-1 mb-5">
        <h2 className="text-xl font-bold tracking-tight">
          {L('المتغيرات العامة', 'General Variables')}
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {L(
            'متغيرات سلوكية عامة تؤثر في دليل الحسابات، العملات، الضرائب، العرض، والأمان. كل متغير يُبيّن إن كان نافذاً فعلياً في منطق العمل أم مخططاً لمرحلة قادمة.',
            'Global behavioural variables that affect the chart of accounts, currencies, tax, display, and security. Each variable shows whether it is currently enforced in business logic or planned for a future phase.'
          )}
        </p>
      </div>
      <TooltipProvider delayDuration={150}>{content}</TooltipProvider>
    </TooltipProvider>
  )
}

// ─── FieldRow ──────────────────────────────────────────────────────────────────
function FieldRow({
  def, value, serverEntry, isDirty, onChange, onReset, L, isRTL,
}: {
  def: Definition
  value: string
  serverEntry?: ValueEntry
  isDirty: boolean
  onChange: (v: string) => void
  onReset: () => void
  L: (ar: string, en: string) => string
  isRTL: boolean
}) {
  const enforced = def.enforcement.status === 'enforced'
  const numberHint =
    def.type === 'number' && def.number
      ? [
          def.number.min !== undefined ? `≥ ${def.number.min}` : '',
          def.number.max !== undefined ? `≤ ${def.number.max}` : '',
        ].filter(Boolean).join(' ، ')
      : ''

  const desc = isRTL ? def.descriptionAr : def.descriptionEn

  return (
    <div className={cn(
      'flex flex-col gap-1.5 rounded-lg p-3 -m-1 transition-colors',
      isDirty && 'bg-amber-500/5 ring-1 ring-amber-500/20 dark:bg-amber-900/10',
    )}>
      {/* Label row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Label className="text-[13px] font-medium">
          {L(def.labelAr, def.labelEn)}
        </Label>
        {def.isSystem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ShieldAlert className="size-3.5 text-orange-500" />
            </TooltipTrigger>
            <TooltipContent>
              {L('متغير نظامي حساس — يتطلب صلاحية أعلى', 'Critical system variable — requires elevated capability')}
            </TooltipContent>
          </Tooltip>
        )}
        {def.secret && <KeyRound className="size-3.5 text-violet-500" />}
        <span className="flex-1" />
        <EnforcementBadge def={def} L={L} />
      </div>

      {/* Description */}
      {desc && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
      )}

      {/* Input */}
      {def.type === 'boolean' ? (
        <div className="flex items-center gap-2 h-9">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
          />
          <span className="text-xs text-muted-foreground">
            {value === 'true' ? L('مفعَّل', 'Enabled') : L('معطَّل', 'Disabled')}
          </span>
        </div>
      ) : def.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => {
              const lbl = OPTION_LABELS[def.key]?.[o]
              return (
                <SelectItem key={o} value={o}>
                  {lbl ? L(lbl.ar, lbl.en) : o}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      ) : def.type === 'secret' ? (
        <Input
          type="password"
          className="h-9 font-mono"
          placeholder={
            serverEntry?.hasValue
              ? L(`قيمة سرية محفوظة (${serverEntry.value})`, `Secret saved (${serverEntry.value})`)
              : L('لم تُضبط بعد', 'Not set yet')
          }
          value={isDirty ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          type={def.type === 'number' ? 'number' : 'text'}
          className="h-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={def.type === 'number' ? 'ltr' : undefined}
        />
      )}

      {/* Footer: number hint + reset */}
      <div className="flex items-center gap-2 min-h-4">
        {numberHint && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{numberHint}</span>
        )}
        <span className="flex-1" />
        {(isDirty || (serverEntry?.hasValue && serverEntry.value !== def.defaultValue && !def.secret)) && (
          <button
            onClick={onReset}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="size-3" />
            {L('الافتراضي', 'Default')}
            {!def.secret && def.defaultValue !== '' && (
              <code className="text-[10px] bg-muted px-1 rounded">{def.defaultValue}</code>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── EnforcementBadge ──────────────────────────────────────────────────────────
function EnforcementBadge({
  def, L,
}: {
  def: Definition
  L: (ar: string, en: string) => string
}) {
  if (def.enforcement.status === 'enforced') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5"
          >
            <ShieldCheck className="size-3" />
            {L('نافذ', 'Enforced')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          <p className="font-medium mb-1">
            {L(
              def.enforcement.effectAr ?? 'يقرأه منطق العمل مباشرة',
              def.enforcement.effectEn ?? 'Read directly by business logic',
            )}
          </p>
          {def.enforcement.readBy?.map((f) => (
            <p key={f} className="text-[11px] font-mono opacity-80" dir="ltr">{f}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] px-1.5"
        >
          <CircleDashed className="size-3" />
          {L('لا يؤثر بعد', 'Not enforced yet')}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        {L(
          `يُحفظ ويُدقَّق لكن لا يقرأه منطق العمل بعد${def.enforcement.plannedPhase ? ` — مقرر في المرحلة ${def.enforcement.plannedPhase}` : ''}. هذه الشارة تختفي تلقائياً عند ربطه فعلياً.`,
          `Persisted and audited but not yet consumed by business logic${def.enforcement.plannedPhase ? ` — planned for phase ${def.enforcement.plannedPhase}` : ''}. The badge disappears automatically once wired.`
        )}
      </TooltipContent>
    </Tooltip>
  )
}
