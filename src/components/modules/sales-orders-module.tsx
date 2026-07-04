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
  ShoppingCart, Wallet, Clock, TrendingUp, Plus, Pencil, Trash2, Printer, X,
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

interface Client {
  id: string
  code: string
  name: string
}
interface Product {
  id: string
  sku: string
  name: string
  nameAr: string | null
  salePrice: number
  taxRate: number
  unit: string
}
interface OrderItem {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  total: number
  product?: Product
}
interface Order {
  id: string
  code: string
  clientId: string
  status: string
  subtotal: number
  taxTotal: number
  discount: number
  total: number
  paid: number
  paymentMethod: string | null
  note: string | null
  createdAt: string
  client: { id: string; name: string; code: string; phone: string | null }
  items: OrderItem[]
}
interface OrderResponse {
  data: Order[]
  total: number
  stats: { totalSales: number; totalPaid: number; totalOutstanding: number; avgOrderValue: number; count: number }
}

const EMPTY_LINE: Omit<OrderItem, 'total'> = {
  productId: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 15,
}

const EMPTY_FORM = {
  clientId: '',
  status: 'confirmed',
  paymentMethod: 'cash',
  discount: 0,
  note: '',
  items: [{ ...EMPTY_LINE }],
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'delivered', label: 'مُسلّم' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'cancelled', label: 'ملغي' },
]

function lineTotal(line: { quantity: number; unitPrice: number; discount: number; taxRate: number }): number {
  const qty = Number(line.quantity) || 0
  const price = Number(line.unitPrice) || 0
  const disc = Number(line.discount) || 0
  const tax = Number(line.taxRate) || 0
  const net = qty * price - disc
  return Math.max(0, net) + Math.max(0, net) * (tax / 100)
}

export function SalesOrdersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<OrderResponse>({
    queryKey: ['sales-orders', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/sales-orders?${params}`)
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
      const r = await fetch('/api/erp/sales-orders', {
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
      toast.success('تم إنشاء أمر البيع بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/sales-orders/${editId}`, {
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
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/sales-orders/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const stats = data?.stats
  const rows = data?.data ?? []

  // Totals from form
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

  const handleAddLine = () => {
    setForm({ ...form, items: [...form.items, { ...EMPTY_LINE }] })
  }

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
    // If product changed, auto-fill unitPrice and taxRate from product
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
    setForm({ ...EMPTY_FORM, items: [{ ...EMPTY_LINE }] })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (o: Order) => {
    setForm({
      clientId: o.clientId,
      status: o.status,
      paymentMethod: o.paymentMethod ?? 'cash',
      discount: o.discount,
      note: o.note ?? '',
      items: o.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate,
        total: it.total,
      })),
    })
    setEditId(o.id)
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

  const handlePrint = (o: Order) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ للأنظمة المحاسبية</h2>
            <p>أمر بيع</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">أمر بيع</div>
          <div class="code">${o.code}</div>
          <div class="date">${formatDate(o.createdAt)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات العميل</div>
        <div class="name">${o.client.name}</div>
        <div class="sub">الرمز: ${o.client.code}</div>
        ${o.client.phone ? `<div class="sub">الهاتف: ${o.client.phone}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>
          ${o.items.map((it, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${it.product?.nameAr ?? it.product?.name ?? '—'}</td>
              <td>${formatNumber(it.quantity, 0)}</td>
              <td>${formatCurrency(it.unitPrice)}</td>
              <td>${formatCurrency(it.discount)}</td>
              <td>${formatNumber(it.taxRate, 0)}%</td>
              <td>${formatCurrency(it.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي</span><span>${formatCurrency(o.subtotal)}</span></div>
        <div class="row"><span>الخصم</span><span>${formatCurrency(o.discount)}</span></div>
        <div class="row"><span>ضريبة القيمة المضافة</span><span>${formatCurrency(o.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي</span><span>${formatCurrency(o.total)}</span></div>
      </div>
      ${o.note ? `<div class="notes">${o.note}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المستودع</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
      </div>
    `
    printHTML(html, `أمر بيع ${o.code}`)
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV('sales-orders', rows.map((r) => ({
      code: r.code,
      client: r.client.name,
      date: formatDate(r.createdAt),
      subtotal: r.subtotal,
      tax: r.taxTotal,
      discount: r.discount,
      total: r.total,
      paid: r.paid,
      outstanding: Math.max(0, r.total - r.paid),
      status: r.status,
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'client', label: 'العميل' },
      { key: 'date', label: 'التاريخ' },
      { key: 'subtotal', label: 'المجموع الفرعي' },
      { key: 'tax', label: 'الضريبة' },
      { key: 'discount', label: 'الخصم' },
      { key: 'total', label: 'الإجمالي' },
      { key: 'paid', label: 'المدفوع' },
      { key: 'outstanding', label: 'المتبقي' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  return (
    <ModuleShell
      title={t('module.sales-orders')}
      description="إنشاء وإدارة أوامر البيع مع القيود المحاسبية التلقائية"
      icon={<ShoppingCart className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الأمر أو اسم العميل..."
      onAdd={handleAdd}
      addLabel="أمر بيع جديد"
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
            <KpiCard title="إجمالي المبيعات" value={formatCurrency(stats?.totalSales ?? 0)} icon={<TrendingUp className="size-5" />} accent="emerald" />
            <KpiCard title="إجمالي المدفوع" value={formatCurrency(stats?.totalPaid ?? 0)} icon={<Wallet className="size-5" />} accent="teal" />
            <KpiCard title="المتبقي (مستحقات)" value={formatCurrency(stats?.totalOutstanding ?? 0)} icon={<Clock className="size-5" />} accent="rose" />
            <KpiCard title="متوسط قيمة الطلب" value={formatCurrency(stats?.avgOrderValue ?? 0)} icon={<ShoppingCart className="size-5" />} accent="violet" />
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
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-end">الإجمالي</TableHead>
                <TableHead className="text-end">المدفوع</TableHead>
                <TableHead className="text-end">المتبقي</TableHead>
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
                rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm font-semibold">{o.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{o.client.name}</p>
                        <p className="text-[11px] text-muted-foreground">{o.items.length} عناصر</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="text-end tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(o.paid)}</TableCell>
                    <TableCell className="text-end tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(Math.max(0, o.total - o.paid))}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handlePrint(o)} title="طباعة">
                          <Printer className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(o)} title="تعديل">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(o.id)} title="حذف">
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? `تعديل أمر بيع` : 'أمر بيع جديد'}</DialogTitle>
            <DialogDescription>اختر العميل وأضف العناصر. سيتم احتساب الإجمالي والضريبة تلقائياً.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">العميل *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">طريقة الدفع</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقد</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="confirmed">مؤكد</SelectItem>
                    <SelectItem value="delivered">مُسلّم</SelectItem>
                    <SelectItem value="paid">مدفوع</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                          <SelectTrigger className="w-full h-8">
                            <SelectValue placeholder="اختر المنتج" />
                          </SelectTrigger>
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
                      <TableCell className="text-end font-semibold tabular-nums">
                        {formatCurrency(lineTotal(line))}
                      </TableCell>
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

          {/* Totals & notes */}
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف أمر البيع والقيود المرتبطة به. لا يمكن التراجع.</AlertDialogDescription>
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
