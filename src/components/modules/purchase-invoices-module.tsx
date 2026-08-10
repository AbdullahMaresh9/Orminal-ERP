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
  Plus, Trash2, Printer, Hash, Wallet, Coins, Receipt, Eye, FileMinus,
} from 'lucide-react'
import { DatePicker } from '../ui/date-picker'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }
interface PurchaseOrder { id: string; code: string; partnerId: string }
interface PurchaseInvoiceLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitCost: number
  discountAmount: number
  taxRate: number
  total: number
}
interface PurchaseInvoice {
  id: string
  code: string
  partnerId: string
  purchaseOrderId?: string | null
  billDate: string
  accountingDate?: string
  dueDate?: string
  vendorBillNo?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  paid: number
  notes?: string
  partner?: Partner
  lines: PurchaseInvoiceLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitCost: string
  discountAmount: string
  taxRate: string
}

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  posted: { ar: 'مُرحّل', en: 'Posted' },
  partially_paid: { ar: 'مدفوع جزئياً', en: 'Partially Paid' },
  paid: { ar: 'مدفوع', en: 'Paid' },
  reversed: { ar: 'معكوس', en: 'Reversed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  credited: { ar: 'تم عمل إشعار دائن', en: 'Credited' },
}

export function PurchaseInvoicesModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'
  const productName = (p?: Product) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''
  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseInvoice[]; meta: any }>({
    queryKey: ['purchase-invoices', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-invoices?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: poData } = useQuery<{ data: PurchaseOrder[] }>({
    queryKey: ['pos-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-orders?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const invoices = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []
  const purchaseOrders = poData?.data ?? []

  const stats = useMemo(() => ({
    totalBilled: invoices.reduce((s, i) => s + i.total, 0),
    totalPaid: invoices.reduce((s, i) => s + i.paid, 0),
    outstanding: invoices.reduce((s, i) => s + (i.total - i.paid), 0),
    count: invoices.length,
  }), [invoices])

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [vendorBillNo, setVendorBillNo] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountingDate, setAccountingDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
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
      const lineNet = qty * cost - disc
      const lineTax = lineNet * (taxRate / 100)
      subtotal += qty * cost
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
        if (p) next.unitCost = String(p.costPrice)
      }
      return next
    }))
  }

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'Must have at least one line item')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setSelectedInvoice(null)
    setViewOnly(false)
    setPartnerId(''); setPurchaseOrderId(''); setVendorBillNo('')
    setBillDate(new Date().toISOString().slice(0, 10))
    setAccountingDate(new Date().toISOString().slice(0, 10))
    setDueDate(''); setNotes('')
    setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  }

  const openView = (i: PurchaseInvoice) => {
    setSelectedInvoice(i)
    setPartnerId(i.partnerId)
    setPurchaseOrderId(i.purchaseOrderId ?? '')
    setVendorBillNo(i.vendorBillNo ?? '')
    setBillDate(i.billDate ? new Date(i.billDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setAccountingDate(i.accountingDate ? new Date(i.accountingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setDueDate(i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : '')
    setNotes(i.notes ?? '')
    if (i.lines && i.lines.length > 0) {
      setLines(i.lines.map((l, idx) => ({
        key: String(idx + 1),
        productId: l.productId ?? '',
        quantity: String(l.quantity),
        unitCost: String(l.unitCost),
        discountAmount: String(l.discountAmount ?? 0),
        taxRate: String(l.taxRate ?? 15),
      })))
    } else {
      setLines([])
    }
    setViewOnly(true)
    setAddOpen(true)
  }

  const handleRowClick = (i: PurchaseInvoice) => {
    if (['cancelled', 'credited', 'reversed'].includes(i.status)) {
      toast.info(L('هذه الفاتورة ملغاة/معكوسة بإشعار دائن ولا يمكن التعديل عليها', 'This invoice is cancelled/credited and cannot be modified'))
      return
    }
    openView(i)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Select a supplier'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        partnerId,
        purchaseOrderId: purchaseOrderId || undefined,
        vendorBillNo,
        billDate,
        accountingDate,
        dueDate: dueDate || undefined,
        status: 'posted',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/purchase-invoices', {
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
      toast.success(L('تم إنشاء فاتورة المشتريات وترحيلها', 'Purchase invoice created and posted'))
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const createCreditNoteMutation = useMutation({
    mutationFn: async (invoice: PurchaseInvoice) => {
      const payload = {
        partnerId: invoice.partnerId,
        invoiceId: invoice.id,
        date: new Date().toISOString().slice(0, 10),
        reason: L('مرتجع / إلغاء فاتورة مشتريات', 'Invoice Cancellation / Return'),
        subtotal: invoice.subtotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total,
        notes: L(`إشعار دائن للفاتورة رقم ${invoice.code}`, `Credit note for invoice ${invoice.code}`),
      }
      const r = await fetch('/api/erp/purchase-credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل إنشاء الإشعار الدائن', 'Failed to create credit note'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إنشاء الإشعار الدائن بنجاح وتحديث حالة الفاتورة', 'Credit note created successfully and invoice status updated'))
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: ['purchase-credit-notes'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-invoices/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الحذف', 'Delete failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف الفاتورة', 'Invoice deleted'))
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const handleExport = () => {
    const rows = invoices.map((i) => ({
      [L('الرمز', 'Code')]: i.code,
      [L('المورد', 'Supplier')]: partnerName(i.partner),
      [L('أمر الشراء', 'Purchase Order')]: purchaseOrders.find((p) => p.id === i.purchaseOrderId)?.code ?? '',
      [L('رقم فاتورة المورد', 'Vendor Bill No')]: i.vendorBillNo ?? '',
      [L('تاريخ الفاتورة', 'Bill Date')]: formatDate(i.billDate),
      [L('تاريخ الاستحقاق', 'Due Date')]: i.dueDate ? formatDate(i.dueDate) : '',
      [L('الإجمالي', 'Total')]: i.total,
      [L('المدفوع', 'Paid')]: i.paid,
      [L('المتبقي', 'Balance Due')]: i.total - i.paid,
      [L('الحالة', 'Status')]: statusLabel(i.status),
    }))
    exportToCSV('purchase-invoices', rows)
    toast.success(L('تم تصدير الملف', 'File exported'))
  }

  const handlePrint = (i: PurchaseInvoice) => {
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
          <div class="type">${L('فاتورة مشتريات', 'Purchase Invoice')}</div>
          <div class="code">${i.code}</div>
          <div class="date">${formatDate(i.billDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('المورد', 'Supplier')}</div>
        <div class="name">${partnerName(i.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${i.partner?.code ?? ''}</div>
        ${i.vendorBillNo ? `<div class="sub">${L('رقم فاتورة المورد', 'Vendor Bill No.')}: ${i.vendorBillNo}</div>` : ''}
        ${i.dueDate ? `<div class="sub">${L('تاريخ الاستحقاق', 'Due Date')}: ${formatDate(i.dueDate)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية', 'Qty')}</th>
            <th>${L('التكلفة', 'Cost')}</th>
            <th>${L('الخصم', 'Discount')}</th>
            <th>${L('الضريبة', 'Tax')}</th>
            <th>${L('الإجمالي', 'Total')}</th>
          </tr>
        </thead>
        <tbody>
          ${i.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${productName(l.product)}</td>
              <td>${l.quantity}</td>
              <td>${formatCurrency(l.unitCost)}</td>
              <td>${formatCurrency(l.discountAmount)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>${L('المجموع الفرعي:', 'Subtotal:')}</span><span>${formatCurrency(i.subtotal)}</span></div>
        <div class="row"><span>${L('الضريبة:', 'Tax:')}</span><span>${formatCurrency(i.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(i.total)}</span></div>
        <div class="row"><span>${L('المدفوع:', 'Paid:')}</span><span>${formatCurrency(i.paid)}</span></div>
        <div class="row"><span>${L('المتبقي:', 'Balance Due:')}</span><span>${formatCurrency(i.total - i.paid)}</span></div>
      </div>
      ${i.notes ? `<div class="notes">${i.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير المالي', 'Financial Manager')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المورد', 'Supplier')}</div></div>
      </div>
    `
    printHTML(html, `${L('فاتورة مشتريات', 'Purchase Invoice')} ${i.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  return (
    <ModuleShell
      title={t('module.purchase-invoices')}
      description={L(
        'فواتير المشتريات من الموردين مع الترحيل المحاسبي التلقائي',
        'Supplier purchase invoices with automatic accounting posting'
      )}
      icon={<Receipt className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الفاتورة أو رقم المورد...', 'Search by invoice code or supplier...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('فاتورة مشتريات جديدة', 'New Purchase Invoice')}
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            {Object.keys(STATUS_LABELS).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي الفواتير', 'Total Billed')} value={formatCurrency(stats.totalBilled)} icon={<Receipt className="size-5" />} accent="blue" />
        <KpiCard title={L('إجمالي المدفوع', 'Total Paid')} value={formatCurrency(stats.totalPaid)} icon={<Wallet className="size-5" />} accent="sky" />
        <KpiCard title={L('المستحق', 'Outstanding')} value={formatCurrency(stats.outstanding)} icon={<Coins className="size-5" />} accent="amber" />
        <KpiCard title={L('عدد الفواتير', 'Total Invoices')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[17%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('أمر الشراء', 'Purchase Order')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('تاريخ الفاتورة', 'Bill Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الاستحقاق', 'Due Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('المدفوع', 'Paid')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد فواتير مشتريات.', 'No purchase invoices found.')}</TableCell></TableRow>
              ) : invoices.map((i) => (
                <TableRow key={i.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => handleRowClick(i)}>
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">{i.code}</TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(i.partner)}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{purchaseOrders.find((p) => p.id === i.purchaseOrderId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(i.billDate)}</TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{i.dueDate ? formatDate(i.dueDate) : '—'}</TableCell>
                  <TableCell className="text-center border-b whitespace-nowrap"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(i.total)}</span></TableCell>
                  <TableCell className="text-center border-b whitespace-nowrap"><span className="num tabular-nums" dir="ltr">{formatCurrency(i.paid)}</span></TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={i.status} /></TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {['cancelled', 'credited', 'reversed'].includes(i.status) ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={L('حذف الفاتورة', 'Delete Invoice')}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(i.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => openView(i)} title={L('عرض الفاتورة', 'View Invoice')}>
                            <Eye className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(i)} title={L('طباعة', 'Print')}>
                            <Printer className="size-4.5" />
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
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl"
        >
          <DialogHeader>
            <DialogTitle>
              {viewOnly
                ? L('عرض فاتورة المشتريات', 'View Purchase Invoice')
                : L('إضافة فاتورة مشتريات', 'New Purchase Invoice')}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <fieldset
              disabled={viewOnly}
              className={viewOnly ? 'space-y-4 sm:space-y-5 cursor-not-allowed [&_input]:cursor-not-allowed [&_button]:cursor-not-allowed [&_select]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_div]:cursor-not-allowed' : 'space-y-4 sm:space-y-5'}
            >
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                <div className="space-y-1.5 col-span-2 lg:col-span-1">
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
                <div className="space-y-1.5 col-span-1">
                  <Label>{L('أمر الشراء (اختياري)', 'Purchase Order (Optional)')}</Label>
                  <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
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
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="vendorBillNo">{L('رقم فاتورة المورد', 'Vendor Bill No.')}</Label>
                  <Input id="vendorBillNo" className={viewOnly ? 'cursor-not-allowed' : ''} value={vendorBillNo} onChange={(e) => setVendorBillNo(e.target.value)} placeholder="—" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="billDate">{L('تاريخ الفاتورة', 'Bill Date')}</Label>
                  <DatePicker
                    id="billDate"
                    value={billDate}
                    onChange={setBillDate}
                    disabled={viewOnly}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="accountingDate">{L('تاريخ القيد', 'Accounting Date')}</Label>
                  <DatePicker
                    id="accountingDate"
                    value={accountingDate}
                    onChange={setAccountingDate}
                    disabled={viewOnly}
                  />
                </div>
                <div className="space-y-1.5 col-span-2 lg:col-span-1">
                  <Label htmlFor="dueDate">{L('تاريخ الاستحقاق', 'Due Date')}</Label>
                  <DatePicker
                    id="dueDate"
                    value={dueDate}
                    onChange={setDueDate}
                    disabled={viewOnly}
                  />
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
                          <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
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
                    <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                  </Button>
                )}
              </div>

              {/* Line items: table on desktop (md+) */}
              <Card className="rounded-lg overflow-hidden hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="ps-3 w-60">{L('المنتج', 'Product')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الكمية', 'Qty')}</TableHead>
                      <TableHead className="text-end num-cell w-30">{L('التكلفة', 'Cost')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الخصم', 'Discount')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الضريبة %', 'Tax %')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
                      <TableHead className="w-15"></TableHead>
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
                              <SelectTrigger className={`h-9 min-w-[220px] ${viewOnly ? 'cursor-not-allowed' : ''}`}><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
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
                            <Input className={`h-9 text-start tabular-nums ${viewOnly ? 'cursor-not-allowed' : ''}`} type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
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
                                <Trash2 className="size-4.5" />
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
                            <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
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
                <Textarea id="notes" className={viewOnly ? 'cursor-not-allowed' : ''} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
              </div>
            </fieldset>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-4 border-t shrink-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto sm:min-w-25" onClick={() => { setAddOpen(false); resetForm() }}>
              {viewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>

            {viewOnly ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {selectedInvoice && (
                  <Button
                    type="button"
                    className="w-full sm:w-auto gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    disabled={createCreditNoteMutation.isPending}
                    onClick={() => {
                      if (selectedInvoice) createCreditNoteMutation.mutate(selectedInvoice)
                    }}
                  >
                    <FileMinus className="size-4" />
                    {createCreditNoteMutation.isPending ? L('جاري الإنشاء...', 'Creating...') : L('إنشاء إشعار دائن', 'Create Credit Note')}
                  </Button>
                )}
                <Button
                  type="button"
                  className="w-full sm:w-auto sm:min-w-25 bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
                  onClick={() => {
                    if (selectedInvoice) handlePrint(selectedInvoice)
                  }}
                >
                  <Printer className="size-4" />
                  {L('طباعة', 'Print')}
                </Button>
              </div>
            ) : (
              <Button type="button" className="w-full sm:w-auto sm:min-w-25 bg-blue-600 hover:bg-blue-700 text-white" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('إنشاء وترحيل', 'Create & Post')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
