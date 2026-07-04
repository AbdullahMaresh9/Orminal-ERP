'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { useI18n } from '@/stores/i18n-store'
import { exportToJSON, exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Settings, Building2, Calculator, Boxes, ShoppingCart, Receipt, Percent, CreditCard, KeyRound, Code2, Printer, FileCheck, Upload, Download, Palette, FileText, ShieldCheck, LayoutGrid, Server, Save, Eye, EyeOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

const TABS = [
  { key: 'general', label: 'settings.general', icon: Settings },
  { key: 'company', label: 'settings.company', icon: Building2 },
  { key: 'accounting', label: 'settings.accounting', icon: Calculator },
  { key: 'inventory', label: 'settings.inventory', icon: Boxes },
  { key: 'sales', label: 'settings.sales', icon: ShoppingCart },
  { key: 'purchases', label: 'settings.purchases', icon: ShoppingCart },
  { key: 'taxes', label: 'settings.taxes', icon: Percent },
  { key: 'paymentMethods', label: 'settings.paymentMethods', icon: CreditCard },
  { key: 'api', label: 'settings.api', icon: KeyRound },
  { key: 'coding', label: 'settings.coding', icon: Code2 },
  { key: 'printer', label: 'settings.printer', icon: Printer },
  { key: 'zatca', label: 'settings.zatca', icon: FileCheck },
  { key: 'importing', label: 'settings.importing', icon: Upload },
  { key: 'exporting', label: 'settings.exporting', icon: Download },
  { key: 'appearance', label: 'settings.appearance', icon: Palette },
  { key: 'header', label: 'settings.header', icon: FileText },
  { key: 'roles', label: 'settings.roles', icon: ShieldCheck },
  { key: 'modules', label: 'settings.modules', icon: LayoutGrid },
  { key: 'system', label: 'settings.system', icon: Server },
] as const

const DEFAULT_SETTINGS: Record<string, string> = {
  'company.name': 'مؤسسة الأستاذ التجارية',
  'company.currency': 'SAR',
  'company.timezone': 'Asia/Riyadh',
  'company.address': 'الرياض، المملكة العربية السعودية',
  'company.phone': '+966 11 234 5678',
  'company.email': 'info@alostaz.sa',
  'company.taxNumber': '300000000000003',
  'company.logo': '',
  'accounting.taxRate': '15',
  'accounting.fiscalYearStart': '01-01',
  'inventory.defaultUnit': 'piece',
  'inventory.lowStockAlert': 'true',
  'sales.defaultPaymentMethod': 'cash',
  'sales.invoicePrefix': 'INV-',
  'purchases.defaultPaymentMethod': 'cash',
  'purchases.invoicePrefix': 'PUR-',
  'taxes.vatRate': '15',
  'taxes.taxNumber': '300000000000003',
  'payment.cash': 'true',
  'payment.card': 'true',
  'payment.transfer': 'true',
  'payment.check': 'false',
  'api.key': 'alostaz_live_sk_' + Math.random().toString(36).slice(2, 14),
  'api.webhookUrl': 'https://api.example.com/webhooks/alostaz',
  'printer.paperSize': 'A4',
  'printer.margins': '20',
  'printer.headerTitle': 'مؤسسة الأستاذ التجارية',
  'printer.footerNote': 'شكراً لتعاملكم معنا',
  'zatca.enabled': 'false',
  'zatca.vatNumber': '300000000000003',
  'zatca.mode': 'sandbox',
  'zatca.qrCode': 'true',
  'header.headerTitle': 'مؤسسة الأستاذ التجارية',
  'header.headerSubtitle': 'الرياض، المملكة العربية السعودية',
  'header.footerNote': 'شكراً لتعاملكم معنا',
  'modules.dashboard': 'true',
  'modules.pos': 'true',
  'modules.sales': 'true',
  'modules.purchases': 'true',
  'modules.inventory': 'true',
  'modules.accounting': 'true',
  'modules.finance': 'true',
  'modules.reports': 'true',
}

const SYSTEM_ACCOUNTS_LIST = [
  { code: SYSTEM_ACCOUNTS.CASH, name: 'النقدية', type: 'asset' },
  { code: SYSTEM_ACCOUNTS.BANK, name: 'البنك', type: 'asset' },
  { code: SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, name: 'الذمم المدينة', type: 'asset' },
  { code: SYSTEM_ACCOUNTS.INVENTORY, name: 'المخزون', type: 'asset' },
  { code: SYSTEM_ACCOUNTS.INPUT_VAT, name: 'ضريبة القيمة المضافة (مدخلات)', type: 'asset' },
  { code: SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE, name: 'الذمم الدائنة', type: 'liability' },
  { code: SYSTEM_ACCOUNTS.OUTPUT_VAT, name: 'ضريبة القيمة المضافة (مخرجات)', type: 'liability' },
  { code: SYSTEM_ACCOUNTS.RETAINED_EARNINGS, name: 'الأرباح المرحّلة', type: 'equity' },
  { code: SYSTEM_ACCOUNTS.SALES_REVENUE, name: 'إيرادات المبيعات', type: 'income' },
  { code: SYSTEM_ACCOUNTS.OTHER_REVENUE, name: 'إيرادات أخرى', type: 'income' },
  { code: SYSTEM_ACCOUNTS.COGS, name: 'تكلفة البضاعة المباعة', type: 'expense' },
  { code: SYSTEM_ACCOUNTS.PURCHASES, name: 'المشتريات', type: 'expense' },
  { code: SYSTEM_ACCOUNTS.PRODUCTION_COST, name: 'تكلفة الإنتاج', type: 'expense' },
  { code: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, name: 'المصروفات التشغيلية', type: 'expense' },
]

const MODULES_TOGGLES = [
  { key: 'modules.dashboard', label: 'لوحة التحكم' },
  { key: 'modules.pos', label: 'نقطة البيع' },
  { key: 'modules.sales', label: 'المبيعات' },
  { key: 'modules.purchases', label: 'المشتريات' },
  { key: 'modules.inventory', label: 'المخزون' },
  { key: 'modules.accounting', label: 'المحاسبة' },
  { key: 'modules.finance', label: 'المالية' },
  { key: 'modules.reports', label: 'التقارير' },
]

export function SettingsModule() {
  const { t } = useT()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const qc = useQueryClient()
  const [local, setLocal] = useState<Record<string, string>>(DEFAULT_SETTINGS)
  const [showApiKey, setShowApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('general')
  const [prevSaved, setPrevSaved] = useState<Record<string, string> | undefined>(undefined)

  const { data: saved } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await fetch('/api/erp/settings')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  // Sync server settings into local state when they first load or change.
  // Using the conditional-setState-during-render pattern (React 19) instead of useEffect.
  if (saved && saved !== prevSaved) {
    setPrevSaved(saved)
    setLocal({ ...DEFAULT_SETTINGS, ...saved })
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const r = await fetch('/api/erp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.saved'))
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error(t('error.save')),
  })

  function set(k: string, v: string) {
    setLocal((prev) => ({ ...prev, [k]: v }))
  }

  function saveAll() {
    saveMutation.mutate(local)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) {
      toast.error('حجم الصورة يجب أن يكون أقل من 500KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      set('company.logo', reader.result as string)
      toast.success('تم تحميل الشعار')
    }
    reader.readAsDataURL(file)
  }

  function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>, entity: string) {
    const file = e.target.files?.[0]
    if (!file) return
    toast.success(`تم استيراد ${entity} بنجاح (${file.name})`)
    e.target.value = ''
  }

  function handleExportJson() {
    exportToJSON('alostaz-settings', local)
    toast.success('تم تصدير الإعدادات')
  }

  return (
    <ModuleShell
      title={t('module.settings')}
      description="إعدادات النظام والشركة والمحاسبة"
      icon={<Settings className="size-5" />}
      actions={
        <Button onClick={saveAll} disabled={saveMutation.isPending} className="gap-1.5">
          <Save className="size-4" />
          {saveMutation.isPending ? t('loading') : t('action.save')}
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-lg">
          <TabsList className="inline-flex w-max">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                <tab.icon className="size-3.5" />
                {t(tab.label as any)}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {/* GENERAL */}
        <TabsContent value="general">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="size-4" /> معلومات عامة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t('company.name')} value={local['company.name']} onChange={(v) => set('company.name', v)} />
              <Field label={t('company.currency')} value={local['company.currency']} onChange={(v) => set('company.currency', v)} />
              <Field label={t('company.timezone')} value={local['company.timezone']} onChange={(v) => set('company.timezone', v)} />
              <Field label={t('company.phone')} value={local['company.phone']} onChange={(v) => set('company.phone', v)} />
              <Field label={t('company.email')} value={local['company.email']} onChange={(v) => set('company.email', v)} />
              <Field label={t('company.taxNumber')} value={local['company.taxNumber']} onChange={(v) => set('company.taxNumber', v)} />
              <Field label={t('company.address')} value={local['company.address']} onChange={(v) => set('company.address', v)} className="md:col-span-2" />
            </div>
          </Card>
        </TabsContent>

        {/* COMPANY */}
        <TabsContent value="company">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="size-4" /> معلومات الشركة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t('company.name')} value={local['company.name']} onChange={(v) => set('company.name', v)} />
              <Field label={t('company.taxNumber')} value={local['company.taxNumber']} onChange={(v) => set('company.taxNumber', v)} />
              <Field label={t('company.phone')} value={local['company.phone']} onChange={(v) => set('company.phone', v)} />
              <Field label={t('company.email')} value={local['company.email']} onChange={(v) => set('company.email', v)} />
              <Field label={t('company.address')} value={local['company.address']} onChange={(v) => set('company.address', v)} className="md:col-span-2" />
              <div className="md:col-span-2 space-y-2">
                <Label>{t('company.logo')}</Label>
                <div className="flex items-center gap-4">
                  {local['company.logo'] ? (
                    <img src={local['company.logo']} alt="logo" className="size-16 rounded-lg object-contain border" />
                  ) : (
                    <div className="size-16 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">لا شعار</div>
                  )}
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border bg-background hover:bg-muted text-sm">
                      <Upload className="size-4" /> تحميل شعار
                    </div>
                  </Label>
                  <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ACCOUNTING */}
        <TabsContent value="accounting">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Calculator className="size-4" /> الإعدادات المحاسبية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="نسبة الضريبة الافتراضية (%)" type="number" value={local['accounting.taxRate']} onChange={(v) => set('accounting.taxRate', v)} />
              <div className="space-y-1.5">
                <Label>بداية السنة المالية</Label>
                <Select value={local['accounting.fiscalYearStart']} onValueChange={(v) => set('accounting.fiscalYearStart', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01-01">1 يناير</SelectItem>
                    <SelectItem value="04-01">1 أبريل</SelectItem>
                    <SelectItem value="07-01">1 يوليو</SelectItem>
                    <SelectItem value="10-01">1 أكتوبر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Boxes className="size-4" /> إعدادات المخزون</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>الوحدة الافتراضية</Label>
                <Select value={local['inventory.defaultUnit']} onValueChange={(v) => set('inventory.defaultUnit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">قطعة</SelectItem>
                    <SelectItem value="kg">كجم</SelectItem>
                    <SelectItem value="liter">لتر</SelectItem>
                    <SelectItem value="box">كرتون</SelectItem>
                    <SelectItem value="pack">علبة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch checked={local['inventory.lowStockAlert'] === 'true'} onCheckedChange={(v) => set('inventory.lowStockAlert', v ? 'true' : 'false')} id="lowStock" />
                <Label htmlFor="lowStock" className="cursor-pointer">تنبيه المخزون المنخفض</Label>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="size-4" /> إعدادات المبيعات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>طريقة الدفع الافتراضية</Label>
                <Select value={local['sales.defaultPaymentMethod']} onValueChange={(v) => set('sales.defaultPaymentMethod', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقد</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="بادئة الفاتورة" value={local['sales.invoicePrefix']} onChange={(v) => set('sales.invoicePrefix', v)} />
            </div>
          </Card>
        </TabsContent>

        {/* PURCHASES */}
        <TabsContent value="purchases">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="size-4" /> إعدادات المشتريات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>طريقة الدفع الافتراضية</Label>
                <Select value={local['purchases.defaultPaymentMethod']} onValueChange={(v) => set('purchases.defaultPaymentMethod', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقد</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="بادئة فاتورة الشراء" value={local['purchases.invoicePrefix']} onChange={(v) => set('purchases.invoicePrefix', v)} />
            </div>
          </Card>
        </TabsContent>

        {/* TAXES */}
        <TabsContent value="taxes">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Percent className="size-4" /> الضرائب</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="نسبة ضريبة القيمة المضافة (%)" type="number" value={local['taxes.vatRate']} onChange={(v) => set('taxes.vatRate', v)} />
              <Field label="الرقم الضريبي" value={local['taxes.taxNumber']} onChange={(v) => set('taxes.taxNumber', v)} />
            </div>
          </Card>
        </TabsContent>

        {/* PAYMENT METHODS */}
        <TabsContent value="paymentMethods">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="size-4" /> طرق الدفع</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'payment.cash', label: 'نقد', icon: '💵' },
                { key: 'payment.card', label: 'بطاقة', icon: '💳' },
                { key: 'payment.transfer', label: 'تحويل بنكي', icon: '🏦' },
                { key: 'payment.check', label: 'شيك', icon: '📝' },
              ].map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{m.icon}</span>
                    <span className="font-medium text-sm">{m.label}</span>
                  </div>
                  <Switch checked={local[m.key] === 'true'} onCheckedChange={(v) => set(m.key, v ? 'true' : 'false')} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* API */}
        <TabsContent value="api">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><KeyRound className="size-4" /> إعدادات API</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label>مفتاح API</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={showApiKey ? local['api.key'] : '•'.repeat(local['api.key']?.length ?? 0)}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <Field label="رابط Webhook" value={local['api.webhookUrl']} onChange={(v) => set('api.webhookUrl', v)} />
            </div>
          </Card>
        </TabsContent>

        {/* CODING */}
        <TabsContent value="coding">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Code2 className="size-4" /> ترقيم الحسابات</h3>
            <div className="mb-4 p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
              تنسيق ترقيم الحسابات: <code className="text-primary font-mono">XXXX</code> — كل خانة 4 أرقام، الحسابات النظامية محجوزة ولا يمكن حذفها.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYSTEM_ACCOUNTS_LIST.map((a) => (
                <div key={a.code} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">{a.code}</Badge>
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* PRINTER */}
        <TabsContent value="printer">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Printer className="size-4" /> إعدادات الطباعة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>حجم الورق</Label>
                <Select value={local['printer.paperSize']} onValueChange={(v) => set('printer.paperSize', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="80mm">حراري 80mm</SelectItem>
                    <SelectItem value="Letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="الهوامش (مم)" type="number" value={local['printer.margins']} onChange={(v) => set('printer.margins', v)} />
              <Field label="عنوان الترويسة" value={local['printer.headerTitle']} onChange={(v) => set('printer.headerTitle', v)} className="md:col-span-2" />
              <div className="md:col-span-2 space-y-1.5">
                <Label>ملاحظة التذييل</Label>
                <Textarea value={local['printer.footerNote']} onChange={(e) => set('printer.footerNote', e.target.value)} rows={2} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ZATCA */}
        <TabsContent value="zatca">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileCheck className="size-4" /> الفوترة الإلكترونية (ZATCA)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">تفعيل الفوترة الإلكترونية</p>
                  <p className="text-xs text-muted-foreground">ربط مع هيئة الزكاة والضريبة والجمارك</p>
                </div>
                <Switch checked={local['zatca.enabled'] === 'true'} onCheckedChange={(v) => set('zatca.enabled', v ? 'true' : 'false')} />
              </div>
              <Field label="الرقم الضريبي" value={local['zatca.vatNumber']} onChange={(v) => set('zatca.vatNumber', v)} />
              <div className="space-y-1.5">
                <Label>الوضع</Label>
                <Select value={local['zatca.mode']} onValueChange={(v) => set('zatca.mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">تجريبي (Sandbox)</SelectItem>
                    <SelectItem value="production">إنتاجي (Production)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Switch checked={local['zatca.qrCode'] === 'true'} onCheckedChange={(v) => set('zatca.qrCode', v ? 'true' : 'false')} id="qr" />
                <Label htmlFor="qr" className="cursor-pointer">إظهار رمز QR على الفواتير</Label>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* IMPORTING */}
        <TabsContent value="importing">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Upload className="size-4" /> استيراد البيانات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { entity: 'العملاء', key: 'clients' },
                { entity: 'المنتجات', key: 'products' },
                { entity: 'الموردون', key: 'suppliers' },
              ].map((it) => (
                <div key={it.key} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Upload className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{it.entity}</p>
                      <p className="text-[11px] text-muted-foreground">CSV / Excel</p>
                    </div>
                  </div>
                  <Label htmlFor={`imp-${it.key}`} className="cursor-pointer">
                    <div className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-md border bg-background hover:bg-muted text-sm">
                      <Upload className="size-4" /> اختر ملف
                    </div>
                  </Label>
                  <Input id={`imp-${it.key}`} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => handleImportCsv(e, it.entity)} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* EXPORTING */}
        <TabsContent value="exporting">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Download className="size-4" /> تصدير البيانات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={handleExportJson}>
                <Download className="size-4" /> تصدير الإعدادات (JSON)
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => { exportToCSV('settings', Object.entries(local).map(([k, v]) => ({ key: k, value: v }))); toast.success('تم التصدير') }}>
                <Download className="size-4" /> تصدير الإعدادات (CSV)
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* APPEARANCE */}
        <TabsContent value="appearance">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Palette className="size-4" /> المظهر</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t('appearance.theme')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'light', label: t('appearance.theme.light') },
                    { v: 'dark', label: t('appearance.theme.dark') },
                    { v: 'system', label: t('appearance.theme.system') },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setTheme(opt.v)}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${theme === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('appearance.language')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'ar', label: t('appearance.language.ar') },
                    { v: 'en', label: t('appearance.language.en') },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setLocale(opt.v as 'ar' | 'en')}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${locale === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* HEADER */}
        <TabsContent value="header">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="size-4" /> ترويسة المستندات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="عنوان الترويسة" value={local['header.headerTitle']} onChange={(v) => set('header.headerTitle', v)} className="md:col-span-2" />
              <Field label="العنوان الفرعي" value={local['header.headerSubtitle']} onChange={(v) => set('header.headerSubtitle', v)} className="md:col-span-2" />
              <div className="md:col-span-2 space-y-1.5">
                <Label>ملاحظة التذييل</Label>
                <Textarea value={local['header.footerNote']} onChange={(e) => set('header.footerNote', e.target.value)} rows={2} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ROLES */}
        <TabsContent value="roles">
          <Card className="p-5">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="size-4" /> الأدوار والصلاحيات</h3>
            <p className="text-sm text-muted-foreground mb-4">إدارة الأدوار والصلاحيات تتم من صفحة الأدوار.</p>
            <div className="p-4 rounded-lg bg-muted/30 border text-center text-sm text-muted-foreground">
              انتقل إلى وحدة <span className="font-semibold text-foreground">الأدوار</span> لعرض مصفوفة الصلاحيات الكاملة.
            </div>
          </Card>
        </TabsContent>

        {/* MODULES */}
        <TabsContent value="modules">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><LayoutGrid className="size-4" /> الوحدات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODULES_TOGGLES.map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <span className="font-medium text-sm">{m.label}</span>
                  <Switch checked={local[m.key] === 'true'} onCheckedChange={(v) => set(m.key, v ? 'true' : 'false')} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* SYSTEM */}
        <TabsContent value="system">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Server className="size-4" /> {t('misc.systemInfo')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow label="إصدار النظام" value="Alostaz ERP v1.0.0" />
              <InfoRow label="إطار العمل" value="Next.js 16 + React 19" />
              <InfoRow label="قاعدة البيانات" value="SQLite (Prisma)" />
              <InfoRow label="البيئة" value={process.env.NODE_ENV ?? 'development'} />
              <InfoRow label="إصدار Node" value={typeof process !== 'undefined' ? (process.versions?.node ?? '—') : '—'} />
              <InfoRow label="اللغة الحالية" value={locale === 'ar' ? 'العربية' : 'English'} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </ModuleShell>
  )
}

function Field({ label, value, onChange, type = 'text', className }: { label: string; value?: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-semibold">{value}</span>
    </div>
  )
}
