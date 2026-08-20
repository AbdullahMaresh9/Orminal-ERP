'use client'

// =============================================================================
// تهيئة النظام — System Configuration Center
//
// Enterprise configuration center generated from the server-side registry:
// the tree (14 domains), the field metadata, validation constraints, scope
// levels and enforcement status all come from /api/erp/config — this screen
// cannot drift from what the server actually understands.
//
// Honesty rule: every field carries an enforcement badge. A key business
// logic actually reads shows WHERE it takes effect; a key that is persisted
// but not yet consumed is clearly marked "لا يؤثر بعد" instead of silently
// pretending. The governance test keeps these claims true.
// =============================================================================

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { useNav, type ModuleKey } from '@/stores/nav-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Settings, BookOpen, ShoppingCart, Truck, Boxes, FileText, Users, Factory,
  Store, Bell, Printer, Database, Plug, GitBranch, ChevronDown, Save,
  RotateCcw, Search, ShieldAlert, ShieldCheck, CircleDashed, KeyRound,
  History, ExternalLink, Loader2, X, type LucideIcon,
} from 'lucide-react'

// ---- lucide resolution for tree icons (server sends icon names) ----
const ICONS: Record<string, LucideIcon> = {
  Settings, BookOpen, ShoppingCart, Truck, Boxes, FileText, Users, Factory,
  Store, Bell, Printer, Database, Plug, GitBranch,
}

// Leaves whose data is managed by an existing master-data module
const LEAF_MODULE_LINKS: Record<string, ModuleKey> = {
  fiscal_periods: 'fiscal-periods',
  cost_centers: 'cost-centers',
  analytic_accounts: 'analytic-accounts',
  warehouses_cfg: 'warehouses',
  items: 'categories',
  payment_methods: 'payment-methods',
  document_types: 'document-templates',
}

// ---- API types (mirror of /api/erp/config GET) ----
interface TreeLeaf { id: string; labelAr: string; labelEn: string }
interface TreeSection { id: string; labelAr: string; labelEn: string; icon: string; leaves: TreeLeaf[] }
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
  tree: TreeSection[]
  definitions: Definition[]
  values: Record<string, ValueEntry>
}
interface AuditRow {
  id: string
  settingKey: string
  oldValue: string | null
  newValue: string | null
  category: string
  reason: string | null
  ipAddress: string | null
  createdAt: string
  user: { username: string; nameAr: string } | null
}

async function fetchBundle(): Promise<ConfigBundle> {
  const r = await fetch('/api/erp/config')
  if (r.status === 403) throw new Error('FORBIDDEN')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  return j.data ?? j
}

export default function SystemConfigModule() {
  const { isRTL, locale } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()
  const { setActiveModule } = useNav()

  const [activeLeaf, setActiveLeaf] = useState<string>('general')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['general']))
  const [dirty, setDirty] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [showAudit, setShowAudit] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['system-config'], queryFn: fetchBundle })

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const r = await fetch('/api/erp/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changes, reason: reason || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message ?? j.error ?? 'save failed')
      return j
    },
    onSuccess: () => {
      toast.success(L('تم حفظ الإعدادات وتسجيلها في سجل التدقيق', 'Settings saved and audited'))
      setDirty({})
      setReason('')
      qc.invalidateQueries({ queryKey: ['system-config'] })
      qc.invalidateQueries({ queryKey: ['config-audit'] })
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
      if (!r.ok) throw new Error(j.message ?? 'reset failed')
      return j
    },
    onSuccess: (_j, key) => {
      toast.success(L(`تمت إعادة «${key}» إلى الافتراضي`, `"${key}" reset to default`))
      setDirty((d) => { const n = { ...d }; delete n[key]; return n })
      qc.invalidateQueries({ queryKey: ['system-config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const auditQuery = useQuery({
    queryKey: ['config-audit'],
    enabled: showAudit,
    queryFn: async (): Promise<AuditRow[]> => {
      const r = await fetch('/api/erp/config/audit?limit=100')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      return j.data ?? j.items ?? []
    },
  })

  const defsByLeaf = useMemo(() => {
    const m = new Map<string, Definition[]>()
    for (const d of data?.definitions ?? []) {
      const arr = m.get(d.category) ?? []
      arr.push(d)
      m.set(d.category, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return m
  }, [data])

  const searchResults = useMemo(() => {
    if (!search.trim() || !data) return null
    const q = search.trim().toLowerCase()
    return data.definitions.filter(
      (d) =>
        d.labelAr.toLowerCase().includes(q) ||
        d.labelEn.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q)
    )
  }, [search, data])

  const enforcedTotal = useMemo(
    () => (data?.definitions ?? []).filter((d) => d.enforcement.status === 'enforced').length,
    [data]
  )

  const dirtyCount = Object.keys(dirty).length
  const dirtyHasSystem = useMemo(
    () => Object.keys(dirty).some((k) => data?.definitions.find((d) => d.key === k)?.isSystem),
    [dirty, data]
  )

  const currentValue = (d: Definition): string =>
    dirty[d.key] ?? data?.values[d.key]?.value ?? d.defaultValue

  const setValue = (key: string, value: string) => {
    setDirty((prev) => {
      const next = { ...prev }
      const server = data?.values[key]?.value ?? ''
      if (value === server) delete next[key]
      else next[key] = value
      return next
    })
  }

  // ---------------- permission / loading states ----------------
  if (error?.message === 'FORBIDDEN') {
    return (
      <ModuleShell
        title={L('تهيئة النظام', 'System Configuration')}
        icon={<SettingsIconSafe />}
      >
        <Card className="p-10 flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="size-10 text-destructive" />
          <p className="font-semibold">{L('صلاحية غير كافية', 'Insufficient permission')}</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {L(
              'عرض مركز التهيئة يتطلب صلاحية قراءة الإعدادات (CONFIG). تواصل مع مدير النظام لمنحك الصلاحية.',
              'Viewing the configuration center requires the CONFIG read capability. Ask your system administrator.'
            )}
          </p>
        </Card>
      </ModuleShell>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <ModuleShell
        title={L('تهيئة النظام', 'System Configuration')}
        description={L(
          'مركز التحكم الفعلي في سلوك النظام — كل إعداد يُظهر أين يؤثر',
          'The real control center — every setting shows where it takes effect'
        )}
        icon={<SettingsIconSafe />}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 hidden sm:inline-flex">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              {L(`${enforcedTotal} إعداد نافذ`, `${enforcedTotal} enforced`)}
            </Badge>
            <Button
              variant={showAudit ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAudit((v) => !v)}
              className="gap-1.5"
            >
              <History className="size-4" />
              {L('سجل التدقيق', 'Audit log')}
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <Card className="p-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {L('جارٍ تحميل سجل الإعدادات…', 'Loading configuration registry…')}
          </Card>
        ) : showAudit ? (
          <AuditPanel rows={auditQuery.data ?? []} loading={auditQuery.isLoading} L={L} locale={locale} />
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {/* ---------------- Tree ---------------- */}
            <Card className="w-full lg:w-72 shrink-0 p-2 lg:sticky lg:top-4">
              <div className="relative mb-2">
                <Search className={cn('absolute top-2.5 size-4 text-muted-foreground', isRTL ? 'right-2.5' : 'left-2.5')} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={L('بحث في الإعدادات…', 'Search settings…')}
                  className={cn('h-9', isRTL ? 'pr-8' : 'pl-8')}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className={cn('absolute top-2.5 text-muted-foreground hover:text-foreground', isRTL ? 'left-2.5' : 'right-2.5')}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <ScrollArea className="lg:h-[calc(100vh-16rem)]">
                <nav className="flex flex-col gap-0.5 pe-2">
                  {(data?.tree ?? []).map((section) => {
                    const Icon = ICONS[section.icon] ?? Settings
                    const open = openSections.has(section.id)
                    const sectionKeyCount = section.leaves.reduce(
                      (n, l) => n + (defsByLeaf.get(l.id)?.length ?? 0), 0)
                    return (
                      <div key={section.id}>
                        <button
                          onClick={() =>
                            setOpenSections((prev) => {
                              const next = new Set(prev)
                              if (next.has(section.id)) next.delete(section.id)
                              else next.add(section.id)
                              return next
                            })
                          }
                          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          <Icon className="size-4 text-primary shrink-0" />
                          <span className="flex-1 text-start truncate">
                            {L(section.labelAr, section.labelEn)}
                          </span>
                          {sectionKeyCount > 0 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">{sectionKeyCount}</span>
                          )}
                          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
                        </button>
                        {open && (
                          <div className={cn('flex flex-col gap-0.5 py-0.5', isRTL ? 'pr-5' : 'pl-5')}>
                            {section.leaves.map((leaf) => {
                              const count = defsByLeaf.get(leaf.id)?.length ?? 0
                              const leafDirty = (defsByLeaf.get(leaf.id) ?? []).some((d) => d.key in dirty)
                              return (
                                <button
                                  key={leaf.id}
                                  onClick={() => { setActiveLeaf(leaf.id); setSearch('') }}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors text-start',
                                    activeLeaf === leaf.id && !search
                                      ? 'bg-primary/10 text-primary font-medium'
                                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                  )}
                                >
                                  <span className="flex-1 truncate">{L(leaf.labelAr, leaf.labelEn)}</span>
                                  {leafDirty && <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />}
                                  {count === 0 && <CircleDashed className="size-3 shrink-0 opacity-50" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </nav>
              </ScrollArea>
            </Card>

            {/* ---------------- Content ---------------- */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
              {searchResults ? (
                <FieldsCard
                  title={L(`نتائج البحث (${searchResults.length})`, `Search results (${searchResults.length})`)}
                  defs={searchResults}
                  data={data!}
                  dirty={dirty}
                  currentValue={currentValue}
                  setValue={setValue}
                  onReset={(k) => resetMutation.mutate(k)}
                  L={L}
                  isRTL={isRTL}
                />
              ) : (
                <LeafContent
                  leafId={activeLeaf}
                  data={data!}
                  defs={defsByLeaf.get(activeLeaf) ?? []}
                  dirty={dirty}
                  currentValue={currentValue}
                  setValue={setValue}
                  onReset={(k) => resetMutation.mutate(k)}
                  onOpenModule={(m) => setActiveModule(m)}
                  L={L}
                  isRTL={isRTL}
                />
              )}

              {/* ---------------- Save bar ---------------- */}
              {dirtyCount > 0 && (
                <Card className="sticky bottom-3 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-primary/40 shadow-lg bg-card/95 backdrop-blur">
                  <Badge variant="secondary" className="self-center shrink-0">
                    {L(`${dirtyCount} تغيير غير محفوظ`, `${dirtyCount} unsaved change(s)`)}
                  </Badge>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={L('سبب التغيير (يُسجَّل في التدقيق)…', 'Reason (recorded in audit)…')}
                    className="h-9 flex-1"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setDirty({}); setReason('') }}>
                      {L('إلغاء', 'Cancel')}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={saveMutation.isPending}
                      onClick={() => (dirtyHasSystem ? setConfirmSave(true) : saveMutation.mutate(dirty))}
                    >
                      {saveMutation.isPending
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Save className="size-4" />}
                      {L('حفظ التغييرات', 'Save changes')}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Confirmation for system-critical settings */}
        <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{L('تأكيد تعديل إعدادات نظامية', 'Confirm critical settings change')}</AlertDialogTitle>
              <AlertDialogDescription>
                {L(
                  'بعض التغييرات تمس إعدادات نظامية حساسة تؤثر في سلوك النظام (الترقيم، الترحيل، الضرائب…). سيُسجَّل التغيير باسمك في سجل التدقيق.',
                  'Some changes touch critical system settings that drive system behaviour (numbering, posting, tax…). The change will be recorded under your name in the audit log.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{L('تراجع', 'Back')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setConfirmSave(false); saveMutation.mutate(dirty) }}>
                {L('تأكيد الحفظ', 'Confirm save')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ModuleShell>
    </TooltipProvider>
  )
}

function SettingsIconSafe() {
  return <Settings className="size-5" />
}

// ---------------- Leaf content ----------------

function LeafContent(props: {
  leafId: string
  data: ConfigBundle
  defs: Definition[]
  dirty: Record<string, string>
  currentValue: (d: Definition) => string
  setValue: (k: string, v: string) => void
  onReset: (k: string) => void
  onOpenModule: (m: ModuleKey) => void
  L: (ar: string, en: string) => string
  isRTL: boolean
}) {
  const { leafId, data, defs, L } = props
  const leaf = data.tree.flatMap((s) => s.leaves).find((l) => l.id === leafId)
  const moduleLink = LEAF_MODULE_LINKS[leafId]

  if (!defs.length) {
    return (
      <Card className="p-10 flex flex-col items-center gap-3 text-center">
        <CircleDashed className="size-8 text-muted-foreground" />
        <p className="font-semibold">{leaf ? L(leaf.labelAr, leaf.labelEn) : leafId}</p>
        {moduleLink ? (
          <>
            <p className="text-sm text-muted-foreground max-w-md">
              {L(
                'تُدار بيانات هذا القسم في وحدة مخصصة قائمة — الإعدادات السلوكية الخاصة به تُضاف في المراحل القادمة.',
                'This section’s data lives in a dedicated module — its behavioural settings arrive in upcoming phases.'
              )}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => props.onOpenModule(moduleLink)}>
              <ExternalLink className="size-4" />
              {L('فتح الوحدة المخصصة', 'Open the dedicated module')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground max-w-md">
            {L(
              'لا توجد إعدادات معرَّفة في هذا الفرع بعد. يُبنى هذا الفرع في المراحل القادمة من برنامج التهيئة — ولن تظهر هنا شاشة شكلية قبل أن يكون لها أثر حقيقي.',
              'No settings are defined in this branch yet. It is built in upcoming phases — no cosmetic screen will appear here before it has real effect.'
            )}
          </p>
        )}
      </Card>
    )
  }

  return (
    <FieldsCard
      {...props}
      title={leaf ? L(leaf.labelAr, leaf.labelEn) : leafId}
      defs={defs}
    />
  )
}

// ---------------- Fields ----------------

function FieldsCard(props: {
  title: string
  defs: Definition[]
  data: ConfigBundle
  dirty: Record<string, string>
  currentValue: (d: Definition) => string
  setValue: (k: string, v: string) => void
  onReset: (k: string) => void
  L: (ar: string, en: string) => string
  isRTL: boolean
}) {
  const { title, defs, data, dirty, currentValue, setValue, onReset, L } = props
  const enforcedHere = defs.filter((d) => d.enforcement.status === 'enforced').length

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          {L(`${enforcedHere} من ${defs.length} نافذ في منطق العمل`, `${enforcedHere} of ${defs.length} enforced in business logic`)}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-5">
        {defs.map((def) => (
          <FieldRow
            key={def.key}
            def={def}
            value={currentValue(def)}
            serverEntry={data.values[def.key]}
            isDirty={def.key in dirty}
            onChange={(v) => setValue(def.key, v)}
            onReset={() => onReset(def.key)}
            L={L}
          />
        ))}
      </div>
    </Card>
  )
}

function FieldRow({
  def, value, serverEntry, isDirty, onChange, onReset, L,
}: {
  def: Definition
  value: string
  serverEntry?: ValueEntry
  isDirty: boolean
  onChange: (v: string) => void
  onReset: () => void
  L: (ar: string, en: string) => string
}) {
  const enforced = def.enforcement.status === 'enforced'
  const numberHint =
    def.type === 'number' && def.number
      ? [
          def.number.min !== undefined ? `≥ ${def.number.min}` : '',
          def.number.max !== undefined ? `≤ ${def.number.max}` : '',
        ].filter(Boolean).join(' ، ')
      : ''

  return (
    <div className={cn('flex flex-col gap-1.5 rounded-lg p-2 -m-2 transition-colors', isDirty && 'bg-amber-500/5 ring-1 ring-amber-500/20')}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Label className="text-[13px] font-medium">{L(def.labelAr, def.labelEn)}</Label>
        {def.isSystem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <ShieldAlert className="size-3.5 text-orange-500" />
            </TooltipTrigger>
            <TooltipContent>{L('إعداد نظامي حساس — يتطلب صلاحية أعلى', 'Critical system setting — requires elevated capability')}</TooltipContent>
          </Tooltip>
        )}
        {def.secret && <KeyRound className="size-3.5 text-violet-500" />}
        <span className="flex-1" />
        <EnforcementBadge def={def} L={L} />
      </div>

      {def.type === 'boolean' ? (
        <div className="flex items-center gap-2 h-9">
          <Switch checked={value === 'true'} onCheckedChange={(c) => onChange(c ? 'true' : 'false')} />
          <span className="text-xs text-muted-foreground">
            {value === 'true' ? L('مفعَّل', 'Enabled') : L('معطَّل', 'Disabled')}
          </span>
        </div>
      ) : def.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : def.type === 'secret' ? (
        <Input
          type="password"
          className="h-9 font-mono"
          placeholder={serverEntry?.hasValue ? L(`قيمة سرية محفوظة (${serverEntry.value})`, `Secret saved (${serverEntry.value})`) : L('لم تُضبط بعد', 'Not set')}
          value={isDirty ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          type={def.type === 'number' ? 'number' : 'text'}
          className="h-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <div className="flex items-center gap-2 min-h-4">
        {numberHint && <span className="text-[11px] text-muted-foreground tabular-nums">{numberHint}</span>}
        <span className="flex-1" />
        {(isDirty || (serverEntry?.hasValue && serverEntry.value !== def.defaultValue && !def.secret)) && (
          <button
            onClick={onReset}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <RotateCcw className="size-3" />
            {L('الافتراضي', 'Default')}
            {!def.secret && def.defaultValue !== '' && <code className="text-[10px] bg-muted px-1 rounded">{def.defaultValue}</code>}
          </button>
        )}
      </div>
    </div>
  )
}

function EnforcementBadge({ def, L }: { def: Definition; L: (ar: string, en: string) => string }) {
  if (def.enforcement.status === 'enforced') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5">
            <ShieldCheck className="size-3" />
            {L('نافذ', 'Enforced')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          <p className="font-medium mb-1">
            {L(def.enforcement.effectAr ?? 'يقرأه منطق العمل', def.enforcement.effectEn ?? 'Read by business logic')}
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
        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px] px-1.5">
          <CircleDashed className="size-3" />
          {L('لا يؤثر بعد', 'Not enforced yet')}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        {L(
          `يُحفظ ويُدقَّق لكن لا يقرأه منطق العمل بعد${def.enforcement.plannedPhase ? ` — مقرر في المرحلة ${def.enforcement.plannedPhase}` : ''}. هذه الشارة تختفي تلقائياً عند ربطه فعلياً.`,
          `Persisted and audited but not yet read by business logic${def.enforcement.plannedPhase ? ` — planned for phase ${def.enforcement.plannedPhase}` : ''}. The badge disappears automatically once wired.`
        )}
      </TooltipContent>
    </Tooltip>
  )
}

// ---------------- Audit panel ----------------

function AuditPanel({ rows, loading, L, locale }: {
  rows: AuditRow[]
  loading: boolean
  L: (ar: string, en: string) => string
  locale: string
}) {
  if (loading) {
    return (
      <Card className="p-10 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        {L('جارٍ تحميل سجل التدقيق…', 'Loading audit log…')}
      </Card>
    )
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b flex items-center gap-2">
        <History className="size-4 text-primary" />
        <h3 className="font-semibold">{L('سجل تدقيق الإعدادات', 'Configuration audit log')}</h3>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="text-start font-medium px-4 py-2">{L('الإعداد', 'Setting')}</th>
              <th className="text-start font-medium px-4 py-2">{L('من', 'From')}</th>
              <th className="text-start font-medium px-4 py-2">{L('إلى', 'To')}</th>
              <th className="text-start font-medium px-4 py-2">{L('بواسطة', 'By')}</th>
              <th className="text-start font-medium px-4 py-2">{L('السبب', 'Reason')}</th>
              <th className="text-start font-medium px-4 py-2">{L('التاريخ', 'When')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                {L('لا توجد تغييرات مسجلة بعد', 'No recorded changes yet')}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs" dir="ltr">{r.settingKey}</td>
                <td className="px-4 py-2 max-w-40 truncate text-muted-foreground">{r.oldValue ?? '—'}</td>
                <td className="px-4 py-2 max-w-40 truncate font-medium">{r.newValue ?? L('(أُعيد للافتراضي)', '(reset)')}</td>
                <td className="px-4 py-2">{r.user ? (locale === 'ar' ? r.user.nameAr : r.user.username) : '—'}</td>
                <td className="px-4 py-2 max-w-48 truncate text-muted-foreground">{r.reason ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                  {new Date(r.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
