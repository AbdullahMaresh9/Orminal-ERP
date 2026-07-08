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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Undo2, Plus, Pencil, Trash2, Printer, FileX, CalendarDays, Receipt,
} from 'lucide-react'

interface CreditNote {
  id: string
  code: string
  supplierId: string
  invoiceId?: string | null
  status: string
  subtotal: number
  taxTotal: number
  total: number
  issueDate: string
  reason?: string | null
  note?: string | null
  createdAt: string
  supplier?: { id: string; name: string; code: string }
  invoice?: { id: string; code: string } | null
}

const STATUSES = ['draft', 'posted', 'cancelled']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const empty = {
  supplierId: '',
  invoiceId: '',
  total: 0,
  reason: '',
  note: '',
  issueDate: todayISO(),
  status: 'posted',
}

export function PurchaseCreditNotesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery<{ data: CreditNote[]; total: number }>({
    queryKey: ['purchase-credit-notes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-credit-notes')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: suppliersData } = useQuery<{ data: any[] }>({
    queryKey: ['suppliers-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/suppliers?active=true')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: any[] }>({
    queryKey: ['purchase-invoices-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const suppliers = suppliersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const filteredInvoices = form.supplierId ? invoices.filter((i) => i.supplierId === form.supplierId) : invoices

  const list = data?.data ?? []
  const filtered = list.filter((o) => {
    const q = search.trim().toLowerCase()
    const matchesQ = !q || [o.code, o.reason, o.note, o.supplier?.name, o.supplier?.code].some((v) => (v ?? '').toLowerCase().includes(q))
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    return matchesQ && matchesStatus
  })

  const totalAmount = list.reduce((s, o) => s + (o.total ?? 0), 0)
  const now = new Date()
  const thisMonth = list.filter((o) => new Date(o.issueDate).getMonth() === now.getMonth() && new Date(o.issueDate).getFullYear() === now.getFullYear())
  const thisMonthTotal = thisMonth.reduce((s, o) => s + (o.total ?? 0), 0)

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/purchase-credit-notes/${editId}` : '/api/erp/purchase-credit-notes'
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
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
      toast.success('تم الحفظ بنجاح')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['purchase-credit-notes'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-credit-notes/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['purchase-credit-notes'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(o: CreditNote) {
    setEditId(o.id)
    setForm({
      supplierId: o.supplierId,
      invoiceId: o.invoiceId ?? '',
      total: o.total,
      reason: o.reason ?? '',
      note: o.note ?? '',
      issueDate: new Date(o.issueDate).toISOString().slice(0, 10),
      status: o.status,
    })
    setOpen(true)
  }

  function submit() {
    if (!form.supplierId) {
      toast.error('المورد مطلوب')
      return
    }
    const total = Number(form.total)
    if (!total || total <= 0) {
      toast.error('المبلغ يجب أن يكون أكبر من صفر')
      return
    }
    saveMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'purchase-credit-notes',
      filtered.map((o) => ({
        code: o.code,
        supplier: o.supplier?.name ?? '',
        invoice: o.invoice?.code ?? '',
        date: formatDate(o.issueDate),
        total: o.total,
        reason: o.reason ?? '',
        status: o.status,
      })),
      [
        { key: 'code', label: 'الكود' },
        { key: 'supplier', label: 'المورد' },
        { key: 'invoice', label: 'الفاتورة' },
        { key: 'date', label: 'التاريخ' },
        { key: 'total', label: 'المبلغ' },
        { key: 'reason', label: 'السبب' },
        { key: 'status', label: 'الحالة' },
      ]
    )
  }

  function handlePrint(o: CreditNote) {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ — نظام محاسبي</h2>
            <p>إشعار دائن شراء</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">إشعار دائن</div>
          <div class="code">${o.code}</div>
          <div class="date">${formatDate(o.issueDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المورد</div>
        <div class="name">${o.supplier?.name ?? '—'}</div>
        <div class="sub">الكود: ${o.supplier?.code ?? '—'} | الفاتورة المرتبطة: ${o.invoice?.code ?? '—'}</div>
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th>المبلغ</th></tr>
        </thead>
        <tbody>
          <tr><td>المجموع الفرعي</td><td>${o.subtotal.toFixed(2)}</td></tr>
          <tr><td>الضريبة</td><td>${o.taxTotal.toFixed(2)}</td></tr>
          <tr><td>السبب</td><td>${o.reason ?? '—'}</td></tr>
        </tbody>
        <tfoot>
          <tr><td style="text-align:right">الإجمالي</td><td style="text-align:left">${o.total.toFixed(2)}</td></tr>
        </tfoot>
      </table>
      ${o.note ? `<div class="notes"><strong>ملاحظات:</strong><br/>${o.note}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المورد</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `إشعار دائن ${o.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-credit-notes')}
      description="إدارة المرتجعات والإشعارات الدائنة للموردين مع عكس القيود المحاسبية"
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو المورد أو السبب..."
      onAdd={openAdd}
      addLabel="إشعار دائن"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المرتجعات" value={formatCurrency(totalAmount)} icon={<Undo2 className="size-5" />} accent="rose" />
            <KpiCard title="عدد الإشعارات" value={formatInt(list.length)} icon={<FileX className="size-5" />} accent="amber" />
            <KpiCard title="مرتجعات هذا الشهر" value={formatCurrency(thisMonthTotal)} icon={<CalendarDays className="size-5" />} accent="teal" />
            <KpiCard title="عدد مرتجعات الشهر" value={formatInt(thisMonth.length)} icon={<Receipt className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>الفاتورة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="num-cell">المبلغ</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد إشعارات دائنة. ابدأ بإضافة أول إشعار.
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{o.code}</TableCell>
                  <TableCell className="font-medium text-sm">{o.supplier?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.invoice?.code ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(o.issueDate)}</TableCell>
                  <TableCell className="num-cell font-semibold text-rose-600 dark:text-rose-400">
                    <span className="num">{formatCurrency(o.total)}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground cell-truncate" title={o.reason ?? ''}>{o.reason || '—'}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(o)} title="طباعة">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(o)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا الإشعار؟')) delMut.mutate(o.id)
                      }} title="حذف">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل إشعار دائن' : 'إضافة إشعار دائن'}</DialogTitle>
            <DialogDescription>سيتم تخفيض رصيد المورد وعكس القيد المحاسبي الأصلي تلقائياً.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>المورد *</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v, invoiceId: '' })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفاتورة المرتبطة (اختياري)</Label>
              <Select value={form.invoiceId || 'none'} onValueChange={(v) => setForm({ ...form, invoiceId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {filteredInvoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.code} — {formatCurrency(i.total)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>المبلغ *</Label>
              <Input type="number" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>السبب</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="سبب الإشعار الدائن" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إنشاء الإشعار'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
