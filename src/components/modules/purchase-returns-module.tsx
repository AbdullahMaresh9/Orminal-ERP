'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import {
  printHTML,
  exportRows,
  type ExportColumn,
  type ExportMeta,
  type ExportFormat,
} from '@/lib/export'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Undo2, Plus, Trash2, Printer, CheckCircle2, Truck, Clock, Coins,
  Download, FileSpreadsheet, FileText, FileDown,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }

interface PurchaseReturnLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitCost: number
  taxRate: number
  total: number
}

interface PurchaseReturn {
  id: string
  code: string
  partnerId: string
  originalInvoiceId?: string | null
  date: string
  reason?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  notes?: string
  partner?: Partner
  lines: PurchaseReturnLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitCost: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'approved', 'shipped', 'debited', 'closed', 'cancelled']

// Bilingual status labels
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  approved: { ar: 'معتمد', en: 'Approved' },
  shipped: { ar: 'تم الشحن', en: 'Shipped' },
  debited: { ar: 'مُصدَر إشعار مدين', en: 'Debit Note Issued' },
  closed: { ar: 'مغلق', en: 'Closed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

// عدد الصفوف الظاهرة قبل ظهور الاسكرول
const VISIBLE_ROWS = 5
const ROW_HEIGHT = 52    // ارتفاع الصف التقريبي بالبكسل
const HEADER_HEIGHT = 44 // ارتفاع رأس الجدول

export function PurchaseReturnsModule() {
  const { t, isRTL } = useT()
  const qc = useQueryClient()

  // Bilingual text helper
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''
  const productName = (p?: Product) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // نافذة الإضافة/التعديل
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const isEditMode = editingId !== null
  const isReadOnly = isEditMode && editingStatus !== 'draft'

  const { data, isLoading } = useQuery<{ data: PurchaseReturn[]; meta: any }>({
    queryKey: ['purchase-returns', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-returns?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pur'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['purchase-invoices-for-pur'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-pur'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const returns = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const products = productsData?.data ?? []

  const stats = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'shipped').length,
    shipped: returns.filter((r) => r.status === 'shipped').length,
    totalValue: returns.reduce((s, r) => s + r.total, 0),
  }), [returns])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [originalInvoiceId, setOriginalInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitCost: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0
    for (const l of lines) {
      const sub = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0)
      const tax = sub * ((Number(l.taxRate) || 0) / 100)
      subtotal += sub; taxTotal += tax
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal }
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

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitCost: '0', taxRate: '15' }])

  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'At least one line item is required')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setEditingId(null)
    setEditingStatus(null)
    setPartnerId(''); setOriginalInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason(''); setNotes(''); setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', taxRate: '15' }])
  }

  /** فتح النافذة لإنشاء مرتجع جديد */
  const openAdd = () => {
    resetForm()
    setDialogOpen(true)
  }

  /** فتح النافذة لتعديل مرتجع قائم (عند النقر على الصف) */
  const openEdit = (r: PurchaseReturn) => {
    setEditingId(r.id)
    setEditingStatus(r.status)
    setPartnerId(r.partnerId ?? '')
    setOriginalInvoiceId(r.originalInvoiceId ?? '')
    setDate((r.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    setReason(r.reason ?? '')
    setNotes(r.notes ?? '')
    setLines(
      r.lines && r.lines.length > 0
        ? r.lines.map((l, i) => ({
          key: l.id ?? `line-${i}`,
          productId: l.productId ?? l.product?.id ?? '',
          quantity: String(l.quantity ?? 1),
          unitCost: String(l.unitCost ?? 0),
          taxRate: String(l.taxRate ?? 15),
        }))
        : [{ key: '1', productId: '', quantity: '1', unitCost: '0', taxRate: '15' }]
    )
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    resetForm()
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Please select a supplier'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        partnerId,
        originalInvoiceId: originalInvoiceId || undefined,
        date,
        reason,
        notes,
        // الحالة تُرسل عند الإنشاء فقط حتى لا يُعاد المرتجع إلى مسودة عند التعديل
        ...(editingId ? {} : { status: 'draft' }),
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          taxRate: Number(l.taxRate),
        })),
      }
      const url = editingId ? `/api/erp/purchase-returns/${editingId}` : '/api/erp/purchase-returns'
      const method = editingId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
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
      toast.success(
        editingId
          ? L('تم تحديث المرتجع', 'Purchase return updated')
          : L('تم إنشاء مرتجع المشتريات', 'Purchase return created')
      )
      // تحديث بيانات الجدول تلقائياً
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      closeDialog()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ ret, action }: { ret: PurchaseReturn; action: string }) => {
      const r = await fetch(`/api/erp/purchase-returns/${ret.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الإجراء', 'Action failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم تنفيذ الإجراء', 'Action completed'))
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // ============================================================
  // التصدير الموحّد (CSV / Excel / PDF) عبر export.ts
  // ============================================================
  const exportColumns: ExportColumn<PurchaseReturn>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 16, align: 'start', type: 'text', value: (r) => r.code },
    { key: 'supplier', header: L('المورد', 'Supplier'), width: 24, align: 'start', type: 'text', value: (r) => partnerName(r.partner) },
    {
      key: 'invoice', header: L('الفاتورة الأصلية', 'Original Invoice'), width: 18, align: 'start', type: 'text',
      value: (r) => invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '',
    },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (r) => formatDate(r.date), dateValue: (r) => r.date, },
    { key: 'subtotal', header: L('المجموع الفرعي', 'Subtotal'), width: 14, align: 'end', type: 'currency', summable: true, value: (r) => r.subtotal },
    { key: 'tax', header: L('الضريبة', 'Tax'), width: 12, align: 'end', type: 'currency', summable: true, value: (r) => r.taxTotal },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 14, align: 'end', type: 'currency', summable: true, value: (r) => r.total },
    { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', type: 'text', value: (r) => statusLabel(r.status) },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('مرتجعات-المشتريات', 'purchase-returns'),
    title: L('تقرير مرتجعات المشتريات', 'Purchase Returns Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي المرتجعات', 'Total Returns'), value: formatInt(stats.total) },
      { label: L('قيد المعالجة', 'In Progress'), value: formatInt(stats.pending) },
      { label: L('تم الشحن', 'Shipped'), value: formatInt(stats.shipped) },
      { label: L('إجمالي القيمة', 'Total Value'), value: formatCurrency(stats.totalValue) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!returns.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, returns, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف', 'File exported'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (r: PurchaseReturn) => {
    const origInv = invoices.find((i) => i.id === r.originalInvoiceId)
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
          <div class="type">${L('مرتجع مشتريات', 'Purchase Return')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('المورد', 'Supplier')}</div>
        <div class="name">${partnerName(r.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${r.partner?.code ?? ''}</div>
        ${origInv ? `<div class="sub">${L('فاتورة أصلية', 'Original invoice')}: ${origInv.code}</div>` : ''}
        ${r.reason ? `<div class="sub">${L('السبب', 'Reason')}: ${r.reason}</div>` : ''}
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
          ${r.lines.map((l) => `
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
        <div class="row"><span>${L('المجموع الفرعي:', 'Subtotal:')}</span><span>${formatCurrency(r.subtotal)}</span></div>
        <div class="row"><span>${L('الضريبة:', 'Tax:')}</span><span>${formatCurrency(r.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(r.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('أمين المستودع', 'Warehouse Keeper')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('مرتجع مشتريات', 'Purchase Return')} ${r.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

  return (
    <ModuleShell
      title={t('module.purchase-returns')}
      description={L(
        'إدارة مرتجعات المشتريات مع عكس القيود تلقائياً عند الإصدار',
        'Manage purchase returns with automatic journal reversal upon issuance'
      )}
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز المرتجع أو السبب...', 'Search by return code or reason...')}
      onAdd={openAdd}
      addLabel={L('مرتجع جديد', 'New Return')}
      // قائمة تصدير منسدلة (CSV / Excel / PDF) عبر فتحة actions
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
          <SelectTrigger className="w-44"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي المرتجعات', 'Total Returns')} value={formatInt(stats.total)} icon={<Undo2 className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'In Progress')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('تم الشحن', 'Shipped')} value={formatInt(stats.shipped)} icon={<Truck className="size-5" />} accent="sky" />
        <KpiCard title={L('إجمالي القيمة', 'Total Value')} value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      {/* جدول مرتجعات المشتريات — رأس ثابت + تمرير للصفوف فقط + نقر الصف للتعديل */}
      {/* جدول مرتجعات المشتريات — رأس ثابت + أعمدة بعرض ثابت لمحاذاة دقيقة بلا تداخل */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          {/* table-fixed + colgroup: يضمن محاذاة كل عمود مع رأسه بلا تداخل */}
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            {/* عرض ثابت لكل عمود (المجموع 100%) */}
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[22%]" />{/* المورد */}
              <col className="w-[14%]" />{/* الفاتورة الأصلية */}
              <col className="w-[13%]" />{/* التاريخ */}
              <col className="w-[12%]" />{/* الإجمالي */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[14%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الفاتورة الأصلية', 'Original Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center `}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : returns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد مرتجعات مشتريات.', 'No purchase returns found.')}</TableCell></TableRow>
              ) : returns.map((r) => {
                const invoiceCode = invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '—'
                const supplier = partnerName(r.partner) || '—'
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => openEdit(r)}
                    className="hover:bg-muted/40 cursor-pointer align-middle"
                    title={L('اضغط لعرض/تعديل المرتجع', 'Click to view/edit return')}
                  >
                    {/* الرمز */}
                    <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={r.code}>
                      {r.code}
                    </TableCell>
                    {/* المورد */}
                    <TableCell className="font-medium border-b truncate" title={supplier}>
                      {supplier}
                    </TableCell>
                    {/* الفاتورة الأصلية */}
                    <TableCell className="font-mono text-xs border-b truncate" dir="ltr" title={invoiceCode}>
                      {invoiceCode}
                    </TableCell>
                    {/* التاريخ */}
                    <TableCell className="text-sm text-center whitespace-nowrap border-b">
                      {formatDate(r.date)}
                    </TableCell>
                    {/* الإجمالي */}
                    <TableCell className="text-center  whitespace-nowrap border-b">
                      <span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(r.total)}</span>
                    </TableCell>
                    {/* الحالة */}
                    <TableCell className="text-center border-b">
                      <div className="flex justify-center">
                        <StatusBadge status={r.status} />
                      </div>
                    </TableCell>
                    {/* إجراءات */}
                    <TableCell className="text-end pe-4 border-b">
                      {/* منع أزرار الإجراءات من فتح نافذة التعديل */}
                      <div
                        className="flex items-center justify-end gap-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === 'draft' && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-sky-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'approve' })}>
                            <CheckCircle2 className="size-3.5" /> {L('اعتماد', 'Approve')}
                          </Button>
                        )}
                        {r.status === 'approved' && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'ship' })}>
                            <Truck className="size-3.5" /> {L('شحن', 'Ship')}
                          </Button>
                        )}
                        {r.status === 'shipped' && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'debit' })}>
                            <Coins className="size-3.5" /> {L('إصدار إشعار مدين', 'Issue Debit Note')}
                          </Button>
                        )}
                        {r.status === 'debited' && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-700" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'close' })}>
                            {L('إغلاق', 'Close')}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => handlePrint(r)}>
                          <Printer className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      </Card>
      {/* نافذة الإضافة / التعديل */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode
                ? (isReadOnly
                  ? L('عرض مرتجع المشتريات', 'View Purchase Return')
                  : L('تعديل مرتجع المشتريات', 'Edit Purchase Return'))
                : L('مرتجع مشتريات جديد', 'New Purchase Return')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isReadOnly && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                {L(
                  `لا يمكن تعديل هذا المرتجع لأن حالته: ${statusLabel(editingStatus ?? '')}. التعديل متاح للمسودات فقط.`,
                  `This return cannot be edited because its status is: ${statusLabel(editingStatus ?? '')}. Editing is available for drafts only.`
                )}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{L('المورد', 'Supplier')} *</Label>
                  <Select value={partnerId} onValueChange={setPartnerId} disabled={isReadOnly}>
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
                  <Label>{L('الفاتورة الأصلية', 'Original Invoice')}</Label>
                  <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue placeholder={L('اختياري', 'Optional')} /></SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter((i) => !partnerId || i.partnerId === partnerId)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            <span dir="ltr" className="font-mono text-xs">{i.code}</span> — {formatCurrency(i.total)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">{L('التاريخ', 'Date')}</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">{L('سبب الإرجاع', 'Return Reason')}</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isReadOnly}
                  placeholder={L('مثال: تالف، مخالف للمواصفات...', 'e.g., Damaged, not as specified...')}
                />
              </div>

              <Card className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="ps-3 w-65">{L('المنتج', 'Product')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الكمية', 'Qty')}</TableHead>
                      <TableHead className="text-end num-cell w-30">{L('التكلفة', 'Cost')}</TableHead>
                      <TableHead className="text-end num-cell w-24">{L('الضريبة %', 'Tax %')}</TableHead>
                      <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
                      <TableHead className="w-15"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const qty = Number(l.quantity) || 0
                      const cost = Number(l.unitCost) || 0
                      const taxRate = Number(l.taxRate) || 0
                      const lineTotal = qty * cost * (1 + taxRate / 100)
                      return (
                        <TableRow key={l.key}>
                          <TableCell className="ps-3">
                            <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)} disabled={isReadOnly}>
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
                            <Input className="h-9 text-start tabular-nums" type="number" step="1" dir="ltr" disabled={isReadOnly} value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.01" dir="ltr" disabled={isReadOnly} value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <Input className="h-9 text-start tabular-nums" type="number" step="0.1" dir="ltr" disabled={isReadOnly} value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-start num-cell">
                            <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" disabled={isReadOnly} onClick={() => removeLine(l.key)}>
                              <Trash2 className="size-4.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={isReadOnly} className="gap-1.5">
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

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={isReadOnly}
                  placeholder={L('ملاحظات إضافية...', 'Additional notes...')}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              {isReadOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>
            {!isReadOnly && (
              <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending
                  ? L('جاري الحفظ...', 'Saving...')
                  : isEditMode
                    ? L('حفظ التغييرات', 'Save Changes')
                    : L('إنشاء', 'Create')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
