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
import { DatePicker } from '@/components/ui/date-picker'
import {
  PackageCheck, Plus, Trash2, Printer, CheckCircle2, Clock, Coins, Warehouse as WhIcon, Eye, RotateCcw,
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

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  received: { ar: 'مستلم', en: 'Received' },
  validated: { ar: 'مُرحّل', en: 'Posted' },
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
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
  const partners = partnersData?.data ?? []
  const warehouses = warehousesData?.data ?? []
  const products = productsData?.data ?? []
  const purchaseOrders = poData?.data ?? []

  const stats = useMemo(() => ({
    total: receipts.length,
    pending: receipts.filter((r) => r.status === 'draft' || r.status === 'received').length,
    validated: receipts.filter((r) => r.status === 'posted' || r.status === 'validated').length,
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

  const isReadOnlyStatus = (s: string) => s === 'posted' || s === 'validated' || s === 'received'
  const isCancelledStatus = (s: string) => s === 'cancelled'

  const openEdit = (grn: GoodsReceipt, explicitViewMode?: boolean) => {
    if (isCancelledStatus(grn.status)) {
      toast.error(L('سند الاستلام ملغي، ولا يجوز التعديل عليه', 'Goods receipt is cancelled, editing is not allowed'))
      return
    }

    setEditingId(grn.id)
    const viewMode = explicitViewMode ?? isReadOnlyStatus(grn.status)
    setViewOnly(viewMode)
    setPartnerId(grn.partnerId || grn.partner?.id || '')
    setWarehouseId(grn.warehouseId || grn.warehouse?.id || '')
    setPurchaseOrderId(grn.purchaseOrderId || '')
    setReceiptDate(grn.receiptDate ? grn.receiptDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setNotes(grn.notes || '')
    setLines(
      grn.lines.length > 0
        ? grn.lines.map((l, i) => ({
          key: String(i + 1),
          productId: l.productId || l.product?.id || '',
          orderedQty: String(l.orderedQty),
          receivedQty: String(l.receivedQty),
          lotNumber: l.lotNumber || '',
          expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : '',
          unitCost: String(l.unitCost),
        }))
        : [{ key: '1', productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' }]
    )
    setAddOpen(true)
  }

  const resetForm = () => {
    setEditingId(null)
    setViewOnly(false)
    setPartnerId('')
    setWarehouseId('')
    setPurchaseOrderId('')
    setReceiptDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setLines([{ key: '1', productId: '', orderedQty: '0', receivedQty: '1', lotNumber: '', expiryDate: '', unitCost: '0' }])
  }

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
        status: validate ? 'posted' : 'draft',
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
      const url = editingId ? `/api/erp/goods-receipts/${editingId}` : '/api/erp/goods-receipts'
      const method = editingId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
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
      const msg = editingId
        ? (validate ? L('تم تحديث وترحيل سند الاستلام بنجاح', 'Goods receipt updated and posted successfully') : L('تم تحديث سند الاستلام بنجاح', 'Goods receipt updated successfully'))
        : (validate ? L('تم إنشاء وترحيل سند الاستلام بنجاح', 'Goods receipt created and posted successfully') : L('تم إنشاء سند الاستلام بنجاح', 'Goods receipt created successfully'))
      toast.success(msg)
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const validateMutation = useMutation({
    mutationFn: async (grn: GoodsReceipt) => {
      const r = await fetch(`/api/erp/goods-receipts/${grn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'posted' }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الترحيل', 'Posting failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم ترحيل سند الاستلام بنجاح', 'Goods receipt posted successfully'))
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/goods-receipts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الإلغاء/الإرجاع', 'Cancellation failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إلغاء/إرجاع سند الاستلام بنجاح', 'Goods receipt cancelled/reversed successfully'))
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء الإلغاء/الإرجاع', 'An error occurred during cancellation')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/goods-receipts/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الحذف', 'Delete failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف سند الاستلام الملغي بنجاح', 'Cancelled goods receipt deleted successfully'))
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء الحذف', 'An error occurred during deletion')),
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
            <SelectItem value="validated">{L('مُرحّل', 'Posted')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي السندات', 'Total Receipts')} value={formatInt(stats.total)} icon={<PackageCheck className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'Pending')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('مُرحّل', 'Posted')} value={formatInt(stats.validated)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
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
                <TableRow key={r.id} className="hover:bg-muted/40 align-middle cursor-pointer" onClick={() => openEdit(r)}>
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(r.partner)}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{r.purchaseOrder?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center border-b truncate">
                    <WhIcon className="inline size-3.5 me-1 text-muted-foreground" />
                    {warehouseName(r.warehouse)}
                  </TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(r.receiptDate)}</TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {isCancelledStatus(r.status) ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={L('حذف سند الاستلام الملغي', 'Delete Cancelled Receipt')}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(r.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <>
                          {r.status === 'draft' && (
                            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate(r)}>
                              <CheckCircle2 className="size-3.5" /> {L('ترحيل', 'Post')}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(r, true)} title={L('عرض سند الاستلام', 'View Goods Receipt')}>
                            <Eye className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)} title={L('طباعة', 'Print')}>
                            <Printer className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm() }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1rem)] sm:w-[95vw] max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-background border-border shadow-xl rounded-xl"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>
                {viewOnly
                  ? L('عرض سند استلام بضاعة', 'View Goods Receipt')
                  : editingId
                    ? L('تعديل سند استلام بضاعة', 'Edit Goods Receipt')
                    : L('سند استلام بضاعة جديد', 'New Goods Receipt')}
              </DialogTitle>

            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
            <fieldset
              disabled={viewOnly}
              className={viewOnly ? 'space-y-4 cursor-not-allowed [&_input]:cursor-not-allowed [&_button]:cursor-not-allowed [&_select]:cursor-not-allowed [&_textarea]:cursor-not-allowed' : 'space-y-4'}
            >
              {/* Main Fields Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Supplier */}
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs sm:text-sm font-medium">{L('المورد *', 'Supplier *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger className={`h-9 sm:h-10 w-full text-xs sm:text-sm ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                      <SelectValue placeholder={L('اختر المورد', 'Select Supplier')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm">
                          {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Purchase Order (Optional) */}
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs sm:text-sm font-medium">{L('أمر الشراء (اختياري)', 'Purchase Order (Optional)')}</Label>
                  <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                    <SelectTrigger className={`h-9 sm:h-10 w-full text-xs sm:text-sm ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                      <SelectValue placeholder={L('بدون أمر شراء', 'No Purchase Order')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {purchaseOrders
                        .filter((p) => !partnerId || p.partnerId === partnerId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm">
                            <span dir="ltr" className="font-mono text-xs me-1">{p.code}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Warehouse */}
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs sm:text-sm font-medium">{L('المستودع *', 'Warehouse *')}</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger className={`h-9 sm:h-10 w-full text-xs sm:text-sm ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                      <SelectValue placeholder={L('اختر المستودع', 'Select Warehouse')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-xs sm:text-sm">
                          {warehouseName(w)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Receipt Date */}
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="receiptDate" className="text-xs sm:text-sm font-medium">{L('تاريخ الاستلام *', 'Receipt Date *')}</Label>
                  <DatePicker
                    id="receiptDate"
                    value={receiptDate}
                    onChange={setReceiptDate}
                    disabled={viewOnly}
                  />
                </div>
              </div>

              {/* Line items: cards on mobile (< md) */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs sm:text-sm font-semibold">{L('بنود المستند', 'Document Line Items')}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">{lines.length} {L('بند', 'items')}</span>
                </div>

                {lines.map((l, idx) => {
                  const lineTotal = (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0)
                  return (
                    <Card key={l.key} className="p-3 space-y-3 rounded-lg border shadow-xs">
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <span className="text-xs font-bold text-muted-foreground">{L('بند', 'Item')} #{idx + 1}</span>
                        {!viewOnly && (
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0" onClick={() => removeLine(l.key)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">{L('المنتج', 'Product')}</Label>
                        <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                          <SelectTrigger className={`h-9 w-full text-xs ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                            <SelectValue placeholder={L('اختر المنتج', 'Select Product')} />
                          </SelectTrigger>
                          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                {productName(p)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium">{L('مطلوب', 'Ordered')}</Label>
                          <Input className={`h-8.5 text-xs text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.orderedQty} onChange={(e) => updateLine(l.key, 'orderedQty', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium">{L('مستلم', 'Received')}</Label>
                          <Input className={`h-8.5 text-xs text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.receivedQty} onChange={(e) => updateLine(l.key, 'receivedQty', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium">{L('رقم التشغيلة', 'Lot No.')}</Label>
                          <Input className={`h-8.5 text-xs ${viewOnly ? 'cursor-not-allowed' : ''}`} value={l.lotNumber} onChange={(e) => updateLine(l.key, 'lotNumber', e.target.value)} placeholder="—" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium">{L('تاريخ الانتهاء', 'Expiry Date')}</Label>
                          <DatePicker value={l.expiryDate} onChange={(v) => updateLine(l.key, 'expiryDate', v)} disabled={viewOnly} className="h-8.5 text-xs" />

                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[11px] font-medium">{L('التكلفة', 'Cost')}</Label>
                          <Input className={`h-8.5 text-xs text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2 bg-muted/20 px-2 py-1.5 rounded">
                        <span className="text-xs text-muted-foreground font-medium">{L('إجمالي البند', 'Line Total')}</span>
                        <span className="num font-semibold text-xs tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                      </div>
                    </Card>
                  )
                })}

                {!viewOnly && (
                  <Button type="button" size="sm" variant="outline" onClick={addLine} className="w-full gap-1.5 text-xs h-9">
                    <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                  </Button>
                )}
              </div>

              {/* Line items: table on desktop (md+) */}
              <Card className="rounded-lg overflow-hidden hidden md:block border shadow-xs">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs caption-bottom border-collapse table-fixed min-w-[700px]">
                    <colgroup>
                      <col className="w-[25%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[13%]" />
                      <col className="w-[17%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                      <col className="w-[6%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="py-2.5 px-3 text-start font-semibold text-muted-foreground">{L('المنتج', 'Product')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('مطلوب', 'Ordered')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('مستلم', 'Received')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('رقم التشغيلة', 'Lot No.')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('تاريخ الانتهاء', 'Expiry Date')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('التكلفة', 'Cost')}</th>
                        <th className="py-2.5 px-2 text-center font-semibold text-muted-foreground">{L('الإجمالي', 'Total')}</th>
                        <th className="py-2.5 px-1 text-center font-semibold text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((l) => {
                        const lineTotal = (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0)
                        return (
                          <tr key={l.key} className="hover:bg-muted/30 align-middle">
                            <td className="p-2">
                              <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                                <SelectTrigger className={`h-8.5 w-full text-xs ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                                  <SelectValue placeholder={L('اختر المنتج', 'Select Product')} />
                                </SelectTrigger>
                                <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                      {productName(p)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input className={`h-8.5 text-xs text-start tabular-nums px-1 ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.orderedQty} onChange={(e) => updateLine(l.key, 'orderedQty', e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className={`h-8.5 text-xs text-start tabular-nums px-1 ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.receivedQty} onChange={(e) => updateLine(l.key, 'receivedQty', e.target.value)} />
                            </td>
                            <td className="p-2">
                              <Input className={`h-8.5 text-xs text-center px-1 ${viewOnly ? 'cursor-not-allowed' : ''}`} value={l.lotNumber} onChange={(e) => updateLine(l.key, 'lotNumber', e.target.value)} placeholder="—" />
                            </td>
                            <td className="p-2">
                              <DatePicker value={l.expiryDate} onChange={(v) => updateLine(l.key, 'expiryDate', v)} disabled={viewOnly} className="h-8.5 text-xs text-start px-1" />
                            </td>
                            <td className="p-2">
                              <Input className={`h-8.5  text-xs text-center tabular-nums px-1 ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span className="num font-semibold text-xs tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                            </td>
                            <td className="p-1 text-center">
                              {!viewOnly && (
                                <Button type="button" size="icon" variant="ghost" className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => removeLine(l.key)}>
                                  <Trash2 className="size-4.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 border-t font-medium">
                        <td colSpan={6} className="p-2.5 ps-3">
                          {!viewOnly && (
                            <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5 text-xs h-8">
                              <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                            </Button>
                          )}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span className="num font-bold text-xs tabular-nums" dir="ltr">{formatCurrency(computedTotal)}</span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* Notes  */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs sm:text-sm font-medium">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" className={`text-xs sm:text-sm min-h-[60px] ${viewOnly ? 'cursor-not-allowed' : ''}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية على سند الاستلام...', 'Additional notes...')} />
              </div>
            </fieldset>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto sm:min-w-24 text-xs sm:text-sm h-9" onClick={() => { setAddOpen(false); resetForm() }}>
              {viewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>

            {viewOnly ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full sm:w-auto gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm h-9"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (editingId) cancelMutation.mutate(editingId)
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  {L('إلغاء/إرجاع استلام', 'Cancel/Reverse Receipt')}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto sm:min-w-24 bg-sky-600 hover:bg-sky-700 text-white gap-1.5 text-xs sm:text-sm h-9"
                  onClick={() => {
                    const currentRec = receipts.find((r) => r.id === editingId)
                    if (currentRec) handlePrint(currentRec)
                  }}
                >
                  <Printer className="size-3.5" />
                  {L('طباعة', 'Print')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button type="button" variant="secondary" className="w-full sm:w-auto sm:min-w-24 text-xs sm:text-sm h-9" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(false)}>
                  {saveMutation.isPending
                    ? L('جاري الحفظ...', 'Saving...')
                    : editingId ? L('تحديث', 'Update') : L('حفظ', 'Save')}
                </Button>
                <Button type="button" className="w-full sm:w-auto sm:min-w-24 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm h-9" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(true)}>
                  {saveMutation.isPending
                    ? L('جاري الحفظ...', 'Saving...')
                    : editingId ? L('تحديث وترحيل', 'Update & Post') : L('حفظ وترحيل', 'Save & Post')}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
