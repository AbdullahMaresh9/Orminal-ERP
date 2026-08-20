'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { useNav } from '@/stores/nav-store'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { DatePicker } from '@/components/ui/date-picker'
import {
  BarChart3, FileText, BookOpen, Scale, TrendingUp, TrendingDown,
  Boxes, Coins, Printer, Download, PlayCircle, ShoppingBag, ShoppingCart,
  Users, UsersRound, Store, UserCheck, Building2, ClipboardCheck, Wallet, Receipt,
} from 'lucide-react'

const REPORTS: Record<string, Array<{ type: string; title: string; icon: any; color: string }>> = {
  accounting: [
    { type: 'account-statement', title: 'كشف حساب تفصيلي', icon: Coins, color: 'emerald' },
    { type: 'general-journal', title: 'دفتر اليومية العامة', icon: FileText, color: 'amber' },
    { type: 'trial-balance', title: 'ميزان المراجعة', icon: Scale, color: 'emerald' },
    { type: 'balance-sheet', title: 'الميزانية العمومية', icon: BookOpen, color: 'violet' },
    { type: 'income', title: 'قائمة الدخل والأرباح', icon: TrendingUp, color: 'teal' },
    { type: 'cash-flow', title: 'قائمة التدفقات النقدية', icon: TrendingDown, color: 'teal' },
    { type: 'cost-center-report', title: 'تقرير مراكز التكلفة', icon: BarChart3, color: 'violet' },
  ],
  ar: [
    { type: 'customers-list', title: 'دليل العملاء', icon: Users, color: 'emerald' },
    { type: 'customer-balances-rep', title: 'أرصدة العملاء', icon: Wallet, color: 'teal' },
    { type: 'customer-statement', title: 'كشف حساب عميل', icon: Coins, color: 'emerald' },
    { type: 'ar-aging-rep', title: 'أعمار ديون العملاء', icon: Scale, color: 'amber' },
    { type: 'customer-collections', title: 'تحصيلات العملاء', icon: Receipt, color: 'emerald' },
  ],
  ap: [
    { type: 'suppliers-list', title: 'دليل الموردين', icon: UsersRound, color: 'amber' },
    { type: 'supplier-balances-rep', title: 'أرصدة الموردين', icon: Wallet, color: 'teal' },
    { type: 'supplier-statement', title: 'كشف حساب مورد', icon: Coins, color: 'emerald' },
    { type: 'ap-aging-rep', title: 'أعمار دائنية الموردين', icon: Scale, color: 'amber' },
    { type: 'supplier-payments-rep', title: 'مدفوعات الموردين', icon: Receipt, color: 'teal' },
  ],
  sales: [
    { type: 'tax-invoices', title: 'الفواتير الضريبية', icon: Receipt, color: 'emerald' },
    { type: 'sales-quotations-rep', title: 'عروض الأسعار', icon: FileText, color: 'amber' },
    { type: 'sales-orders-rep', title: 'أوامر البيع', icon: ShoppingBag, color: 'teal' },
    { type: 'sales-returns-rep', title: 'مرتجع المبيعات', icon: TrendingDown, color: 'amber' },
    { type: 'net-sales', title: 'صافي المبيعات', icon: TrendingUp, color: 'emerald' },
    { type: 'sales-by-customer', title: 'المبيعات حسب العميل', icon: Users, color: 'teal' },
    { type: 'sales-by-product', title: 'المبيعات حسب الصنف', icon: Boxes, color: 'violet' },
  ],
  purchases: [
    { type: 'purchase-invoices-rep', title: 'فواتير الشراء', icon: Receipt, color: 'amber' },
    { type: 'purchase-requests-rep', title: 'طلبات الشراء', icon: FileText, color: 'teal' },
    { type: 'purchase-orders-rep', title: 'أوامر الشراء', icon: ShoppingCart, color: 'amber' },
    { type: 'purchase-returns-rep', title: 'مرتجع المشتريات', icon: TrendingUp, color: 'emerald' },
    { type: 'net-purchases', title: 'صافي المشتريات', icon: TrendingDown, color: 'teal' },
    { type: 'purchases-by-supplier', title: 'المشتريات حسب المورد', icon: UsersRound, color: 'amber' },
  ],
  inventory: [
    { type: 'inventory-value', title: 'قيمة المخزون', icon: Boxes, color: 'violet' },
    { type: 'stock-moves-rep', title: 'حركات المخزون', icon: BarChart3, color: 'teal' },
    { type: 'low-stock', title: 'الأصناف الناقصة وحد الطلب', icon: TrendingDown, color: 'amber' },
  ],
  hr: [
    { type: 'payroll-summary', title: 'ملخص الرواتب والمسيرات', icon: Coins, color: 'emerald' },
    { type: 'employees-directory', title: 'دليل الموظفين', icon: UserCheck, color: 'teal' },
    { type: 'attendance-summary', title: 'ملخص الحضور والانصراف', icon: ClipboardCheck, color: 'amber' },
    { type: 'leave-summary', title: 'ملخص الإجازات', icon: FileText, color: 'violet' },
  ],
  platform: [
    { type: 'audit-trail', title: 'سجل العمليات والنشاطات', icon: FileText, color: 'teal' },
  ],
}

const ALL_REPORTS_LIST = Object.values(REPORTS).flat()

const COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 ring-blue-200 dark:ring-blue-900',
  teal: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 ring-sky-200 dark:ring-sky-900',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 ring-violet-200 dark:ring-violet-900',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 ring-amber-200 dark:ring-amber-900',
}

export function ReportsModule() {
  const { t } = useT()
  const { activeModule } = useNav()
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (activeModule && activeModule !== 'reports' && activeModule !== 'reports-dashboard') {
      setActiveReport(activeModule)
    }
  }, [activeModule])

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['financial-report', activeReport, from, to],
    queryFn: async () => {
      if (!activeReport) return null
      const params = new URLSearchParams()
      params.set('type', activeReport)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const r = await fetch(`/api/erp/financial-statements?${params}`)
      if (!r.ok) throw new Error('Failed')
      const json = await r.json()
      return json.data
    },
    enabled: !!activeReport,
  })

  const handleGenerate = (type: string) => {
    setActiveReport(type)
    setTimeout(() => refetch(), 50)
  }

  const handleExport = () => {
    if (!data || !activeReport) return
    let rows: any[] = []
    if (activeReport === 'trial-balance') {
      rows = (data.rows ?? []).map((r: any) => ({
        'الرمز': r.code,
        'الحساب': r.nameAr,
        'النوع': r.type,
        'مدين': r.debit,
        'دائن': r.credit,
      }))
    } else if (activeReport === 'income') {
      rows = [
        ...((data.revenues ?? []).map((r: any) => ({ 'القسم': 'إيرادات', 'الرمز': r.code, 'البيان': r.nameAr, 'المبلغ': r.amount }))),
        ...((data.expenses ?? []).map((r: any) => ({ 'القسم': 'مصروفات', 'الرمز': r.code, 'البيان': r.nameAr, 'المبلغ': r.amount }))),
      ]
    } else if (activeReport === 'balance-sheet') {
      rows = [
        ...((data.assets ?? []).map((r: any) => ({ 'القسم': 'أصول', 'الرمز': r.code, 'البيان': r.nameAr, 'المبلغ': r.amount }))),
        ...((data.liabilities ?? []).map((r: any) => ({ 'القسم': 'التزامات', 'الرمز': r.code, 'البيان': r.nameAr, 'المبلغ': r.amount }))),
        ...((data.equity ?? []).map((r: any) => ({ 'القسم': 'حقوق ملكية', 'الرمز': r.code, 'البيان': r.nameAr, 'المبلغ': r.amount }))),
      ]
    } else if (activeReport === 'inventory-value') {
      rows = (data.rows ?? []).map((r: any) => ({
        'SKU': r.sku,
        'المنتج': r.name,
        'المستودع': r.warehouse,
        'الكمية': r.quantity,
        'التكلفة': r.costPrice,
        'القيمة': r.value,
      }))
    } else if (data.rows && Array.isArray(data.rows)) {
      rows = data.rows
    }
    exportToCSV(activeReport, rows)
    toast.success('تم تصدير التقرير بنجاح')
  }

  const handlePrint = () => {
    if (!data || !activeReport) return
    const title = ALL_REPORTS_LIST.find((r) => r.type === activeReport)?.title ?? activeReport
    let body = ''
    if (activeReport === 'trial-balance') {
      body = `
        <table>
          <thead><tr><th>الرمز</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
          <tbody>
            ${(data.rows ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.debit)}</td><td>${formatCurrency(r.credit)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="2">الإجمالي</td><td>${formatCurrency(data.totalDebit)}</td><td>${formatCurrency(data.totalCredit)}</td></tr></tfoot>
        </table>
      `
    } else {
      body = `<pre style="font-family:sans-serif;white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>`
    }
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال ERP</h2><p>${title}</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">${title}</div>
          <div class="code">${from ? formatDate(from) : 'بداية'}</div>
          <div class="date">${to ? formatDate(to) : formatDate(new Date())}</div>
        </div>
      </div>
      ${body}
    `
    printHTML(html, title)
  }

  return (
    <ModuleShell
      title={t('module.reports')}
      description="المركز الموحد للتقارير المحاسبية والمالية والمبيعات والمشتريات والمخزون"
      icon={<BarChart3 className="size-5" />}
    >
      <Tabs defaultValue="accounting">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-5">
          <TabsTrigger value="accounting">محاسبي ومالي</TabsTrigger>
          <TabsTrigger value="sales">المبيعات والعملاء</TabsTrigger>
          <TabsTrigger value="purchases">المشتريات والموردين</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
          <TabsTrigger value="hr">الرواتب والموارد</TabsTrigger>
          <TabsTrigger value="platform">النظام والأمان</TabsTrigger>
        </TabsList>

        {/* Date range filter */}
        <Card className="p-4 mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">من تاريخ</Label>
              <DatePicker id="from" value={from} onChange={(val) => setFrom(val)} placeholder="من تاريخ" className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">إلى تاريخ</Label>
              <DatePicker id="to" value={to} onChange={(val) => setTo(val)} placeholder="إلى تاريخ" className="w-40" />
            </div>
          </div>
        </Card>

        <TabsContent value="accounting" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.accounting.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.sales.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.purchases.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.inventory.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hr" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.hr.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="platform" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {REPORTS.platform.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>
      </Tabs>


      {/* Report Results */}
      {activeReport && (
        <Card className="mt-5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base">
              نتائج: {REPORTS.accounting.concat(REPORTS.sales, REPORTS.purchases, REPORTS.inventory).find((r) => r.type === activeReport)?.title ?? activeReport}
            </h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
                <Download className="size-3.5" /> تصدير
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                <Printer className="size-3.5" /> طباعة
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">جاري إنشاء التقرير...</div>
          ) : !data ? (
            <div className="py-10 text-center text-muted-foreground">اختر تقريراً لعرض النتائج</div>
          ) : (
            <ReportResults type={activeReport} data={data} />
          )}
        </Card>
      )}
    </ModuleShell>
  )
}


function ReportCard({ report, onGenerate, active }: { report: any; onGenerate: () => void; active: boolean }) {
  const Icon = report.icon
  return (
    <Card className={`p-5 transition-all hover:shadow-md ${active ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`size-10 rounded-xl flex items-center justify-center ring-1 ${COLOR_CLASSES[report.color]}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{report.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">تقرير تفصيلي</p>
        </div>
      </div>
      <Button size="sm" className="w-full gap-1.5" onClick={onGenerate} variant={active ? 'default' : 'outline'}>
        <PlayCircle className="size-4" />
        {active ? 'مُحدد' : 'إنشاء التقرير'}
      </Button>
    </Card>
  )
}

function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card className="p-5 opacity-60">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-10 rounded-xl flex items-center justify-center ring-1 bg-muted text-muted-foreground">
          <FileText className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">قيد التطوير</p>
        </div>
      </div>
      <Button size="sm" className="w-full" disabled variant="outline">قريباً</Button>
    </Card>
  )
}

function ReportResults({ type, data }: { type: string; data: any }) {
  if (type === 'trial-balance') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">الرمز</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-end num-cell">مدين</TableHead>
                <TableHead className="text-end num-cell">دائن</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.nameAr}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.type}</Badge></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.debit)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.credit)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">الإجمالي</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalDebit)}</span></TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalCredit)}</span></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }
  if (type === 'income') {
    return (
      <div className="space-y-5">
        <Card className="rounded-lg overflow-hidden">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-b">
            <p className="font-semibold text-blue-700 dark:text-blue-400">الإيرادات</p>
          </div>
          <Table>
            <TableBody>
              {(data.revenues ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.nameAr}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-blue-600" dir="ltr">{formatCurrency(r.amount)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="rounded-lg overflow-hidden">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b">
            <p className="font-semibold text-amber-700 dark:text-amber-400">المصروفات</p>
          </div>
          <Table>
            <TableBody>
              {(data.expenses ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.nameAr}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-amber-600" dir="ltr">{formatCurrency(r.amount)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
            <p className="font-bold text-lg text-blue-700 dark:text-blue-400 tabular-nums" dir="ltr">{formatCurrency(data.totals?.revenue ?? 0)}</p>
          </Card>
          <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
            <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
            <p className="font-bold text-lg text-amber-700 dark:text-amber-400 tabular-nums" dir="ltr">{formatCurrency(data.totals?.expense ?? 0)}</p>
          </Card>
          <Card className={`p-4 ${(data.totals?.netProfit ?? 0) >= 0 ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'}`}>
            <p className="text-xs text-muted-foreground">صافي الربح</p>
            <p className={`font-bold text-lg tabular-nums ${(data.totals?.netProfit ?? 0) >= 0 ? 'text-sky-700 dark:text-sky-400' : 'text-rose-700 dark:text-rose-400'}`} dir="ltr">{formatCurrency(data.totals?.netProfit ?? 0)}</p>
          </Card>
        </div>
      </div>
    )
  }
  if (type === 'balance-sheet') {
    return (
      <div className="space-y-5">
        <BalanceSheetSection title="الأصول" items={data.assets ?? []} color="emerald" total={data.totals?.assets ?? 0} />
        <BalanceSheetSection title="الالتزامات" items={data.liabilities ?? []} color="rose" total={data.totals?.liabilities ?? 0} />
        <BalanceSheetSection title="حقوق الملكية + صافي الدخل" items={[
          ...(data.equity ?? []),
          { code: '—', nameAr: `صافي الدخل (${data.netIncome >= 0 ? 'ربح' : 'خسارة'})`, amount: data.netIncome ?? 0 },
        ]} color="violet" total={data.totals?.equity ?? 0} />
      </div>
    )
  }
  if (type === 'sales-summary' || type === 'purchases-summary') {
    const isSales = type === 'sales-summary'
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="إجمالي الطلبات" value={formatCurrency(isSales ? data.totalSales : data.totalPurchases)} />
        <SummaryCard title="إجمالي الفواتير" value={formatCurrency(data.totalInvoiced)} />
        <SummaryCard title="المدفوع" value={formatCurrency(data.totalPaid)} />
        <SummaryCard title="المستحق" value={formatCurrency(data.outstanding)} />
        <SummaryCard title="عدد الطلبات" value={formatInt(data.ordersCount)} />
        <SummaryCard title="عدد الفواتير" value={formatInt(data.invoicesCount)} />
      </div>
    )
  }
  if (type === 'inventory-value') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">SKU</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead className="text-end num-cell">الكمية</TableHead>
                <TableHead className="text-end num-cell">التكلفة</TableHead>
                <TableHead className="text-end num-cell">القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{r.warehouse}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatInt(r.quantity)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.costPrice)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(r.value)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-bold">إجمالي القيمة</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalValue ?? 0)}</span></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }
  if (type === 'general-journal') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">رقم القيد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead className="text-end num-cell">إجمالي المدين</TableHead>
                <TableHead className="text-end num-cell">إجمالي الدائن</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.number}</TableCell>
                  <TableCell className="text-xs">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-xs">{r.ref}</TableCell>
                  <TableCell className="font-medium text-xs">{r.description}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.totalDebit)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.totalCredit)}</span></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.state === 'posted' ? 'رحل' : 'مسودة'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold">الإجمالي</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalDebit)}</span></TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalCredit)}</span></TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (type === 'account-statement') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">التاريخ</TableHead>
                <TableHead>رقم القيد</TableHead>
                <TableHead>رمز الحساب</TableHead>
                <TableHead>اسم الحساب</TableHead>
                <TableHead>البيان / الشريك</TableHead>
                <TableHead className="text-end num-cell">مدين</TableHead>
                <TableHead className="text-end num-cell">دائن</TableHead>
                <TableHead className="text-end num-cell">الرصيد التراكمي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 text-xs">{formatDate(r.date)}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.entryNumber}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.accountCode}</TableCell>
                  <TableCell className="font-medium text-xs">{r.accountName}</TableCell>
                  <TableCell className="text-xs">{r.description} {r.partner ? `(${r.partner})` : ''}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.debit)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.credit)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(r.balance)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-bold">الإجمالي والرصيد النهائي</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalDebit)}</span></TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.totalCredit)}</span></TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(data.endingBalance)}</span></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (type === 'customer-statement' || type === 'ar-aging' || type === 'supplier-statement' || type === 'ap-aging') {
    const isCustomer = type.includes('customer') || type.includes('ar')
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">الرمز</TableHead>
                <TableHead>{isCustomer ? 'العميل' : 'المورد'}</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead className="text-end num-cell">إجمالي الفواتير</TableHead>
                <TableHead className="text-end num-cell">المدفوع</TableHead>
                <TableHead className="text-end num-cell">الرصيد القائم</TableHead>
                <TableHead className="text-end num-cell">حالي (0-30)</TableHead>
                <TableHead className="text-end num-cell">31-60 يوم</TableHead>
                <TableHead className="text-end num-cell">61-90 يوم</TableHead>
                <TableHead className="text-end num-cell">+90 يوم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium text-xs">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.phone}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.invoiced)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-emerald-600" dir="ltr">{formatCurrency(r.paid)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums text-rose-600" dir="ltr">{formatCurrency(r.balance)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.current)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.days30)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.days60)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-600 font-semibold" dir="ltr">{formatCurrency(r.days90Plus)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-bold">إجمالي الرصيد المستحق</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums text-rose-600" dir="ltr">{formatCurrency(data.totalBalance)}</span></TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (type === 'low-stock') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">SKU</TableHead>
                <TableHead>اسم الصنف</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead className="text-end num-cell">حد الطلب الأدنى</TableHead>
                <TableHead className="text-end num-cell">المتوفر حالياً</TableHead>
                <TableHead className="text-end num-cell">مقدار النقص</TableHead>
                <TableHead className="text-end num-cell">سعر التكلفة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i} className="bg-rose-50/40 dark:bg-rose-950/20">
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.sku}</TableCell>
                  <TableCell className="font-medium text-xs">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.category}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatInt(r.minStock)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-600 font-bold" dir="ltr">{formatInt(r.currentStock)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-700 font-bold" dir="ltr">{formatInt(r.shortage)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.costPrice)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (type === 'payroll-summary') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">الفترة</TableHead>
                <TableHead>كود الموظف</TableHead>
                <TableHead>اسم الموظف</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead className="text-end num-cell">الراتب الأساسي</TableHead>
                <TableHead className="text-end num-cell">البدلات</TableHead>
                <TableHead className="text-end num-cell">الخصومات</TableHead>
                <TableHead className="text-end num-cell">صافي الراتب</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.period}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.empCode}</TableCell>
                  <TableCell className="font-medium text-xs">{r.empName}</TableCell>
                  <TableCell className="text-xs">{r.dept}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.basic)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-emerald-600" dir="ltr">{formatCurrency(r.allowances)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-600" dir="ltr">{formatCurrency(r.deductions)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(r.net)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="font-bold">إجمالي صافي المسيرات</TableCell>
                <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums text-emerald-600" dir="ltr">{formatCurrency(data.totalNet)}</span></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (type === 'audit-trail') {
    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-3">التاريخ والوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>العملية</TableHead>
                <TableHead>الموديول</TableHead>
                <TableHead>الكيان المستهدف</TableHead>
                <TableHead>عنوان IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.rows ?? []).map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="ps-3 text-xs">{formatDate(r.date)}</TableCell>
                  <TableCell className="font-medium text-xs">{r.user}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.action}</Badge></TableCell>
                  <TableCell className="text-xs">{r.module}</TableCell>
                  <TableCell className="text-xs font-mono">{r.entity}</TableCell>
                  <TableCell className="text-xs font-mono" dir="ltr">{r.ip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  if (data?.rows && Array.isArray(data.rows) && data.rows.length > 0) {
    const sample = data.rows[0]
    const keys = Object.keys(sample).filter((k) => k !== 'id')

    const getHeaderLabel = (k: string) => {
      const labels: Record<string, string> = {
        code: 'الرمز / الكود',
        number: 'رقم المستند',
        partner: 'الشريك / العميل / المورد',
        partnerCode: 'رمز الشريك',
        supplier: 'المورد',
        name: 'الاسم / الصنف',
        productName: 'اسم الصنف',
        sku: 'رمز SKU',
        date: 'التاريخ',
        requiredDate: 'التاريخ المطلوب',
        billDate: 'تاريخ الفاتورة',
        amount: 'المبلغ',
        total: 'الإجمالي',
        paid: 'المدفوع',
        subtotal: 'المبلغ قبل الضريبة',
        taxTotal: 'الضريبة',
        discount: 'الخصم',
        status: 'الحالة',
        state: 'الحالة',
        method: 'طريقة الدفع',
        reference: 'المرجع',
        reason: 'السبب / البيان',
        department: 'القسم',
        dept: 'القسم',
        job: 'المسمى الوظيفي',
        phone: 'الهاتف',
        email: 'البريد الإلكتروني',
        quantity: 'الكمية',
        invoicesCount: 'عدد الفواتير',
        totalInvoiced: 'إجمالي المفوتر',
        totalPaid: 'إجمالي المحصل / المدفوع',
        balance: 'الرصيد القائم',
        warehouse: 'المستودع',
        type: 'النوع',
        checkIn: 'وقت الدخول',
        checkOut: 'وقت الخروج',
        leaveType: 'نوع الإجازة',
        startDate: 'من تاريخ',
        endDate: 'إلى تاريخ',
        days: 'عدد الأيام',
        empCode: 'كود الموظف',
        empName: 'اسم الموظف',
      }
      return labels[k] || k
    }

    const renderCell = (r: any, key: string) => {
      const val = r[key]
      if (val === null || val === undefined) return '—'
      if (key === 'date' || key === 'requiredDate' || key === 'billDate' || key === 'startDate' || key === 'endDate') {
        return formatDate(val)
      }
      if (typeof val === 'number') {
        if (key.includes('Count') || key === 'quantity' || key === 'days') return <span className="num font-mono" dir="ltr">{formatInt(val)}</span>
        return <span className="num font-mono font-semibold" dir="ltr">{formatCurrency(val)}</span>
      }
      if (key === 'status' || key === 'state') {
        return <Badge variant="outline" className="text-[10px]">{String(val)}</Badge>
      }
      if (key === 'code' || key === 'sku' || key === 'number' || key === 'empCode' || key === 'partnerCode') {
        return <span className="font-mono text-xs" dir="ltr">{String(val)}</span>
      }
      return String(val)
    }

    return (
      <Card className="rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {keys.map((k) => (
                  <TableHead key={k} className={typeof sample[k] === 'number' ? 'text-end num-cell' : ''}>
                    {getHeaderLabel(k)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r: any, i: number) => (
                <TableRow key={i}>
                  {keys.map((k) => (
                    <TableCell key={k} className={`text-xs ${typeof sample[k] === 'number' ? 'text-end num-cell' : ''}`}>
                      {renderCell(r, k)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    )
  }

  return (
    <Card className="p-8 text-center border-dashed">
      <div className="flex flex-col items-center justify-center gap-2">
        <FileText className="size-10 text-muted-foreground/50" />
        <p className="font-semibold text-sm">لا تتوفر بيانات للتقرير المحدد</p>
        <p className="text-xs text-muted-foreground">قم بتغيير نطاق التاريخ أو حدد تقريراً آخر لعرض النتائج التفصيلية.</p>
      </div>
    </Card>
  )
}

function BalanceSheetSection({ title, items, color, total }: { title: string; items: any[]; color: string; total: number }) {
  return (
    <Card className="rounded-lg overflow-hidden">
      <div className={`p-3 bg-${color}-50 dark:bg-${color}-950/30 border-b`}>
        <div className="flex items-center justify-between">
          <p className={`font-semibold text-${color}-700 dark:text-${color}-400`}>{title}</p>
          <span className={`font-bold tabular-nums text-${color}-700 dark:text-${color}-400`} dir="ltr">{formatCurrency(total)}</span>
        </div>
      </div>
      <Table>
        <TableBody>
          {items.map((r: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="ps-3 font-mono text-xs" dir="ltr">{r.code}</TableCell>
              <TableCell className="font-medium">{r.nameAr}</TableCell>
              <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.amount)}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-bold text-lg tabular-nums mt-1" dir="ltr">{value}</p>
    </Card>
  )
}
