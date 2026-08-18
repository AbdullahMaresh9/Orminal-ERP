'use client'

import { useState, useMemo, useEffect } from 'react'
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
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'
import {
  FileText, Plus, Trash2, Printer, FileSignature, CheckCircle2, Clock, Percent,
  Download, FileSpreadsheet, FileDown, MoreHorizontal, Pencil, Eye,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; salePrice: number }

interface SalesQuotationLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitPrice: number
  discountAmount: number
  discountPercent: number
  taxRate: number
  total: number
}
interface SalesQuotation {
  id: string
  code: string
  partnerId: string
  quotationDate: string
  validUntil?: string
  status: string
  subtotal: number
  taxTotal: number
  discount: number
  total: number
  notes?: string
  convertedSalesOrderId?: string
  partner?: Partner
  lines: SalesQuotationLine[]
}
interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
}

// ✅ (P1) شكل الإحصائيات المجمّعة القادمة من الخادم
interface QuotationStats {
  total: number
  accepted: number
  pending: number
  converted: number
}

const STATUS_FLOW = ['draft', 'sent', 'accepted', 'expired', 'cancelled', 'converted']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  sent: { ar: 'مُرسل', en: 'Sent' },
  accepted: { ar: 'مقبول', en: 'Accepted' },
  expired: { ar: 'منتهي', en: 'Expired' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  converted: { ar: 'تم تحويله', en: 'Converted' },
}
// الحالات القابلة للتغيير اليدوي (لا نسمح بتعيين converted يدويًا — يتم عبر التحويل فقط)
const MANUAL_STATUSES = ['draft', 'sent', 'accepted', 'expired', 'cancelled']

const VISIBLE_ROWS = 6
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

export function SalesQuotationsModule() {
  const { isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const partnerName = (p?: Partner) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')
  const productName = (p?: Product) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')
  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()

  // ✅ (P1) بحث مع debounce + إعادة الترقيم للصفحة الأولى
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => { setPage(1) }, [filterStatus])

  const { data, isLoading } = useQuery<{ data: SalesQuotation[]; meta: any }>({
    queryKey: ['sales-quotations', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-quotations?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-sq'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-sq'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const quotations = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  // ✅ (P1) تصحيح الـ KPIs: تُقرأ من إحصائيات الخادم المجمّعة (meta.stats)
  // مع fallback مؤقت (نطاق الصفحة الحالية) لحين توفير الـ backend لها.
  const stats = useMemo(() => {
    const s: QuotationStats | undefined = data?.meta?.stats
    if (s) {
      const conversionRate = s.total > 0 ? (s.converted / s.total) * 100 : 0
      return { total: s.total, accepted: s.accepted, pending: s.pending, converted: s.converted, conversionRate }
    }
    // fallback (نطاق الصفحة فقط) — يُفضّل تعطيله بعد دعم meta.stats في الخادم
    const accepted = quotations.filter((q) => q.status === 'accepted' || q.status === 'converted').length
    const pending = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length
    const converted = quotations.filter((q) => q.status === 'converted').length
    const conversionRate = total > 0 ? (converted / (quotations.length || 1)) * 100 : 0
    return { total, accepted, pending, converted, conversionRate }
  }, [data, quotations, total])

  // ============ حالة النموذج (إنشاء + تعديل + عرض) ============
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewOnly, setViewOnly] = useState(false) // العروض المحوّلة تُفتح للعرض فقط
  const [partnerId, setPartnerId] = useState('')
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' },
  ])

  // حالة تأكيد الحذف
  const [deleteTarget, setDeleteTarget] = useState<SalesQuotation | null>(null)

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
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'Must keep at least one line')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setEditingId(null)
    setViewOnly(false)
    setPartnerId('')
    setQuotationDate(new Date().toISOString().slice(0, 10))
    setValidUntil('')
    setNotes('')
    setStatus('draft')
    setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  }

  const openCreate = () => { resetForm(); setAddOpen(true) }

  // ✅ (P1) فتح شاشة التعديل عند النقر على الصف — تعبئة النموذج ببيانات العملية
  const openEdit = (q: SalesQuotation, readOnly = false) => {
    setEditingId(q.id)
    setViewOnly(readOnly || q.status === 'converted')
    setPartnerId(q.partnerId)
    setQuotationDate((q.quotationDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    setValidUntil((q.validUntil || '').slice(0, 10))
    setNotes(q.notes || '')
    setStatus(q.status)
    setLines(
      q.lines?.length
        ? q.lines.map((l, i) => ({
          key: l.id ?? `${q.id}-${i}`,
          productId: l.productId ?? '',
          quantity: String(l.quantity ?? 1),
          unitPrice: String(l.unitPrice ?? 0),
          discountAmount: String(l.discountAmount ?? 0),
          taxRate: String(l.taxRate ?? 15),
        }))
        : [{ key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }],
    )
    setAddOpen(true)
  }

  // ✅ (P1) حفظ موحّد: PUT عند التعديل / POST عند الإنشاء
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر العميل', 'Select a customer'))
      if (validUntil && validUntil < quotationDate) {
        throw new Error(L('تاريخ الصلاحية يجب أن يكون بعد تاريخ العرض', 'Valid-until must be after the quotation date'))
      }
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line'))
      const payload = {
        partnerId,
        quotationDate,
        validUntil: validUntil || undefined,
        status,
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const url = editingId ? `/api/erp/sales-quotations/${editingId}` : '/api/erp/sales-quotations'
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
      toast.success(editingId
        ? L('تم تحديث عرض السعر بنجاح', 'Sales quotation updated successfully')
        : L('تم إنشاء عرض السعر بنجاح', 'Sales quotation created successfully'))
      // ✅ تحديث بيانات الصف في الجدول فورًا
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // ✅ (P1) تغيير الحالة السريع من القائمة
  const statusMutation = useMutation({
    mutationFn: async ({ q, newStatus }: { q: SalesQuotation; newStatus: string }) => {
      const r = await fetch(`/api/erp/sales-quotations/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل تغيير الحالة', 'Failed to change status'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم تحديث الحالة', 'Status updated'))
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // ✅ (P1) حذف
  const deleteMutation = useMutation({
    mutationFn: async (q: SalesQuotation) => {
      const r = await fetch(`/api/erp/sales-quotations/${q.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الحذف', 'Failed to delete'))
      }
      return true
    },
    onSuccess: () => {
      toast.success(L('تم حذف عرض السعر', 'Sales quotation deleted'))
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const convertMutation = useMutation({
    mutationFn: async (q: SalesQuotation) => {
      const payload = {
        partnerId: q.partnerId,
        quotationId: q.id,
        orderDate: new Date().toISOString().slice(0, 10),
        status: 'draft',
        lines: q.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          taxRate: l.taxRate,
        })),
      }
      const r = await fetch('/api/erp/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل التحويل', 'Failed to convert'))
      }
      const so = await r.json()
      const updateRes = await fetch(`/api/erp/sales-quotations/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted', convertedSalesOrderId: so.data?.id ?? so.id }),
      })
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل تحديث حالة عرض السعر', 'Failed to update quotation status'))
      }
      return so
    },
    onSuccess: () => {
      toast.success(L('تم التحويل إلى أمر بيع بنجاح', 'Successfully converted to sales order'))
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<SalesQuotation>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'center', value: (q) => q.code },
    { key: 'customer', header: L('العميل', 'Customer'), width: 22, align: 'center', value: (q) => partnerName(q.partner) },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (q) => formatDate(q.quotationDate), dateValue: (q) => q.quotationDate },
    { key: 'validUntil', header: L('صالح حتى', 'Valid Until'), width: 14, align: 'center', type: 'date', value: (q) => q.validUntil ? formatDate(q.validUntil) : '', dateValue: (q) => q.validUntil },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 16, align: 'center', type: 'currency', summable: true, value: (q) => q.total },
    { key: 'status', header: L('الحالة', 'Status'), width: 12, align: 'center', value: (q) => STATUS_LABELS[q.status]?.[isRTL ? 'ar' : 'en'] ?? q.status },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('عروض الأسعار', 'sales-quotations'),
    title: L('تقرير عروض الأسعار', 'Sales Quotations Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي العروض', 'Total Quotations'), value: formatInt(stats.total) },
      { label: L('المقبولة', 'Accepted'), value: formatInt(stats.accepted) },
      { label: L('معدل التحويل', 'Conversion Rate'), value: `${stats.conversionRate.toFixed(1)}%` },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!quotations.length) { toast.error(L('لا توجد بيانات للتصدير', 'No data to export')); return }
    try {
      await exportRows(format, quotations, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (q: SalesQuotation) => {
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
          <div class="type">${L('عرض سعر', 'Sales Quotation')}</div>
          <div class="code">${q.code}</div>
          <div class="date">${formatDate(q.quotationDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('العميل', 'Customer')}</div>
        <div class="name">${partnerName(q.partner)}</div>
        <div class="sub">${L('رقم الحساب', 'Account Number')}: ${q.partner?.code ?? ''}</div>
        ${q.validUntil ? `<div class="sub">${L('صالح حتى', 'Valid Until')}: ${formatDate(q.validUntil)}</div>` : ''}
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
          ${q.lines.map((l) => `
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
        <div class="row"><span>${L('المجموع الفرعي:', 'Subtotal:')}</span><span>${formatCurrency(q.subtotal)}</span></div>
        <div class="row"><span>${L('الخصم:', 'Discount:')}</span><span>${formatCurrency(q.discount)}</span></div>
        <div class="row"><span>${L('الضريبة:', 'Tax:')}</span><span>${formatCurrency(q.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(q.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المندوب', 'Representative')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('العميل', 'Customer')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('عرض سعر', 'Sales Quotation')} ${q.code}`)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <ModuleShell
      title={L('عروض الأسعار', 'Sales Quotations')}
      description={L('إدارة عروض أسعار العملاء وتحويلها إلى أوامر بيع', 'Manage customer sales quotations and convert to sales orders')}
      icon={<FileSignature className="size-5" />}
      searchValue={searchInput}
      onSearch={setSearchInput}
      searchPlaceholder={L('ابحث برمز العرض أو العميل...', 'Search by quotation code or customer...')}
      onAdd={openCreate}
      addLabel={L('عرض سعر جديد', 'New Quotation')}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-4.5" />
              <span className="hidden sm:inline">{L('تصدير', 'Export')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4} collisionPadding={8} className="w-32">
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
          <SelectTrigger className="w-30"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent align="start" side="bottom" sideOffset={4} collisionPadding={8} className="w-30">
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            {STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي العروض', 'Total Quotations')} value={formatInt(stats.total)} icon={<FileSignature className="size-5" />} accent="blue" />
        <KpiCard title={L('المقبولة', 'Accepted')} value={formatInt(stats.accepted)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title={L('قيد الانتظار', 'Pending')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('معدل التحويل', 'Conversion Rate')} value={`${stats.conversionRate.toFixed(1)}%`} icon={<Percent className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[21%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-6 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العميل', 'Customer')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('صالح حتى', 'Valid Until')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-center pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : quotations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد عروض أسعار. ابدأ بإنشاء أول عرض.', 'No sales quotations found. Start by creating the first quotation.')}</TableCell></TableRow>
              ) : quotations.map((q) => (
                // ✅ (P1) النقر على الصف يفتح شاشة التعديل
                <TableRow
                  key={q.id}
                  className="hover:bg-muted/40 align-middle cursor-pointer"
                  onClick={() => openEdit(q)}
                >
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={q.code}>{q.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(q.partner)}>{partnerName(q.partner) || '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(q.quotationDate)}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{q.validUntil ? formatDate(q.validUntil) : '—'}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(q.total)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={q.status} /></div></TableCell>
                  {/* ✅ إيقاف انتشار النقر حتى لا يفتح التعديل عند الضغط على الأزرار */}
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {q.status === 'accepted' && !q.convertedSalesOrderId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-blue-600"
                          disabled={convertMutation.isPending}
                          onClick={() => convertMutation.mutate(q)}
                        >
                          <FileText className="size-3.5" />
                          <span className="text-xs">{L('تحويل لأمر بيع', 'Convert to Order')}</span>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8 mx-4" title={L('طباعة عرض السعر', 'Print Quotation')} onClick={() => handlePrint(q)}>
                        <Printer className="size-4.5" />
                      </Button>

                      {/* ✅ (P1) قائمة إجراءات الصف: عرض/تعديل، تغيير الحالة، حذف */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8" title={L('إجراءات', 'Actions')}>
                            <MoreHorizontal className="size-4.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom" sideOffset={4} collisionPadding={8} className="w-30">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(q, q.status === 'converted')}>
                            {q.status === 'converted'
                              ? <><Eye className="size-4" /> {L('عرض', 'View')}</>
                              : <><Pencil className="size-4" /> {L('تعديل', 'Edit')}</>}
                          </DropdownMenuItem>

                          {q.status !== 'converted' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">{L('تغيير الحالة', 'Change status')}</DropdownMenuLabel>
                              {MANUAL_STATUSES.filter((s) => s !== q.status).map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  className="cursor-pointer"
                                  disabled={statusMutation.isPending}
                                  onClick={() => statusMutation.mutate({ q, newStatus: s })}
                                >
                                  {STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600"
                                onClick={() => setDeleteTarget(q)}
                              >
                                <Trash2 className="size-4" /> {L('حذف', 'Delete')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* ============ نموذج إنشاء / تعديل / عرض ============ */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm() }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>
              {viewOnly
                ? L('عرض عرض السعر', 'View Sales Quotation')
                : editingId
                  ? L('تعديل عرض السعر', 'Edit Sales Quotation')
                  : L('عرض سعر جديد', 'New Sales Quotation')}
            </DialogTitle>

          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <fieldset disabled={viewOnly} className="space-y-4 sm:space-y-5">
              {/* ===== بيانات الرأس: تتكيّف 1 → 2 → 4 أعمدة ===== */}
              {/* ===== بيانات الرأس: عمودان على الجوال → 4 على الديسكتوب ===== */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {/* العميل — كامل العرض */}
                <div className="space-y-1.5 col-span-2 lg:col-span-1">
                  <Label>{L('العميل *', 'Customer *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={L('اختر العميل', 'Select Customer')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* التاريخان جنبًا إلى جنب على الجوال */}
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="quotationDate">{L('تاريخ العرض', 'Quotation Date')}</Label>
                  <DatePicker id="quotationDate" value={quotationDate} onChange={setQuotationDate} disabled={viewOnly} />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="validUntil">{L('صالح حتى', 'Valid Until')}</Label>
                  <DatePicker id="validUntil" value={validUntil} onChange={setValidUntil} disabled={viewOnly} />
                </div>

                {/* ✅ الحالة — نصف العرض فقط على الجوال (أضيق) */}
                <div className="space-y-1.5 col-span-1">
                  <Label>{L('الحالة', 'Status')}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {MANUAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
                      ))}
                      {status === 'converted' && (
                        <SelectItem value="converted" disabled>{STATUS_LABELS.converted[isRTL ? 'ar' : 'en']}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ===== البنود: بطاقات على الجوال (< md) ===== */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{L('البنود', 'Line Items')}</span>
                  <span className="text-xs text-muted-foreground px-2">{lines.length} {L('بند', 'items')}</span>
                </div>

                {lines.map((l, idx) => {
                  const qty = Number(l.quantity) || 0
                  const price = Number(l.unitPrice) || 0
                  const disc = Number(l.discountAmount) || 0
                  const taxRate = Number(l.taxRate) || 0
                  const lineTotal = (qty * price - disc) * (1 + taxRate / 100)
                  return (
                    <Card key={l.key} className="p-3 space-y-3 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{L('بند', 'Item')} #{idx + 1}</span>
                        <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600 shrink-0" onClick={() => removeLine(l.key)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">{L('المنتج', 'Product')}</Label>
                        <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                          <SelectTrigger className="h-9 w-full"><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
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
                          <Input className="h-9 text-start tabular-nums" type="number" step="1" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('السعر', 'Price')}</Label>
                          <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الخصم', 'Discount')}</Label>
                          <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الضريبة %', 'Tax %')}</Label>
                          <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="text-xs text-muted-foreground">{L('إجمالي البند', 'Line Total')}</span>
                        <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                      </div>
                    </Card>
                  )
                })}

                <Button type="button" size="sm" variant="outline" onClick={addLine} className="w-full gap-1.5">
                  <Plus className="size-3.5" /> {L('إضافة بند', 'Add Item')}
                </Button>
              </div>

              {/* ===== البنود: جدول على التابلت/الديسكتوب (md+) مع تمرير أفقي آمن ===== */}
              <Card className="rounded-lg overflow-hidden hidden md:block">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="ps-3 min-w-[200px]">{L('المنتج', 'Product')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الكمية', 'Qty')}</TableHead>
                        <TableHead className="text-end num-cell w-28">{L('السعر', 'Price')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الخصم', 'Discount')}</TableHead>
                        <TableHead className="text-end num-cell w-24">{L('الضريبة %', 'Tax %')}</TableHead>
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
                                <SelectTrigger className="h-9 w-full min-w-[200px]"><SelectValue placeholder={L('اختر المنتج', 'Select Product')} /></SelectTrigger>
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
                              <Input className="h-9 text-start tabular-nums" type="number" step="1" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.1" inputMode="decimal" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-end num-cell">
                              <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                            </TableCell>
                            <TableCell>
                              <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => removeLine(l.key)}>
                                <Trash2 className="size-4" />
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
                </div>
              </Card>

              {/* ===== ملخّص الإجماليات: عمود واحد على الجوال، 3 على sm+ ===== */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-green-200 dark:border-green-900">
                  <p className="text-xs text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.subtotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-muted-200 dark:border-muted-900">
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
            </fieldset>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t shrink-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto sm:min-w-25" onClick={() => { setAddOpen(false); resetForm() }}>
              {viewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>
            {!viewOnly && (
              <Button type="button" className="w-full sm:w-auto sm:min-w-25" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending
                  ? L('جاري الحفظ...', 'Saving...')
                  : editingId ? L('حفظ التغييرات', 'Save Changes') : L('إنشاء', 'Create')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ تأكيد الحذف ============ */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="size-5" /> {L('حذف عرض السعر', 'Delete Quotation')}
            </DialogTitle>
            <DialogDescription>
              {L(
                `هل أنت متأكد من حذف عرض السعر لا يمكن التراجع عن هذا الإجراء.`,
                `Are you sure you want to delete quotationء This action cannot be undone.`,
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{L('إلغاء', 'Cancel')}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? L('جاري الحذف...', 'Deleting...') : L('حذف', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}