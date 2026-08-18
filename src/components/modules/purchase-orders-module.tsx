'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import { printHTML, exportRows, type ExportColumn, type ExportMeta, type ExportFormat } from '@/lib/export'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'
import { FileText, Plus, Trash2, Printer, ShoppingCart, Coins, Wallet, Download, FileSpreadsheet, FileDown, Eye } from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }
interface PurchaseRequestLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  orderedQuantity?: number
  costCenterId?: string
  notes?: string
}

interface PurchaseRequest {
  id: string
  code: string
  status: string
  notes?: string
  lines?: PurchaseRequestLine[]
}

interface PurchaseOrderLine {
  id?: string
  productId?: string
  purchaseRequestLineId?: string
  product?: Product
  quantity: number
  unitCost: number
  discountAmount: number
  taxRate: number
  total: number
}
interface PurchaseOrder {
  id: string
  code: string
  partnerId?: string
  purchaseRequestId?: string
  purchaseRequest?: { id: string; code: string }
  orderDate: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  paid: number
  notes?: string
  partner?: Partner
  lines: PurchaseOrderLine[]
}

interface LineDraft {
  key: string
  purchaseRequestLineId?: string
  productId: string
  quantity: string
  unitCost: string
  discountAmount: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'confirmed', 'received', 'paid', 'cancelled']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  received: { ar: 'مستلم', en: 'Received' },
  paid: { ar: 'مدفوع', en: 'Paid' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 42

export function PurchaseOrdersModule() {
  const { t, isRTL } = useT()
  const qc = useQueryClient()

  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''
  const productName = (p?: Product) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseOrder[]; meta: any }>({
    queryKey: ['purchase-orders', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-orders?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-po'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-po'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: purchaseRequestsData } = useQuery<{ data: PurchaseRequest[] }>({
    queryKey: ['approved-purchase-requests'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-requests?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const approvedRequests = useMemo(() => {
    const reqs = purchaseRequestsData?.data ?? []
    return reqs.filter((pr) => {
      const st = (pr.status || '').toLowerCase()
      if (st !== 'approved' && st !== 'approve' && st !== 'partially_ordered') return false
      return (pr.lines || []).some((l) => (l.quantity - (l.orderedQuantity || 0)) > 0.0001)
    })
  }, [purchaseRequestsData])

  const orders = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  const stats = {
    total: orders.length,
    totalPurchases: orders.reduce((s, o) => s + o.total, 0),
    totalPaid: orders.reduce((s, o) => s + o.paid, 0),
    outstanding: orders.reduce((s, o) => s + (o.total - o.paid), 0),
  }

  const [partnerId, setPartnerId] = useState('')
  const [purchaseRequestId, setPurchaseRequestId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' },
  ])

  const isReadOnlyStatus = (s: string) => s === 'confirmed' || s === 'received' || s === 'paid'
  const isCancelledStatus = (s: string) => s === 'cancelled'

  const handleSelectPurchaseRequest = (selectedId: string) => {
    if (selectedId === 'none' || !selectedId) {
      if (lines.some((l) => l.productId.trim() !== '')) {
        const confirmReset = window.confirm(
          L(
            'هل تريد إلغاء ربط طلب الشراء وتفريغ البنود؟',
            'Do you want to unlink the purchase request and clear line items?'
          )
        )
        if (!confirmReset) return
      }
      setPurchaseRequestId('')
      setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
      return
    }

    const selectedPr = approvedRequests.find((pr) => pr.id === selectedId)
    if (!selectedPr) return

    const hasModifiedLines = lines.some((l) => l.productId.trim() !== '')
    if (hasModifiedLines) {
      const confirmChange = window.confirm(
        L(
          'هل تريد استبدال بنود جدول المشتريات الحالية ببنود طلب الشراء المختار؟',
          'Do you want to replace current line items with items from the selected purchase request?'
        )
      )
      if (!confirmChange) return
    }

    setPurchaseRequestId(selectedId)
    if (selectedPr.notes && !notes) {
      setNotes(selectedPr.notes)
    }

    const prLines = selectedPr.lines ?? []
    const eligibleLines = prLines.filter((l) => (l.quantity - (l.orderedQuantity || 0)) > 0.0001)
    if (eligibleLines.length > 0) {
      const newLines: LineDraft[] = eligibleLines.map((line, idx) => {
        const pId = line.productId || line.product?.id || ''
        const p = products.find((prod) => prod.id === pId)
        const remaining = Math.max(0, line.quantity - (line.orderedQuantity || 0))
        return {
          key: String(idx + 1),
          purchaseRequestLineId: line.id,
          productId: pId,
          quantity: String(remaining),
          unitCost: p ? String(p.costPrice ?? 0) : '0',
          discountAmount: '0',
          taxRate: '15',
        }
      })
      setLines(newLines)
    } else {
      setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
    }
  }

  const openEdit = (order: PurchaseOrder, explicitViewMode?: boolean) => {
    if (isCancelledStatus(order.status)) {
      toast.error(L('أمر الشراء ملغي، يلزم حذفه أو مراجعته', 'Purchase order is cancelled, must be deleted or reviewed'))
      return
    }
    setEditingId(order.id)
    const viewMode = explicitViewMode ?? isReadOnlyStatus(order.status)
    setViewOnly(viewMode)
    setPartnerId(order.partnerId || order.partner?.id || '')
    setPurchaseRequestId(order.purchaseRequestId || order.purchaseRequest?.id || '')
    setOrderDate(order.orderDate ? order.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setNotes(order.notes || '')
    setStatus(order.status || 'draft')
    setLines(
      order.lines && order.lines.length > 0
        ? order.lines.map((l, i) => ({
          key: String(i + 1),
          productId: l.productId || l.product?.id || '',
          quantity: String(l.quantity),
          unitCost: String(l.unitCost),
          discountAmount: String(l.discountAmount),
          taxRate: String(l.taxRate),
        }))
        : [{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }]
    )
    setAddOpen(true)
  }

  const resetForm = () => {
    setEditingId(null)
    setViewOnly(false)
    setPartnerId('')
    setPurchaseRequestId('')
    setOrderDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setStatus('draft')
    setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  }

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0, discount = 0
    for (const l of lines) {
      const qty = Number(l.quantity) || 0
      const cost = Number(l.unitCost) || 0
      const disc = Number(l.discountAmount) || 0
      const taxRate = Number(l.taxRate) || 0
      subtotal += qty * cost
      discount += disc
      taxTotal += (qty * cost - disc) * (taxRate / 100)
    }
    return { subtotal, taxTotal, discount, total: subtotal - discount + taxTotal }
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

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) {
      toast.error(L('يجب وجود بند واحد على الأقل', 'At least one line item is required'))
      return
    }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Please select a supplier'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        partnerId,
        purchaseRequestId: purchaseRequestId || undefined,
        orderDate,
        notes,
        status,
        lines: validLines.map((l) => ({
          purchaseRequestLineId: l.purchaseRequestLineId || undefined,
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const url = editingId ? `/api/erp/purchase-orders/${editingId}` : '/api/erp/purchase-orders'
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
    onSuccess: () => {
      toast.success(editingId ? L('تم تحديث أمر الشراء بنجاح', 'Purchase order updated successfully') : L('تم إنشاء أمر الشراء بنجاح', 'Purchase order created successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      qc.invalidateQueries({ queryKey: ['approved-purchase-requests'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-orders/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الحذف', 'Delete failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف أمر الشراء الملغي بنجاح', 'Cancelled purchase order deleted successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء الحذف', 'An error occurred during deletion')),
  })

  const exportColumns: ExportColumn<PurchaseOrder>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 16, align: 'start', type: 'text', value: (r) => r.code },
    { key: 'supplier', header: L('المورد', 'Supplier'), width: 22, align: 'start', type: 'text', value: (r) => partnerName(r.partner) },
    { key: 'orderDate', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (r) => formatDate(r.orderDate), dateValue: (r) => r.orderDate },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 14, align: 'end', type: 'currency', value: (r) => formatCurrency(r.total) },
    { key: 'paid', header: L('المدفوع', 'Paid'), width: 14, align: 'end', type: 'currency', value: (r) => formatCurrency(r.paid) },
    { key: 'outstanding', header: L('المتبقي', 'Outstanding'), width: 14, align: 'end', type: 'currency', value: (r) => formatCurrency(r.total - r.paid) },
    { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', type: 'text', value: (r) => statusLabel(r.status) },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('أوامر-الشراء', 'purchase-orders'),
    title: L('تقرير أوامر الشراء', 'Purchase Orders Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي الطلبات', 'Total Orders'), value: formatInt(stats.total) },
      { label: L('إجمالي المشتريات', 'Total Purchases'), value: formatCurrency(stats.totalPurchases) },
      { label: L('المدفوع', 'Paid'), value: formatCurrency(stats.totalPaid) },
      { label: L('المتبقي', 'Outstanding'), value: formatCurrency(stats.outstanding) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!orders.length) { toast.error(L('لا توجد بيانات للتصدير', 'No data to export')); return }
    try {
      await exportRows(format, orders, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف', 'File exported'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (order: PurchaseOrder) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>${L('أورمنال', 'Orminal')}</h2>
            <p>${L('نظام إدارة موارد المؤسسات ERP', 'Enterprise Resource Planning (ERP)')}</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">${L('أمر شراء', 'Purchase Order')}</div>
          <div class="code">${order.code}</div>
          <div class="date">${formatDate(order.orderDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('المورد', 'Supplier')}</div>
        <div class="name">${partnerName(order.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${order.partner?.code ?? ''}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية', 'Qty')}</th>
            <th>${L('التكلفة', 'Cost')}</th>
            <th>${L('الضريبة', 'Tax')}</th>
            <th>${L('الإجمالي', 'Total')}</th>
          </tr>
        </thead>
        <tbody>
          ${order.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${productName(l.product)}</td>
              <td>${l.quantity}</td>
              <td>${formatCurrency(l.unitCost)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>${L('المجموع الفرعي', 'Subtotal')}:</span><span>${formatCurrency(order.subtotal)}</span></div>
        <div class="row"><span>${L('الضريبة', 'Tax')}:</span><span>${formatCurrency(order.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي', 'Total')}:</span><span>${formatCurrency(order.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المشتري', 'Purchaser')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المورد', 'Supplier')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('أمر شراء', 'Purchase Order')} ${order.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  return (
    <ModuleShell
      title={t('module.purchase-orders')}
      description={L('إدارة أوامر الشراء من الموردين', 'Manage purchase orders from suppliers')}
      icon={<FileText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الأمر أو المورد...', 'Search by order code or supplier...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('أمر شراء جديد', 'New Order')}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-4" />
              <span className="hidden sm:inline">{L('تصدير', 'Export')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-44">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="size-4 text-emerald-600" /> {L('تصدير Excel', 'Export Excel')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
              <FileText className="size-4 text-sky-600" /> {L('تصدير CSV', 'Export CSV')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
              <FileDown className="size-4 text-rose-600" /> {L('تصدير PDF', 'Export PDF')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            {STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي الطلبات', 'Total Orders')} value={formatInt(total)} icon={<ShoppingCart className="size-5" />} accent="blue" />
        <KpiCard title={L('إجمالي المشتريات', 'Total Purchases')} value={formatCurrency(stats.totalPurchases)} icon={<Coins className="size-5" />} accent="amber" />
        <KpiCard title={L('المدفوع', 'Paid')} value={formatCurrency(stats.totalPaid)} icon={<Wallet className="size-5" />} accent="sky" />
        <KpiCard title={L('المتبقي', 'Outstanding')} value={formatCurrency(stats.outstanding)} icon={<Wallet className="size-5" />} accent="rose" />
      </div>
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-center`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('المدفوع', 'Paid')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد أوامر شراء. ابدأ بإنشاء أول أمر.', 'No purchase orders found. Start by creating the first order.')}</TableCell></TableRow>
              ) : orders.map((o) => (
                <TableRow
                  key={o.id}
                  className="hover:bg-muted/40 align-middle cursor-pointer"
                  onClick={() => openEdit(o)}
                >
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr" title={o.code}>
                    <div className="flex items-center gap-1.5">
                      <span>{o.code}</span>
                      {o.purchaseRequest?.code && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-1 py-0.5 rounded font-mono" title={L('مبني على طلب شراء', 'Based on Purchase Request')}>
                          {o.purchaseRequest.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(o.partner)}>{partnerName(o.partner) || '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(o.orderDate)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b">
                    <span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(o.total)}</span>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b">
                    <span className="num tabular-nums" dir="ltr">{formatCurrency(o.paid)}</span>
                  </TableCell>
                  <TableCell className="text-center border-b">
                    <div className="flex justify-center">
                      <StatusBadge status={o.status} />
                    </div>
                  </TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {isCancelledStatus(o.status) ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={L('حذف أمر الشراء الملغي', 'Delete Cancelled Order')}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(o.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="size-8" title={L('عرض أمر الشراء', 'View Purchase Order')} onClick={() => openEdit(o, true)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" title={L('طباعة أمر الشراء', 'Print Purchase Order')} onClick={() => handlePrint(o)}>
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

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm() }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl"
        >
          <DialogHeader>
            <DialogTitle>
              {viewOnly
                ? L('عرض أمر الشراء', 'View Purchase Order')
                : editingId
                  ? L('تعديل أمر الشراء', 'Edit Purchase Order')
                  : L('أمر شراء جديد', 'New Purchase Order')}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <fieldset
              disabled={viewOnly}
              className={viewOnly ? 'space-y-4 sm:space-y-5 cursor-not-allowed [&_input]:cursor-not-allowed [&_button]:cursor-not-allowed [&_select]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_div]:cursor-not-allowed' : 'space-y-4 sm:space-y-5'}
            >
              {/* Header: 2 columns on mobile → 4 on desktop */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {/* Supplier */}
                <div className="space-y-1.5 col-span-2 sm:col-span-1 lg:col-span-1">
                  <Label>{L('المورد *', 'Supplier *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue placeholder={L('اختر المورد', 'Select Supplier')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Linked Purchase Request — optional */}
                <div className="space-y-1.5 col-span-2 sm:col-span-1 lg:col-span-1">
                  <Label>{L('طلب الشراء المرتبط', 'Linked Request')}</Label>
                  <Select value={purchaseRequestId || 'none'} onValueChange={handleSelectPurchaseRequest} disabled={viewOnly}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed' : ''}`}>
                      <SelectValue placeholder={L('اختياري - طلب شراء معتمد', 'Optional - Approved Request')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectItem value="none">{L('بدون طلب شراء', 'No Linked Request')}</SelectItem>
                      {approvedRequests.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>
                          <span dir="ltr" className="font-mono text-xs">{pr.code}</span>
                          {pr.notes ? ` — ${pr.notes.slice(0, 18)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date — half width on mobile */}
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="orderDate">{L('التاريخ', 'Date')}</Label>
                  <DatePicker id="orderDate" value={orderDate} onChange={setOrderDate} disabled={viewOnly} />
                </div>

                {/* Status — half width on mobile */}
                <div className="space-y-1.5 col-span-1">
                  <Label>{L('الحالة', 'Status')}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {STATUS_FLOW.map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line items: cards on mobile (< md) */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{L('البنود', 'Line Items')}</span>
                  <span className="text-xs text-muted-foreground px-2">{lines.length} {L('بند', 'items')}</span>
                </div>

                {lines.map((l, idx) => {
                  const qty = Number(l.quantity) || 0
                  const cost = Number(l.unitCost) || 0
                  const disc = Number(l.discountAmount) || 0
                  const taxRate = Number(l.taxRate) || 0
                  const lineTotal = (qty * cost - disc) * (1 + taxRate / 100)
                  return (
                    <Card key={l.key} className="p-3 space-y-3 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{L('بند', 'Item')} #{idx + 1}</span>
                        {!viewOnly && (
                          <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600 shrink-0" onClick={() => removeLine(l.key)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">{L('المنتج', 'Product')}</Label>
                        <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                          <SelectTrigger className={`h-9 w-full ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
                          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {productName(p)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الكمية', 'Qty')}</Label>
                          <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('التكلفة', 'Cost')}</Label>
                          <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الخصم', 'Discount')}</Label>
                          <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الضريبة %', 'Tax %')}</Label>
                          <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="text-xs text-muted-foreground">{L('إجمالي البند', 'Line Total')}</span>
                        <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                      </div>
                    </Card>
                  )
                })}

                {!viewOnly && (
                  <Button type="button" size="sm" variant="outline" onClick={addLine} className="w-full gap-1.5">
                    <Plus className="size-3.5" /> {L('إضافة بند', 'Add Item')}
                  </Button>
                )}
              </div>

              {/* Line items: table on desktop (md+) */}
              <Card className="rounded-lg overflow-hidden hidden md:block">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="ps-3 min-w-[200px]">{L('المنتج', 'Product')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الكمية', 'Qty')}</TableHead>
                        <TableHead className="text-end num-cell w-28">{L('التكلفة', 'Cost')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الخصم', 'Discount')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الضريبة %', 'Tax %')}</TableHead>
                        <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => {
                        const qty = Number(l.quantity) || 0
                        const cost = Number(l.unitCost) || 0
                        const disc = Number(l.discountAmount) || 0
                        const taxRate = Number(l.taxRate) || 0
                        const lineTotal = (qty * cost - disc) * (1 + taxRate / 100)
                        return (
                          <TableRow key={l.key}>
                            <TableCell className="ps-3">
                              <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                                <SelectTrigger className={`h-9 w-full min-w-[200px] ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
                                <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {productName(p)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="1" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-end num-cell">
                              <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                            </TableCell>
                            <TableCell>
                              {!viewOnly && (
                                <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => removeLine(l.key)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={5}>
                          {!viewOnly && (
                            <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                              <Plus className="size-3.5" /> {L('إضافة بند', 'Add Item')}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(computed.total)}</span>
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Card>

              {/* Totals Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-amber-200 dark:border-amber-900">
                  <p className="text-xs text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.subtotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-muted-200 dark:border-muted-900">
                  <p className="text-xs text-muted-foreground">{L('الضريبة', 'Tax')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.taxTotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 col-span-2 sm:col-span-1">
                  <p className="text-xs text-amber-700 dark:text-amber-400">{L('الإجمالي', 'Total')}</p>
                  <p className="font-bold tabular-nums text-amber-700 dark:text-amber-400" dir="ltr">{formatCurrency(computed.total)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" className={`w-full ${viewOnly ? 'cursor-not-allowed' : ''}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
              </div>
            </fieldset>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-4 border-t shrink-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto sm:min-w-25" onClick={() => { setAddOpen(false); resetForm() }}>
              {viewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>
            {viewOnly ? (
              <Button
                type="button"
                className="w-full sm:w-auto sm:min-w-25 bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
                onClick={() => {
                  const orderToPrint = orders.find((o) => o.id === editingId)
                  if (orderToPrint) handlePrint(orderToPrint)
                }}
              >
                <Printer className="size-4" />
                {L('طباعة', 'Print')}
              </Button>
            ) : (
              <Button type="button" className="w-full sm:w-auto sm:min-w-25 bg-blue-600 hover:bg-blue-700 text-white" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending
                  ? L('جاري الحفظ...', 'Saving...')
                  : editingId ? L('تحديث', 'Update') : L('إنشاء', 'Create')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
