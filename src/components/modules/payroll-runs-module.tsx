'use client'

import { useState } from 'react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي التشغيلات" value={formatInt(stats.total)} icon={<Wallet className="size-5" />} accent="emerald" />
        <KpiCard title="مُرحّلة" value={formatInt(stats.posted)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
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
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-emerald-600" dir="ltr">{formatCurrency(r.totalNet)}</span></TableCell>
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
                        <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="ترحيل" onClick={() => actionMutation.mutate({ id: r.id, action: 'post' })}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تشغيل رواتب جديد</DialogTitle>
            <DialogDescription>أدخل الفترة والتواريخ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="period">الفترة (YYYY-MM) *</Label>
              <Input id="period" type="month" value={draft.period} onChange={(e) => {
                const p = e.target.value
                setDraft({ ...draft, period: p, startDate: `${p}-01`, endDate: `${p}-28` })
              }} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">من تاريخ</Label>
                <Input id="startDate" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">إلى تاريخ</Label>
                <Input id="endDate" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} dir="ltr" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>بنود رواتب فترة {viewing?.period}</DialogTitle>
            <DialogDescription>
              {viewing?.payslips?.length ?? 0} موظف · إجمالي {viewing ? formatCurrency(viewing.totalGross) : ''} · صافي {viewing ? formatCurrency(viewing.totalNet) : ''}
            </DialogDescription>
          </DialogHeader>
          <Card className="rounded-lg overflow-hidden">
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">الكود</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الإدارة</TableHead>
                    <TableHead className="text-end num-cell">الإجمالي</TableHead>
                    <TableHead className="text-end num-cell">البدلات</TableHead>
                    <TableHead className="text-end num-cell">الاستقطاعات</TableHead>
                    <TableHead className="text-end num-cell">الصافي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(viewing?.payslips ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بنود. قم بحساب التشغيل أولاً.</TableCell></TableRow>
                  ) : (viewing?.payslips ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="ps-3 font-mono text-xs" dir="ltr">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.employee?.nameAr ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.employee?.department?.nameAr ?? '—'}</TableCell>
                      <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(p.grossSalary)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(p.allowances)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num tabular-nums text-rose-600" dir="ltr">{formatCurrency(p.deductions)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-emerald-600" dir="ltr">{formatCurrency(p.netSalary)}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {viewing && (viewing.payslips?.length ?? 0) > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">الإجمالي</TableCell>
                      <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(viewing.totalGross)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">—</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums text-rose-600" dir="ltr">{formatCurrency(viewing.totalDeductions)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums text-emerald-600" dir="ltr">{formatCurrency(viewing.totalNet)}</span></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </ScrollArea>
          </Card>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewDialogOpen(false)}>إغلاق</Button>
            <Button type="button" onClick={handleViewPrint} className="gap-1.5">
              <Printer className="size-4" /> طباعة الملخص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
