'use client'

import { useState, useMemo } from 'react'
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
  ShoppingCart, Plus, Pencil, Trash2, Printer, Wallet, TrendingUp, Receipt, Eye, X,
} from 'lucide-react'

interface LineItem {
  productId: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
}

interface Order {
  id: string
  code: string
  supplierId: string
  status: string
  subtotal: number
  taxTotal: number
  discount: number
  total: number
  paid: number
  note?: string | null
  createdAt: string
  supplier?: { id: string; name: string; code: string; phone?: string | null }
  items?: any[]
}

const STATUSES = ['draft', 'ordered', 'received', 'paid', 'cancelled']

function newItem(): LineItem {
  return { productId: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 15 }
}

export function PurchaseOrdersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewData, setViewData] = useState<Order | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    supplierId: '',
    paymentMethod: 'credit',
    discount: 0,
    note: '',
    status: 'ordered',
    items: [newItem()],
  })

  const { data, isLoading } = useQuery<{ data: Order[]; total: number }>({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-orders')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: suppliersData } = useQuery<{ data: any[] }>({
    queryKey: ['suppliers-for-po'],
    queryFn: async () => {
      const r = await fetch('/api/erp/suppliers?active=true')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-po'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const suppliers = suppliersData?.data ?? []
  const products = productsData?.data ?? []

  const list = data?.data ?? []
  const filtered = list.filter((o) => {
    const q = search.trim().toLowerCase()
    const matchesQ = !q || [o.code, o.supplier?.name, o.supplier?.code, o.note].some((v) => (v ?? '').toLowerCase().includes(q))
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    return matchesQ && matchesStatus
  })

  // KPIs
  const totalPurchases = list.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalPaid = list.reduce((s, o) => s + (o.paid ?? 0), 0)
  const outstanding = list.reduce((s, o) => s + Math.max(0, (o.total ?? 0) - (o.paid ?? 0)), 0)
  const avgOrder = list.length ? totalPurchases / list.length : 0

  // Compute totals from line items
  const computed = useMemo(() => {
    const items = form.items as LineItem[]
    let subtotal = 0
    let taxTotal = 0
    for (const it of items) {
      const lineNet = Math.max(0, (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0))
      subtotal += lineNet
      taxTotal += lineNet * ((Number(it.taxRate) || 0) / 100)
    }
    const discount = Number(form.discount) || 0
    const total = Math.max(0, subtotal + taxTotal - discount)
    return { subtotal, taxTotal, total, discount }
  }, [form.items, form.discount])

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/purchase-orders/${editId}` : '/api/erp/purchase-orders'
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
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-orders/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm({
      supplierId: '',
      paymentMethod: 'credit',
      discount: 0,
      note: '',
      status: 'ordered',
      items: [newItem()],
    })
    setOpen(true)
  }

  function openEdit(o: Order) {
    setEditId(o.id)
    setForm({
      supplierId: o.supplierId,
      paymentMethod: 'credit',
      discount: o.discount,
      note: o.note ?? '',
      status: o.status,
      items: (o.items ?? []).map((it: any) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate,
      })),
    })
    setOpen(true)
  }

  async function openView(o: Order) {
    try {
      const r = await fetch(`/api/erp/purchase-orders/${o.id}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setViewData(d)
      setViewOpen(true)
    } catch {
      toast.error('حدث خطأ')
    }
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    const items = [...form.items]
    items[idx] = { ...items[idx], ...patch }
    setForm({ ...form, items })
  }

  function onProductChange(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId)
    if (p) {
      updateItem(idx, { productId, unitPrice: p.costPrice ?? 0, taxRate: p.taxRate ?? 15 })
    } else {
      updateItem(idx, { productId })
    }
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, newItem()] })
  }

  function removeItem(idx: number) {
    const items = form.items.filter((_: any, i: number) => i !== idx)
    setForm({ ...form, items: items.length ? items : [newItem()] })
  }

  function submit() {
    if (!form.supplierId) {
      toast.error('المورد مطلوب')
      return
    }
    const validItems = form.items.filter((it: LineItem) => it.productId && it.quantity > 0)
    if (validItems.length === 0) {
      toast.error('يجب إضافة عنصر واحد على الأقل')
      return
    }
    saveMut.mutate({ ...form, items: validItems })
  }

  function handleExport() {
    exportToCSV(
      'purchase-orders',
      filtered.map((o) => ({
        code: o.code,
        supplier: o.supplier?.name ?? '',
        date: formatDate(o.createdAt),
        subtotal: o.subtotal,
        tax: o.taxTotal,
        discount: o.discount,
        total: o.total,
        paid: o.paid,
        outstanding: o.total - o.paid,
        status: o.status,
      })),
      [
        { key: 'code', label: 'الكود' },
        { key: 'supplier', label: 'المورد' },
        { key: 'date', label: 'التاريخ' },
        { key: 'subtotal', label: 'المجموع الفرعي' },
        { key: 'tax', label: 'الضريبة' },
        { key: 'discount', label: 'الخصم' },
        { key: 'total', label: 'الإجمالي' },
        { key: 'paid', label: 'المدفوع' },
        { key: 'outstanding', label: 'المتبقي' },
        { key: 'status', label: 'الحالة' },
      ]
    )
  }

  function handlePrint(o: Order) {
    const items: any[] = o.items ?? []
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ — نظام محاسبي</h2>
            <p>أمر شراء</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">أمر شراء</div>
          <div class="code">${o.code}</div>
          <div class="date">${formatDate(o.createdAt)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المورد</div>
        <div class="name">${o.supplier?.name ?? '—'}</div>
        <div class="sub">الكود: ${o.supplier?.code ?? '—'} | الهاتف: ${o.supplier?.phone ?? '—'}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>المنتج</th><th>SKU</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة%</th><th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:16px;color:#777">لا توجد عناصر</td></tr>' : items.map((it, i) => {
            const lineNet = Math.max(0, it.quantity * it.unitPrice - it.discount)
            const lineTax = lineNet * (it.taxRate / 100)
            return `<tr>
              <td>${i + 1}</td>
              <td>${it.product?.name ?? it.product?.nameAr ?? '—'}</td>
              <td>${it.product?.sku ?? '—'}</td>
              <td>${formatNumber(it.quantity)}</td>
              <td>${formatNumber(it.unitPrice)}</td>
              <td>${formatNumber(it.discount)}</td>
              <td>${formatNumber(it.taxRate, 1)}%</td>
              <td>${(lineNet + lineTax).toFixed(2)}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي</span><span>${o.subtotal.toFixed(2)}</span></div>
        <div class="row"><span>الضريبة</span><span>${o.taxTotal.toFixed(2)}</span></div>
        <div class="row"><span>الخصم</span><span>${o.discount.toFixed(2)}</span></div>
        <div class="row grand"><span>الإجمالي</span><span>${o.total.toFixed(2)}</span></div>
      </div>
      ${o.note ? `<div class="notes"><strong>ملاحظات:</strong><br/>${o.note}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المشتري</div></div>
        <div class="sig"><div class="line"></div><div class="label">المورد</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `أمر شراء ${o.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-orders')}
      description="إدارة أوامر الشراء من الموردين وربطها بالمخزون والقيود المحاسبية"
      icon={<ShoppingCart className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو المورد..."
      onAdd={openAdd}
      addLabel="أمر شراء"
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
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المشتريات" value={formatCurrency(totalPurchases)} icon={<ShoppingCart className="size-5" />} accent="amber" />
            <KpiCard title="إجمالي المدفوع" value={formatCurrency(totalPaid)} icon={<Wallet className="size-5" />} accent="emerald" />
            <KpiCard title="المستحقات" value={formatCurrency(outstanding)} icon={<TrendingUp className="size-5" />} accent="rose" />
            <KpiCard title="متوسط الأمر" value={formatCurrency(avgOrder)} icon={<Receipt className="size-5" />} accent="teal" />
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
                <TableHead className="text-start">المورد</TableHead>
                <TableHead className="text-start">التاريخ</TableHead>
                <TableHead className="text-start">الإجمالي</TableHead>
                <TableHead className="text-start">المدفوع</TableHead>
                <TableHead className="text-start">الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد أوامر شراء. ابدأ بإضافة أول أمر.
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell className="font-medium">{o.supplier?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  <TableCell className="font-bold tabular-nums">{formatCurrency(o.total)}</TableCell>
                  <TableCell className="tabular-nums text-emerald-600">{formatCurrency(o.paid)}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openView(o)} title="عرض">
                        <Eye className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(o)} title="طباعة">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(o)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا الأمر؟')) delMut.mutate(o.id)
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

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل أمر شراء' : 'إضافة أمر شراء'}</DialogTitle>
            <DialogDescription>اختر المورد وأضف الأصناف. سيتم تحديث المخزون وإنشاء قيد محاسبي تلقائياً عند الحفظ.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>المورد *</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">آجل</SelectItem>
                  <SelectItem value="cash">نقدي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_70px_100px_80px_70px_32px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
              <div>المنتج</div>
              <div className="text-center">الكمية</div>
              <div className="text-center">السعر</div>
              <div className="text-center">الخصم</div>
              <div className="text-center">ضريبة%</div>
              <div></div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {form.items.map((it: LineItem, idx: number) => {
                const lineNet = Math.max(0, (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0))
                const lineTotal = lineNet + lineNet * ((Number(it.taxRate) || 0) / 100)
                return (
                  <div key={idx} className="grid grid-cols-[1fr_70px_100px_80px_70px_32px] gap-2 px-3 py-2 border-b last:border-b-0 items-center">
                    <Select value={it.productId} onValueChange={(v) => onProductChange(idx, v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.nameAr ?? p.name} ({p.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" className="h-9 text-xs text-center" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                    <Input type="number" step="0.01" className="h-9 text-xs text-center" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} />
                    <Input type="number" step="0.01" className="h-9 text-xs text-center" value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} />
                    <Input type="number" step="0.01" className="h-9 text-xs text-center" value={it.taxRate} onChange={(e) => updateItem(idx, { taxRate: Number(e.target.value) })} />
                    <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600" onClick={() => removeItem(idx)}>
                      <X className="size-4" />
                    </Button>
                    <div className="col-span-6 text-end text-[10px] text-muted-foreground -mt-1">
                      إجمالي السطر: <span className="font-bold tabular-nums">{formatCurrency(lineTotal)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-2 border-t">
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5 w-full">
                <Plus className="size-4" /> إضافة صنف
              </Button>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>خصم إضافي على الأمر</Label>
              <Input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
              <div className="space-y-1.5 pt-2">
                <Label>ملاحظات</Label>
                <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <Card className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الضريبة</span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.taxTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الخصم</span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.discount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>الإجمالي</span>
                <span className="tabular-nums text-primary">{formatCurrency(computed.total)}</span>
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إنشاء الأمر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>أمر شراء — {viewData?.code}</DialogTitle>
            <DialogDescription>
              {viewData?.supplier?.name} · {viewData ? formatDate(viewData.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>
          <Card className="rounded-xl border bg-card">
            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">#</TableHead>
                    <TableHead className="text-start">المنتج</TableHead>
                    <TableHead className="text-start">الكمية</TableHead>
                    <TableHead className="text-start">السعر</TableHead>
                    <TableHead className="text-start">الخصم</TableHead>
                    <TableHead className="text-start">الضريبة</TableHead>
                    <TableHead className="text-start">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(viewData?.items ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">لا توجد عناصر</TableCell></TableRow>
                  ) : (viewData?.items ?? []).map((it: any, i: number) => {
                    const lineNet = Math.max(0, it.quantity * it.unitPrice - it.discount)
                    const lineTax = lineNet * (it.taxRate / 100)
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{it.product?.nameAr ?? it.product?.name ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(it.quantity)}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(it.unitPrice)}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(it.discount)}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(it.taxRate, 1)}%</TableCell>
                        <TableCell className="font-bold tabular-nums">{formatCurrency(lineNet + lineTax)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">المجموع الفرعي</p>
              <p className="font-bold tabular-nums">{formatCurrency(viewData?.subtotal ?? 0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">الضريبة</p>
              <p className="font-bold tabular-nums">{formatCurrency(viewData?.taxTotal ?? 0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">الخصم</p>
              <p className="font-bold tabular-nums">{formatCurrency(viewData?.discount ?? 0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground">الإجمالي</p>
              <p className="font-bold tabular-nums text-primary">{formatCurrency(viewData?.total ?? 0)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>إغلاق</Button>
            {viewData && <Button onClick={() => handlePrint(viewData)} className="gap-1.5"><Printer className="size-4" /> طباعة</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
