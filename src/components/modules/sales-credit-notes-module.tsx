'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { exportToCSV, printHTML } from '@/lib/export'
import { formatCurrency, formatDate } from '@/lib/format'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import {
  Undo2, FileX, Calendar, Plus, Pencil, Trash2, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Client { id: string; code: string; name: string }
interface Invoice { id: string; code: string; total: number; issueDate: string }
interface CreditNote {
  id: string
  code: string
  clientId: string
  invoiceId: string | null
  status: string
  issueDate: string
  subtotal: number
  taxTotal: number
  total: number
  reason: string | null
  note: string | null
  createdAt: string
  client: { id: string; name: string; code: string; phone: string | null }
}
interface CreditNoteResponse {
  data: CreditNote[]
  total: number
  stats: { totalCredit: number; count: number; thisMonth: number }
}

const EMPTY_FORM = {
  clientId: '',
  invoiceId: '',
  subtotal: 0,
  taxRate: 15,
  reason: '',
  note: '',
}

const REASON_OPTIONS = [
  'مرتجع بضاعة تالفة',
  'مرتجع بضاعة',
  'خصم بعد الفاتورة',
  'إلغاء فاتورة',
  'تصحيح خطأ',
  'أخرى',
]

export function SalesCreditNotesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<CreditNoteResponse>({
    queryKey: ['sales-credit-notes', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/sales-credit-notes?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 30 * 1000,
  })

  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients-for-select'],
    queryFn: async () => {
      const r = await fetch('/api/erp/clients?active=true')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 60 * 1000,
  })

  const clients = clientsData?.data ?? []

  // Fetch invoices for selected client (when dialog open)
  const { data: clientInvoices } = useQuery<{ data: Invoice[] }>({
    queryKey: ['client-invoices', form.clientId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/sales-invoices?q=${encodeURIComponent('')}`)
      if (!r.ok) throw new Error('fetch failed')
      const all = await r.json()
      return { data: (all.data as Invoice[]).filter((inv) => inv.clientId === form.clientId) }
    },
    enabled: !!form.clientId && dialogOpen,
    staleTime: 30 * 1000,
  })

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/sales-credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء الإشعار الدائن بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-credit-notes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/sales-credit-notes/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.updated'))
      qc.invalidateQueries({ queryKey: ['sales-credit-notes'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/sales-credit-notes/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['sales-credit-notes'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const stats = data?.stats
  const rows = data?.data ?? []

  const formSubtotal = Number(form.subtotal) || 0
  const formTax = formSubtotal * ((Number(form.taxRate) || 0) / 100)
  const formTotal = formSubtotal + formTax

  const handleAdd = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (cn: CreditNote) => {
    setForm({
      clientId: cn.clientId,
      invoiceId: cn.invoiceId ?? '',
      subtotal: cn.subtotal,
      taxRate: cn.taxTotal > 0 && cn.subtotal > 0 ? (cn.taxTotal / cn.subtotal) * 100 : 15,
      reason: cn.reason ?? '',
      note: cn.note ?? '',
    })
    setEditId(cn.id)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.clientId) {
      toast.error('العميل مطلوب')
      return
    }
    if (formSubtotal <= 0) {
      toast.error('المبلغ يجب أن يكون أكبر من صفر')
      return
    }
    const payload = {
      clientId: form.clientId,
      invoiceId: form.invoiceId || null,
      subtotal: formSubtotal,
      taxTotal: formTax,
      total: formTotal,
      reason: form.reason,
      note: form.note,
    }
    if (editId) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const handlePrint = (cn: CreditNote) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ للأنظمة المحاسبية</h2>
            <p>إشعار دائن (مرتجع مبيعات)</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type" style="color:#d97706">إشعار دائن</div>
          <div class="code">${cn.code}</div>
          <div class="date">${formatDate(cn.issueDate)}</div>
        </div>
      </div>
      <div class="party" style="background:#fff7ed;border-inline-start-color:#d97706">
        <div class="label" style="color:#d97706">بيانات العميل</div>
        <div class="name">${cn.client.name}</div>
        <div class="sub">الرمز: ${cn.client.code}</div>
      </div>
      ${cn.reason ? `<div class="notes"><strong>السبب:</strong> ${cn.reason}</div>` : ''}
      <table>
        <thead>
          <tr style="background:#d97706"><th>الوصف</th><th class="text-end">المبلغ</th></tr>
        </thead>
        <tbody>
          <tr><td>المجموع الفرعي</td><td>${formatCurrency(cn.subtotal)}</td></tr>
          <tr><td>ضريبة القيمة المضافة</td><td>${formatCurrency(cn.taxTotal)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>الإجمالي المعاد</td><td>${formatCurrency(cn.total)}</td></tr>
        </tfoot>
      </table>
      ${cn.note ? `<div class="notes"><strong>ملاحظات:</strong> ${cn.note}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
      </div>
    `
    printHTML(html, `إشعار دائن ${cn.code}`)
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV('sales-credit-notes', rows.map((r) => ({
      code: r.code,
      client: r.client.name,
      date: formatDate(r.issueDate),
      subtotal: r.subtotal,
      tax: r.taxTotal,
      total: r.total,
      reason: r.reason ?? '',
      status: r.status,
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'client', label: 'العميل' },
      { key: 'date', label: 'التاريخ' },
      { key: 'subtotal', label: 'المجموع الفرعي' },
      { key: 'tax', label: 'الضريبة' },
      { key: 'total', label: 'الإجمالي' },
      { key: 'reason', label: 'السبب' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  const STATUS_OPTIONS = [
    { value: 'all', label: 'الكل' },
    { value: 'draft', label: 'مسودة' },
    { value: 'posted', label: 'مُرحّل' },
    { value: 'cancelled', label: 'ملغي' },
  ]

  return (
    <ModuleShell
      title={t('module.sales-credit-notes')}
      description="إدارة الإشعارات الدائنة (مرتجعات المبيعات) مع عكس القيود المحاسبية"
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الإشعار أو العميل..."
      onAdd={handleAdd}
      addLabel="إشعار دائن جديد"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المرتجعات" value={formatCurrency(stats?.totalCredit ?? 0)} icon={<Undo2 className="size-5" />} accent="rose" />
            <KpiCard title="عدد الإشعارات" value={String(stats?.count ?? 0)} icon={<FileX className="size-5" />} accent="amber" />
            <KpiCard title="مرتجعات هذا الشهر" value={formatCurrency(stats?.thisMonth ?? 0)} icon={<Calendar className="size-5" />} accent="violet" />
            <KpiCard title="متوسط القيمة" value={formatCurrency(stats?.count ? (stats?.totalCredit ?? 0) / stats.count : 0)} icon={<FileX className="size-5" />} accent="teal" />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الفاتورة المرتبطة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="num-cell">الإجمالي</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-6" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">{t('empty.noData')}</TableCell>
                </TableRow>
              ) : (
                rows.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{cn.code}</TableCell>
                    <TableCell className="font-medium text-sm">{cn.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cn.invoiceId ? 'مرتبط' : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(cn.issueDate)}</TableCell>
                    <TableCell className="num-cell font-semibold text-rose-600 dark:text-rose-400">
                      <span className="num">{formatCurrency(cn.total)}</span>
                    </TableCell>
                    <TableCell className="text-sm cell-truncate">{cn.reason ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={cn.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handlePrint(cn)} title="طباعة">
                          <Printer className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(cn)} title="تعديل">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(cn.id)} title="حذف">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل إشعار دائن' : 'إشعار دائن جديد'}</DialogTitle>
            <DialogDescription>سيتم عكس قيد الفاتورة الأصلية وتخفيض رصيد العميل تلقائياً.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">العميل *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, invoiceId: '' })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">الفاتورة المرتبطة (اختياري)</Label>
              <Select value={form.invoiceId} onValueChange={(v) => {
                const inv = clientInvoices?.data?.find((i) => i.id === v)
                setForm({ ...form, invoiceId: v, subtotal: inv?.total ?? form.subtotal })
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون ربط" /></SelectTrigger>
                <SelectContent>
                  {(clientInvoices?.data ?? []).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.code} · {formatCurrency(inv.total)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">المبلغ قبل الضريبة *</Label>
              <Input type="number" min="0" step="any" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">نسبة الضريبة %</Label>
              <Input type="number" min="0" step="any" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">السبب</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر السبب" /></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">ملاحظات</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>

            <div className="col-span-2 rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="tabular-nums">{formatCurrency(formSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ضريبة القيمة المضافة ({Number(form.taxRate) || 0}%)</span>
                <span className="tabular-nums">{formatCurrency(formTax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-base">
                <span>الإجمالي المعاد</span>
                <span className="tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(formTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="gap-1.5">
              {editId ? t('action.save') : <><Plus className="size-4" /> {t('action.create')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الإشعار الدائن والقيد المعاكس المرتبط به.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}
