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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
import { DatePicker } from '@/components/ui/date-picker'
import {
  Receipt, Hash, TrendingUp, CreditCard, Download, FileSpreadsheet, FileText, FileDown, Eye, Pencil, Printer, RotateCcw, AlertTriangle, History, ShieldAlert, ArrowLeftRight, Trash2,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; paid: number; partnerId: string }

interface SalesPayment {
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
  partner?: Partner
}

const METHOD_OPTIONS = [
  { value: 'cash', ar: 'نقد', en: 'Cash' },
  { value: 'card', ar: 'بطاقة', en: 'Card' },
  { value: 'transfer', ar: 'تحويل', en: 'Transfer' },
  { value: 'check', ar: 'شيك', en: 'Check' },
]

const STATUS_FLOW = ['draft', 'posted', 'reversed', 'cancelled']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  posted: { ar: 'مُرحّل', en: 'Posted' },
  reversed: { ar: 'معكوس', en: 'Reversed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

export function SalesPaymentsModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const partnerName = (p?: Partner) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesPayment[]; meta: any }>({
    queryKey: ['sales-payments', search, filterMethod, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-payments?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-sp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['sales-invoices-for-sp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/sales-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const payments = (data?.data ?? []).filter((p) => filterMethod === 'all' || p.method === filterMethod)
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []

  const methodLabel = (m: string) => {
    const opt = METHOD_OPTIONS.find((o) => o.value === m)
    return opt ? (isRTL ? opt.ar : opt.en) : m
  }

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = payments.filter((p) => {
      const d = new Date(p.paymentDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.status === 'posted'
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

  // Main Form State
  const [selectedPayment, setSelectedPayment] = useState<SalesPayment | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('0')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'draft' | 'posted'>('posted')

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<SalesPayment | null>(null)

  // Reversal Modal State
  const [reverseTarget, setReverseTarget] = useState<SalesPayment | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const resetForm = () => {
    setSelectedPayment(null)
    setViewOnly(false)
    setPartnerId(''); setInvoiceId(''); setAmount('0')
    setPaymentDate(new Date().toISOString().slice(0, 10)); setMethod('cash')
    setReference(''); setNotes('')
    setStatus('posted')
  }

  // Open voucher modal based on status
  const openVoucherModal = (p: SalesPayment) => {
    setSelectedPayment(p)
    setPartnerId(p.partnerId || p.partner?.id || '')
    setInvoiceId(p.invoiceId || '')
    setAmount(String(p.amount ?? 0))
    setPaymentDate((p.paymentDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    setMethod(p.method || 'cash')
    setReference(p.reference || '')
    setNotes(p.notes || '')
    setStatus((p.status === 'draft' ? 'draft' : 'posted') as any)

    if (p.status === 'draft') {
      setViewOnly(false) // Draft allows full editing
    } else {
      setViewOnly(true) // Posted, reversed, or cancelled strictly read-only
    }
    setAddOpen(true)
  }

  // Delete Draft Payment Mutation
  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const r = await fetch(`/api/erp/sales-payments/${paymentId}`, {
        method: 'DELETE',
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل حذف مسودة سند القبض', 'Failed to delete receipt draft'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف مسودة سند القبض بنجاح', 'Receipt draft deleted successfully'))
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء الحذف', 'An error occurred during deletion')),
  })

  // Open Reversal Confirmation Modal
  const openReverseModal = (p: SalesPayment) => {
    setReverseTarget(p)
    setReverseReason(L('عكس سند قبض بناءً على طلب محاسبي وتعديل حركة النقدية', 'Reversal of receipt voucher as requested'))
  }

  // Calculate invoice max allowed payment amount
  const maxInvoiceAmount = useMemo(() => {
    if (!invoiceId) return null
    const inv = invoices.find((i) => i.id === invoiceId)
    if (!inv) return null
    const alreadyPaidWithoutCurrent = inv.paid - (selectedPayment?.invoiceId === invoiceId ? (selectedPayment?.amount || 0) : 0)
    return Math.max(0, inv.total - alreadyPaidWithoutCurrent)
  }, [invoiceId, invoices, selectedPayment])

  // Save new payment (Draft or Posted)
  const saveMutation = useMutation({
    mutationFn: async (targetStatus: 'draft' | 'posted') => {
      if (!partnerId) throw new Error(L('اختر العميل/الحساب *', 'Select a customer/account *'))
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر *', 'Amount must be greater than zero *'))

      if (maxInvoiceAmount !== null && amt > maxInvoiceAmount + 0.001) {
        throw new Error(
          L(
            `المبلغ المحدد (${amt}) يتجاوز المبلغ المستحق على الفاتورة المختارة (${maxInvoiceAmount})`,
            `Amount (${amt}) exceeds remaining due amount on selected invoice (${maxInvoiceAmount})`
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
        status: targetStatus,
      }

      const r = await fetch('/api/erp/sales-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل حفظ سند القبض', 'Failed to save receipt voucher'))
      }
      return r.json()
    },
    onSuccess: (_, targetStatus) => {
      toast.success(
        targetStatus === 'posted'
          ? L('تم إنشاء وترحيل سند القبض بنجاح', 'Receipt created & posted successfully')
          : L('تم حفظ مسودة سند القبض بنجاح', 'Receipt draft saved successfully')
      )
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // Update existing draft payment (Save Draft or Save & Post)
  const updateMutation = useMutation({
    mutationFn: async (targetStatus: 'draft' | 'posted') => {
      if (!selectedPayment) return
      if (!partnerId) throw new Error(L('اختر العميل/الحساب *', 'Select a customer/account *'))
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر *', 'Amount must be greater than zero *'))

      if (maxInvoiceAmount !== null && amt > maxInvoiceAmount + 0.001) {
        throw new Error(
          L(
            `المبلغ المحدد (${amt}) يتجاوز المبلغ المستحق على الفاتورة المختارة (${maxInvoiceAmount})`,
            `Amount (${amt}) exceeds remaining due amount on selected invoice (${maxInvoiceAmount})`
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
        status: targetStatus,
      }

      const r = await fetch(`/api/erp/sales-payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل تحديث سند القبض', 'Failed to update receipt voucher'))
      }
      return r.json()
    },
    onSuccess: (_, targetStatus) => {
      toast.success(
        targetStatus === 'posted'
          ? L('تم تحديث وترحيل سند القبض بنجاح', 'Receipt updated & posted successfully')
          : L('تم تحديث سند القبض بنجاح', 'Receipt updated successfully')
      )
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // Reverse posted payment (Reversal Entry)
  const reverseMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const r = await fetch(`/api/erp/sales-payments/${paymentId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل عكس سند القبض', 'Failed to reverse receipt voucher'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم عكس سند القبض وإنشاء القيد العكسي بنجاح', 'Receipt reversed & reversal entry created successfully'))
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      setAddOpen(false)
      setReverseTarget(null)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<SalesPayment>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'center', value: (p) => p.code },
    { key: 'customer', header: L('العميل', 'Customer'), width: 22, align: 'center', value: (p) => partnerName(p.partner) },
    { key: 'invoice', header: L('الفاتورة', 'Invoice'), width: 16, align: 'center', value: (p) => invoices.find((i) => i.id === p.invoiceId)?.code ?? '—' },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (p) => formatDate(p.paymentDate), dateValue: (p) => p.paymentDate },
    { key: 'amount', header: L('المبلغ', 'Amount'), width: 16, align: 'center', type: 'currency', summable: true, value: (p) => p.amount },
    { key: 'method', header: L('الطريقة', 'Method'), width: 14, align: 'center', value: (p) => methodLabel(p.method) },
    { key: 'reference', header: L('المرجع', 'Reference'), width: 16, align: 'center', value: (p) => p.reference ?? '—' },
    { key: 'status', header: L('الحالة', 'Status'), width: 12, align: 'center', value: (p) => STATUS_LABELS[p.status]?.[isRTL ? 'ar' : 'en'] ?? p.status },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('سندات_القبض_مبيعات', 'sales-receipts'),
    title: L('تقرير سندات القبض - المبيعات', 'Sales Receipts Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('قبوض هذا الشهر', 'This Month Total'), value: formatCurrency(stats.monthTotal) },
      { label: L('عدد السندات', 'Total Count'), value: formatInt(stats.count) },
      { label: L('متوسط السند', 'Average Amount'), value: formatCurrency(stats.avg) },
      { label: L('أعلى طريقة', 'Top Method'), value: stats.topMethod },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!payments.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, payments, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (p: SalesPayment) => {
    const inv = invoices.find((i) => i.id === p.invoiceId)
    const statusText = STATUS_LABELS[p.status]?.[isRTL ? 'ar' : 'en'] ?? p.status
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
          <div class="type">${L('سند قبض', 'Receipt')}</div>
          <div class="code">${p.code}</div>
          <div class="date">${formatDate(p.paymentDate)}</div>
          <div class="status" style="font-weight:bold;margin-top:4px;">[ ${statusText} ]</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('استلمنا من السيد/السادة', 'Received From')}</div>
        <div class="name">${partnerName(p.partner)}</div>
        <div class="sub">${L('كود العميل', 'Code')}: ${p.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">${L('مقابل الفاتورة', 'Invoice')}: ${inv.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>${L('البيان', 'Description')}</th>
            <th>${L('القيمة', 'Amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>${L('المبلغ المستلم', 'Received Amount')}</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>${L('طريقة الدفع', 'Payment Method')}</td><td>${methodLabel(p.method)}</td></tr>
          ${p.reference ? `<tr><td>${L('المرجع (رقم الشيك / التحويل)', 'Reference')}</td><td>${p.reference}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(p.amount)}</span></div>
      </div>
      ${p.notes ? `<div class="notes"><strong>${L('ملاحظات:', 'Notes:')}</strong> ${p.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('أمين الصندوق', 'Cashier')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المستلم / العميل', 'Customer')}</div></div>
      </div>
    `
    printHTML(html, `${L('سند قبض', 'Receipt')} ${p.code}`)
  }

  // Header Title Helper
  const getModalTitle = () => {
    if (!selectedPayment) return L('سند قبض جديد', 'New Receipt Voucher')
    if (selectedPayment.status === 'draft') return L('تعديل سند قبض', 'Edit Receipt Voucher')
    return L('عرض سند قبض', 'View Receipt Voucher')
  }

  return (
    <ModuleShell
      title={L('سندات القبض - المبيعات', 'Sales Receipts')}
      description={L('إدارة وتحرير سندات قبض العملاء ومراجعتها وفق الضوابط المحاسبية', 'Manage and audit customer receipt vouchers under strict accounting controls')}
      icon={<Receipt className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز السند أو المرجع...', 'Search by code or reference...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('سند قبض جديد', 'New Receipt')}
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
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="all">{L('كل الطرق', 'All Methods')}</SelectItem>
              {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
              {STATUS_FLOW.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2 mb-2">
        <KpiCard title={L('قبوض هذا الشهر', 'This Month Total')} value={formatCurrency(stats.monthTotal)} icon={<Receipt className="size-5" />} accent="blue" />
        <KpiCard title={L('عدد السندات المرحّلة', 'Posted Count')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title={L('متوسط السند', 'Average Amount')} value={formatCurrency(stats.avg)} icon={<TrendingUp className="size-5" />} accent="violet" />
        <KpiCard title={L('أعلى طريقة', 'Top Method')} value={stats.topMethod} icon={<CreditCard className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-6 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العميل', 'Customer')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الفاتورة', 'Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('المبلغ', 'Amount')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الطريقة', 'Method')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد سندات قبض.', 'No receipts found.')}</TableCell></TableRow>
              ) : payments.map((p) => (
                <TableRow
                  key={p.id}
                  className="hover:bg-muted/40 align-middle cursor-pointer"
                  onClick={() => openVoucherModal(p)}
                >
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={p.code}>{p.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(p.partner)}>{partnerName(p.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === p.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(p.amount)}</span></TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="text-xs">{methodLabel(p.method)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={p.status} /></div></TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'draft' ? (
                        <>
                          <Button size="icon" variant="ghost" className="size-8 text-sky-600 hover:text-sky-700" title={L('تعديل سند القبض', 'Edit Receipt')} onClick={() => openVoucherModal(p)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30" title={L('حذف مسودة السند', 'Delete Draft')} onClick={() => setDeleteTarget(p)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : p.status === 'reversed' || p.status === 'cancelled' ? (
                        <Button size="icon" variant="ghost" className="size-8 text-amber-600 hover:text-amber-700" title={L('عرض السجل والسند', 'View Audit & Record')} onClick={() => openVoucherModal(p)}>
                          <History className="size-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="size-8" title={L('عرض سند القبض', 'View Receipt')} onClick={() => openVoucherModal(p)}>
                          <Eye className="size-4" />
                        </Button>
                      )}

                      <Button size="icon" variant="ghost" className="size-8" title={L('طباعة سند القبض', 'Print Receipt')} onClick={() => handlePrint(p)}>
                        <Printer className="size-3.5" />
                      </Button>

                      {p.status === 'posted' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={L('عكس السند (قيد عكسي)', 'Reverse Voucher')}
                          onClick={() => openReverseModal(p)}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* Main Voucher View / Edit / Create Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm() }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pe-6">
              <DialogTitle className="flex items-center gap-2">
                <span>{getModalTitle()}</span>
                {selectedPayment?.code && (
                  <span className="font-mono text-xs text-muted-foreground dir-ltr">({selectedPayment.code})</span>
                )}
              </DialogTitle>

            </div>
            <DialogDescription>
              {viewOnly
                ? L('عرض بيانات وتفاصيل سند القبض (للقراءة فقط لحماية السجلات المالية)', 'Read-only view of receipt voucher to preserve financial records')
                : L('تعبئة وتعديل بيانات سند القبض - يمكنك الحفظ كمسودة أو الترحيل المباشر للصندوق/البنك', 'Fill in receipt voucher details - save as draft or post directly to cash/bank')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {/* Red Alert Banner for Cancelled / Reversed Vouchers */}
            {selectedPayment && (selectedPayment.status === 'reversed' || selectedPayment.status === 'cancelled') && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
                <ShieldAlert className="size-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{L('سند قبض معكوس / ملغي', 'Reversed / Cancelled Receipt Voucher')}</span>
                </div>
              </div>
            )}

            <fieldset
              disabled={viewOnly}
              className={`space-y-4 sm:space-y-5 ${viewOnly ? 'cursor-not-allowed select-none' : ''}`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label>{L('العميل / الحساب *', 'Customer / Account *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId} disabled={viewOnly}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}`}>
                      <SelectValue placeholder={L('اختر العميل', 'Select Customer')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {partnerName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{L('الفاتورة المرتبطة (اختياري)', 'Linked Invoice (Optional)')}</Label>
                  <Select
                    value={invoiceId}
                    disabled={viewOnly}
                    onValueChange={(v) => {
                      setInvoiceId(v)
                      const inv = invoices.find((i) => i.id === v)
                      if (inv) {
                        const due = Math.max(0, inv.total - inv.paid)
                        setAmount(String(due))
                      }
                    }}
                  >
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}`}>
                      <SelectValue placeholder={L('بدون ربط بفاتورة', 'None')} />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {invoices
                        .filter((i) => !partnerId || i.partnerId === partnerId)
                        .map((i) => {
                          const due = Math.max(0, i.total - i.paid)
                          return (
                            <SelectItem key={i.id} value={i.id}>
                              <span dir="ltr" className="font-mono text-xs">{i.code}</span> — {formatCurrency(due)}
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{L('حالة السند', 'Voucher Status')}</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as 'draft' | 'posted')}
                    disabled={viewOnly || (!!selectedPayment && selectedPayment.status !== 'draft')}
                  >
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectItem value="draft">{STATUS_LABELS['draft']?.[isRTL ? 'ar' : 'en']}</SelectItem>
                      <SelectItem value="posted">{STATUS_LABELS['posted']?.[isRTL ? 'ar' : 'en']}</SelectItem>
                      {selectedPayment && (selectedPayment.status === 'reversed' || selectedPayment.status === 'cancelled') && (
                        <SelectItem value={selectedPayment.status}>{STATUS_LABELS[selectedPayment.status]?.[isRTL ? 'ar' : 'en']}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="amount">{L('المبلغ *', 'Amount *')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    dir="ltr"
                    disabled={viewOnly}
                    className={`text-start tabular-nums ${viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  {maxInvoiceAmount !== null && !viewOnly && (
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {L('الحد الأقصى للمستحق:', 'Max Invoice Due:')} {formatCurrency(maxInvoiceAmount)}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="paymentDate">{L('التاريخ *', 'Date *')}</Label>
                  <DatePicker
                    id="paymentDate"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    disabled={viewOnly}
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label>{L('طريقة الدفع', 'Payment Method')}</Label>
                  <Select value={method} onValueChange={setMethod} disabled={viewOnly}>
                    <SelectTrigger className={`w-full ${viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="reference">{L('المرجع', 'Reference')}</Label>
                  <Input
                    id="reference"
                    disabled={viewOnly}
                    className={viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={L('رقم شيك / مرجع تحويل', 'Check # / Transfer Ref')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea
                  id="notes"
                  disabled={viewOnly}
                  className={viewOnly ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-90' : ''}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={L('ملاحظات إضافية...', 'Additional notes...')}
                />
              </div>
            </fieldset>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto sm:min-w-25"
              onClick={() => { setAddOpen(false); resetForm() }}
            >
              {viewOnly ? L('إغلاق', 'Close') : L('إلغاء', 'Cancel')}
            </Button>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
              {/* Posted Voucher Actions */}
              {selectedPayment && selectedPayment.status === 'posted' && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto gap-1.5 border"
                    onClick={() => handlePrint(selectedPayment)}
                  >
                    <Printer className="size-4" />
                    {L('طباعة السند', 'Print Voucher')}
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto gap-1.5"
                    disabled={reverseMutation.isPending}
                    onClick={() => openReverseModal(selectedPayment)}
                  >
                    <RotateCcw className="size-4" />
                    {L('عكس السند (قيد عكسي)', 'Reverse Voucher')}
                  </Button>
                </>
              )}

              {/* Reversed / Cancelled Voucher Actions */}
              {selectedPayment && (selectedPayment.status === 'reversed' || selectedPayment.status === 'cancelled') && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto gap-1.5 border"
                  onClick={() => handlePrint(selectedPayment)}
                >
                  <Printer className="size-4" />
                  {L('طباعة السند', 'Print Voucher')}
                </Button>
              )}

              {/* Draft Voucher Actions */}
              {selectedPayment && selectedPayment.status === 'draft' && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto min-w-28 border"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate('draft')}
                  >
                    {updateMutation.isPending ? L('جاري التحديث...', 'Updating...') : L('تحديث', 'Update')}
                  </Button>

                  <Button
                    type="button"
                    className="w-full sm:w-auto min-w-32 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate('posted')}
                  >
                    {updateMutation.isPending ? L('جاري الترحيل...', 'Posting...') : L('تحديث وترحيل', 'Update & Post')}
                  </Button>
                </>
              )}

              {/* New Voucher Actions */}
              {!selectedPayment && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto min-w-28 border"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate('draft')}
                  >
                    {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ مسودة', 'Save Draft')}
                  </Button>

                  <Button
                    type="button"
                    className="w-full sm:w-auto min-w-32 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate('posted')}
                  >
                    {saveMutation.isPending ? L('جاري الترحيل...', 'Posting...') : L('حفظ وترحيل', 'Save & Post')}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Professional High-Fidelity Reversal Confirmation Dialog */}
      <Dialog open={!!reverseTarget} onOpenChange={(o) => { if (!o) setReverseTarget(null) }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden bg-background text-foreground dark:bg-zinc-950 dark:border-zinc-800"
        >
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <RotateCcw className="size-5" />
              </div>
              <div className="flex flex-col gap-1 text-start">
                <DialogTitle>
                  <span>{L('تأكيد عكس سند القبض وتوليد قيد عكسي آلي', 'Confirm Receipt Voucher Reversal & Auto Entry')}</span>
                </DialogTitle>

                {reverseTarget && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{L('رمز السند:', 'Voucher Code:')}</span>
                    <span className="font-mono font-semibold text-foreground dir-ltr">{reverseTarget.code}</span>
                    <span>•</span>
                    <span>{L('المبلغ:', 'Amount:')}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums dir-ltr">{formatCurrency(reverseTarget.amount)}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-xs sm:text-sm">
            {/* Red Alert Notice */}


            {/* Reversal Entry Journal Line Preview */}
            {reverseTarget && (
              <div className="rounded-xl border bg-muted/20 dark:bg-zinc-900/50 p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowLeftRight className="size-3.5 text-primary" />
                    {L('تفاصيل حركة القيد المحاسبي العكسي الآلي', 'Automated Reversal Journal Entry Lines')}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {L('نوع القيد: عكسي', 'Entry: Reversal')}
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {/* Debit Line */}
                  <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-sans font-bold">
                        {L('مدين (Dr)', 'Dr')}
                      </span>
                      <span className="font-sans font-medium">
                        {L('حـ/ الذمم المدينة - العميل', 'Accounts Receivable - Customer')}
                      </span>
                      <span className="text-muted-foreground font-sans text-[11px]">
                        ({partnerName(reverseTarget.partner)})
                      </span>
                    </div>
                    <span className="font-bold tabular-nums dir-ltr text-rose-700 dark:text-rose-300">
                      +{formatCurrency(reverseTarget.amount)}
                    </span>
                  </div>

                  {/* Credit Line */}
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-sans font-bold">
                        {L('دائن (Cr)', 'Cr')}
                      </span>
                      <span className="font-sans font-medium">
                        {L('حـ/ النقدية والصندوق / البنك', 'Cash & Bank / Safe')}
                      </span>
                      <span className="text-muted-foreground font-sans text-[11px]">
                        ({methodLabel(reverseTarget.method)})
                      </span>
                    </div>
                    <span className="font-bold tabular-nums dir-ltr text-emerald-700 dark:text-emerald-300">
                      -{formatCurrency(reverseTarget.amount)}
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* Financial Impact Breakdown Grid */}
            {reverseTarget && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border bg-card flex flex-col gap-1">
                  <span className="text-muted-foreground">{L('تأثير رصيد العميل:', 'Customer Balance Impact:')}</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 dir-ltr text-start">
                    +{formatCurrency(reverseTarget.amount)} ({L('زيادة المديونية', 'Increased Debt')})
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border bg-card flex flex-col gap-1">
                  <span className="text-muted-foreground">{L('الفاتورة المرتبطة:', 'Linked Invoice Impact:')}</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 truncate">
                    {reverseTarget.invoiceId
                      ? (invoices.find((i) => i.id === reverseTarget.invoiceId)?.code ?? 'مرتبطة') + ` (${L('إلغاء التحصيل', 'Cancel Payment')})`
                      : L('غير مرتبطة بفاتورة', 'Unlinked')}
                  </span>
                </div>
              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="reverseReason" className="text-xs font-semibold">
                {L('سبب عكس سند القبض *', 'Reason for reversal *')}
              </Label>
              <Textarea
                id="reverseReason"
                rows={2}
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder={L('أدخل سبب إلغاء وعكس السند المحاسبي...', 'Enter reason for voucher reversal...')}
                className="text-xs sm:text-sm"
              />
            </div>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t bg-muted/20 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto min-w-28"
              onClick={() => setReverseTarget(null)}
            >
              {L('إلغاء الإجراء', 'Cancel Action')}
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto min-w-36 gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              disabled={reverseMutation.isPending || !reverseReason.trim()}
              onClick={() => {
                if (reverseTarget) {
                  reverseMutation.mutate({ paymentId: reverseTarget.id, reason: reverseReason })
                }
              }}
            >
              <RotateCcw className="size-4" />
              {reverseMutation.isPending
                ? L('جاري العكس والتوليد...', 'Reversing...')
                : L('تأكيد العكس وتوليد القيد', 'Confirm Reversal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Deletion Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-md p-0 flex flex-col overflow-hidden bg-background text-foreground dark:bg-zinc-950 dark:border-zinc-800"
        >
          <DialogHeader className="p-4 sm:p-6 pb-2">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex flex-col gap-1 text-start">
                <DialogTitle>
                  <span>{L('تأكيد حذف مسودة سند القبض', 'Confirm Deleting Receipt Voucher Draft')}</span>
                </DialogTitle>
                <DialogDescription>
                  {L('هل أنت تأكد من إرادتك لحذف مسودة سند القبض التالية؟ لا يمكن التراجع عن هذا الإجراء.', 'Are you sure you want to delete this draft receipt voucher? This action cannot be undone.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteTarget && (
            <DialogBody className="px-4 sm:px-6 py-2">
              <div className="p-3 rounded-lg border bg-muted/40 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{L('رمز السند:', 'Code:')}</span>
                  <span className="font-mono font-semibold dir-ltr">{deleteTarget.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{L('العميل:', 'Customer:')}</span>
                  <span className="font-medium">{partnerName(deleteTarget.partner)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{L('المبلغ:', 'Amount:')}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 dir-ltr">{formatCurrency(deleteTarget.amount)}</span>
                </div>
              </div>
            </DialogBody>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t bg-muted/20 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto min-w-24"
              onClick={() => setDeleteTarget(null)}
            >
              {L('إلغاء', 'Cancel')}
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto min-w-28 gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id)
                }
              }}
            >
              <Trash2 className="size-4" />
              {deleteMutation.isPending ? L('جاري الحذف...', 'Deleting...') : L('تأكيد الحذف', 'Delete Draft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
