'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { exportToCSV, printHTML } from '@/lib/export'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import {
  FileText, Wallet, Clock, Hash, Plus, Pencil, Trash2, Printer, X,
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

interface Client { id: string; code: string; name: string; taxNumber?: string | null; address?: string | null; phone?: string | null }
interface Product { id: string; sku: string; name: string; nameAr: string | null; salePrice: number; taxRate: number; unit: string }
interface InvoiceItem {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  total: number
  product?: Product
}
interface Invoice {
  id: string
  code: string
  clientId: string
  status: string
  issueDate: string
  dueDate: string | null
  subtotal: number
  taxTotal: number
  discount: number
  total: number
  paid: number
  note: string | null
  createdAt: string
  client: { id: string; name: string; code: string; phone: string | null }
  items: InvoiceItem[]
}
interface InvoiceResponse {
  data: Invoice[]
  total: number
  stats: { totalInvoiced: number; totalCollected: number; outstanding: number; count: number }
}

const EMPTY_LINE = {
  productId: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 15,
}

const EMPTY_FORM = {
  clientId: '',
  status: 'posted',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  discount: 0,
  note: '',
  items: [{ ...EMPTY_LINE }],
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'posted', label: 'مُرحّل' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'cancelled', label: 'ملغي' },
]

function lineTotal(line: { quantity: number; unitPrice: number; discount: number; taxRate: number }): number {
  const qty = Number(line.quantity) || 0
  const price = Number(line.unitPrice) || 0
  const disc = Number(line.discount) || 0
  const tax = Number(line.taxRate) || 0
  const net = Math.max(0, qty * price - disc)
  return net + net * (tax / 100)
}

export function SalesInvoicesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<InvoiceResponse>({
    queryKey: ['sales-invoices', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/sales-invoices?${params}`)
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

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-select'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 60 * 1000,
  })

  const clients = clientsData?.data ?? []
  const products = productsData?.data ?? []

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/sales-invoices', {
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
      toast.success('تم إنشاء الفاتورة بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/sales-invoices/${editId}`, {
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
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/sales-invoices/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const stats = data?.stats
  const rows = data?.data ?? []

  const formTotals = (form.items ?? []).reduce(
    (acc: { subtotal: number; taxTotal: number }, line: any) => {
      if (!line.productId) return acc
      const qty = Number(line.quantity) || 0
      const price = Number(line.unitPrice) || 0
      const disc = Number(line.discount) || 0
      const tax = Number(line.taxRate) || 0
      const net = Math.max(0, qty * price - disc)
      acc.subtotal += net
      acc.taxTotal += net * (tax / 100)
      return acc
    },
    { subtotal: 0, taxTotal: 0 }
  )
  const formDiscount = Number(form.discount) || 0
  const formSubtotal = Math.max(0, formTotals.subtotal - formDiscount)
  const formTotal = formSubtotal + formTotals.taxTotal

  const handleAddLine = () => setForm({ ...form, items: [...form.items, { ...EMPTY_LINE }] })

  const handleRemoveLine = (idx: number) => {
    if (form.items.length === 1) {
      toast.error('يجب وجود عنصر واحد على الأقل')
      return
    }
    setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) })
  }

  const handleLineChange = (idx: number, field: string, value: any) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    if (field === 'productId') {
      const p = products.find((pr) => pr.id === value)
      if (p) {
        items[idx].unitPrice = p.salePrice
        items[idx].taxRate = p.taxRate
      }
    }
    setForm({ ...form, items })
  }

  const handleAdd = () => {
    setForm({ ...EMPTY_FORM, items: [{ ...EMPTY_LINE }], issueDate: new Date().toISOString().slice(0, 10) })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (inv: Invoice) => {
    setForm({
      clientId: inv.clientId,
      status: inv.status,
      issueDate: new Date(inv.issueDate).toISOString().slice(0, 10),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      discount: inv.discount,
      note: inv.note ?? '',
      items: inv.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate,
        total: it.total,
      })),
    })
    setEditId(inv.id)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.clientId) {
      toast.error('العميل مطلوب')
      return
    }
    const validItems = form.items.filter((it: any) => it.productId && Number(it.quantity) > 0)
    if (!validItems.length) {
      toast.error('يجب إضافة عنصر صالح واحد على الأقل')
      return
    }
    const payload = {
      ...form,
      discount: Number(form.discount) || 0,
      items: validItems.map((it: any) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount) || 0,
        taxRate: Number(it.taxRate) || 0,
      })),
    }
    if (editId) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const handlePrint = (inv: Invoice) => {
    const client = clients.find((c) => c.id === inv.clientId) ?? inv.client as any
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ للأنظمة المحاسبية</h2>
            <p>الرقم الضريبي: 300000000000003</p>
            <p>الرياض · المملكة العربية السعودية</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">فاتورة ضريبية</div>
          <div class="code">${inv.code}</div>
          <div class="date">تاريخ الإصدار: ${formatDate(inv.issueDate)}</div>
          ${inv.dueDate ? `<div class="date">تاريخ الاستحقاق: ${formatDate(inv.dueDate)}</div>` : ''}
        </div>
      </div>
      <div class="party">
        <div class="label">فاتورة إلى (العميل)</div>
        <div class="name">${inv.client.name}</div>
        ${client?.taxNumber ? `<div class="sub">الرقم الضريبي: ${client.taxNumber}</div>` : ''}
        ${client?.address ? `<div class="sub">${client.address}</div>` : ''}
        ${inv.client.phone ? `<div class="sub">الهاتف: ${inv.client.phone}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>المنتج / الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>
          ${inv.items.map((it, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${it.product?.nameAr ?? it.product?.name ?? '—'}<div style="font-size:10px;color:#777">${it.product?.sku ?? ''}</div></td>
              <td>${formatNumber(it.quantity, 0)} ${it.product?.unit ?? ''}</td>
              <td>${formatCurrency(it.unitPrice)}</td>
              <td>${formatCurrency(it.discount)}</td>
              <td>${formatNumber(it.taxRate, 0)}%</td>
              <td>${formatCurrency(it.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي</span><span>${formatCurrency(inv.subtotal)}</span></div>
        <div class="row"><span>الخصم</span><span>${formatCurrency(inv.discount)}</span></div>
        <div class="row"><span>ضريبة القيمة المضافة (15%)</span><span>${formatCurrency(inv.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي المستحق</span><span>${formatCurrency(inv.total)}</span></div>
        <div class="row"><span>المدفوع</span><span>${formatCurrency(inv.paid)}</span></div>
        <div class="row"><span>المتبقي</span><span>${formatCurrency(Math.max(0, inv.total - inv.paid))}</span></div>
      </div>
      ${inv.note ? `<div class="notes"><strong>ملاحظات:</strong> ${inv.note}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `فاتورة ضريبية ${inv.code}`)
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV('sales-invoices', rows.map((r) => ({
      code: r.code,
      client: r.client.name,
      issueDate: formatDate(r.issueDate),
      dueDate: r.dueDate ? formatDate(r.dueDate) : '',
      total: r.total,
      paid: r.paid,
      outstanding: Math.max(0, r.total - r.paid),
      status: r.status,
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'client', label: 'العميل' },
      { key: 'issueDate', label: 'تاريخ الإصدار' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق' },
      { key: 'total', label: 'الإجمالي' },
      { key: 'paid', label: 'المدفوع' },
      { key: 'outstanding', label: 'المتبقي' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  return (
    <ModuleShell
      title={t('module.sales-invoices')}
      description="إنشاء وإدارة الفواتير الضريبية مع القيود التلقائية وتحديث أرصدة العملاء"
      icon={<FileText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الفاتورة أو اسم العميل..."
      onAdd={handleAdd}
      addLabel="فاتورة جديدة"
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
            <KpiCard title="إجمالي الفواتير" value={formatCurrency(stats?.totalInvoiced ?? 0)} icon={<FileText className="size-5" />} accent="emerald" />
            <KpiCard title="إجمالي المحصّل" value={formatCurrency(stats?.totalCollected ?? 0)} icon={<Wallet className="size-5" />} accent="teal" />
            <KpiCard title="المستحقات" value={formatCurrency(stats?.outstanding ?? 0)} icon={<Clock className="size-5" />} accent="rose" />
            <KpiCard title="عدد الفواتير" value={String(stats?.count ?? 0)} icon={<Hash className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>تاريخ الإصدار</TableHead>
                <TableHead>الاستحقاق</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
                <TableHead className="text-end">المدفوع</TableHead>
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
                rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm font-semibold">{inv.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inv.client.name}</p>
                        <p className="text-[11px] text-muted-foreground">{inv.items.length} عناصر</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">{formatCurrency(inv.total)}</TableCell>
                    <TableCell className="text-end tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.paid)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handlePrint(inv)} title="طباعة">
                          <Printer className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(inv)} title="تعديل">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(inv.id)} title="حذف">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل فاتورة' : 'فاتورة ضريبية جديدة'}</DialogTitle>
            <DialogDescription>سيتم إنشاء قيد محاسبي تلقائي عند الحفظ: من ح/الذمم المدينة، إلى ح/إيرادات المبيعات وضريبة القيمة المضافة.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
            <div className="md:col-span-2">
              <Label className="text-xs font-medium mb-1.5 block">العميل *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">تاريخ الإصدار</Label>
              <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">الاستحقاق</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">العناصر</Label>
              <Button size="sm" variant="outline" onClick={handleAddLine} className="gap-1.5 h-8">
                <Plus className="size-3.5" /> إضافة سطر
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">المنتج</TableHead>
                    <TableHead className="w-20">الكمية</TableHead>
                    <TableHead className="w-28">السعر</TableHead>
                    <TableHead className="w-24">الخصم</TableHead>
                    <TableHead className="w-20">الضريبة%</TableHead>
                    <TableHead className="w-28 text-end">الإجمالي</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.items.map((line: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={line.productId} onValueChange={(v) => handleLineChange(idx, 'productId', v)}>
                          <SelectTrigger className="w-full h-8"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nameAr ?? p.name} ({p.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="any" value={line.quantity} onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="any" value={line.unitPrice} onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="any" value={line.discount} onChange={(e) => handleLineChange(idx, 'discount', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="any" value={line.taxRate} onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)} className="h-8" />
                      </TableCell>
                      <TableCell className="text-end font-semibold tabular-nums">{formatCurrency(lineTotal(line))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => handleRemoveLine(idx)}>
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">ملاحظات</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 self-start">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="tabular-nums">{formatCurrency(formTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">خصم إضافي</span>
                <Input type="number" min="0" step="any" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-28 h-8 text-end" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ضريبة القيمة المضافة</span>
                <span className="tabular-nums">{formatCurrency(formTotals.taxTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-base">
                <span>الإجمالي</span>
                <span className="tabular-nums text-primary">{formatCurrency(formTotal)}</span>
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
            <AlertDialogDescription>سيتم حذف الفاتورة والقيد المحاسبي المرتبط بها. لا يمكن التراجع.</AlertDialogDescription>
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
