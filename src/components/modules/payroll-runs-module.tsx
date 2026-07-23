'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Wallet, Plus, Printer, Calculator, Send, Coins, Eye, CheckCircle2,
} from 'lucide-react'

interface Payslip {
  id: string
  code: string
  grossSalary: number
  allowances: number
  deductions: number
  netSalary: number
  status: string
  employee?: { employeeNo: string; nameAr: string; department?: { nameAr: string } }
}

interface PayrollRun {
  id: string
  period: string
  startDate: string
  endDate: string
  status: string
  totalGross: number
  totalDeductions: number
  totalNet: number
  _count?: { payslips: number }
  payslips?: Payslip[]
}

interface Draft {
  period: string
  startDate: string
  endDate: string
}

const currentMonth = new Date().toISOString().slice(0, 7)
const emptyDraft: Draft = {
  period: currentMonth,
  startDate: `${currentMonth}-01`,
  endDate: `${currentMonth}-28`,
}

export function PayrollRunsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewing, setViewing] = useState<PayrollRun | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDir = () => {
        const docDir = document.documentElement.dir || 'rtl'
        setDir(docDir as 'rtl' | 'ltr')
      }
      updateDir()
      const observer = new MutationObserver(updateDir)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dir'],
      })
      return () => observer.disconnect()
    }
  }, [])

  const isRTL = dir === 'rtl'


  const { data, isLoading } = useQuery<{ data: PayrollRun[]; meta: any }>({
    queryKey: ['payroll-runs', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '300')
      const r = await fetch(`/api/erp/payroll-runs?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const items = data?.data ?? []

  const thisMonth = new Date().toISOString().slice(0, 7)
  const stats = {
    total: items.length,
    posted: items.filter((i) => ['posted', 'paid'].includes(i.status)).length,
    totalNet: items.reduce((s, i) => s + (i.totalNet || 0), 0),
    thisMonth: items.filter((i) => i.period === thisMonth).length,
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!draft.period) throw new Error('الفترة مطلوبة')
      const r = await fetch('/api/erp/payroll-runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: draft.period,
          startDate: draft.startDate,
          endDate: draft.endDate,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الإنشاء')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء تشغيل الرواتب')
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
      setDialogOpen(false)
      setDraft(emptyDraft)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await fetch(`/api/erp/payroll-runs/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل')
      }
      return r.json()
    },
    onSuccess: (resp: any) => {
      const msg = resp?.journalEntryCode ? `تم الترحيل — قيد ${resp.journalEntryCode}` : 'تم تنفيذ الإجراء'
      toast.success(msg)
      qc.invalidateQueries({ queryKey: ['payroll-runs'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const viewMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/payroll-runs/${id}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: (resp: any) => {
      setViewing(resp.data)
      setViewDialogOpen(true)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((r) => ({
      'الفترة': r.period,
      'من': formatDate(r.startDate),
      'إلى': formatDate(r.endDate),
      'الإجمالي': r.totalGross,
      'الاستقطاعات': r.totalDeductions,
      'الصافي': r.totalNet,
      'الحالة': r.status,
      'بنود الرواتب': r._count?.payslips ?? 0,
    }))
    exportToCSV('payroll-runs', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (r: PayrollRun) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال</h2><p>ملخص رواتب الموظفين</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">تشغيل رواتب</div>
          <div class="code">${r.period}</div>
          <div class="date">${formatDate(r.startDate)} — ${formatDate(r.endDate)}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>الكود</th><th>الموظف</th><th>الإدارة</th><th>الإجمالي</th><th>البدلات</th><th>الاستقطاعات</th><th>الصافي</th></tr></thead>
        <tbody>
          ${(r.payslips ?? []).map((p) => `
            <tr>
              <td>${p.code}</td>
              <td>${p.employee?.nameAr ?? ''}</td>
              <td>${p.employee?.department?.nameAr ?? '—'}</td>
              <td>${formatCurrency(p.grossSalary)}</td>
              <td>${formatCurrency(p.allowances)}</td>
              <td>${formatCurrency(p.deductions)}</td>
              <td>${formatCurrency(p.netSalary)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">الإجمالي</td>
            <td>${formatCurrency(r.totalGross)}</td>
            <td>—</td>
            <td>${formatCurrency(r.totalDeductions)}</td>
            <td>${formatCurrency(r.totalNet)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">مدير الموارد البشرية</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير العام</div></div>
      </div>
    `
    printHTML(html, `ملخص رواتب ${r.period}`)
  }

  const handleViewPrint = () => {
    if (viewing) handlePrint(viewing)
  }

  return (
    <ModuleShell
      title={t('module.payroll-runs')}
      description="إدارة تشغيلات الرواتب الشهرية والحساب والترحيل"
      icon={<Wallet className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالفترة (YYYY-MM)..."
      onAdd={() => { setDraft(emptyDraft); setDialogOpen(true) }}
      addLabel="تشغيل جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي التشغيلات" value={formatInt(stats.total)} icon={<Wallet className="size-5" />} accent="blue" />
        <KpiCard title="مُرحّلة" value={formatInt(stats.posted)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title="صافي الرواتب" value={formatCurrency(stats.totalNet)} icon={<Coins className="size-5" />} accent="violet" />
        <KpiCard title="هذا الشهر" value={formatInt(stats.thisMonth)} icon={<Calculator className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الفترة</TableHead>
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead className="text-end num-cell">الاستقطاعات</TableHead>
                <TableHead className="text-end num-cell">الصافي</TableHead>
                <TableHead className="text-end num-cell">البنود</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد تشغيلات رواتب. ابدأ بإنشاء أول تشغيل.</TableCell></TableRow>
              ) : items.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono font-semibold" dir="ltr">{r.period}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.startDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.endDate)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.totalGross)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-600" dir="ltr">{formatCurrency(r.totalDeductions)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-blue-600" dir="ltr">{formatCurrency(r.totalNet)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{r._count?.payslips ?? 0}</span></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {['draft', 'calculated'].includes(r.status) && (
                        <Button size="icon" variant="ghost" className="size-8 text-amber-600" title="حساب" onClick={() => actionMutation.mutate({ id: r.id, action: 'calculate' })}>
                          <Calculator className="size-3.5" />
                        </Button>
                      )}
                      {['calculated', 'reviewed', 'approved'].includes(r.status) && (
                        <Button size="icon" variant="ghost" className="size-8 text-blue-600" title="ترحيل" onClick={() => actionMutation.mutate({ id: r.id, action: 'post' })}>
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      {r.status === 'posted' && (
                        <Button size="icon" variant="ghost" className="size-8 text-violet-600" title="دفع" onClick={() => actionMutation.mutate({ id: r.id, action: 'pay' })}>
                          <Coins className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" title="عرض البنود" onClick={() => viewMutation.mutate(r.id)}>
                        <Eye className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-350 dark:border-slate-700 shadow-2xl" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Calculator className="size-6 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تشغيل رواتب جديد' : 'New Payroll Run'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 bg-white dark:bg-slate-950">
            <div className="space-y-4">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="period" className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'الفترة (YYYY-MM) *' : 'Period (YYYY-MM) *'}</Label>
                <Input id="period" type="month" value={draft.period} onChange={(e) => {
                  const p = e.target.value
                  setDraft({ ...draft, period: p, startDate: `${p}-01`, endDate: `${p}-28` })
                }} className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500 focus-visible:border-blue-500" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-start">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'من تاريخ' : 'Start Date'}</Label>
                  <Input id="startDate" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500 focus-visible:border-blue-500 font-mono text-end" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'إلى تاريخ' : 'End Date'}</Label>
                  <Input id="endDate" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500 focus-visible:border-blue-500 font-mono text-end" dir="ltr" />
                </div>
              </div>

              <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 dark:shadow-none">
                  {createMutation.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء' : 'Create')}
                </Button>
              </DialogFooter>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Wallet className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? `بنود رواتب فترة ${viewing?.period}` : `Payroll Run Period ${viewing?.period}`}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-700/70 dark:text-blue-200/60 leading-normal">
                  {viewing?.payslips?.length ?? 0} {isRTL ? 'موظف' : 'employees'} · {isRTL ? 'إجمالي' : 'Gross'} {viewing ? formatCurrency(viewing.totalGross) : ''} · {isRTL ? 'صافي' : 'Net'} {viewing ? formatCurrency(viewing.totalNet) : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6">
            <div className="space-y-4">
              <Card className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                <ScrollArea className="max-h-[50vh]">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead className="ps-3 text-xs">{isRTL ? 'الكود' : 'Code'}</TableHead>
                        <TableHead className="text-xs">{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                        <TableHead className="text-xs">{isRTL ? 'الإدارة' : 'Department'}</TableHead>
                        <TableHead className="text-end num-cell text-xs">{isRTL ? 'الإجمالي' : 'Gross'}</TableHead>
                        <TableHead className="text-end num-cell text-xs">{isRTL ? 'البدلات' : 'Allowances'}</TableHead>
                        <TableHead className="text-end num-cell text-xs">{isRTL ? 'الاستقطاعات' : 'Deductions'}</TableHead>
                        <TableHead className="text-end num-cell text-xs">{isRTL ? 'الصافي' : 'Net'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewing?.payslips ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">{isRTL ? 'لا توجد بنود. قم بحساب التشغيل أولاً.' : 'No items. Please calculate the run first.'}</TableCell></TableRow>
                      ) : (viewing?.payslips ?? []).map((p) => (
                        <TableRow key={p.id} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <TableCell className="ps-3 font-mono text-[11px]" dir="ltr">{p.code}</TableCell>
                          <TableCell className="font-semibold">{p.employee?.nameAr ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{p.employee?.department?.nameAr ?? '—'}</TableCell>
                          <TableCell className="text-end num-cell font-mono">{formatCurrency(p.grossSalary)}</TableCell>
                          <TableCell className="text-end num-cell font-mono">{formatCurrency(p.allowances)}</TableCell>
                          <TableCell className="text-end num-cell font-mono text-rose-600">{formatCurrency(p.deductions)}</TableCell>
                          <TableCell className="text-end num-cell font-semibold text-blue-600 font-mono">{formatCurrency(p.netSalary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    {viewing && (viewing.payslips?.length ?? 0) > 0 && (
                      <TableFooter className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="text-xs font-semibold">
                          <TableCell colSpan={3} className="ps-3">{isRTL ? 'الإجمالي' : 'Total'}</TableCell>
                          <TableCell className="text-end num-cell font-mono">{formatCurrency(viewing.totalGross)}</TableCell>
                          <TableCell className="text-end num-cell">—</TableCell>
                          <TableCell className="text-end num-cell text-rose-600 font-mono">{formatCurrency(viewing.totalDeductions)}</TableCell>
                          <TableCell className="text-end num-cell text-blue-600 font-mono">{formatCurrency(viewing.totalNet)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </ScrollArea>
              </Card>

              <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setViewDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'إغلاق' : 'Close'}
                </Button>
                <Button type="button" onClick={handleViewPrint} className="h-10 px-5 bg-blue-650 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-sm shadow-blue-100 dark:shadow-none">
                  <Printer className="size-4" /> {isRTL ? 'طباعة الملخص' : 'Print Summary'}
                </Button>
              </DialogFooter>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>

  )
}
