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
import { cn } from '@/lib/utils'
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Banknote, Printer, Hash, TrendingUp, CreditCard, Download, FileSpreadsheet, FileText, FileDown,
  MoreHorizontal, CheckCircle2, XCircle, Trash2, Eye, RotateCcw, ShieldAlert, AlertTriangle, ArrowRightLeft,
  ArrowUpRight, ArrowDownLeft, Lock
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; paid: number; partnerId: string }
interface PurchasePayment {
  id: string
  code: string
  partnerId: string
  invoiceId?: string | null
  amount: number
  paymentDate: string
  method: string
  reference?: string
  status: string
  notes?: string
  journalEntryId?: string | null
  partner?: Partner
}

const METHOD_OPTIONS = [
  { value: 'cash', ar: 'نقد', en: 'Cash' },
  { value: 'card', ar: 'بطاقة', en: 'Card' },
  { value: 'transfer', ar: 'تحويل', en: 'Bank Transfer' },
  { value: 'check', ar: 'شيك', en: 'Check' },
]

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  posted: { ar: 'مُرحّل', en: 'Posted' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  reversed: { ar: 'معكوس', en: 'Reversed' },
}

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 44

export function PurchasePaymentsModule() {
  const { t, isRTL } = useT()
  const qc = useQueryClient()

  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const methodLabel = (m: string) => {
    const opt = METHOD_OPTIONS.find((o) => o.value === m)
    return opt ? (isRTL ? opt.ar : opt.en) : m
  }
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? ''

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PurchasePayment | null>(null)

  // Reversal Dialog State
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseTarget, setReverseTarget] = useState<PurchasePayment | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<PurchasePayment | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchasePayment[]; meta: any }>({
    queryKey: ['purchase-payments', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-payments?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['purchase-invoices-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const payments = (data?.data ?? []).filter((p) => filterMethod === 'all' || p.method === filterMethod)
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = payments.filter((p) => {
      const d = new Date(p.paymentDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const byMethod: Record<string, number> = {}
    for (const p of thisMonth) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
    const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]
    return {
      monthTotal: thisMonth.reduce((s, p) => s + p.amount, 0),
      count: thisMonth.length,
      avg: thisMonth.length > 0 ? thisMonth.reduce((s, p) => s + p.amount, 0) / thisMonth.length : 0,
      topMethod: topMethod ? methodLabel(topMethod[0]) : '—',
    }
  }, [payments, isRTL])

  // Form Fields
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('0')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // Determine if current modal view is strictly read-only
  const isViewOnly = useMemo(() => {
    if (!selectedPayment) return false
    return selectedPayment.status === 'posted' || selectedPayment.status === 'reversed' || selectedPayment.status === 'cancelled'
  }, [selectedPayment])

  const openCreateModal = () => {
    setSelectedPayment(null)
    setPartnerId('')
    setInvoiceId('')
    setAmount('0')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setMethod('cash')
    setReference('')
    setNotes('')
    setModalOpen(true)
  }

  const openPaymentModal = (payment: PurchasePayment) => {
    setSelectedPayment(payment)
    setPartnerId(payment.partnerId)
    setInvoiceId(payment.invoiceId || '')
    setAmount(String(payment.amount))
    setPaymentDate(payment.paymentDate ? payment.paymentDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setMethod(payment.method || 'cash')
    setReference(payment.reference || '')
    setNotes(payment.notes || '')
    setModalOpen(true)
  }

  // Calculate remaining balance for selected purchase invoice
  const linkedInvoice = useMemo(() => {
    return invoices.find((i) => i.id === invoiceId)
  }, [invoices, invoiceId])

  const remainingInvoiceDue = useMemo(() => {
    if (!linkedInvoice) return 0
    // If editing existing payment, add back its previous contribution to calculate true remaining capacity
    const currentContrib = selectedPayment && selectedPayment.invoiceId === linkedInvoice.id ? selectedPayment.amount : 0
    return Math.max(0, linkedInvoice.total - linkedInvoice.paid + currentContrib)
  }, [linkedInvoice, selectedPayment])

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (shouldPost: boolean) => {
      if (!partnerId) throw new Error(L('اختر المورد *', 'Please select a supplier *'))
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر *', 'Amount must be greater than zero *'))

      // Validate against invoice remaining balance
      if (linkedInvoice && amt > remainingInvoiceDue + 0.001) {
        throw new Error(
          L(
            `المبلغ أدناه (${formatCurrency(amt)}) يتجاوز المتبقي المستحق على الفاتورة المختارة (${formatCurrency(remainingInvoiceDue)})`,
            `Entered amount (${formatCurrency(amt)}) exceeds remaining due on selected invoice (${formatCurrency(remainingInvoiceDue)})`
          )
        )
      }

      const payload = {
        partnerId,
        invoiceId: invoiceId || undefined,
        amount: amt,
        paymentDate,
        method,
        reference,
        notes,
        status: shouldPost ? 'posted' : 'draft',
      }

      const isEdit = !!selectedPayment
      const url = isEdit ? `/api/erp/purchase-payments/${selectedPayment.id}` : '/api/erp/purchase-payments'
      const httpMethod = isEdit ? 'PUT' : 'POST'

      const r = await fetch(url, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل حفظ سند الصرف', 'Save failed'))
      }
      return r.json()
    },
    onSuccess: (_, shouldPost) => {
      toast.success(
        shouldPost
          ? L('تم ترحيل سند الصرف بنجاح والأثر المحاسبي مسجّل', 'Payment voucher posted successfully')
          : L('تم حفظ مسودة سند الصرف بنجاح', 'Payment voucher draft saved successfully')
      )
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: ['suppliers-for-pp'] })
      setModalOpen(false)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء حفظ السند', 'An error occurred while saving')),
  })

  // Status Action Mutation (Draft -> Post / Cancel)
  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'post' | 'cancel' }) => {
      const r = await fetch(`/api/erp/purchase-payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل تعديل حالة السند', 'Failed to update voucher status'))
      }
      return r.json()
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === 'post'
          ? L('تم ترحيل السند وتحديث كشف حساب المورد بنجاح', 'Payment voucher posted successfully')
          : L('تم إلغاء السند بنجاح', 'Payment voucher cancelled successfully')
      )
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: ['suppliers-for-pp'] })
      setModalOpen(false)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // Reversal Mutation
  const reverseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const r = await fetch(`/api/erp/purchase-payments/${id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل عكس سند الصرف', 'Failed to reverse payment voucher'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم عكس سند الصرف وتوليد قيد عكسي آلي بنجاح', 'Payment voucher reversed & counter journal entry generated successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: ['suppliers-for-pp'] })
      setReverseOpen(false)
      setReverseTarget(null)
      setReverseReason('')
      setModalOpen(false)
    },
    onError: (e: any) => toast.error(e.message || L('فشل عكس السند', 'Reversal failed')),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/purchase-payments/${id}`, {
        method: 'DELETE',
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل حذف السند', 'Failed to delete payment voucher'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف السند بنجاح', 'Payment voucher deleted successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء الحذف', 'An error occurred while deleting')),
  })

  const exportColumns: ExportColumn<PurchasePayment>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'start', type: 'text', value: (p) => p.code },
    { key: 'supplier', header: L('المورد', 'Supplier'), width: 22, align: 'start', type: 'text', value: (p) => partnerName(p.partner) },
    { key: 'invoice', header: L('الفاتورة', 'Invoice'), width: 14, align: 'center', type: 'text', value: (p) => invoices.find((i) => i.id === p.invoiceId)?.code ?? '—' },
    { key: 'paymentDate', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (p) => formatDate(p.paymentDate), dateValue: (p) => p.paymentDate },
    { key: 'amount', header: L('المبلغ', 'Amount'), width: 14, align: 'end', type: 'currency', value: (p) => formatCurrency(p.amount) },
    { key: 'method', header: L('الطريقة', 'Method'), width: 12, align: 'center', type: 'text', value: (p) => methodLabel(p.method) },
    { key: 'reference', header: L('المرجع', 'Reference'), width: 14, align: 'start', type: 'text', value: (p) => p.reference ?? '' },
    { key: 'status', header: L('الحالة', 'Status'), width: 12, align: 'center', type: 'text', value: (p) => statusLabel(p.status) },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('سندات-الصرف', 'purchase-payments'),
    title: L('تقرير سندات الصرف', 'Purchase Payments Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('صرف هذا الشهر', 'This Month Payments'), value: formatCurrency(stats.monthTotal) },
      { label: L('عدد السندات', 'Total Vouchers'), value: formatInt(stats.count) },
      { label: L('متوسط السند', 'Average Voucher'), value: formatCurrency(stats.avg) },
      { label: L('أعلى طريقة', 'Top Method'), value: stats.topMethod },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!payments.length) { toast.error(L('لا توجد بيانات للتصدير', 'No data to export')); return }
    try {
      await exportRows(format, payments, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (p: PurchasePayment) => {
    const inv = invoices.find((i) => i.id === p.invoiceId)
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
          <div class="type">${L('سند صرف', 'Payment Voucher')}</div>
          <div class="code">${p.code}</div>
          <div class="date">${formatDate(p.paymentDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('صرفنا إلى المورد', 'Paid To Supplier')}</div>
        <div class="name">${partnerName(p.partner)}</div>
        <div class="sub">${L('رمز المورد', 'Supplier Code')}: ${p.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">${L('الفاتورة المرتبطة', 'Linked Invoice')}: ${inv.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>${L('البيان', 'Description')}</th>
            <th>${L('القيمة', 'Amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>${L('المبلغ المصروف', 'Amount Paid')}</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>${L('طريقة الدفع', 'Payment Method')}</td><td>${methodLabel(p.method)}</td></tr>
          ${p.reference ? `<tr><td>${L('المرجع', 'Reference')}</td><td>${p.reference}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>${L('الإجمالي', 'Total')}:</span><span>${formatCurrency(p.amount)}</span></div>
      </div>
      ${p.notes ? `<div class="notes">${p.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('أمين الصندوق', 'Cashier')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المستلم', 'Recipient')}</div></div>
      </div>
    `
    printHTML(html, `${L('سند صرف', 'Payment Voucher')} ${p.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  const getModalTitle = () => {
    if (!selectedPayment) return L('سند صرف جديد', 'New Payment Voucher')
    if (selectedPayment.status === 'draft') return L('تعديل سند صرف', 'Edit Payment Voucher')
    return L('عرض سند صرف', 'View Payment Voucher')
  }

  const handleOpenReverseConfirmation = (payment: PurchasePayment) => {
    setReverseTarget(payment)
    setReverseReason('')
    setReverseOpen(true)
  }

  return (
    <ModuleShell
      title={t('module.purchase-payments')}
      description={L('إدارة سندات الصرف وسداد المستحقات للموردين وفق أثر محاسبي صارم', 'Supplier payment vouchers and payables settlement')}
      icon={<Banknote className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز السند أو المرجع...', 'Search by voucher code or reference...')}
      onAdd={openCreateModal}
      addLabel={L('سند صرف جديد', 'New Voucher')}
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
        <>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-36"><SelectValue placeholder={L('الطريقة', 'Method')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L('كل الطرق', 'All Methods')}</SelectItem>
              {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
              <SelectItem value="draft">{statusLabel('draft')}</SelectItem>
              <SelectItem value="posted">{statusLabel('posted')}</SelectItem>
              <SelectItem value="reversed">{statusLabel('reversed')}</SelectItem>
              <SelectItem value="cancelled">{statusLabel('cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('صرف هذا الشهر', 'This Month')} value={formatCurrency(stats.monthTotal)} icon={<Banknote className="size-5" />} accent="blue" />
        <KpiCard title={L('عدد السندات', 'Voucher Count')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title={L('متوسط السند', 'Average Voucher')} value={formatCurrency(stats.avg)} icon={<TrendingUp className="size-5" />} accent="violet" />
        <KpiCard title={L('أعلى طريقة', 'Top Method')} value={stats.topMethod} icon={<CreditCard className="size-5" />} accent="amber" />
      </div>

      {/* Table Card */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الفاتورة', 'Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('المبلغ', 'Amount')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الطريقة', 'Method')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-center pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد سندات صرف.', 'No payment vouchers found.')}</TableCell></TableRow>
              ) : payments.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => openPaymentModal(p)}
                  className="hover:bg-muted/40 align-middle cursor-pointer transition-colors"
                >
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">
                    <span className="font-semibold text-primary">{p.code}</span>
                  </TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(p.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">
                    {invoices.find((i) => i.id === p.invoiceId)?.code ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-center border-b whitespace-nowrap">
                    <span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(p.amount)}</span>
                  </TableCell>
                  <TableCell className="text-center border-b"><span className="text-xs">{methodLabel(p.method)}</span></TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'draft' ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            onClick={() => statusMutation.mutate({ id: p.id, action: 'post' })}
                            title={L('ترحيل السند', 'Post Voucher')}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            onClick={() => setDeleteTarget(p)}
                            title={L('حذف السند', 'Delete Voucher')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : p.status === 'posted' ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => handlePrint(p)}
                            title={L('طباعة', 'Print')}
                          >
                            <Printer className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                            onClick={() => handleOpenReverseConfirmation(p)}
                            title={L('عكس السند بقيد آلي', 'Reverse Voucher')}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openPaymentModal(p)}
                            title={L('عرض السند', 'View Voucher')}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => handlePrint(p)}
                            title={L('طباعة', 'Print')}
                          >
                            <Printer className="size-4" />
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

      {/* View / Edit Payment Voucher Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden"
        >
          <DialogHeader >
            <DialogTitle >
              <span>{getModalTitle()}</span>
              {selectedPayment && (
                <span className="font-mono text-xs text-muted-foreground dir-ltr ms-2">
                  ({selectedPayment.code})
                </span>
              )}
            </DialogTitle>

          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {/* Banner for Cancelled or Reversed Vouchers */}
            {selectedPayment && (selectedPayment.status === 'reversed' || selectedPayment.status === 'cancelled') && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
                <ShieldAlert className="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{L('سند صرف معكوس / ملغي', 'Reversed / Cancelled Payment Voucher')}</span>
                </div>
              </div>
            )}

            {/* Banner for Posted Vouchers */}
            {selectedPayment && selectedPayment.status === 'posted' && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs">
                <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {L('هذا السند مرحّل نهائياً وأنتج أثراً مالياً. لا يمكن التعديل أو الحذف', 'This voucher is posted and generated a financial entry.couldnt edit or delete')}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Supplier Field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{L('المورد *', 'Supplier *')}</Label>
                  <Select
                    disabled={isViewOnly}
                    value={partnerId}
                    onValueChange={setPartnerId}
                  >
                    <SelectTrigger className={cn("text-xs sm:text-sm", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}>
                      <SelectValue placeholder={L('اختر المورد', 'Select supplier')} />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{L('الفاتورة المرتبطة (اختياري)', 'Linked Invoice (Optional)')}</Label>
                    {linkedInvoice && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        {L('المتبقي:', 'Due:')} {formatCurrency(remainingInvoiceDue)}
                      </span>
                    )}
                  </div>
                  <Select
                    disabled={isViewOnly}
                    value={invoiceId}
                    onValueChange={(v) => {
                      setInvoiceId(v)
                      const inv = invoices.find((i) => i.id === v)
                      if (inv) {
                        const rem = Math.max(0, inv.total - inv.paid)
                        setAmount(String(rem))
                      }
                    }}
                  >
                    <SelectTrigger className={cn("text-xs sm:text-sm", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}>
                      <SelectValue placeholder={L('بدون ربط بفاتورة', 'No invoice link')} />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter((i) => !partnerId || i.partnerId === partnerId)
                        .map((i) => {
                          const curPaid = selectedPayment && selectedPayment.invoiceId === i.id ? selectedPayment.amount : 0
                          const due = Math.max(0, i.total - i.paid + curPaid)
                          return (
                            <SelectItem key={i.id} value={i.id}>
                              <span dir="ltr" className="font-mono text-xs">{i.code}</span> — {L('متبقي', 'Due')} {formatCurrency(due)}
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Amount Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs font-semibold">{L('المبلغ *', 'Amount *')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    dir="ltr"
                    disabled={isViewOnly}
                    className={cn("font-mono font-semibold text-xs sm:text-sm", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {/* Date Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="paymentDate" className="text-xs font-semibold">{L('التاريخ *', 'Date *')}</Label>
                  <DatePicker
                    id="paymentDate"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    disabled={isViewOnly}
                  />
                </div>

                {/* Payment Method Field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{L('طريقة الدفع', 'Payment Method')}</Label>
                  <Select
                    disabled={isViewOnly}
                    value={method}
                    onValueChange={setMethod}
                  >
                    <SelectTrigger className={cn("text-xs sm:text-sm", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reference Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="reference" className="text-xs font-semibold">{L('المرجع', 'Reference')}</Label>
                  <Input
                    id="reference"
                    disabled={isViewOnly}
                    className={cn("text-xs sm:text-sm", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={L('رقم شيك / مرجع تحويل', 'Check No. / Transfer Ref')}
                  />
                </div>
              </div>

              {/* Notes Field */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold">{L('الملاحظات والبيان', 'Notes & Description')}</Label>
                <Textarea
                  id="notes"
                  disabled={isViewOnly}
                  className={cn("text-xs sm:text-sm min-h-[70px]", isViewOnly && "cursor-not-allowed opacity-80 bg-muted/60")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={L('ملاحظات إضافية على سند الصرف...', 'Additional payment notes...')}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-muted/20 dark:bg-zinc-900/30 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              {isViewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>

            <div className="flex items-center gap-2">
              {/* Actions when ViewOnly */}
              {isViewOnly ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => selectedPayment && handlePrint(selectedPayment)}
                  >
                    <Printer className="size-4" />
                    <span>{L('طباعة السند', 'Print Voucher')}</span>
                  </Button>
                  {selectedPayment && selectedPayment.status === 'posted' && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium"
                      onClick={() => handleOpenReverseConfirmation(selectedPayment)}
                    >
                      <RotateCcw className="size-4" />
                      <span>{L('عكس السند (قيد عكسي)', 'Reverse Voucher')}</span>
                    </Button>
                  )}
                </>
              ) : (
                /* Actions when Editable (New or Draft) */
                <>
                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    variant="secondary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                    onClick={() => saveMutation.mutate(false)}
                  >
                    {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : selectedPayment ? L('تحديث كمسودة', 'Update Draft') : L('حفظ كمسودة', 'Save Draft')}
                  </Button>
                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => saveMutation.mutate(true)}
                  >
                    <CheckCircle2 className="size-4" />
                    {saveMutation.isPending ? L('جاري الترحيل...', 'Posting...') : selectedPayment ? L('تحديث وترحيل', 'Update & Post') : L('حفظ وترحيل', 'Save & Post')}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialized Reversal Confirmation Modal */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden bg-background text-foreground dark:bg-zinc-950 dark:border-zinc-800"
        >
          <DialogHeader >
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <RotateCcw className="size-5" />
              </div>
              <div className="flex flex-col gap-1 text-start">
                <DialogTitle>
                  <span>{L('تأكيد عكس سند الصرف', 'Confirm Payment Voucher Reversal')}</span>
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-xs sm:text-sm">
            {/* Red Alert Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">{L('تنبيه محاسبي هـام:', 'Important Accounting & Audit Notice:')}</span>

              </div>
            </div>

            {/* Reversal Entry Journal Line Preview */}
            {reverseTarget && (
              <div className="p-2.5 rounded-xl border bg-card/60 dark:bg-zinc-900/60 space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <ArrowRightLeft className="size-3.5 text-primary" />
                    {L(' القيد المحاسبي العكسي :', 'Counter Journal Entry:')}
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary">{reverseTarget.code}</span>
                </div>

                <div className="space-y-3.5 text-xs font-mono">
                  {/* Debit Line */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="size-3.5 shrink-0" />
                      <span>{L('مدين (Dr): حـ/ النقدية والصندوق / البنك', 'Debit (Dr): Cash & Bank Account')}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(reverseTarget.amount)}</span>
                  </div>

                  {/* Credit Line */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="size-3.5 shrink-0" />
                      <span>{L(`دائن (Cr): حـ/ الذمم  — ${partnerName(reverseTarget.partner)}`, `Credit (Cr): Accounts Payable — ${partnerName(reverseTarget.partner)}`)}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(reverseTarget.amount)}</span>
                  </div>
                </div>

              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="reverseReason" className="text-xs font-semibold">
                {L('سبب عكس سند الصرف', 'Reason for reversal')}
              </Label>
              <Textarea
                id="reverseReason"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder={L('يرجى إدخال سبب عكس هذا السند بشكل واضح...', 'Please specify clear justification for reversing this voucher...')}
                rows={2}
                className="text-xs"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReverseOpen(false)
                setReverseTarget(null)
              }}
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={reverseMutation.isPending || !reverseReason.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5"
              onClick={() => {
                if (reverseTarget) {
                  reverseMutation.mutate({ id: reverseTarget.id, reason: reverseReason })
                }
              }}
            >
              <RotateCcw className="size-4" />
              {reverseMutation.isPending ? L('جاري العكس...', 'Reversing...') : L('تأكيد القيد', 'Confirm Reversal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              {L('تأكيد حذف سند الصرف', 'Confirm Delete Voucher')}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-foreground/80">
              {L(
                'هل أنت متأكد من حذف مسودة السند نهائياً؟ هذا الإجراء متاح للمسودات فقط ولا يمكن التراجع عنه.',
                'Are you sure you want to permanently delete this draft voucher? This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel>{L('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id)
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {L('حذف السند', 'Delete Voucher')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}

export default PurchasePaymentsModule
