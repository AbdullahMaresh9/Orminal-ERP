'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, formatInt, formatNumber } from '@/lib/format'
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
  Banknote, Plus, Pencil, Trash2, Printer, Wallet, Receipt, CreditCard,
} from 'lucide-react'

interface Payment {
  id: string
  code: string
  supplierId: string
  invoiceId?: string | null
  amount: number
  date: string
  method: string
  reference?: string | null
  status: string
  description?: string | null
  createdAt: string
  supplier?: { id: string; name: string; code: string }
  invoice?: { id: string; code: string } | null
}

const STATUSES = ['completed', 'pending', 'cancelled', 'refunded']
const METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'card', label: 'بطاقة' },
  { value: 'transfer', label: 'تحويل' },
  { value: 'check', label: 'شيك' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const empty = {
  supplierId: '',
  invoiceId: '',
  amount: 0,
  date: todayISO(),
  method: 'cash',
  reference: '',
  description: '',
  status: 'completed',
}

export function PurchasePaymentsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery<{ data: Payment[]; total: number }>({
    queryKey: ['purchase-payments'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-payments')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: suppliersData } = useQuery<{ data: any[] }>({
    queryKey: ['suppliers-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/suppliers?active=true')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: any[] }>({
    queryKey: ['purchase-invoices-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const suppliers = suppliersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const filteredInvoices = form.supplierId ? invoices.filter((i) => i.supplierId === form.supplierId && i.status !== 'paid' && i.status !== 'cancelled') : invoices

  const list = data?.data ?? []
  const filtered = list.filter((o) => {
    const q = search.trim().toLowerCase()
    const matchesQ = !q || [o.code, o.reference, o.description, o.supplier?.name, o.supplier?.code].some((v) => (v ?? '').toLowerCase().includes(q))
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    const matchesMethod = methodFilter === 'all' || o.method === methodFilter
    return matchesQ && matchesStatus && matchesMethod
  })

  // KPIs
  const now = new Date()
  const thisMonth = list.filter((o) => new Date(o.date).getMonth() === now.getMonth() && new Date(o.date).getFullYear() === now.getFullYear())
  const thisMonthTotal = thisMonth.reduce((s, o) => s + (o.amount ?? 0), 0)
  const avg = thisMonth.length ? thisMonthTotal / thisMonth.length : 0
  const byMethod = new Map<string, number>()
  for (const m of METHODS) {
    byMethod.set(m.value, thisMonth.filter((o) => o.method === m.value).reduce((s, o) => s + o.amount, 0))
  }
  const topMethod = Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/purchase-payments/${editId}` : '/api/erp/purchase-payments'
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
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-payments/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(o: Payment) {
    setEditId(o.id)
    setForm({
      supplierId: o.supplierId,
      invoiceId: o.invoiceId ?? '',
      amount: o.amount,
      date: new Date(o.date).toISOString().slice(0, 10),
      method: o.method,
      reference: o.reference ?? '',
      description: o.description ?? '',
      status: o.status,
    })
    setOpen(true)
  }

  function submit() {
    if (!form.supplierId) {
      toast.error('المورد مطلوب')
      return
    }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      toast.error('المبلغ يجب أن يكون أكبر من صفر')
      return
    }
    saveMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'purchase-payments',
      filtered.map((o) => ({
        code: o.code,
        supplier: o.supplier?.name ?? '',
        invoice: o.invoice?.code ?? '',
        date: formatDate(o.date),
        amount: o.amount,
        method: METHODS.find((m) => m.value === o.method)?.label ?? o.method,
        reference: o.reference ?? '',
        status: o.status,
      })),
      [
        { key: 'code', label: 'الكود' },
        { key: 'supplier', label: 'المورد' },
        { key: 'invoice', label: 'الفاتورة' },
        { key: 'date', label: 'التاريخ' },
        { key: 'amount', label: 'المبلغ' },
        { key: 'method', label: 'الطريقة' },
        { key: 'reference', label: 'المرجع' },
        { key: 'status', label: 'الحالة' },
      ]
    )
  }

  function handlePrint(o: Payment) {
    const methodLabel = METHODS.find((m) => m.value === o.method)?.label ?? o.method
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ — نظام محاسبي</h2>
            <p>سند صرف</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">سند صرف</div>
          <div class="code">${o.code}</div>
          <div class="date">${formatDate(o.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">صُرف إلى (المورد)</div>
        <div class="name">${o.supplier?.name ?? '—'}</div>
        <div class="sub">الكود: ${o.supplier?.code ?? '—'} | الفاتورة المرتبطة: ${o.invoice?.code ?? '—'}</div>
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th>القيمة</th></tr>
        </thead>
        <tbody>
          <tr><td>المبلغ</td><td>${formatNumber(o.amount)}</td></tr>
          <tr><td>طريقة الدفع</td><td>${methodLabel}</td></tr>
          <tr><td>المرجع</td><td>${o.reference ?? '—'}</td></tr>
          <tr><td>الحالة</td><td>${o.status}</td></tr>
        </tbody>
        <tfoot>
          <tr><td style="text-align:right">الإجمالي</td><td style="text-align:left">${o.amount.toFixed(2)} ر.س</td></tr>
        </tfoot>
      </table>
      ${o.description ? `<div class="notes"><strong>البيان:</strong><br/>${o.description}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المستلم</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `سند صرف ${o.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-payments')}
      description="إدارة سندات الصرف للموردين مع القيود المحاسبية التلقائية وتحديث الأرصدة"
      icon={<Banknote className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو المورد أو المرجع..."
      onAdd={openAdd}
      addLabel="سند صرف"
      onExport={handleExport}
      filters={
        <>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="كل الطرق" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الطرق</SelectItem>
              {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="مدفوعات هذا الشهر" value={formatCurrency(thisMonthTotal)} icon={<Banknote className="size-5" />} accent="emerald" />
            <KpiCard title="عدد السندات" value={formatInt(thisMonth.length)} icon={<Receipt className="size-5" />} accent="teal" />
            <KpiCard title="متوسط السند" value={formatCurrency(avg)} icon={<Wallet className="size-5" />} accent="amber" />
            <KpiCard title="الأعلى طريقة" value={METHODS.find((m) => m.value === topMethod)?.label ?? topMethod} icon={<CreditCard className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">الكود</TableHead>
                <TableHead className="text-start">المورد</TableHead>
                <TableHead className="text-start">التاريخ</TableHead>
                <TableHead className="text-start">المبلغ</TableHead>
                <TableHead className="text-start">الطريقة</TableHead>
                <TableHead className="text-start">المرجع</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
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
                    لا توجد سندات صرف. ابدأ بإضافة أول سند.
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell className="font-medium">{o.supplier?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.date)}</TableCell>
                  <TableCell className="font-bold tabular-nums text-emerald-600">{formatCurrency(o.amount)}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">{METHODS.find((m) => m.value === o.method)?.label ?? o.method}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.reference || '—'}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(o)} title="طباعة">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(o)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا السند؟')) delMut.mutate(o.id)
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
            <DialogTitle>{editId ? 'تعديل سند صرف' : 'إضافة سند صرف'}</DialogTitle>
            <DialogDescription>سيتم تحديث رصيد المورد وإنشاء قيد محاسبي (Dr ذمم دائنة / Cr النقدية) تلقائياً.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>المورد *</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v, invoiceId: '' })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code}) — رصيد: {formatCurrency(s.balance)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الفاتورة المرتبطة (اختياري)</Label>
              <Select value={form.invoiceId || 'none'} onValueChange={(v) => setForm({ ...form, invoiceId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {filteredInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.code} — متبقي: {formatCurrency(i.total - i.paid)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المرجع</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم الشيك/المرجع" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>البيان / الوصف</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إنشاء السند'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
