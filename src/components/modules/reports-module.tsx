'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  BarChart3, FileText, ShoppingCart, Truck, Boxes, Users, Building2,
  Play, Printer, Download, Calendar, Filter, BarChart2, PieChart, TrendingUp,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const PIE_COLORS = ['#16a34a', '#65a30d', '#ca8a04', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#0d9488']

interface ReportDef {
  key: string
  title: string
  description: string
  type: string // endpoint type param
  category: 'accounting' | 'sales' | 'purchases' | 'inventory' | 'clients' | 'suppliers'
  icon: React.ReactNode
  working: boolean
}

const REPORTS: ReportDef[] = [
  // Accounting
  { key: 'trial-balance', title: 'ميزان المراجعة', description: 'كشف بأرصدة جميع الحسابات مدين/دائن', type: 'trial-balance', category: 'accounting', icon: <BarChart2 className="size-5" />, working: true },
  { key: 'income', title: 'قائمة الدخل', description: 'الإيرادات والمصروفات وصافي الربح', type: 'income', category: 'accounting', icon: <TrendingUp className="size-5" />, working: true },
  { key: 'balance', title: 'الميزانية العمومية', description: 'الأصول مقابل الالتزامات وحقوق الملكية', type: 'balance', category: 'accounting', icon: <BarChart3 className="size-5" />, working: true },
  { key: 'general-ledger', title: 'الأستاذ العام', description: 'تفاصيل القيود لكل حساب', type: 'general-ledger', category: 'accounting', icon: <FileText className="size-5" />, working: false },
  { key: 'tax-detailed', title: 'التقارير الضريبية المفصّلة', description: 'تقرير ضريبة القيمة المضافة المفصّل', type: 'tax-detailed', category: 'accounting', icon: <FileText className="size-5" />, working: false },
  { key: 'tax-summary', title: 'التقارير الضريبية المجملة', description: 'ملخص ضريبة القيمة المضافة', type: 'tax-summary', category: 'accounting', icon: <FileText className="size-5" />, working: false },
  { key: 'tax-return', title: 'الإقرار الضريبي', description: 'إقرار ضريبة القيمة المضافة', type: 'tax-return', category: 'accounting', icon: <FileText className="size-5" />, working: false },
  // Sales
  { key: 'sales-summary', title: 'ملخص المبيعات', description: 'إجمالي المبيعات والضريبة', type: 'sales-summary', category: 'sales', icon: <ShoppingCart className="size-5" />, working: true },
  { key: 'sales-invoices-detailed', title: 'الفواتير (مفصّل)', description: 'تفاصيل فواتير المبيعات', type: 'sales-invoices-detailed', category: 'sales', icon: <FileText className="size-5" />, working: false },
  { key: 'gross-profit', title: 'إجمالي الربح', description: 'تحليل هامش الربح الإجمالي', type: 'gross-profit', category: 'sales', icon: <TrendingUp className="size-5" />, working: false },
  { key: 'client-payments', title: 'مدفوعات العملاء', description: 'تقرير المقبوضات من العملاء', type: 'client-payments', category: 'sales', icon: <FileText className="size-5" />, working: false },
  // Purchases
  { key: 'purchases-summary', title: 'ملخص المشتريات', description: 'إجمالي المشتريات والضريبة', type: 'purchases-summary', category: 'purchases', icon: <Truck className="size-5" />, working: true },
  { key: 'purchase-invoices-detailed', title: 'فواتير الشراء (مفصّل)', description: 'تفاصيل فواتير المشتريات', type: 'purchase-invoices-detailed', category: 'purchases', icon: <FileText className="size-5" />, working: false },
  { key: 'supplier-payments', title: 'مدفوعات الموردين', description: 'تقرير المدفوعات للموردين', type: 'supplier-payments', category: 'purchases', icon: <FileText className="size-5" />, working: false },
  // Inventory
  { key: 'inventory-value', title: 'قيمة المخزون', description: 'قيمة المخزون بالتكلفة لكل منتج', type: 'inventory-value', category: 'inventory', icon: <Boxes className="size-5" />, working: true },
  // Clients
  { key: 'client-aging', title: 'أعمار ديون العملاء', description: 'تحليل أعمار الذمم المدينة', type: 'client-aging', category: 'clients', icon: <Users className="size-5" />, working: true },
  { key: 'client-statement', title: 'كشف حساب العميل', description: 'كشف حساب مفصّل للعميل', type: 'client-statement', category: 'clients', icon: <FileText className="size-5" />, working: false },
  // Suppliers
  { key: 'supplier-aging', title: 'أعمار دائنية الموردين', description: 'تحليل أعمار الذمم الدائنة', type: 'supplier-aging', category: 'suppliers', icon: <Building2 className="size-5" />, working: true },
  { key: 'supplier-statement', title: 'كشف حساب المورد', description: 'كشف حساب مفصّل للمورد', type: 'supplier-statement', category: 'suppliers', icon: <FileText className="size-5" />, working: false },
]

const CATEGORIES = [
  { key: 'accounting', label: 'محاسبي' },
  { key: 'sales', label: 'المبيعات' },
  { key: 'purchases', label: 'المشتريات' },
  { key: 'inventory', label: 'المخزون' },
  { key: 'clients', label: 'العملاء' },
  { key: 'suppliers', label: 'الموردون' },
] as const

export function ReportsModule() {
  const { t, locale } = useT()
  const [activeCategory, setActiveCategory] = useState<string>('accounting')
  const [selected, setSelected] = useState<ReportDef | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ['report', selected?.type, from, to],
    queryFn: async () => {
      if (!selected) return null
      const params = new URLSearchParams({ type: selected.type })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const r = await fetch(`/api/erp/reports?${params}`)
      if (!r.ok) throw new Error()
      return r.json()
    },
    enabled: !!selected,
  })

  function generate(r: ReportDef) {
    setSelected(r)
    setTimeout(() => refetch(), 50)
  }

  function handleExport() {
    if (!data?.rows || data.rows.length === 0) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV(selected?.title ?? 'report', data.rows)
  }

  function handlePrint() {
    if (!data) return
    const title = selected?.title ?? 'تقرير'
    let html = `<div class="doc-header"><div class="company"><div class="logo">أ</div><div class="info"><h2>مؤسسة الأستاذ التجارية</h2><p>${title}</p></div></div><div class="doc-meta"><div class="type">${title}</div><div class="date">${formatDate(new Date(), locale)}</div></div></div>`
    if (data.rows?.length) {
      const keys = Object.keys(data.rows[0])
      html += '<table><thead><tr>' + keys.map((k) => `<th>${k}</th>`).join('') + '</tr></thead><tbody>'
      html += data.rows.slice(0, 100).map((r: any) => '<tr>' + keys.map((k) => `<td>${typeof r[k] === 'number' ? formatNumber(r[k]) : (r[k] ?? '—')}</td>`).join('') + '</tr>').join('')
      html += '</tbody></table>'
    }
    if (data.totals) {
      html += '<div class="totals">'
      for (const [k, v] of Object.entries(data.totals)) {
        html += `<div class="row ${k.includes('total') || k.includes('net') ? 'grand' : ''}"><span>${k}</span><span>${typeof v === 'number' ? formatCurrency(v as number) : v}</span></div>`
      }
      html += '</div>'
    }
    printHTML(html, title)
  }

  return (
    <ModuleShell
      title={t('module.reports')}
      description="مركز التقارير الشامل"
      icon={<BarChart3 className="size-5" />}
      onPrint={selected ? handlePrint : undefined}
      onExport={selected ? handleExport : undefined}
    >
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="gap-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex w-max">
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORTS.filter((r) => r.category === cat.key).map((r) => (
                <Card key={r.key} className={`p-5 gap-3 hover:shadow-md transition-all cursor-pointer ${selected?.key === r.key ? 'ring-2 ring-primary' : ''}`} onClick={() => generate(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                      {r.icon}
                    </div>
                    {r.working ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">جاهز</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">قريباً</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{r.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  </div>
                  <Button size="sm" className="w-full gap-1.5" onClick={(e) => { e.stopPropagation(); generate(r) }}>
                    <Play className="size-3.5" /> توليد التقرير
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Report viewer */}
      {selected && (
        <Card className="rounded-xl border p-5 mt-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {selected.icon}
              </div>
              <div>
                <h3 className="font-semibold">{selected.title}</h3>
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Calendar className="size-3.5 text-muted-foreground" />
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-32 text-xs" />
                <span className="text-muted-foreground text-xs">—</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-32 text-xs" />
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
                <Filter className="size-3.5" /> {isFetching ? t('loading') : 'تحديث'}
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                <Printer className="size-3.5" /> طباعة
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
                <Download className="size-3.5" /> تصدير
              </Button>
            </div>
          </div>

          {isLoading || isFetching ? (
            <Skeleton className="h-96" />
          ) : !data ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('empty.noData')}</div>
          ) : data.placeholder ? (
            <div className="py-16 text-center">
              <div className="size-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
                <FileText className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{data.message}</p>
            </div>
          ) : (
            <ReportRenderer data={data} type={selected.type} locale={locale} />
          )}
        </Card>
      )}
    </ModuleShell>
  )
}

function ReportRenderer({ data, type, locale }: { data: any; type: string; locale: 'ar' | 'en' }) {
  // TRIAL BALANCE
  if (type === 'trial-balance') {
    return (
      <div className="space-y-4">
        <ChartBar data={data.chart ?? []} xKey="name" bars={[{ key: 'debit', name: 'مدين', color: '#16a34a' }, { key: 'credit', name: 'دائن', color: '#d97706' }]} locale={locale} />
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="text-end">مدين</TableHead>
                <TableHead className="text-end">دائن</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows?.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.type}</TableCell>
                  <TableCell className="text-end tabular-nums">{r.debit ? formatNumber(r.debit) : '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{r.credit ? formatNumber(r.credit) : '—'}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-primary bg-primary/5 font-bold">
                <TableCell colSpan={3}>الإجمالي</TableCell>
                <TableCell className="text-end tabular-nums">{formatNumber(data.totals.debit)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatNumber(data.totals.credit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  // INCOME STATEMENT
  if (type === 'income') {
    return (
      <div className="space-y-4">
        <ChartBar data={data.chart ?? []} xKey="name" bars={[{ key: 'value', name: 'القيمة', color: '#16a34a' }]} locale={locale} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="إجمالي الإيرادات" value={formatCurrency(data.totals.totalRevenue)} accent="emerald" />
          <SummaryCard label="إجمالي المصروفات" value={formatCurrency(data.totals.totalExpense)} accent="rose" />
          <SummaryCard label="صافي الربح" value={formatCurrency(data.totals.netIncome)} accent={data.totals.netIncome >= 0 ? 'teal' : 'rose'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="الإيرادات" rows={data.revenues} />
          <Section title="المصروفات" rows={data.expenses} />
        </div>
      </div>
    )
  }

  // BALANCE SHEET
  if (type === 'balance') {
    return (
      <div className="space-y-4">
        <ChartBar data={data.chart ?? []} xKey="name" bars={[{ key: 'value', name: 'القيمة', color: '#0d9488' }]} locale={locale} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="إجمالي الأصول" value={formatCurrency(data.totals.totalAssets)} accent="emerald" />
          <SummaryCard label="إجمالي الالتزامات" value={formatCurrency(data.totals.totalLiabilities)} accent="amber" />
          <SummaryCard label="حقوق الملكية" value={formatCurrency(data.totals.totalEquity)} accent="teal" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="الأصول" rows={data.assets} />
          <div className="space-y-4">
            <Section title="الالتزامات" rows={data.liabilities} />
            <Section title="حقوق الملكية" rows={data.equity} />
          </div>
        </div>
      </div>
    )
  }

  // SALES / PURCHASES SUMMARY
  if (type === 'sales-summary' || type === 'purchases-summary') {
    const isSales = type === 'sales-summary'
    return (
      <div className="space-y-4">
        <ChartBar data={data.chart ?? []} xKey="name" bars={[{ key: 'value', name: isSales ? 'المبيعات' : 'المشتريات', color: isSales ? '#16a34a' : '#d97706' }]} locale={locale} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="عدد العمليات" value={String(data.totals.count)} accent="violet" />
          <SummaryCard label="المجموع الفرعي" value={formatCurrency(data.totals.subtotal)} accent="emerald" />
          <SummaryCard label="الضريبة" value={formatCurrency(data.totals.tax)} accent="amber" />
          <SummaryCard label="الإجمالي" value={formatCurrency(data.totals.total)} accent="teal" />
        </div>
        <ScrollArea className="max-h-[40vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشهر</TableHead>
                <TableHead className="text-end">القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows?.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatCurrency(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  // INVENTORY VALUE
  if (type === 'inventory-value') {
    return (
      <div className="space-y-4">
        <ChartPie data={data.chart ?? []} locale={locale} />
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="عدد المنتجات" value={String(data.totals.count)} accent="violet" />
          <SummaryCard label="إجمالي القيمة" value={formatCurrency(data.totals.totalValue)} accent="emerald" />
        </div>
        <ScrollArea className="max-h-[50vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead className="text-end">الكمية</TableHead>
                <TableHead className="text-end">التكلفة</TableHead>
                <TableHead className="text-end">القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows?.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatNumber(r.qty, 0)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatCurrency(r.cost)}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{formatCurrency(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  // AGING (client / supplier)
  if (type === 'client-aging' || type === 'supplier-aging') {
    return (
      <div className="space-y-4">
        <ChartBar data={data.chart ?? []} xKey="name" bars={[{ key: 'value', name: 'الرصيد', color: '#dc2626' }]} locale={locale} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="الإجمالي" value={formatCurrency(data.totals.total)} accent="rose" />
          <SummaryCard label="حالي" value={formatCurrency(data.totals.current)} accent="emerald" />
          <SummaryCard label="0-30 يوم" value={formatCurrency(data.totals.d30)} accent="teal" />
          <SummaryCard label="90+ يوم" value={formatCurrency(data.totals.d90p)} accent="rose" />
        </div>
        <ScrollArea className="max-h-[50vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفئة العمرية</TableHead>
                <TableHead className="text-end">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows?.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.bucket}</span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatCurrency(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    )
  }

  return <div className="py-16 text-center text-sm text-muted-foreground">{t('empty.noData')}</div>
}

function ChartBar({ data, xKey, bars, locale }: { data: any[]; xKey: string; bars: { key: string; name: string; color: string }[]; locale: 'ar' | 'en' }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} reversed={locale === 'ar'} />
        <YAxis tick={{ fontSize: 11 }} orientation={locale === 'ar' ? 'right' : 'left'} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={{ direction: locale === 'ar' ? 'rtl' : 'ltr', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => formatCurrency(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartPie({ data, locale }: { data: any[]; locale: 'ar' | 'en' }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RPieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
          {data.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ direction: locale === 'ar' ? 'rtl' : 'ltr', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </RPieChart>
    </ResponsiveContainer>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' | 'rose' | 'teal' | 'violet' }) {
  const colors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400',
    teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400',
    violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400',
  }
  return (
    <div className={`p-4 rounded-xl border ${colors[accent]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: any[] }) {
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  return (
    <div className="rounded-xl border">
      <div className="px-4 py-2.5 border-b bg-muted/40 font-semibold text-sm flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">{rows.length} حساب</span>
      </div>
      <ScrollArea className="max-h-72">
        <Table>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell className="text-center text-muted-foreground py-6">لا بيانات</TableCell></TableRow>
            ) : rows.map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs text-muted-foreground w-20">{r.code}</TableCell>
                <TableCell className="font-medium text-sm">{r.name}</TableCell>
                <TableCell className="text-end tabular-nums text-sm font-semibold">{formatCurrency(r.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/30 font-bold">
              <TableCell colSpan={2}>الإجمالي</TableCell>
              <TableCell className="text-end tabular-nums">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
