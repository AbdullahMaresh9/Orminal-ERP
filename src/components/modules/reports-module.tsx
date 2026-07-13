'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
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
import {
  BarChart3, FileText, BookOpen, Scale, TrendingUp, TrendingDown,
  Boxes, Coins, Printer, Download, PlayCircle,
} from 'lucide-react'

type ReportType = 'trial-balance' | 'income' | 'balance-sheet' | 'sales-summary' | 'purchases-summary' | 'inventory-value'

const REPORTS = {
  accounting: [
    { type: 'trial-balance' as ReportType, title: 'ميزان المراجعة', icon: Scale, color: 'blue' },
    { type: 'income' as ReportType, title: 'قائمة الدخل', icon: TrendingUp, color: 'sky' },
    { type: 'balance-sheet' as ReportType, title: 'الميزانية العمومية', icon: BookOpen, color: 'violet' },
  ],
  sales: [
    { type: 'sales-summary' as ReportType, title: 'ملخص المبيعات', icon: FileText, color: 'blue' },
  ],
  purchases: [
    { type: 'purchases-summary' as ReportType, title: 'ملخص المشتريات', icon: FileText, color: 'amber' },
  ],
  inventory: [
    { type: 'inventory-value' as ReportType, title: 'قيمة المخزون', icon: Boxes, color: 'violet' },
  ],
}

const COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 ring-blue-200 dark:ring-blue-900',
  teal: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 ring-sky-200 dark:ring-sky-900',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 ring-violet-200 dark:ring-violet-900',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 ring-amber-200 dark:ring-amber-900',
}

export function ReportsModule() {
  const { t } = useT()
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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

  const handleGenerate = (type: ReportType) => {
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
    }
    exportToCSV(activeReport, rows)
    toast.success('تم تصدير التقرير')
  }

  const handlePrint = () => {
    if (!data || !activeReport) return
    const title = REPORTS.accounting.concat(REPORTS.sales, REPORTS.purchases, REPORTS.inventory).find((r) => r.type === activeReport)?.title ?? activeReport
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
    } else if (activeReport === 'income') {
      body = `
        <h3>الإيرادات</h3>
        <table>
          <thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${(data.revenues ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.amount)}</td></tr>`).join('')}
          </tbody>
        </table>
        <h3>المصروفات</h3>
        <table>
          <thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${(data.expenses ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.amount)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>إجمالي الإيرادات:</span><span>${formatCurrency(data.totals?.revenue ?? 0)}</span></div>
          <div class="row"><span>إجمالي المصروفات:</span><span>${formatCurrency(data.totals?.expense ?? 0)}</span></div>
          <div class="row grand"><span>صافي الربح:</span><span>${formatCurrency(data.totals?.netProfit ?? 0)}</span></div>
        </div>
      `
    } else if (activeReport === 'balance-sheet') {
      body = `
        <h3>الأصول</h3>
        <table><thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead>
        <tbody>${(data.assets ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.amount)}</td></tr>`).join('')}</tbody></table>
        <h3>الالتزامات</h3>
        <table><thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead>
        <tbody>${(data.liabilities ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.amount)}</td></tr>`).join('')}</tbody></table>
        <h3>حقوق الملكية</h3>
        <table><thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead>
        <tbody>${(data.equity ?? []).map((r: any) => `<tr><td>${r.code}</td><td>${r.nameAr}</td><td>${formatCurrency(r.amount)}</td></tr>`).join('')}</tbody></table>
        <div class="totals">
          <div class="row"><span>إجمالي الأصول:</span><span>${formatCurrency(data.totals?.assets ?? 0)}</span></div>
          <div class="row"><span>إجمالي الالتزامات:</span><span>${formatCurrency(data.totals?.liabilities ?? 0)}</span></div>
          <div class="row"><span>إجمالي حقوق الملكية:</span><span>${formatCurrency(data.totals?.equity ?? 0)}</span></div>
        </div>
      `
    } else if (activeReport === 'sales-summary' || activeReport === 'purchases-summary') {
      body = `
        <div class="totals">
          <div class="row"><span>إجمالي الطلبات:</span><span>${formatCurrency(data.totalSales ?? data.totalPurchases ?? 0)}</span></div>
          <div class="row"><span>إجمالي الفواتير:</span><span>${formatCurrency(data.totalInvoiced ?? 0)}</span></div>
          <div class="row"><span>المدفوع:</span><span>${formatCurrency(data.totalPaid ?? 0)}</span></div>
          <div class="row"><span>المستحق:</span><span>${formatCurrency(data.outstanding ?? 0)}</span></div>
          <div class="row grand"><span>عدد الطلبات:</span><span>${data.ordersCount ?? 0}</span></div>
        </div>
      `
    } else if (activeReport === 'inventory-value') {
      body = `
        <table>
          <thead><tr><th>SKU</th><th>المنتج</th><th>المستودع</th><th>الكمية</th><th>التكلفة</th><th>القيمة</th></tr></thead>
          <tbody>
            ${(data.rows ?? []).map((r: any) => `<tr><td>${r.sku}</td><td>${r.name}</td><td>${r.warehouse}</td><td>${r.quantity}</td><td>${formatCurrency(r.costPrice)}</td><td>${formatCurrency(r.value)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="5">الإجمالي</td><td>${formatCurrency(data.totalValue ?? 0)}</td></tr></tfoot>
        </table>
      `
    }
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال</h2><p>${title}</p></div>
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
      description="التقارير المحاسبية والمالية والمخزون"
      icon={<BarChart3 className="size-5" />}
    >
      <Tabs defaultValue="accounting">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-5">
          <TabsTrigger value="accounting">محاسبي</TabsTrigger>
          <TabsTrigger value="sales">المبيعات</TabsTrigger>
          <TabsTrigger value="purchases">المشتريات</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
          <TabsTrigger value="customers">العملاء</TabsTrigger>
          <TabsTrigger value="suppliers">الموردون</TabsTrigger>
        </TabsList>

        {/* Date range filter */}
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">من تاريخ</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">إلى تاريخ</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        </Card>

        <TabsContent value="accounting" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REPORTS.accounting.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REPORTS.sales.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
            <ComingSoonCard title="كشف حساب عميل" />
            <ComingSoonCard title="أعمار ديون العملاء" />
          </div>
        </TabsContent>
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REPORTS.purchases.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
            <ComingSoonCard title="كشف حساب مورد" />
            <ComingSoonCard title="أعمار دائنية الموردين" />
          </div>
        </TabsContent>
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REPORTS.inventory.map((r) => (
              <ReportCard key={r.type} report={r} onGenerate={() => handleGenerate(r.type)} active={activeReport === r.type} />
            ))}
            <ComingSoonCard title="حركة مخزون صنف" />
            <ComingSoonCard title="تسوية المخزون" />
          </div>
        </TabsContent>
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ComingSoonCard title="كشف حساب عميل" />
            <ComingSoonCard title="أعمار ديون العملاء" />
            <ComingSoonCard title="تحليل العملاء" />
          </div>
        </TabsContent>
        <TabsContent value="suppliers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ComingSoonCard title="كشف حساب مورد" />
            <ComingSoonCard title="أعمار دائنية الموردين" />
            <ComingSoonCard title="تحليل الموردين" />
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

function ReportResults({ type, data }: { type: ReportType; data: any }) {
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
  return null
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
