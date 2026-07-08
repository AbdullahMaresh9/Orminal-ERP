'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Settings as SettingsIcon, Building2, BookOpen, Package, Receipt,
  Palette, Server, Save, RotateCcw,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useI18n } from '@/stores/i18n-store'

const TABS = [
  { value: 'general', label: 'عام', icon: SettingsIcon },
  { value: 'company', label: 'الشركة', icon: Building2 },
  { value: 'accounting', label: 'محاسبي', icon: BookOpen },
  { value: 'inventory', label: 'المخزون', icon: Package },
  { value: 'taxes', label: 'الضرائب', icon: Receipt },
  { value: 'appearance', label: 'المظهر', icon: Palette },
  { value: 'system', label: 'النظام', icon: Server },
]

export function SettingsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useI18n()
  const [form, setForm] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery<{ data: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await fetch('/api/erp/settings')
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  // Sync loaded settings into local form state via mount key (React 19 safe).
  const loadedSettings = data?.data ?? null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  // When data arrives with a new reference, swap the form
  const dataKey = loadedSettings ? JSON.stringify(loadedSettings) : null
  if (loadedSettings && dataKey !== loadedKey) {
    setForm(loadedSettings)
    setLoadedKey(dataKey)
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
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
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => saveMutation.mutate(form)

  const handleReset = () => {
    setForm(loadedSettings)
    toast.info('تمت إعادة التعيين')
  }

  return (
    <ModuleShell
      title={t('module.settings')}
      description="إعدادات النظام والشركة والمحاسبة والمظهر"
      icon={<SettingsIcon className="size-5" />}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-4" />
            إعادة تعيين
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
            <Save className="size-4" />
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">جاري التحميل...</Card>
      ) : (
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 mb-5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="general">
            <SettingsCard title="الإعدادات العامة">
              <Field label="اسم النظام" value={form['app.name'] ?? ''} onChange={(v) => update('app.name', v)} />
              <Field label="العملة الافتراضية" value={form['company.currency'] ?? 'SAR'} onChange={(v) => update('company.currency', v)} />
              <Field label="المنطقة الزمنية" value={form['company.timezone'] ?? 'Asia/Riyadh'} onChange={(v) => update('company.timezone', v)} dir="ltr" />
              <Field label="رقم هاتف الدعم" value={form['app.supportPhone'] ?? ''} onChange={(v) => update('app.supportPhone', v)} dir="ltr" />
              <ToggleField label="تفعيل الإشعارات" value={form['app.notifications'] === 'true'} onChange={(v) => update('app.notifications', v ? 'true' : 'false')} />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="company">
            <SettingsCard title="معلومات الشركة">
              <Field label="اسم الشركة" value={form['company.name'] ?? ''} onChange={(v) => update('company.name', v)} />
              <Field label="الاسم القانوني" value={form['company.legalName'] ?? ''} onChange={(v) => update('company.legalName', v)} />
              <Field label="الرقم الضريبي" value={form['company.taxNumber'] ?? ''} onChange={(v) => update('company.taxNumber', v)} dir="ltr" />
              <Field label="الرقم التجاري" value={form['company.crNumber'] ?? ''} onChange={(v) => update('company.crNumber', v)} dir="ltr" />
              <Field label="الهاتف" value={form['company.phone'] ?? ''} onChange={(v) => update('company.phone', v)} dir="ltr" />
              <Field label="البريد الإلكتروني" value={form['company.email'] ?? ''} onChange={(v) => update('company.email', v)} dir="ltr" />
              <Field label="العنوان" value={form['company.address'] ?? ''} onChange={(v) => update('company.address', v)} />
              <Field label="الموقع الإلكتروني" value={form['company.website'] ?? ''} onChange={(v) => update('company.website', v)} dir="ltr" />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="accounting">
            <SettingsCard title="الإعدادات المحاسبية">
              <Field label="نسبة الضريبة الافتراضية %" value={form['accounting.defaultTaxRate'] ?? '15'} onChange={(v) => update('accounting.defaultTaxRate', v)} type="number" dir="ltr" />
              <Field label="نسبة ضريبة القيمة المضافة %" value={form['accounting.vatRate'] ?? '15'} onChange={(v) => update('accounting.vatRate', v)} type="number" dir="ltr" />
              <Field label="بداية السنة المالية (شهر)" value={form['accounting.fiscalYearStartMonth'] ?? '1'} onChange={(v) => update('accounting.fiscalYearStartMonth', v)} type="number" dir="ltr" />
              <Field label="العملة الأساسية" value={form['accounting.baseCurrency'] ?? 'SAR'} onChange={(v) => update('accounting.baseCurrency', v)} dir="ltr" />
              <ToggleField label="تجميع القيود تلقائياً" value={form['accounting.autoGroup'] === 'true'} onChange={(v) => update('accounting.autoGroup', v ? 'true' : 'false')} />
              <ToggleField label="منع الترحيل في فترة مغلقة" value={form['accounting.blockClosedPeriod'] !== 'false'} onChange={(v) => update('accounting.blockClosedPeriod', v ? 'true' : 'false')} />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="inventory">
            <SettingsCard title="إعدادات المخزون">
              <Field label="الوحدة الافتراضية" value={form['inventory.defaultUnit'] ?? 'PCE'} onChange={(v) => update('inventory.defaultUnit', v)} dir="ltr" />
              <Field label="طريقة التكلفة الافتراضية" value={form['inventory.costingMethod'] ?? 'fifo'} onChange={(v) => update('inventory.costingMethod', v)} dir="ltr" />
              <ToggleField label="تنبيهات المخزون المنخفض" value={form['inventory.lowStockAlert'] === 'true'} onChange={(v) => update('inventory.lowStockAlert', v ? 'true' : 'false')} />
              <ToggleField label="تتبع الدفعات (Lots)" value={form['inventory.trackLots'] === 'true'} onChange={(v) => update('inventory.trackLots', v ? 'true' : 'false')} />
              <ToggleField label="السماح بمخزون سالب" value={form['inventory.allowNegative'] === 'true'} onChange={(v) => update('inventory.allowNegative', v ? 'true' : 'false')} />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="taxes">
            <SettingsCard title="إعدادات الضرائب">
              <Field label="نسبة ضريبة القيمة المضافة %" value={form['tax.vatRate'] ?? '15'} onChange={(v) => update('tax.vatRate', v)} type="number" dir="ltr" />
              <ToggleField label="تفعيل ضريبة القيمة المضافة" value={form['tax.vatEnabled'] !== 'false'} onChange={(v) => update('tax.vatEnabled', v ? 'true' : 'false')} />
              <ToggleField label="ضريبة الاستقطاع" value={form['tax.withholdingEnabled'] === 'true'} onChange={(v) => update('tax.withholdingEnabled', v ? 'true' : 'false')} />
              <ToggleField label="الفوترة الإلكترونية (ZATCA)" value={form['zatca.enabled'] === 'true'} onChange={(v) => update('zatca.enabled', v ? 'true' : 'false')} />
              <Field label="بيئة ZATCA" value={form['zatca.environment'] ?? 'sandbox'} onChange={(v) => update('zatca.environment', v)} dir="ltr" />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="appearance">
            <SettingsCard title="المظهر واللغة">
              <div className="space-y-2">
                <Label>السمة</Label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>فاتح</Button>
                  <Button size="sm" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>داكن</Button>
                  <Button size="sm" variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}>تلقائي</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>اللغة</Label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={locale === 'ar' ? 'default' : 'outline'} onClick={() => setLocale('ar')}>العربية</Button>
                  <Button size="sm" variant={locale === 'en' ? 'default' : 'outline'} onClick={() => setLocale('en')}>English</Button>
                </div>
              </div>
              <Field label="عنوان الترويسة" value={form['doc.headerTitle'] ?? ''} onChange={(v) => update('doc.headerTitle', v)} />
              <Field label="ملاحظة التذييل" value={form['doc.footerNote'] ?? ''} onChange={(v) => update('doc.footerNote', v)} />
            </SettingsCard>
          </TabsContent>

          <TabsContent value="system">
            <SettingsCard title="معلومات النظام">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">إصدار النظام</span>
                  <span className="font-mono text-sm" dir="ltr">v2.0.0</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">قاعدة البيانات</span>
                  <span className="font-mono text-sm" dir="ltr">SQLite</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">إطار العمل</span>
                  <span className="font-mono text-sm" dir="ltr">Next.js 16</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">عدد الجداول</span>
                  <span className="font-mono text-sm" dir="ltr">79</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="text-sm">عدد الوحدات</span>
                  <span className="font-mono text-sm" dir="ltr">16</span>
                </div>
              </div>
            </SettingsCard>
          </TabsContent>
        </Tabs>
      )}
    </ModuleShell>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-base mb-4">{title}</h3>
      <ScrollArea className="max-h-[65vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pe-2">
          {children}
        </div>
      </ScrollArea>
    </Card>
  )
}

function Field({ label, value, onChange, type = 'text', dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} />
    </div>
  )
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
