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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody, } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu'
import { FileText, Plus, Trash2, Printer, ShoppingCart, Coins, Wallet, Download, FileSpreadsheet, FileDown } from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }
interface PurchaseOrderLine {
  id?: string
  productId?: string
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

// عدد الصفوف الظاهرة قبل ظهور الاسكرول
const VISIBLE_ROWS = 5
const ROW_HEIGHT = 52    // ارتفاع الصف التقريبي بالبكسل
const HEADER_HEIGHT = 44 // ارتفاع رأس الجدول

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

  const orders = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  const stats = {
    total: orders.length,
    totalPurchases: orders.reduce((s, o) => s + o.total, 0),
    totalPaid: orders.reduce((s, o) => s + o.paid, 0),
    outstanding: orders.reduce((s, o) => s + (o.total - o.paid), 0),
  }

  const [partnerId, setPartnerId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' },
  ])

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

  const resetForm = () => {
    setPartnerId('')
    setOrderDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setStatus('draft')
    setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Please select a supplier'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        partnerId,
        orderDate,
        notes,
        status,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/purchase-orders', {
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
    onSuccess: () => {
      toast.success(L('تم إنشاء أمر الشراء بنجاح', 'Purchase order created successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
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

      {/* جدول أوامر الشراء — رأس ثابت + تمرير عمودي/أفقي (نمط مرتجعات المشتريات) */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[22%]" />{/* المورد */}
              <col className="w-[13%]" />{/* التاريخ */}
              <col className="w-[14%]" />{/* الإجمالي */}
              <col className="w-[14%]" />{/* المدفوع */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[13%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
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
                <TableRow key={o.id} className="hover:bg-muted/40 a">
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr" title={o.code}>{o.code}</TableCell>
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
                  <TableCell className="text-end pe-4 border-b">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(o)}>
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{L('أمر شراء جديد', 'New Purchase Order')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label>{L('المورد', 'Supplier')} *</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder={L('اختر المورد', 'Select supplier')} /></SelectTrigger>
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
                  <Label htmlFor="orderDate">{L('التاريخ', 'Date')}</Label>
                  <Input id="orderDate" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{L('الحالة', 'Status')}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{statusLabel('draft')}</SelectItem>
                      <SelectItem value="confirmed">{statusLabel('confirmed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="ps-3">{L('المنتج', 'Product')}</TableHead>
                      <TableHead className="text-start num-cell w-24">{L('الكمية', 'Qty')}</TableHead>
                      <TableHead className="text-start num-cell w-30">{L('التكلفة', 'Cost')}</TableHead>
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
                              <SelectTrigger className="h-9 min-w-[220px]"><SelectValue placeholder={L('اختر المنتج', 'Select product')} /></SelectTrigger>
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
                            <Input className="h-9 text-start tabular-nums" type="number" step="1" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.1" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.1" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                              <Trash2 className="size-4.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                          <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                        </Button>
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(computed.total)}</span>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </Card>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.subtotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">{L('الضريبة', 'Tax')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.taxTotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <p className="text-xs text-amber-700 dark:text-amber-400">{L('الإجمالي', 'Total')}</p>
                  <p className="font-bold tabular-nums text-amber-700 dark:text-amber-400" dir="ltr">{formatCurrency(computed.total)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{L('إلغاء', 'Cancel')}</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
