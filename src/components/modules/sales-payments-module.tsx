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
  Receipt, Wallet, Hash, TrendingUp, Plus, Pencil, Trash2, Printer, CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
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
interface Invoice { id: string; code: string; total: number; paid: number; issueDate: string }
interface Payment {
  id: string
  code: string
  clientId: string
  invoiceId: string | null
  amount: number
  date: string
  method: string
  reference: string | null
  status: string
  description: string | null
  client: { id: string; name: string; code: string; phone: string | null }
}
interface PaymentResponse {
  data: Payment[]
  total: number
  stats: {
    totalReceipts: number
    count: number
    avgAmount: number
    byMethod: Record<string, number>
  }
}

const EMPTY_FORM = {
  clientId: '',
  invoiceId: '',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  method: 'cash',
  reference: '',
  description: '',
}

const METHOD_OPTIONS = [
  { value: 'cash', label: 'نقد' },
  { value: 'card', label: 'بطاقة' },
  { value: 'transfer', label: 'تحويل' },
  { value: 'check', label: 'شيك' },
]

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  card: 'بطاقة',
  transfer: 'تحويل',
  check: 'شيك',
}

export function SalesPaymentsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PaymentResponse>({
    queryKey: ['sales-payments', search, methodFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (methodFilter && methodFilter !== 'all') params.set('method', methodFilter)
      const r = await fetch(`/api/erp/sales-payments?${params}`)
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
    queryKey: ['client-invoices-pay', form.clientId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/sales-invoices`)
      if (!r.ok) throw new Error('fetch failed')
      const all = await r.json()
      return { data: (all.data as Invoice[]).filter((inv) => inv.clientId === form.clientId) }
    },
    enabled: !!form.clientId && dialogOpen,
    staleTime: 30 * 1000,
  })

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/sales-payments', {
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
      toast.success('تم إنشاء سند القبض بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/sales-payments/${editId}`, {
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
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/sales-payments/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const stats = data?.stats
  const rows = data?.data ?? []
  const byMethod = stats?.byMethod ?? {}
  const maxMethod = Math.max(1, ...Object.values(byMethod))

  const handleAdd = () => {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (p: Payment) => {
    setForm({
      clientId: p.clientId,
      invoiceId: p.invoiceId ?? '',
      amount: p.amount,
      date: new Date(p.date).toISOString().slice(0, 10),
      method: p.method,
      reference: p.reference ?? '',
      description: p.description ?? '',
    })
    setEditId(p.id)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.clientId) {
      toast.error('العميل مطلوب')
      return
    }
    if (Number(form.amount) <= 0) {
      toast.error('المبلغ يجب أن يكون أكبر من صفر')
      return
    }
    const payload = {
      clientId: form.clientId,
      invoiceId: form.invoiceId || null,
      amount: Number(form.amount),
      date: form.date,
      method: form.method,
      reference: form.reference,
      description: form.description,
    }
    if (editId) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const handlePrint = (p: Payment) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ للأنظمة المحاسبية</h2>
            <p>سند قبض</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">سند قبض</div>
          <div class="code">${p.code}</div>
          <div class="date">${formatDate(p.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">استلمنا من السيد/السادة</div>
        <div class="name">${p.client.name}</div>
        <div class="sub">الرمز: ${p.client.code}</div>
        ${p.client.phone ? `<div class="sub">الهاتف: ${p.client.phone}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th>القيمة</th></tr>
        </thead>
        <tbody>
          <tr><td>طريقة الدفع</td><td>${METHOD_LABELS[p.method] ?? p.method}</td></tr>
          <tr><td>المرجع</td><td>${p.reference ?? '—'}</td></tr>
          <tr><td>التاريخ</td><td>${formatDate(p.date)}</td></tr>
          ${p.description ? `<tr><td>البيان</td><td>${p.description}</td></tr>` : ''}
        </tbody>
        <tfoot>
          <tr><td>المبلغ المستلم</td><td style="font-size:18px;color:#16a34a">${formatCurrency(p.amount)}</td></tr>
        </tfoot>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العامل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المستلم</div></div>
      </div>
    `
    printHTML(html, `سند قبض ${p.code}`)
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV('sales-payments', rows.map((r) => ({
      code: r.code,
      client: r.client.name,
      date: formatDate(r.date),
      amount: r.amount,
      method: METHOD_LABELS[r.method] ?? r.method,
      reference: r.reference ?? '',
      status: r.status,
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'client', label: 'العميل' },
      { key: 'date', label: 'التاريخ' },
      { key: 'amount', label: 'المبلغ' },
      { key: 'method', label: 'الطريقة' },
      { key: 'reference', label: 'المرجع' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  return (
    <ModuleShell
      title={t('module.sales-payments')}
      description="إدارة سندات القبض من العملاء مع القيود المحاسبية التلقائية وتحديث الأرصدة"
      icon={<Receipt className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز السند أو اسم العميل..."
      onAdd={handleAdd}
      addLabel="سند قبض جديد"
      onExport={handleExport}
      filters={
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="الطريقة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {METHOD_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
            <KpiCard title="مقبوضات الشهر" value={formatCurrency(stats?.totalReceipts ?? 0)} icon={<Wallet className="size-5" />} accent="emerald" />
            <KpiCard title="عدد السندات" value={String(stats?.count ?? 0)} icon={<Hash className="size-5" />} accent="teal" />
            <KpiCard title="متوسط السند" value={formatCurrency(stats?.avgAmount ?? 0)} icon={<TrendingUp className="size-5" />} accent="violet" />
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">حسب الطريقة</p>
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                {Object.keys(byMethod).length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد بيانات</p>
                ) : (
                  Object.entries(byMethod).map(([method, amount]) => (
                    <div key={method}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-medium">{METHOD_LABELS[method] ?? method}</span>
                        <span className="num text-muted-foreground">{formatCurrency(amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(amount / maxMethod) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
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
                <TableHead>التاريخ</TableHead>
                <TableHead className="num-cell">المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>المرجع</TableHead>
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
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{p.code}</TableCell>
                    <TableCell className="font-medium text-sm">{p.client.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.date)}</TableCell>
                    <TableCell className="num-cell font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="num">{formatCurrency(p.amount)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded-md bg-muted">{METHOD_LABELS[p.method] ?? p.method}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">{p.reference ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handlePrint(p)} title="طباعة">
                          <Printer className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(p)} title="تعديل">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(p.id)} title="حذف">
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
            <DialogTitle>{editId ? 'تعديل سند قبض' : 'سند قبض جديد'}</DialogTitle>
            <DialogDescription>سيتم خصم المبلغ من رصيد العميل وإنشاء قيد محاسبي تلقائي: من ح/النقدية، إلى ح/الذمم المدينة.</DialogDescription>
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
                setForm({ ...form, invoiceId: v, amount: inv ? Math.max(0, inv.total - inv.paid) : form.amount })
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون ربط" /></SelectTrigger>
                <SelectContent>
                  {(clientInvoices?.data ?? []).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.code} · متبقي {formatCurrency(Math.max(0, inv.total - inv.paid))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">المبلغ *</Label>
              <Input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">طريقة الدفع</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">المرجع</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} dir="ltr" placeholder="رقم شيك / مرجع تحويل" />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">البيان / الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
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
            <AlertDialogDescription>سيتم حذف سند القبض والقيد المحاسبي المرتبط به.</AlertDialogDescription>
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
