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
import { DatePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Undo2, Plus, Trash2, Printer, CheckCircle2, Truck, Clock, Coins,
  Download, FileSpreadsheet, FileText, FileDown, Eye, History, AlertTriangle,
  FileCheck, ShieldAlert, Lock, ArrowRightLeft, Info, Receipt, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface InvoiceLine { id: string; productId: string; quantity: number; unitCost: number }
interface Invoice { id: string; code: string; total: number; partnerId: string; lines?: InvoiceLine[] }
interface Product { id: string; sku: string; nameAr: string; nameEn?: string; costPrice: number }

interface JournalLine {
  id?: string
  accountCode?: string
  debit: number
  credit: number
  description?: string
  account?: { code: string; nameAr: string; nameEn?: string }
}

interface JournalEntry {
  id: string
  entryNumber: string
  postingDate: string
  description?: string
  lines: JournalLine[]
}

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
  journalEntryId?: string | null
  journalEntry?: JournalEntry | null
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
  debited: { ar: 'مُصدَر إشعار مدين / مرحّل', en: 'Debited / Posted' },
  closed: { ar: 'مغلق', en: 'Closed' },
  cancelled: { ar: 'ملغي / معكوس', en: 'Cancelled / Reversed' },
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

  // نافذة الإضافة/التعديل/العرض
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingReturn, setEditingReturn] = useState<PurchaseReturn | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)

  // نافذة الإشعار المدين/الدائن
  const [debitNoteReturn, setDebitNoteReturn] = useState<PurchaseReturn | null>(null)

  const isEditMode = editingId !== null
  const isDraft = !isEditMode || editingStatus === 'draft'
  const isCancelled = editingStatus === 'cancelled' || editingStatus === 'reversed'
  const isPosted = isEditMode && !isDraft && !isCancelled
  const isReadOnly = !isDraft

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

  const { data: detailedReturnData } = useQuery<{ data: PurchaseReturn }>({
    queryKey: ['purchase-return-detail', debitNoteReturn?.id],
    queryFn: async () => {
      if (!debitNoteReturn?.id) return null
      const r = await fetch(`/api/erp/purchase-returns/${debitNoteReturn.id}`)
      if (!r.ok) return null
      return r.json()
    },
    enabled: !!debitNoteReturn?.id,
  })

  const fullDebitNoteReturn = detailedReturnData?.data ?? debitNoteReturn

  const returns = data?.data ?? []
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const products = productsData?.data ?? []

  const stats = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'shipped').length,
    shipped: returns.filter((r) => r.status === 'shipped').length,
    totalValue: returns.reduce((s, r) => s + r.total, 0),
  }), [returns])

  // Form State
  const [partnerId, setPartnerId] = useState('')
  const [originalInvoiceId, setOriginalInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitCost: '0', taxRate: '15' },
  ])

  // Selected original invoice details for quantity validation
  const selectedOriginalInvoice = useMemo(() => {
    return invoices.find((i) => i.id === originalInvoiceId)
  }, [invoices, originalInvoiceId])

  const maxQtyForProduct = (prodId: string) => {
    if (!selectedOriginalInvoice || !selectedOriginalInvoice.lines) return null
    const invLine = selectedOriginalInvoice.lines.find((l) => l.productId === prodId)
    return invLine ? invLine.quantity : null
  }

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
        // If linked to an invoice, set default cost and max quantity if applicable
        if (selectedOriginalInvoice && selectedOriginalInvoice.lines) {
          const invLine = selectedOriginalInvoice.lines.find((il) => il.productId === value)
          if (invLine) {
            next.unitCost = String(invLine.unitCost)
          }
        }
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
    setEditingReturn(null)
    setEditingStatus(null)
    setPartnerId(''); setOriginalInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason(''); setNotes(''); setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', taxRate: '15' }])
  }

  /** فتح النافذة لإنشاء مرتجع جديد */
  const openAdd = () => {
    resetForm()
    setDialogOpen(true)
  }

  /** فتح النافذة لتعديل / عرض مرتجع قائم عند النقر على الصف */
  const openEdit = (r: PurchaseReturn) => {
    setEditingId(r.id)
    setEditingReturn(r)
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
    mutationFn: async ({ shouldPost = false }: { shouldPost?: boolean } = {}) => {
      if (!partnerId) throw new Error(L('يرجى اختيار المورد أولاً', 'Please select a supplier'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل للمرتجع', 'Add at least one line item'))

      // Validate quantities against original invoice if linked
      if (selectedOriginalInvoice && selectedOriginalInvoice.lines) {
        for (const l of validLines) {
          const maxQ = maxQtyForProduct(l.productId)
          const qtyVal = Number(l.quantity) || 0
          if (maxQ !== null && qtyVal > maxQ) {
            const p = products.find((pr) => pr.id === l.productId)
            const pName = productName(p) || l.productId
            throw new Error(
              L(
                `الكمية المرجعة (${qtyVal}) للمنتج (${pName}) تتجاوز الكمية المشتراة في الفاتورة الأصلية (${maxQ})`,
                `Returned quantity (${qtyVal}) for product (${pName}) exceeds invoice quantity (${maxQ})`
              )
            )
          }
        }
      }

      const payload = {
        partnerId,
        originalInvoiceId: originalInvoiceId || undefined,
        date,
        reason,
        notes,
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
        throw new Error(err?.error?.message ?? err?.error ?? L('فشل الحفظ', 'Failed to save'))
      }

      const resData = await r.json()
      const returnRecordId = resData.data?.id ?? editingId

      // If user selected "Update & Post" (تحديث وترحيل), immediately transition to debited/posted
      if (shouldPost && returnRecordId) {
        const actionRes = await fetch(`/api/erp/purchase-returns/${returnRecordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'debit' }),
        })
        if (!actionRes.ok) {
          const actionErr = await actionRes.json().catch(() => ({}))
          throw new Error(actionErr?.error?.message ?? L('تمت عملية الحفظ ولكن تعذر الترحيل تلقائياً', 'Saved, but automatic posting failed'))
        }
        return { ...resData, posted: true }
      }

      return resData
    },
    onSuccess: (res: any) => {
      if (res?.posted) {
        toast.success(L('تم تحديث وترحيل مرتجع المشتريات بنجاح وإنشاء الأثر المالي والرقابي', 'Purchase return updated and posted successfully'))
      } else {
        toast.success(
          editingId
            ? L('تم تحديث المسودة بنجاح', 'Draft updated successfully')
            : L('تم إنشاء مسودة المرتجع بنجاح', 'Draft return created successfully')
        )
      }
      qc.invalidateQueries({ queryKey: ['purchase-returns'] })
      closeDialog()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء المعالجة', 'An error occurred during processing')),
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
      toast.success(L('تم تنفيذ الإجراء بنجاح', 'Action completed successfully'))
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
          <div class="status">${statusLabel(r.status)}</div>
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

  const handlePrintDebitNote = (r: PurchaseReturn, je?: JournalEntry | null) => {
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
          <div class="type" style="color:#059669; font-weight:bold;">${L('إشعار مدين رسمي', 'OFFICIAL DEBIT NOTE')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.date)}</div>
          ${r.journalEntryId ? `<div class="sub" style="font-weight:bold; color:#0284c7;">${L('رقم القيد المحاسبي:', 'JE Code:')} ${je?.entryNumber || r.journalEntryId}</div>` : ''}
        </div>
      </div>
      <div class="party">
        <div class="label">${L('صادر لصالح المورد', 'Issued To Supplier')}</div>
        <div class="name">${partnerName(r.partner)}</div>
        <div class="sub">${L('رمز المورد', 'Supplier Code')}: ${r.partner?.code ?? ''}</div>
        ${origInv ? `<div class="sub">${L('مرتبط بالفاتورة الأصلية', 'Linked Invoice')}: ${origInv.code}</div>` : ''}
        ${r.reason ? `<div class="sub">${L('سبب الإصدار', 'Reason')}: ${r.reason}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج المرجع', 'Returned Product')}</th>
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
      ${je && je.lines && je.lines.length > 0 ? `
        <div style="margin-top:20px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e293b;">${L('بيانات القيد المحاسبي والأثر المالي (General Ledger Journal Entry)', 'General Ledger Journal Entry')}</h4>
          <table style="margin:0; font-size: 11px; border-collapse: collapse; width:100%;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:6px; border:1px solid #cbd5e1; text-align:start;">${L('رمز الحساب', 'Account Code')}</th>
                <th style="padding:6px; border:1px solid #cbd5e1; text-align:start;">${L('اسم الحساب / البيان', 'Account Name / Line Description')}</th>
                <th style="padding:6px; border:1px solid #cbd5e1; text-align:center;">${L('مدين (Debit)', 'Debit')}</th>
                <th style="padding:6px; border:1px solid #cbd5e1; text-align:center;">${L('دائن (Credit)', 'Credit')}</th>
              </tr>
            </thead>
            <tbody>
              ${je.lines.map((line) => `
                <tr>
                  <td style="padding:6px; border:1px solid #cbd5e1; font-family:monospace;">${line.accountCode || line.account?.code || '—'}</td>
                  <td style="padding:6px; border:1px solid #cbd5e1;">${isRTL ? (line.account?.nameAr || line.description) : (line.account?.nameEn || line.account?.nameAr || line.description)}</td>
                  <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:${line.debit > 0 ? '#0284c7' : 'inherit'};">${line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                  <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:${line.credit > 0 ? '#059669' : 'inherit'};">${line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      <div class="totals">
        <div class="row"><span>${L('المجموع الفرعي:', 'Subtotal:')}</span><span>${formatCurrency(r.subtotal)}</span></div>
        <div class="row"><span>${L('ضريبة القيمة المضافة:', 'VAT Total:')}</span><span>${formatCurrency(r.taxTotal)}</span></div>
        <div class="row grand" style="background:#ecfdf5; color:#065f46;"><span>${L('إجمالي قيمة الإشعار المدين:', 'Debit Note Total:')}</span><span>${formatCurrency(r.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب المسؤول', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير المالي', 'Financial Controller')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('توقيع واستلام المورد', 'Supplier Signature')}</div></div>
      </div>
    `
    printHTML(html, `${L('إشعار مدين', 'Debit Note')} ${r.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

  return (
    <ModuleShell
      title={t('module.purchase-returns')}
      description={L(
        'إدارة مرتجعات المشتريات مع ضبط رقابي ومحاسبي صارم وإصدار الإشعارات المدينة',
        'Manage purchase returns with strict accounting controls and debit note issuance'
      )}
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز المرتجع أو السبب أو المورد...', 'Search by return code, reason or supplier...')}
      onAdd={openAdd}
      addLabel={L('مرتجع جديد', 'New Return')}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-300 dark:border-slate-700">
              <Download className="size-4 text-slate-600 dark:text-slate-400" />
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-2">
        <KpiCard title={L('إجمالي المرتجعات', 'Total Returns')} value={formatInt(stats.total)} icon={<Undo2 className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'In Progress')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('تم الشحن', 'Shipped')} value={formatInt(stats.shipped)} icon={<Truck className="size-5" />} accent="sky" />
        <KpiCard title={L('إجمالي القيمة', 'Total Value')} value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      {/* جدول مرتجعات المشتريات — رأس ثابت + تمرير للصفوف فقط + نقر الصف للتعديل/العرض */}
      <Card className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain scrollbar-thin"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[900px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[24%]" />{/* المورد */}
              <col className="w-[14%]" />{/* الفاتورة الأصلية */}
              <col className="w-[13%]" />{/* التاريخ */}
              <col className="w-[13%]" />{/* الإجمالي */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[12%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الفاتورة الأصلية', 'Original Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
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
                const isCancelledItem = r.status === 'cancelled' || r.status === 'reversed'

                return (
                  <TableRow
                    key={r.id}
                    onClick={() => openEdit(r)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/60"
                    title={L('اضغط لفتح شاشة التعديل أو العرض', 'Click to open edit or view screen')}
                  >
                    {/* الرمز */}
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" dir="ltr" title={r.code}>
                      {r.code}
                    </TableCell>

                    {/* المورد */}
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200 border-b truncate" title={supplier}>
                      {supplier}
                    </TableCell>

                    {/* الفاتورة الأصلية */}
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400 border-b truncate" dir="ltr" title={invoiceCode}>
                      {invoiceCode}
                    </TableCell>

                    {/* التاريخ */}
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-center whitespace-nowrap border-b">
                      {formatDate(r.date)}
                    </TableCell>

                    {/* الإجمالي */}
                    <TableCell className="text-center whitespace-nowrap border-b">
                      <span className="num tabular-nums font-bold text-slate-900 dark:text-slate-100" dir="ltr">{formatCurrency(r.total)}</span>
                    </TableCell>

                    {/* الحالة */}
                    <TableCell className="text-center border-b">
                      <div className="flex justify-center">
                        <StatusBadge status={r.status} />
                      </div>
                    </TableCell>

                    {/* إجراءات */}
                    <TableCell className="text-end pe-4 border-b">
                      <div
                        className="flex items-center justify-end gap-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isCancelledItem ? (
                          /* للمرتجع الملغي: تظهر أيقونة المعاينة / السجل الرقابي حصراً */
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title={L('معاينة المرتجع الملغي والسجل الرقابي', 'Audit view for cancelled return')}
                            onClick={() => openEdit(r)}
                          >
                            <History className="size-4" />
                          </Button>
                        ) : (
                          <>
                            {r.status === 'draft' && (
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'approve' })}>
                                <CheckCircle2 className="size-3.5" /> {L('اعتماد', 'Approve')}
                              </Button>
                            )}
                            {r.status === 'approved' && (
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'ship' })}>
                                <Truck className="size-3.5" /> {L('شحن', 'Ship')}
                              </Button>
                            )}
                            {r.status === 'shipped' && (
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'debit' })}>
                                <Coins className="size-3.5" /> {L('إشعار مدين', 'Debit Note')}
                              </Button>
                            )}
                            {r.status === 'debited' && (
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-slate-600 hover:text-slate-800 dark:hover:bg-slate-800" onClick={() => setDebitNoteReturn(r)}>
                                <Receipt className="size-3.5 text-emerald-600" /> {L('عرض الإشعار', 'View Note')}
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="size-8 shrink-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handlePrint(r)}>
                              <Printer className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* نافذة الإضافة / التعديل / العرض الرقابية (Modal) */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true) }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl">
          <DialogHeader className="p-4 sm:p-5 border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-lg shrink-0",
                isCancelled
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                  : isPosted
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                    : "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
              )}>
                {isCancelled ? <ShieldAlert className="size-5" /> : isPosted ? <Lock className="size-5" /> : <Undo2 className="size-5" />}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {isCancelled
                    ? L('عرض مرتجع مشتريات ملغي', 'View Cancelled Purchase Return')
                    : isPosted
                      ? L('عرض مرتجع مشتريات (قراءة فقط)', 'View Purchase Return (Read-Only)')
                      : isEditMode
                        ? L('تعديل مرتجع مشتريات', 'Edit Purchase Return')
                        : L('إنشاء مرتجع مشتريات جديد', 'New Purchase Return')}
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isCancelled
                    ? L('هذا المرتجع ملغي/معكوس ولا يمكن إجراء أي عمليات عليه', 'This return is cancelled/reversed and no further action can be taken')
                    : isPosted
                      ? L(`كود المرتجع: ${editingReturn?.code ?? ''} — مرحّل ومحمي من التعديل/الحذف`, `Code: ${editingReturn?.code ?? ''} — Posted and protected from editing/deletion`)
                      : isEditMode
                        ? L(`كود المرتجع: ${editingReturn?.code ?? ''} — يمكنك تعديل الحقول والتحديث أو الترحيل`, `Code: ${editingReturn?.code ?? ''} — You can edit fields and update or post`)
                        : L('قم بتعبئة بيانات مرتجع المشتريات وإدراج البنود', 'Fill in purchase return details and item lines')}
                </p>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
            {/* شارة التنبيه الحمراء للمرتجع الملغي */}
            {isCancelled && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 flex items-start gap-3 shadow-xs">
                <ShieldAlert className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm text-rose-900 dark:text-rose-200">
                    {L('شارة تنبيه: مرتجع مشتريات ملغي/معكوس', 'Warning: Cancelled / Reversed Purchase Return')}
                  </div>
                  <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                    {L(
                      'تم إلغاء أو عكس هذا المرتجع سابقاً في النظام. لا يُسمح بإجراء أي تعديلات مادية أو مالية على هذا السجل لضمان سلامة السجل الرقابي والقيود المحاسبية.',
                      'This return has been previously cancelled or reversed in the system. No material or financial modifications are allowed.'
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* تنبيه وضع القراءة فقط للمرتجعات المرحّلة */}
            {isPosted && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-2.5 shadow-xs">
                <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {L(
                    `هذا المرتجع بالحالة (${statusLabel(editingStatus ?? '')}) ومرحّل ماليين. التعديل والحذف محظور تماماً بحسب القواعد المحاسبية.`,
                    `Status is (${statusLabel(editingStatus ?? '')}) and posted. Modifications are strictly forbidden.`
                  )}
                </span>
              </div>
            )}

            {/* الحقول الأساسية */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('المورد *', 'Supplier *')}
                </Label>
                <Select value={partnerId} onValueChange={setPartnerId} disabled={isReadOnly}>
                  <SelectTrigger className={cn("h-10 text-xs sm:text-sm bg-white dark:bg-slate-900", isReadOnly && "cursor-not-allowed opacity-80")}>
                    <SelectValue placeholder={L('اختر المورد', 'Select supplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span dir="ltr" className="font-mono text-xs text-blue-600 dark:text-blue-400 me-2">[{p.code}]</span> {partnerName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('الفاتورة الأصلية (اختياري)', 'Original Invoice (Optional)')}
                </Label>
                <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId} disabled={isReadOnly}>
                  <SelectTrigger className={cn("h-10 text-xs sm:text-sm bg-white dark:bg-slate-900", isReadOnly && "cursor-not-allowed opacity-80")}>
                    <SelectValue placeholder={L('اختياري', 'Optional')} />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices
                      .filter((i) => !partnerId || i.partnerId === partnerId)
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          <span dir="ltr" className="font-mono text-xs me-2">[{i.code}]</span> — {formatCurrency(i.total)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label htmlFor="date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('تاريخ المرتجع *', 'Return Date *')}
                </Label>
                <DatePicker
                  id="date"
                  value={date}
                  onChange={setDate}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* سبب الإرجاع */}
            <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
              <Label htmlFor="reason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {L('سبب الإرجاع', 'Return Reason')}
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isReadOnly}
                placeholder={L('مثال: تالف، مخالف للمواصفات المعيارية، انتهاء الصلاحية...', 'e.g., Damaged, non-conforming to specifications, expired...')}
                className={cn("h-10 text-xs sm:text-sm bg-white dark:bg-slate-900", isReadOnly && "cursor-not-allowed opacity-80")}
              />
            </div>

            {/* جدول المنتجات والبنود */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {L('جدول المنتجات والبنود المرجعة', 'Return Line Items Table')}
                </Label>
                {selectedOriginalInvoice && (
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                    {L(`مرتبط بالفاتورة الأصلية: ${selectedOriginalInvoice.code}`, `Linked to Invoice: ${selectedOriginalInvoice.code}`)}
                  </span>
                )}
              </div>

              <Card className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="overflow-x-auto scrollbar-thin">
                  <Table className="min-w-[620px]">
                    <TableHeader>
                      <TableRow className="bg-slate-100/70 dark:bg-slate-800/70 border-b">
                        <TableHead className="ps-3 min-w-[200px] text-xs font-bold text-slate-700 dark:text-slate-300">{L('المنتج *', 'Product *')}</TableHead>
                        <TableHead className="text-start num-cell w-24 text-xs font-bold text-slate-700 dark:text-slate-300">{L('الكمية', 'Qty')}</TableHead>
                        <TableHead className="text-start num-cell w-28 text-xs font-bold text-slate-700 dark:text-slate-300">{L('التكلفة', 'Cost')}</TableHead>
                        <TableHead className="text-start num-cell w-24 text-xs font-bold text-slate-700 dark:text-slate-300">{L('الضريبة %', 'Tax %')}</TableHead>
                        <TableHead className="text-start num-cell w-28 text-xs font-bold text-slate-700 dark:text-slate-300">{L('الإجمالي', 'Total')}</TableHead>
                        <TableHead className="w-12 pe-3"></TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {lines.map((l) => {
                        const qty = Number(l.quantity) || 0
                        const cost = Number(l.unitCost) || 0
                        const taxRate = Number(l.taxRate) || 0
                        const lineSub = qty * cost
                        const lineTax = lineSub * (taxRate / 100)
                        const lineTotal = lineSub + lineTax

                        const maxQ = maxQtyForProduct(l.productId)
                        const isExceeded = maxQ !== null && qty > maxQ

                        return (
                          <TableRow key={l.key} className="border-b border-slate-100 dark:border-slate-800/50">
                            <TableCell className="ps-3 py-2">
                              <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)} disabled={isReadOnly}>
                                <SelectTrigger className={cn("h-9 text-xs bg-transparent", isReadOnly && "cursor-not-allowed")}>
                                  <SelectValue placeholder={L('اختر المنتج', 'Select product')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      <span dir="ltr" className="font-mono text-xs me-2 text-slate-500">[{p.sku}]</span> {productName(p)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell className="text-start num-cell py-2">
                              <div className="space-y-0.5">
                                <Input
                                  className={cn(
                                    "h-9 text-xs text-start tabular-nums font-semibold",
                                    isReadOnly && "cursor-not-allowed",
                                    isExceeded && "border-rose-500 focus-visible:ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                                  )}
                                  type="number"
                                  step="1"
                                  min="1"
                                  dir="ltr"
                                  disabled={isReadOnly}
                                  value={l.quantity}
                                  onChange={(e) => updateLine(l.key, 'quantity', e.target.value)}
                                />
                                {maxQ !== null && (
                                  <div className={cn("text-[10px] truncate", isExceeded ? "text-rose-600 font-bold" : "text-slate-500")}>
                                    {L(`أقصى كمية: ${maxQ}`, `Max Qty: ${maxQ}`)}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-start num-cell py-2">
                              <Input
                                className={cn("h-9 text-xs text-start tabular-nums font-mono", isReadOnly && "cursor-not-allowed")}
                                type="number"
                                step="0.01"
                                dir="ltr"
                                disabled={isReadOnly}
                                value={l.unitCost}
                                onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)}
                              />
                            </TableCell>

                            <TableCell className="text-start num-cell py-2">
                              <Input
                                className={cn("h-9 text-xs text-start tabular-nums font-mono", isReadOnly && "cursor-not-allowed")}
                                type="number"
                                step="0.1"
                                dir="ltr"
                                disabled={isReadOnly}
                                value={l.taxRate}
                                onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)}
                              />
                            </TableCell>

                            <TableCell className="text-start num-cell py-2">
                              <span className="num font-bold text-xs tabular-nums text-slate-900 dark:text-slate-100" dir="ltr">
                                {formatCurrency(lineTotal)}
                              </span>
                            </TableCell>

                            <TableCell className="pe-3 py-2">
                              {!isReadOnly && (
                                <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => removeLine(l.key)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>

                    <TableFooter className="bg-slate-50 dark:bg-slate-900 border-t">
                      <TableRow>
                        <TableCell colSpan={3} className="ps-3 py-3">
                          {!isReadOnly && (
                            <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5 text-xs bg-white dark:bg-slate-800">
                              <Plus className="size-3.5 text-blue-600" /> {L('إضافة بند جديد', 'Add Item')}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-end num-cell font-bold text-xs text-slate-700 dark:text-slate-300">
                          {L('الإجمالي الكلي:', 'Grand Total:')}
                        </TableCell>
                        <TableCell className="text-start num-cell py-3">
                          <span className="num font-extrabold text-sm tabular-nums text-blue-600 dark:text-blue-400" dir="ltr">
                            {formatCurrency(computed.total)}
                          </span>
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Card>
            </div>

            {/* الملاحظات */}
            <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {L('ملاحظات إضافية', 'Additional Notes')}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={isReadOnly}
                placeholder={L('ملاحظات المرتجع...', 'Additional return notes...')}
                className={cn("text-xs bg-white dark:bg-slate-900 resize-none", isReadOnly && "cursor-not-allowed opacity-80")}
              />
            </div>
          </DialogBody>

          {/* أزرار الإجراءات السفلى في Modal */}
          <DialogFooter className="p-4 sm:p-5 border-t bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 items-center justify-end">
            {isReadOnly ? (
              /* وضع القراءة فقط: إظهار أزرار الطباعة والإشعار وإغلاق */
              <div className="w-full flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
                <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto text-xs">
                  {L('إغلاق', 'Close')}
                </Button>

                <div className="w-full sm:w-auto flex items-center gap-2">
                  {editingReturn && (
                    <Button type="button" variant="outline" className="w-full sm:w-auto text-xs gap-1.5 text-slate-700 dark:text-slate-300" onClick={() => handlePrint(editingReturn)}>
                      <Printer className="size-4" /> {L('طباعة المرتجع', 'Print Return')}
                    </Button>
                  )}
                  {editingReturn && (editingReturn.status === 'debited' || editingReturn.status === 'closed' || editingReturn.journalEntryId) && (
                    <Button type="button" className="w-full sm:w-auto text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setDebitNoteReturn(editingReturn)}>
                      <Receipt className="size-4" /> {L('عرض الإشعار المدين المرتبط', 'View Associated Debit Note')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* وضع التعديل للمسودة: زر إلغاء، تحديث، وتحديث وترحيل */
              <div className="w-full flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
                <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto text-xs">
                  {L('إلغاء', 'Cancel')}
                </Button>

                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ shouldPost: false })}
                    className="w-full sm:w-auto text-xs font-semibold border-slate-300 dark:border-slate-700"
                  >
                    {saveMutation.isPending
                      ? L('جاري الحفظ...', 'Saving...')
                      : L('تحديث (مسودة)', 'Update (Draft)')}
                  </Button>

                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ shouldPost: true })}
                    className="w-full sm:w-auto text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    <Check className="size-4" />
                    {saveMutation.isPending
                      ? L('جاري التحديث والترحيل...', 'Updating & Posting...')
                      : L('تحديث وترحيل', 'Update & Post')}
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة عرض تفاصيل الإشعار المدين/الدائن المرتبط */}
      <Dialog open={debitNoteReturn !== null} onOpenChange={(open) => { if (!open) setDebitNoteReturn(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Receipt className="size-5 text-emerald-600" />
              {L('إشعار مدين رسمي للمشتريات', 'Official Purchase Debit Note')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 py-4 text-xs">
            {fullDebitNoteReturn && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-3 text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{L('الحالة: مُصدَر ومُرحّل بالكامل', 'Status: Debited & Fully Posted')}</div>
                    <div className="text-[11px] opacity-80">{L('تم خصم المبلغ من حساب المورد في الذمم الدائنة', 'Amount debited from supplier AP balance')}</div>
                  </div>
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>

                <div className="space-y-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{L('رمز المرتجع / الإشعار:', 'Return / Debit Note Code:')}</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{fullDebitNoteReturn.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{L('المورد:', 'Supplier:')}</span>
                    <span className="font-bold">{partnerName(fullDebitNoteReturn.partner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{L('التاريخ:', 'Date:')}</span>
                    <span className="font-mono">{formatDate(fullDebitNoteReturn.date)}</span>
                  </div>
                  {fullDebitNoteReturn.journalEntryId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{L('معرّف القيد المحاسبي:', 'Journal Entry ID:')}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {fullDebitNoteReturn.journalEntry?.entryNumber || fullDebitNoteReturn.journalEntryId}
                      </span>
                    </div>
                  )}
                </div>

                {/* تفاصيل القيد اليومي المالي */}
                {fullDebitNoteReturn.journalEntry && fullDebitNoteReturn.journalEntry.lines && (
                  <div className="space-y-2 pt-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>{L('توزيع القيد اليومي (الأثر المالي):', 'Journal Entry Lines:')}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {fullDebitNoteReturn.journalEntry.entryNumber}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <Table className="text-[11px]">
                        <TableHeader className="bg-slate-100 dark:bg-slate-800">
                          <TableRow>
                            <TableHead className="py-1.5 ps-2">{L('الحساب', 'Account')}</TableHead>
                            <TableHead className="py-1.5 text-center">{L('مدين', 'Debit')}</TableHead>
                            <TableHead className="py-1.5 text-center">{L('دائن', 'Credit')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fullDebitNoteReturn.journalEntry.lines.map((l: any, idx: number) => (
                            <TableRow key={l.id || idx} className="border-b border-slate-100 dark:border-slate-800">
                              <TableCell className="py-1.5 ps-2 font-medium">
                                <div className="font-mono text-[10px] text-slate-500">{l.accountCode || l.account?.code}</div>
                                <div>{isRTL ? (l.account?.nameAr || l.description) : (l.account?.nameEn || l.account?.nameAr || l.description)}</div>
                              </TableCell>
                              <TableCell className="py-1.5 text-center font-bold text-blue-600 dark:text-blue-400">
                                {l.debit > 0 ? formatCurrency(l.debit) : '—'}
                              </TableCell>
                              <TableCell className="py-1.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                {l.credit > 0 ? formatCurrency(l.credit) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    <span>{L('إجمالي قيمة الإشعار المدين:', 'Debit Note Total:')}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(fullDebitNoteReturn.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="border-t pt-3 flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setDebitNoteReturn(null)}>
              {L('إغلاق', 'Close')}
            </Button>
            {fullDebitNoteReturn && (
              <Button size="sm" variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => handlePrintDebitNote(fullDebitNoteReturn, fullDebitNoteReturn.journalEntry)}>
                <Printer className="size-4" /> {L('طباعة الإشعار المدين', 'Print Debit Note')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
