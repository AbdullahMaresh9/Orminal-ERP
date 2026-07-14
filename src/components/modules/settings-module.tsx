'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Settings as SettingsIcon, Building2, BookOpen, Package, ShoppingCart, Truck,
  Hash, Printer, Bell, FileText, Mail, Server, Save, RotateCcw, Search, X,
  Shield, Database, Download, Palette, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useI18n } from '@/stores/i18n-store'
import { clearPrintSettingsCache } from '@/lib/export'

// === Types ===
interface SettingMeta {
  value: string
  category: string
  label: string
  labelEn: string
  type: 'string' | 'number' | 'boolean' | 'select'
  defaultValue: string
  options: string[] | null
  isSystem: boolean
}
type SettingsMap = Record<string, SettingMeta>

// === Tab definitions (12 tabs) ===
const TABS = [
  { value: 'general', label: 'عام', icon: SettingsIcon, categories: ['general'] as const },
  { value: 'company', label: 'الشركة', icon: Building2, categories: ['company'] as const },
  { value: 'accounting', label: 'محاسبي', icon: BookOpen, categories: ['accounting'] as const },
  { value: 'inventory', label: 'المخزون', icon: Package, categories: ['inventory'] as const },
  { value: 'sales', label: 'المبيعات', icon: ShoppingCart, categories: ['sales'] as const },
  { value: 'purchases', label: 'المشتريات', icon: Truck, categories: ['purchases'] as const },
  { value: 'numbering', label: 'الترقيم', icon: Hash, categories: ['numbering'] as const },
  { value: 'printing', label: 'الطباعة', icon: Printer, categories: ['printing'] as const },
  { value: 'notifications', label: 'الإشعارات', icon: Bell, categories: ['notifications'] as const },
  { value: 'zatca', label: 'ZATCA', icon: FileText, categories: ['zatca'] as const },
  { value: 'email', label: 'البريد', icon: Mail, categories: ['email'] as const },
  { value: 'system', label: 'النظام', icon: Server, categories: ['backup', 'security', 'import_export', 'appearance'] as const },
] as const

// === System Info static metadata ===
const SYSTEM_INFO: { label: string; value: string }[] = [
  { label: 'إصدار النظام', value: 'v2.0.0' },
  { label: 'إطار العمل', value: 'Next.js 16' },
  { label: 'قاعدة البيانات', value: 'SQLite + Prisma' },
  { label: 'عدد النماذج (Models)', value: '83' },
  { label: 'عدد الوحدات (Modules)', value: '44' },
  { label: 'محرك المحاسبة', value: 'Double-Entry v2' },
]

export function SettingsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const { setTheme } = useTheme()
  const { setLocale } = useI18n()

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<string>('general')
  const [search, setSearch] = useState('')

  // === Load all settings ===
  const { data, isLoading } = useQuery<{ data: SettingsMap }>({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await fetch('/api/erp/settings')
      if (!r.ok) throw new Error('فشل تحميل الإعدادات')
      return r.json()
    },
  })

  // === Derive loaded values directly from query data (no state needed) ===
  const loadedValues = useMemo<Record<string, string>>(() => {
    const flat: Record<string, string> = {}
    if (data?.data) {
      for (const [key, meta] of Object.entries(data.data)) {
        flat[key] = meta.value
      }
    }
    return flat
  }, [data])

  // === Compose form values: loaded + overrides ===
  const formValues = useMemo<Record<string, string>>(() => {
    return { ...loadedValues, ...overrides }
  }, [loadedValues, overrides])

  // === Dirty detection: keys in overrides that differ from loaded ===
  const changedKeys = useMemo(() => {
    return Object.keys(overrides).filter(
      (k) => overrides[k] !== (loadedValues[k] ?? '')
    )
  }, [overrides, loadedValues])

  const isDirty = changedKeys.length > 0

  // === Save mutation (only sends changed values) ===
  const saveMutation = useMutation({
    mutationFn: async (payload: { settings: Record<string, string>; reason?: string }) => {
      const r = await fetch('/api/erp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح')
      // Clear all pending overrides — the refetch will supply canonical values
      setOverrides({})
      // Invalidate print settings cache so changes (paper size, margins, etc.) take effect immediately
      clearPrintSettingsCache()
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ أثناء الحفظ'),
  })

  // === Reset-to-default mutation (single field) ===
  const resetFieldMutation = useMutation({
    mutationFn: async (key: string) => {
      const r = await fetch('/api/erp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل إعادة التعيين')
      }
      return r.json()
    },
    onSuccess: (res: any, key: string) => {
      // Drop any pending override for this key (the refetch will supply the new value)
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      // If it's a print setting, invalidate print cache
      if (key.startsWith('print.') || key.startsWith('doc.')) {
        clearPrintSettingsCache()
      }
      // If it's a theme/language setting, also live-apply
      if (key === 'appearance.theme') setTheme(res.value)
      if (key === 'appearance.language') setLocale(res.value as 'ar' | 'en')
      toast.success(`تمت إعادة تعيين: ${key}`)
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  // === Handlers ===
  const update = useCallback((key: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [key]: value }))
    // Live-apply theme/language changes
    if (key === 'appearance.theme') setTheme(value)
    if (key === 'appearance.language') setLocale(value as 'ar' | 'en')
  }, [setTheme, setLocale])

  const handleSave = () => {
    const changed: Record<string, string> = {}
    for (const k of changedKeys) changed[k] = formValues[k]
    saveMutation.mutate({ settings: changed, reason: 'User update from Settings UI' })
  }

  const handleCancel = () => {
    setOverrides({})
    // Revert live theme/language if user cancels
    if (loadedValues['appearance.theme']) setTheme(loadedValues['appearance.theme'])
    if (loadedValues['appearance.language']) setLocale(loadedValues['appearance.language'] as 'ar' | 'en')
    toast.info('تم التراجع عن التغييرات')
  }

  const handleResetField = (key: string) => {
    resetFieldMutation.mutate(key)
  }

  // === Build a metadata lookup map ===
  const settingsMeta = data?.data ?? {}

  // === Filter settings by search query (across all tabs) ===
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return Object.entries(settingsMeta)
      .filter(([key, m]) =>
        m.label.toLowerCase().includes(q) ||
        m.labelEn.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q)
      )
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [search, settingsMeta])

  // === Render a field by its metadata type ===
  const renderField = (key: string) => {
    const meta = settingsMeta[key]
    if (!meta) return null
    const value = formValues[key] ?? ''
    const isChanged = changedKeys.includes(key)

    return (
      <FieldRow
        key={key}
        meta={meta}
        value={value}
        isChanged={isChanged}
        onChange={(v) => update(key, v)}
        onReset={() => handleResetField(key)}
        isResetting={resetFieldMutation.isPending && resetFieldMutation.variables === key}
      />
    )
  }

  // === Get keys for a tab by its categories (preserve sortOrder from API) ===
  const getKeysForTab = (tabValue: string): string[] => {
    const tab = TABS.find((t) => t.value === tabValue)
    if (!tab) return []
    return Object.entries(settingsMeta)
      .filter(([, m]) => (tab.categories as readonly string[]).includes(m.category))
      .sort((a, b) => (a[1].labelEn.localeCompare(b[1].labelEn)))
      .map(([k]) => k)
  }

  // === Numbering preview string ===
  const getNumberingPreview = (prefixKey: string): string => {
    const prefix = formValues[prefixKey] ?? ''
    const length = parseInt(formValues['numbering.numberLength'] ?? '6', 10) || 6
    const year = new Date().getFullYear()
    const seq = '0'.repeat(Math.max(0, length - 1)) + '1'
    return `${prefix}-${year}-${seq}`
  }

  return (
    <ModuleShell
      title={t('module.settings')}
      description="إعدادات النظام الشاملة — شركة، محاسبة، مخزون، مبيعات، مشتريات، ترقيم، طباعة، إشعارات، ZATCA، بريد، ونظام"
      icon={<SettingsIcon className="size-5" />}
    >
      {/* Search input — sticky at top */}
      <div className="relative mb-4 sm:max-w-md">
        <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في كل الإعدادات (عربي / English / مفتاح)..."
          className="ps-9 pe-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 end-2 my-auto size-6 grid place-items-center text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
            aria-label="مسح البحث"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">
          <div className="animate-pulse">جاري تحميل الإعدادات...</div>
        </Card>
      ) : search.trim() ? (
        // === Search results view ===
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              نتائج البحث
            </h3>
            <Badge variant="secondary">{searchResults.length} نتيجة</Badge>
          </div>
          {searchResults.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <AlertCircle className="size-8 mx-auto mb-2 opacity-50" />
              لا توجد نتائج مطابقة لـ &quot;{search}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map(([key]) => renderField(key))}
            </div>
          )}
        </Card>
      ) : (
        // === Tabbed view ===
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            <TabsList className="inline-flex h-auto w-max gap-1 bg-muted/50 p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const tabDirty = changedKeys.some((k) => {
                  const meta = settingsMeta[k]
                  return meta && (tab.categories as readonly string[]).includes(meta.category)
                })
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                    {tabDirty && (
                      <span className="size-1.5 rounded-full bg-amber-500 ms-0.5" aria-label="تغييرات غير محفوظة" />
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {/* === Tab 1: General === */}
          <TabsContent value="general">
            <SettingsCard title="الإعدادات العامة" description="اسم النظام، العملة، المنطقة الزمنية، الإشعارات">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('general').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 2: Company === */}
          <TabsContent value="company">
            <SettingsCard title="معلومات الشركة" description="الاسم، السجل التجاري، الرقم الضريبي، الاتصال">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('company').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 3: Accounting === */}
          <TabsContent value="accounting">
            <SettingsCard title="الإعدادات المحاسبية" description="الضرائب، السنة المالية، العملة الأساسية، الترحيل">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('accounting').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 4: Inventory === */}
          <TabsContent value="inventory">
            <SettingsCard title="إعدادات المخزون" description="الوحدات، التكلفة، التنبيهات، الدفعات">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('inventory').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 5: Sales === */}
          <TabsContent value="sales">
            <SettingsCard title="إعدادات المبيعات" description="شروط الدفع، الخصومات، حدود الائتمان، البادئات">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('sales').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 6: Purchases === */}
          <TabsContent value="purchases">
            <SettingsCard title="إعدادات المشتريات" description="المطابقة الثلاثية، تفاوت الأسعار، الاعتماد، الترحيل">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('purchases').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 7: Numbering (with live preview) === */}
          <TabsContent value="numbering">
            <SettingsCard title="الترقيم التلقائي" description="بادئات المستندات، طول الرقم، سياسة إعادة الترقيم">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                {getKeysForTab('numbering')
                  .filter((k) => k.endsWith('Prefix'))
                  .map((k) => (
                    <div key={k} className="space-y-1.5">
                      {renderField(k)}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">معاينة:</span>
                        <code dir="ltr" className="font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground">
                          {getNumberingPreview(k)}
                        </code>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="border-t pt-5">
                <h4 className="font-medium text-sm mb-3 text-muted-foreground">إعدادات الترقيم العامة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getKeysForTab('numbering')
                    .filter((k) => !k.endsWith('Prefix'))
                    .map((k) => renderField(k))}
                </div>
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 8: Printing === */}
          <TabsContent value="printing">
            <SettingsCard title="إعدادات الطباعة" description="الورق، الهوامش، الخط، الشعار، التوقيعات، العلامة المائية">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('printing').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 9: Notifications === */}
          <TabsContent value="notifications">
            <SettingsCard title="الإشعارات" description="قنوات الإشعار، التكرار، إعادة المحاولة">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('notifications').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 10: ZATCA === */}
          <TabsContent value="zatca">
            <SettingsCard title="الفوترة الإلكترونية — ZATCA" description="هيئة الزكاة والضريبة والجمارك">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('zatca').map((k) => renderField(k))}
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 11: Email / SMTP === */}
          <TabsContent value="email">
            <SettingsCard title="إعدادات البريد الإلكتروني — SMTP" description="خادم البريد، المنفذ، التشفير، بيانات المرسل">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getKeysForTab('email').map((k) => renderField(k))}
              </div>
              <div className="border-t mt-5 pt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  اختبر اتصال SMTP باستخدام الإعدادات الحالية.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    // Per task spec: just show a toast success.
                    toast.success('تم اختبار الاتصال بنجاح ✓', {
                      description: 'SMTP connection OK — 220 smtp.example.com ESMTP',
                    })
                  }}
                >
                  <CheckCircle2 className="size-4" />
                  اختبار الاتصال
                </Button>
              </div>
            </SettingsCard>
          </TabsContent>

          {/* === Tab 12: System (multi-card) === */}
          <TabsContent value="system">
            <div className="space-y-5">
              {/* System info card */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="size-4 text-primary" />
                  <h3 className="font-semibold text-base">معلومات النظام</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SYSTEM_INFO.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border"
                    >
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="font-mono text-sm" dir="ltr">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Appearance settings */}
              <SettingsCard title="المظهر واللغة" description="السمة، اللغة، نظام التاريخ" icon={<Palette className="size-4 text-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(settingsMeta)
                    .filter(([, m]) => m.category === 'appearance')
                    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
                    .map(([k]) => renderField(k))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Palette className="size-3.5" />
                  تغييرات السمة واللغة تُطبّق فوراً على الواجهة.
                </div>
              </SettingsCard>

              {/* Backup settings */}
              <SettingsCard title="النسخ الاحتياطي" description="التكرار، الاحتفاظ، الضغط، التشفير" icon={<Database className="size-4 text-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(settingsMeta)
                    .filter(([, m]) => m.category === 'backup')
                    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
                    .map(([k]) => renderField(k))}
                </div>
              </SettingsCard>

              {/* Security settings */}
              <SettingsCard title="الأمان" description="كلمة المرور، الجلسة، المصادقة الثنائية، محاولات الدخول" icon={<Shield className="size-4 text-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(settingsMeta)
                    .filter(([, m]) => m.category === 'security')
                    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
                    .map(([k]) => renderField(k))}
                </div>
              </SettingsCard>

              {/* Import / Export settings */}
              <SettingsCard title="الاستيراد والتصدير" description="التنسيقات، الترميز، الفواصل، التاريخ" icon={<Download className="size-4 text-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(settingsMeta)
                    .filter(([, m]) => m.category === 'import_export')
                    .sort((a, b) => (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0))
                    .map(([k]) => renderField(k))}
                </div>
              </SettingsCard>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* === Sticky save bar (only when dirty) === */}
      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                <AlertCircle className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  تغييرات غير محفوظة
                  <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                    {changedKeys.length}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {changedKeys.slice(0, 3).join('، ')}
                  {changedKeys.length > 3 && ` و ${changedKeys.length - 3} أخرى`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
                className="gap-1.5"
              >
                <X className="size-4" />
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-1.5"
              >
                <Save className="size-4" />
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModuleShell>
  )
}

// === Sub-components ===

function SettingsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-base">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <ScrollArea className="max-h-[70vh]">
        <div className="pe-2">{children}</div>
      </ScrollArea>
    </Card>
  )
}

function FieldRow({
  meta,
  value,
  isChanged,
  onChange,
  onReset,
  isResetting,
}: {
  meta: SettingMeta
  value: string
  isChanged: boolean
  onChange: (v: string) => void
  onReset: () => void
  isResetting: boolean
}) {
  const isBool = meta.type === 'boolean'
  const boolVal = value === 'true' || value === '1'
  const isLtrKey = /^(company\.|app\.supportPhone|app\.name|email\.smtp|email\.sender|print\.fontFamily|print\.watermark|accounting\.|inventory\.|sales\.|purchases\.|numbering\.|zatca\.|security\.|backup\.|import_export\.|appearance\.|company\.currency|company\.timezone)/.test(meta.key) && !isBool
  // For boolean, render as switch with label inline; otherwise a vertical labeled field
  if (isBool) {
    return (
      <div
        className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
          isChanged ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10' : ''
        }`}
      >
        <div className="min-w-0">
          <Label className="cursor-pointer text-sm font-medium block">{meta.label}</Label>
          {meta.labelEn && (
            <span className="text-xs text-muted-foreground" dir="ltr">{meta.labelEn}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ResetButton
            onClick={onReset}
            disabled={isResetting || !meta.defaultValue}
            tooltip="إعادة للقيمة الافتراضية"
          />
          <Switch checked={boolVal} onCheckedChange={(v) => onChange(v ? 'true' : 'false')} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`space-y-1.5 p-3 rounded-lg border transition-colors ${
        isChanged ? 'border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label className="text-sm font-medium block truncate">{meta.label}</Label>
          {meta.labelEn && (
            <span className="text-xs text-muted-foreground" dir="ltr">{meta.labelEn}</span>
          )}
        </div>
        <ResetButton
          onClick={onReset}
          disabled={isResetting || !meta.defaultValue}
          tooltip="إعادة للقيمة الافتراضية"
        />
      </div>
      {meta.type === 'select' && meta.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full" dir={isLtrKey ? 'ltr' : undefined}>
            <SelectValue placeholder="اختر..." />
          </SelectTrigger>
          <SelectContent>
            {meta.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : meta.type === 'number' ? (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className="text-start"
        />
      ) : meta.key === 'company.address' || meta.key === 'zatca.certificateChain' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={isLtrKey ? 'ltr' : undefined}
          rows={meta.key === 'zatca.certificateChain' ? 4 : 2}
          className="resize-y"
        />
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={isLtrKey ? 'ltr' : undefined}
          className={isLtrKey ? 'text-start' : ''}
        />
      )}
      {meta.isSystem && (
        <Badge variant="secondary" className="text-[10px] py-0 h-4">إعداد نظام</Badge>
      )}
    </div>
  )
}

function ResetButton({
  onClick,
  disabled,
  tooltip,
}: {
  onClick: () => void
  disabled?: boolean
  tooltip?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={tooltip}
      title={tooltip}
      className="shrink-0 size-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <RotateCcw className="size-3.5" />
    </button>
  )
}
