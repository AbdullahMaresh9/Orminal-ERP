'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, formatInt } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Plus, Printer, CheckCircle2, XCircle, PlayCircle, Clock, BarChart3, Wallet,
} from 'lucide-react'

interface Requisition {
  id: string
  code: string
  amount: number
  payee?: string | null
  type: string
  status: string
  note?: string | null
  createdAt: string
  updatedAt: string
}

const emptyForm = {
  amount: 0,
  payee: '',
  type: 'expense',
  note: '',
}

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'approved', label: 'معتمد' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'fulfilled', label: 'مُنفّذ' },
]

export function FinanceRequisitionsModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const { data, isLoading } = useQuery<{ data: Requisition[]; total: number }>({
    queryKey: ['finance-requisitions', statusFilter],
    queryFn: async () => {
      const url = `/api/erp/finance-requisitions${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
      const r = await fetch(url)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const list = data?.data ?? []
  const filtered = list.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [r.code, r.payee, r.note].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  // KPIs
  const pendingTotal = list.filter((r) => r.status === 'draft' || r.status === 'approved').reduce((s, r) => s + r.amount, 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const fulfilledMonth = list.filter((r) => r.status === 'fulfilled' && new Date(r.updatedAt) >= monthStart)
  const fulfilledTotal = fulfilledMonth.reduce((s, r) => s + r.amount, 0)
  const avgAmount = list.length ? list.reduce((s, r) => s + r.amount, 0) / list.length : 0

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/finance-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'request failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء الطلب بنجاح')
      setOpen(false)
      setForm(emptyForm)
      qc.invalidateQueries({ queryKey: ['finance-requisitions'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await fetch(`/api/erp/finance-requisitions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'request failed')
      }
      return r.json()
    },
    onSuccess: (_data, vars) => {
      const msg = vars.action === 'approve' ? 'تم اعتماد الطلب' : vars.action === 'reject' ? 'تم رفض الطلب' : 'تم تنفيذ الطلب وإنشاء سند الصرف'
      toast.success(msg)
      qc.invalidateQueries({ queryKey: ['finance-requisitions'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['safes'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function submit() {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('أدخل مبلغاً صحيحاً')
      return
    }
    createMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'finance-requisitions',
      filtered.map((r) => ({
        code: r.code,
        date: formatDate(r.createdAt),
        payee: r.payee ?? '',
        amount: r.amount,
        type: r.type === 'expense' ? 'مصروف' : 'تحويل',
        status: r.status,
        note: r.note ?? '',
      })),
      [
        { key: 'code', label: 'الكود' },
        { key: 'date', label: 'التاريخ' },
        { key: 'payee', label: 'المستفيد' },
        { key: 'amount', label: 'المبلغ' },
        { key: 'type', label: 'النوع' },
        { key: 'status', label: 'الحالة' },
        { key: 'note', label: 'ملاحظات' },
      ]
    )
  }

  function handlePrint(r: Requisition) {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال — نظام إدارة موارد المؤسسات ERP</h2>
            <p>طلب صرف مالي</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">طلب صرف مالي</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.createdAt)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المستفيد</div>
        <div class="name">${r.payee ?? '—'}</div>
        <div class="sub">النوع: ${r.type === 'expense' ? 'مصروف' : 'تحويل'} | الحالة: ${r.status}</div>
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th style="text-align:left">المبلغ</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${r.note ?? 'طلب صرف نقدي'}</td>
            <td style="text-align:left">${formatCurrency(r.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="text-align:right">الإجمالي</td>
            <td style="text-align:left">${formatCurrency(r.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">مقدم الطلب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المعتمد</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `طلب صرف ${r.code}`)
  }

  return (
    <ModuleShell
      title={t('module.finance-requisitions')}
      description="طلبات الصرف المالي واعتمادها وتنفيذها"
      icon={<FileText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو المستفيد..."
      onAdd={() => { setForm(emptyForm); setOpen(true) }}
      addLabel="طلب صرف"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="المعتمدات المعلقة" value={formatCurrency(pendingTotal)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title="المنفّذة هذا الشهر" value={formatCurrency(fulfilledTotal)} icon={<CheckCircle2 className="size-5" />} accent="blue" />
            <KpiCard title="عدد الطلبات" value={formatInt(list.length)} icon={<FileText className="size-5" />} accent="sky" />
            <KpiCard title="متوسط قيمة الطلب" value={formatCurrency(avgAmount)} icon={<BarChart3 className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">الكود</TableHead>
                <TableHead className="text-start">التاريخ</TableHead>
                <TableHead className="text-start">المستفيد</TableHead>
                <TableHead className="text-start">المبلغ</TableHead>
                <TableHead className="text-start">النوع</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-start">ملاحظات</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد طلبات صرف. ابدأ بإنشاء أول طلب.
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><span className="font-mono text-xs">{r.code}</span></TableCell>
                  <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="font-medium">{r.payee || '—'}</TableCell>
                  <TableCell className="font-bold tabular-nums">{formatCurrency(r.amount)}</TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="size-3" />
                      {r.type === 'expense' ? 'مصروف' : 'تحويل'}
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{r.note || '—'}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(r)} title="طباعة">
                        <Printer className="size-4" />
                      </Button>
                      {r.status === 'draft' && (
                        <>
                          <Button size="sm" variant="ghost" className="size-8 p-0 text-blue-600 hover:text-blue-700" onClick={() => actionMut.mutate({ id: r.id, action: 'approve' })} title="اعتماد">
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => actionMut.mutate({ id: r.id, action: 'reject' })} title="رفض">
                            <XCircle className="size-4" />
                          </Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="size-8 p-0 text-violet-600 hover:text-violet-700" onClick={() => actionMut.mutate({ id: r.id, action: 'fulfill' })} title="تنفيذ (إنشاء سند صرف)">
                          <PlayCircle className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'طلب صرف مالي جديد' : 'New Payment Request'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="req-amount" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'المبلغ *' : 'Amount *'}</Label>
                <Input id="req-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-1.5 text-start">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'النوع' : 'Type'}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{isRTL ? 'مصروف' : 'Expense'}</SelectItem>
                    <SelectItem value="transfer">{isRTL ? 'تحويل' : 'Transfer'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 text-start sm:col-span-2">
                <Label htmlFor="req-payee" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'المستفيد' : 'Payee'}</Label>
                <Input id="req-payee" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} placeholder={isRTL ? 'اسم الجهة المستفيدة' : 'Beneficiary name'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-1.5 text-start sm:col-span-2">
                <Label htmlFor="req-note" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea id="req-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={isRTL ? ' البيان التفصيلي...' : 'Reason or detailed statement...'} className="border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={submit} disabled={createMut.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
              {createMut.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إنشاء الطلب' : 'Create Request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

