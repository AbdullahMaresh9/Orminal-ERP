'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import { exportRows, ExportColumn, ExportFormat, ExportMeta, printHTML } from '@/lib/export'
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText, Plus, Trash2, Printer, ShoppingCart, Coins, Wallet, Download, FileSpreadsheet, FileDown,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; salePrice: number; costPrice: number }
interface SalesOrderLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  total: number
}
interface SalesOrder {
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
  lines: SalesOrderLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'confirmed', 'delivered', 'paid', 'cancelled']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  delivered: { ar: 'مُسلّم', en: 'Delivered' },
  paid: { ar: 'مدفوع', en: 'Paid' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const VISIBLE_ROWS = 5
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

export function SalesOrdersModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const partnerName = (p?: Partner) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')
  const productName = (p?: Product) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesOrder[]; meta: any }>({
    queryKey: ['sales-orders', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-orders?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-so'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-so'],
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

  const stats = useMemo(() => ({
    total: orders.length,
    totalSales: orders.reduce((s, o) => s + o.total, 0),
    totalPaid: orders.reduce((s, o) => s + o.paid, 0),
    outstanding: orders.reduce((s, o) => s + (o.total - o.paid), 0),
  }), [orders])

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0, discount = 0
    for (const l of lines) {
      const qty = Number(l.quantity) || 0
      const price = Number(l.unitPrice) || 0
      const disc = Number(l.discountAmount) || 0
      const taxRate = Number(l.taxRate) || 0
      const lineNet = qty * price - disc
      const lineTax = lineNet * (taxRate / 100)
      subtotal += qty * price
      discount += disc
      taxTotal += lineTax
    }
    return { subtotal, taxTotal, discount, total: subtotal - discount + taxTotal }
  }, [lines])

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [field]: value }
      if (field === 'productId') {
        const p = products.find((p) => p.id === value)
        if (p) next.unitPrice = String(p.salePrice)
      }
      return next
    }))
  }

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) {
      toast.error(L('يجب وجود بند واحد على الأقل', 'Must keep at least one line'))
      return
    }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId('')
    setOrderDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setStatus('draft')
    setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر العميل', 'Select a customer'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line'))
      const payload = {
        partnerId,
        orderDate,
        notes,
        status,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الحفظ', 'Failed to save'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إنشاء أمر البيع بنجاح', 'Sales order created successfully'))
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<SalesOrder>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'center', value: (o) => o.code },
    { key: 'customer', header: L('العميل', 'Customer'), width: 22, align: 'center', value: (o) => partnerName(o.partner) },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (o) => formatDate(o.orderDate), dateValue: (o) => o.orderDate },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 16, align: 'center', type: 'currency', summable: true, value: (o) => o.total },
    { key: 'paid', header: L('المدفوع', 'Paid'), width: 16, align: 'center', type: 'currency', summable: true, value: (o) => o.paid },
    { key: 'remaining', header: L('المتبقي', 'Remaining'), width: 16, align: 'center', type: 'currency', summable: true, value: (o) => o.total - o.paid },
    { key: 'status', header: L('الحالة', 'Status'), width: 12, align: 'center', value: (o) => STATUS_LABELS[o.status]?.[isRTL ? 'ar' : 'en'] ?? o.status },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('أوامر_البيع', 'sales-orders'),
    title: L('تقرير أوامر البيع', 'Sales Orders Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي الطلبات', 'Total Orders'), value: formatInt(total) },
      { label: L('إجمالي المبيعات', 'Total Sales'), value: formatCurrency(stats.totalSales) },
      { label: L('المحصّل', 'Total Paid'), value: formatCurrency(stats.totalPaid) },
      { label: L('المتبقي', 'Outstanding'), value: formatCurrency(stats.outstanding) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!orders.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, orders, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (order: SalesOrder) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>${L('أورمنال', 'Orminal')}</h2>
            <p>${L('نظام إدارة موارد المؤسسات ERP', 'ERP Management System')}</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">${L('أمر بيع', 'Sales Order')}</div>
          <div class="code">${order.code}</div>
          <div class="date">${formatDate(order.orderDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('العميل', 'Customer')}</div>
        <div class="name">${partnerName(order.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${order.partner?.code ?? ''}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية', 'Qty')}</th>
            <th>${L('السعر', 'Price')}</th>
            <th>${L('الخصم', 'Discount')}</th>
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
              <td>${formatCurrency(l.unitPrice)}</td>
              <td>${formatCurrency(l.discountAmount)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>${L('المجموع الفرعي:', 'Subtotal:')}</span><span>${formatCurrency(order.subtotal)}</span></div>
        <div class="row"><span>${L('الخصم:', 'Discount:')}</span><span>${formatCurrency(order.subtotal - order.taxTotal - (order.subtotal - order.total + order.taxTotal))}</span></div>
        <div class="row"><span>${L('الضريبة:', 'Tax:')}</span><span>${formatCurrency(order.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(order.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المندوب', 'Representative')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('العميل', 'Customer')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('أمر بيع', 'Sales Order')} ${order.code}`)
  }

  return (
    <ModuleShell
      title={L('أوامر البيع', 'Sales Orders')}
      description={L('إدارة أوامر البيع مع البنود والحسابات التلقائية', 'Manage sales orders with items and automatic calculations')}
      icon={<FileText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الأمر أو العميل...', 'Search by order code or customer...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('أمر بيع جديد', 'New Sales Order')}
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
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي الطلبات', 'Total Orders')} value={formatInt(total)} icon={<ShoppingCart className="size-5" />} accent="blue" />
        <KpiCard title={L('إجمالي المبيعات', 'Total Sales')} value={formatCurrency(stats.totalSales)} icon={<Coins className="size-5" />} accent="sky" />
        <KpiCard title={L('المحصّل', 'Total Paid')} value={formatCurrency(stats.totalPaid)} icon={<Wallet className="size-5" />} accent="violet" />
        <KpiCard title={L('المتبقي', 'Outstanding')} value={formatCurrency(stats.outstanding)} icon={<Wallet className="size-5" />} accent="amber" />
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
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-6 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العميل', 'Customer')}</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد أوامر بيع. ابدأ بإنشاء أول أمر.', 'No sales orders found. Start by creating the first order.')}</TableCell></TableRow>
              ) : orders.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/40 align-middle">
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={o.code}>{o.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(o.partner)}>{partnerName(o.partner) || '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(o.orderDate)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(o.total)}</span></TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums" dir="ltr">{formatCurrency(o.paid)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={o.status} /></div></TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <Button size="icon" variant="ghost" className="size-8" title={L('طباعة أمر البيع', 'Print Sales Order')} onClick={() => handlePrint(o)}>
                      <Printer className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className="text-muted-foreground">
          {isRTL
            ? `عرض ${orders.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + orders.length} من ${total}`
            : `Showing ${orders.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + orders.length} of ${total}`}
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
        <DialogContent className="max-w-4xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{L('أمر بيع جديد', 'New Sales Order')}</DialogTitle>
            <DialogDescription>{L('اختر العميل وأضف بنود البيع', 'Select customer and add sales order line items')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label>{L('العميل *', 'Customer *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder={L('اختر العميل', 'Select Customer')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
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
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {STATUS_FLOW.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
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
                      <TableHead className="text-end num-cell w-20">{L('الكمية', 'Qty')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('السعر', 'Price')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الخصم', 'Discount')}</TableHead>
                      <TableHead className="text-end num-cell w-20">{L('الضريبة %', 'Tax %')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const qty = Number(l.quantity) || 0
                      const price = Number(l.unitPrice) || 0
                      const disc = Number(l.discountAmount) || 0
                      const taxRate = Number(l.taxRate) || 0
                      const lineTotal = (qty * price - disc) * (1 + taxRate / 100)
                      return (
                        <TableRow key={l.key}>
                          <TableCell className="ps-3">
                            <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                              <SelectTrigger className="h-9 min-w-[220px]"><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
                              <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {productName(p)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => removeLine(l.key)}>
                              <Trash2 className="size-3.5" />
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
                          <Plus className="size-3.5" /> {L('إضافة بند', 'Add Item')}
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
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <p className="text-xs text-blue-700 dark:text-blue-400">{L('الإجمالي', 'Total')}</p>
                  <p className="font-bold tabular-nums text-blue-700 dark:text-blue-400" dir="ltr">{formatCurrency(computed.total)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
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
