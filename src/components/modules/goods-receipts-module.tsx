'use client'

import { useState, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  PackageCheck, Plus, Trash2, Printer, CheckCircle2, Clock, Coins, Warehouse as WhIcon,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Product { id: string; sku: string; nameAr: string; costPrice: number }
interface Warehouse { id: string; code: string; nameAr: string }
interface PurchaseOrder { id: string; code: string; partnerId: string }
interface GoodsReceiptLine {
  id?: string
  productId?: string
  product?: Product
  orderedQty: number
  receivedQty: number
  lotNumber?: string
  expiryDate?: string
  unitCost: number
  total: number
}
interface GoodsReceipt {
  id: string
  code: string
  partnerId: string
  purchaseOrderId?: string | null
  warehouseId: string
  receiptDate: string
  status: string
  notes?: string
  partner?: Partner
  warehouse?: Warehouse
  purchaseOrder?: PurchaseOrder
  lines: GoodsReceiptLine[]
}

interface LineDraft {
  key: string
  productId: string
  orderedQty: string
  receivedQty: string
  lotNumber: string
  expiryDate: string
  unitCost: string
}

export function GoodsReceiptsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: GoodsReceipt[]; meta: any }>({
    queryKey: ['goods-receipts', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/goods-receipts?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-grn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: warehousesData } = useQuery<{ data: Warehouse[] }>({
    queryKey: ['warehouses-for-grn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/warehouses?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-grn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: poData } = useQuery<{ data: PurchaseOrder[] }>({
    queryKey: ['pos-for-grn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-orders?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const receipts = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const warehouses = warehousesData?.data ?? []
  const products = productsData?.data ?? []
  const purchaseOrders = poData?.data ?? []

  const stats = useMemo(() => ({
    total: receipts.length,
    pending: receipts.filter((r) => r.status === 'draft' || r.status === 'received').length,
    validated: receipts.filter((r) => r.status === 'validated').length,
    totalValue: receipts.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.total, 0), 0),
  }), [receipts])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' },
  ])

  const computedTotal = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0)
  }, [lines])

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [field]: value }
      if (field === 'productId') {
        const p = products.find((p) => p.id === value)
        if (p) next.unitCost = String(p.costPrice)
      }
      return next
    }))
  }
  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId(''); setWarehouseId(''); setPurchaseOrderId('')
    setReceiptDate(new Date().toISOString().slice(0, 10)); setNotes('')
    setLines([{ key: '1', productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' }])
  }

  const saveMutation = useMutation({
    mutationFn: async (validate: boolean) => {
      if (!partnerId) throw new Error('اختر المورد')
      if (!warehouseId) throw new Error('اختر المستودع')
      const validLines = lines.filter((l) => l.productId && Number(l.receivedQty) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        partnerId,
        warehouseId,
        purchaseOrderId: purchaseOrderId || undefined,
        receiptDate,
        status: validate ? 'validated' : 'draft',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty) || 0,
          receivedQty: Number(l.receivedQty),
          lotNumber: l.lotNumber || undefined,
          expiryDate: l.expiryDate || undefined,
          unitCost: Number(l.unitCost) || 0,
        })),
      }
      const r = await fetch('/api/erp/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: (_data, validate) => {
      toast.success(validate ? 'تم إنشاء سند الاستلام والتحقق منه' : 'تم إنشاء سند الاستلام')
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const validateMutation = useMutation({
    mutationFn: async (grn: GoodsReceipt) => {
      const r = await fetch(`/api/erp/goods-receipts/${grn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'validated' }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل التحقق')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم التحقق من سند الاستلام')
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = receipts.map((r) => ({
      'الرمز': r.code,
      'المورد': r.partner?.nameAr ?? '',
      'أمر الشراء': r.purchaseOrder?.code ?? '',
      'المستودع': r.warehouse?.nameAr ?? '',
      'التاريخ': formatDate(r.receiptDate),
      'القيمة': r.lines.reduce((a, l) => a + l.total, 0),
      'الحالة': r.status,
    }))
    exportToCSV('goods-receipts', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (r: GoodsReceipt) => {
    const total = r.lines.reduce((s, l) => s + l.total, 0)
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال</h2>
            <p>نظام إدارة موارد المؤسسات ERP</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">سند استلام بضاعة</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.receiptDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المورد</div>
        <div class="name">${r.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${r.partner?.code ?? ''}</div>
        <div class="sub">المستودع: ${r.warehouse?.nameAr ?? ''}</div>
        ${r.purchaseOrder ? `<div class="sub">أمر شراء: ${r.purchaseOrder.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>المنتج</th>
            <th>الكمية المطلوبة</th>
            <th>الكمية المستلمة</th>
            <th>التكلفة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${r.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.orderedQty}</td>
              <td>${l.receivedQty}</td>
              <td>${formatCurrency(l.unitCost)}</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(total)}</span></div>
      </div>
      ${r.notes ? `<div class="notes">${r.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">أمين المستودع</div></div>
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
      </div>
    `
    printHTML(html, `سند استلام ${r.code}`)
  }

  return (
    <ModuleShell
      title={t('module.goods-receipts')}
      description="استلام بضاعة الموردين مع تحديث المخزون والقيود تلقائياً"
      icon={<PackageCheck className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز السند..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="سند استلام جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="received">مستلم</SelectItem>
            <SelectItem value="validated">مُتحقَّق</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي السندات" value={formatInt(stats.total)} icon={<PackageCheck className="size-5" />} accent="blue" />
        <KpiCard title="قيد المعالجة" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="مُتحقَّق" value={formatInt(stats.validated)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title="إجمالي القيمة" value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>أمر الشراء</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : receipts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد سندات استلام.</TableCell></TableRow>
              ) : receipts.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.purchaseOrder?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm"><WhIcon className="inline size-3.5 me-1 text-muted-foreground" />{r.warehouse?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.receiptDate)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate(r)}>
                          <CheckCircle2 className="size-3.5" /> تحقق
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)}>
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {receipts.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + receipts.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>سند استلام بضاعة جديد</DialogTitle>
            <DialogDescription>حدد المورد والمستودع والبنود المستلمة</DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>المورد *</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span dir="ltr" className="font-mono text-xs">{p.code}</span> — {p.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>أمر الشراء (اختياري)</Label>
                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    {purchaseOrders
                      .filter((p) => !partnerId || p.partnerId === partnerId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span dir="ltr" className="font-mono text-xs">{p.code}</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المستودع *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <span dir="ltr" className="font-mono text-xs">{w.code}</span> — {w.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">المنتج</TableHead>
                    <TableHead className="text-end num-cell w-24">مطلوب</TableHead>
                    <TableHead className="text-end num-cell w-24">مستلم</TableHead>
                    <TableHead className="w-28">رقم التشغيلة</TableHead>
                    <TableHead className="w-36">تاريخ الانتهاء</TableHead>
                    <TableHead className="text-end num-cell w-28">التكلفة</TableHead>
                    <TableHead className="text-end num-cell w-28">الإجمالي</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const lineTotal = (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0)
                    return (
                      <TableRow key={l.key}>
                        <TableCell className="ps-3">
                          <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                            <SelectTrigger className="h-9 min-w-[200px]"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.orderedQty} onChange={(e) => updateLine(l.key, 'orderedQty', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.receivedQty} onChange={(e) => updateLine(l.key, 'receivedQty', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-9" value={l.lotNumber} onChange={(e) => updateLine(l.key, 'lotNumber', e.target.value)} placeholder="—" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-9" type="date" value={l.expiryDate} onChange={(e) => updateLine(l.key, 'expiryDate', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                        </TableCell>
                        <TableCell>
                          <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                        <Plus className="size-3.5" /> إضافة بند
                      </Button>
                    </TableCell>
                    <TableCell className="text-end num-cell">
                      <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(computedTotal)}</span>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>

            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
            </div>
          </div>

          </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button type="button" variant="secondary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(false)}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ كمسودة'}
              </Button>
              <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(true)}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتحقق'}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
