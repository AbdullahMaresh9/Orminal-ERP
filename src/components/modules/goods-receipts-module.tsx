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

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }
interface Warehouse { id: string; code: string; nameAr: string; nameEn?: string }
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

const VISIBLE_ROWS = 5
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  received: { ar: 'مستلم', en: 'Received' },
  validated: { ar: 'مُتحقَّق', en: 'Validated' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

export function GoodsReceiptsModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'
  const warehouseName = (w?: Warehouse) => (isRTL ? w?.nameAr : (w?.nameEn || w?.nameAr)) ?? '—'
  const productName = (p?: Product) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''
  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
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
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'At least one line is required')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId(''); setWarehouseId(''); setPurchaseOrderId('')
    setReceiptDate(new Date().toISOString().slice(0, 10)); setNotes('')
    setLines([{ key: '1', productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' }])
  }

  const saveMutation = useMutation({
    mutationFn: async (validate: boolean) => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Select supplier'))
      if (!warehouseId) throw new Error(L('اختر المستودع', 'Select warehouse'))
      const validLines = lines.filter((l) => l.productId && Number(l.receivedQty) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one valid line'))
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
        throw new Error(err?.error?.message ?? L('فشل الحفظ', 'Save failed'))
      }
      return r.json()
    },
    onSuccess: (_data, validate) => {
      toast.success(validate ? L('تم إنشاء سند الاستلام والتحقق منه', 'Goods receipt created and validated') : L('تم إنشاء سند الاستلام', 'Goods receipt created'))
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
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
        throw new Error(err?.error?.message ?? L('فشل التحقق', 'Validation failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم التحقق من سند الاستلام', 'Goods receipt validated'))
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const handleExport = () => {
    const rows = receipts.map((r) => ({
      [L('الرمز', 'Code')]: r.code,
      [L('المورد', 'Supplier')]: partnerName(r.partner),
      [L('أمر الشراء', 'Purchase Order')]: r.purchaseOrder?.code ?? '',
      [L('المستودع', 'Warehouse')]: warehouseName(r.warehouse),
      [L('التاريخ', 'Date')]: formatDate(r.receiptDate),
      [L('القيمة', 'Value')]: r.lines.reduce((a, l) => a + l.total, 0),
      [L('الحالة', 'Status')]: statusLabel(r.status),
    }))
    exportToCSV('goods-receipts', rows)
    toast.success(L('تم تصدير الملف', 'File exported successfully'))
  }

  const handlePrint = (r: GoodsReceipt) => {
    const total = r.lines.reduce((s, l) => s + l.total, 0)
    const html = `
      <div class="doc-header" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>${L('أورمنال', 'Orminal')}</h2>
            <p>${L('نظام إدارة موارد المؤسسات ERP', 'Enterprise Resource Planning System')}</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">${L('سند استلام بضاعة', 'Goods Receipt')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.receiptDate)}</div>
        </div>
      </div>
      <div class="party" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="label">${L('المورد', 'Supplier')}</div>
        <div class="name">${partnerName(r.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${r.partner?.code ?? ''}</div>
        <div class="sub">${L('المستودع', 'Warehouse')}: ${warehouseName(r.warehouse)}</div>
        ${r.purchaseOrder ? `<div class="sub">${L('أمر شراء', 'PO')}: ${r.purchaseOrder.code}</div>` : ''}
      </div>
      <table dir="${isRTL ? 'rtl' : 'ltr'}">
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية المطلوبة', 'Ordered Qty')}</th>
            <th>${L('الكمية المستلمة', 'Received Qty')}</th>
            <th>${L('التكلفة', 'Cost')}</th>
            <th>${L('الإجمالي', 'Total')}</th>
          </tr>
        </thead>
        <tbody>
          ${r.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${productName(l.product)}</td>
              <td>${l.orderedQty}</td>
              <td>${l.receivedQty}</td>
              <td>${formatCurrency(l.unitCost)}</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(total)}</span></div>
      </div>
      ${r.notes ? `<div class="notes" dir="${isRTL ? 'rtl' : 'ltr'}">${r.notes}</div>` : ''}
      <div class="signatures" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="sig"><div class="line"></div><div class="label">${L('أمين المستودع', 'Warehouse Keeper')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('سند استلام', 'Goods Receipt')} ${r.code}`)
  }

  return (
    <ModuleShell
      title={t('module.goods-receipts')}
      description={L('استلام بضاعة الموردين مع تحديث المخزون والقيود تلقائياً', 'Receive goods from suppliers with automatic inventory and ledger updates')}
      icon={<PackageCheck className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز السند...', 'Search by receipt code...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('سند استلام جديد', 'New Receipt')}
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            <SelectItem value="draft">{L('مسودة', 'Draft')}</SelectItem>
            <SelectItem value="received">{L('مستلم', 'Received')}</SelectItem>
            <SelectItem value="validated">{L('مُتحقَّق', 'Validated')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي السندات', 'Total Receipts')} value={formatInt(stats.total)} icon={<PackageCheck className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'Pending')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('مُتحقَّق', 'Validated')} value={formatInt(stats.validated)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title={L('إجمالي القيمة', 'Total Value')} value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[900px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('أمر الشراء', 'PO')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('المستودع', 'Warehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : receipts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{L('لا توجد سندات استلام.', 'No goods receipts found.')}</TableCell></TableRow>
              ) : receipts.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(r.partner)}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{r.purchaseOrder?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center border-b truncate">
                    <WhIcon className="inline size-3.5 me-1 text-muted-foreground" />
                    {warehouseName(r.warehouse)}
                  </TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(r.receiptDate)}</TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate(r)}>
                          <CheckCircle2 className="size-3.5" /> {L('تحقق', 'Validate')}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)} title={L('طباعة', 'Print')}>
                        <Printer className="size-4.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          {isRTL
            ? `عرض ${receipts.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + receipts.length} من ${total}`
            : `Showing ${receipts.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + receipts.length} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{L('السابق', 'Previous')}</Button>
          <span className="text-xs text-muted-foreground">
            {isRTL ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{L('التالي', 'Next')}</Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{L('سند استلام بضاعة جديد', 'New Goods Receipt')}</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{L('المورد *', 'Supplier *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder={L('اختر المورد', 'Select Supplier')} /></SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span dir="ltr" className="font-mono text-xs">{p.code}</span> — {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{L('أمر الشراء (اختياري)', 'Purchase Order (Optional)')}</Label>
                  <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                    <SelectTrigger><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
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
                  <Label>{L('المستودع *', 'Warehouse *')}</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder={L('اختر المستودع', 'Select Warehouse')} /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span dir="ltr" className="font-mono text-xs">{w.code}</span> — {warehouseName(w)}
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
                      <TableHead className="ps-3">{L('المنتج', 'Product')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('مطلوب', 'Ordered')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('مستلم', 'Received')}</TableHead>
                      <TableHead className="w-26">{L('رقم التشغيلة', 'Lot No.')}</TableHead>
                      <TableHead className="w-32">{L('تاريخ الانتهاء', 'Expiry Date')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('التكلفة', 'Cost')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
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
                              <SelectTrigger className="h-9 min-w-[200px]"><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {productName(p)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="1" dir="ltr" value={l.orderedQty} onChange={(e) => updateLine(l.key, 'orderedQty', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="1" dir="ltr" value={l.receivedQty} onChange={(e) => updateLine(l.key, 'receivedQty', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9" value={l.lotNumber} onChange={(e) => updateLine(l.key, 'lotNumber', e.target.value)} placeholder="—" />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9" type="date" value={l.expiryDate} onChange={(e) => updateLine(l.key, 'expiryDate', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
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
                          <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
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
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{L('إلغاء', 'Cancel')}</Button>
            <Button type="button" variant="secondary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(false)}>
              {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ كمسودة', 'Save as Draft')}
            </Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(true)}>
              {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ وتحقق', 'Save & Validate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
