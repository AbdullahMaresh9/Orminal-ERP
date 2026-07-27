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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Banknote, Printer, Hash, TrendingUp, CreditCard, Download, FileSpreadsheet, FileText, FileDown, MoreHorizontal, CheckCircle2, XCircle, Trash2,
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
}

// عدد الصفوف الظاهرة قبل ظهور الاسكرول
const VISIBLE_ROWS = 5
const ROW_HEIGHT = 52    // ارتفاع الصف التقريبي بالبكسل
const HEADER_HEIGHT = 44 // ارتفاع رأس الجدول

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
  const [addOpen, setAddOpen] = useState(false)
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

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('0')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setPartnerId(''); setInvoiceId(''); setAmount('0')
    setPaymentDate(new Date().toISOString().slice(0, 10)); setMethod('cash')
    setReference(''); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async (shouldPost: boolean) => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Please select a supplier'))
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero'))
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
      const r = await fetch('/api/erp/purchase-payments', {
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
    onSuccess: (_, shouldPost) => {
      toast.success(
        shouldPost
          ? L('تم إنشاء سند الصرف وترحيله بنجاح', 'Payment voucher created and posted successfully')
          : L('تم حفظ سند الصرف بنجاح', 'Payment voucher saved successfully')
      )
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

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
          ? L('تم ترحيل السند بنجاح', 'Payment voucher posted successfully')
          : L('تم إلغاء السند بنجاح', 'Payment voucher cancelled successfully')
      )
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

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
      toast.success(L('تم حذف السند بنجاح من النظام', 'Payment voucher deleted successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
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
      toast.success(L('تم تصدير الملف', 'File exported'))
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
        <div class="label">${L('صرفنا إلى', 'Paid To')}</div>
        <div class="name">${partnerName(p.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${p.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">${L('فاتورة', 'Invoice')}: ${inv.code}</div>` : ''}
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
        <div class="sig"><div class="line"></div><div class="label">${L('العامل', 'Cashier')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المستلم', 'Recipient')}</div></div>
      </div>
    `
    printHTML(html, `${L('سند صرف', 'Payment Voucher')} ${p.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  return (
    <ModuleShell
      title={t('module.purchase-payments')}
      description={L('سندات صرف الموردين وإيصالات الدفع', 'Supplier payment vouchers and receipts')}
      icon={<Banknote className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز السند أو المرجع...', 'Search by voucher code or reference...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
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

      {/* جدول سندات الصرف — رأس ثابت + تمرير عمودي/أفقي (نمط مرتجعات المشتريات) */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[18%]" />{/* المورد */}
              <col className="w-[12%]" />{/* الفاتورة */}
              <col className="w-[13%]" />{/* التاريخ */}
              <col className="w-[14%]" />{/* المبلغ */}
              <col className="w-[7%]" />{/* الطريقة */}
              <col className="w-[7%]" />{/* الحالة */}
              <col className="w-[14%]" />{/* إجراءات */}
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
                <TableRow key={p.id} className="hover:bg-muted/40 align-middle">
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">{p.code}</TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(p.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === p.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-center border-b whitespace-nowrap"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(p.amount)}</span></TableCell>
                  <TableCell className="text-center border-b"><span className="text-xs">{methodLabel(p.method)}</span></TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === 'cancelled' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          onClick={() => setDeleteTarget(p)}
                          title={L('حذف السند', 'Delete Voucher')}
                        >
                          <Trash2 className="size-4.5" />
                        </Button>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(p)} title={L('طباعة', 'Print')}>
                            <Printer className="size-4.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8" title={L('خيارات الإجراءات', 'Action Options')}>
                                <MoreHorizontal className="size-4.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              {p.status === 'draft' && (
                                <DropdownMenuItem
                                  onClick={() => statusMutation.mutate({ id: p.id, action: 'post' })}
                                  className="gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                >
                                  <CheckCircle2 className="size-4" />
                                  {L('ترحيل', 'Post')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => statusMutation.mutate({ id: p.id, action: 'cancel' })}
                                className="gap-2 text-rose-600 dark:text-rose-400 cursor-pointer"
                              >
                                <XCircle className="size-4" />
                                {L('إلغاء', 'Cancel')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{L('سند صرف جديد', 'New Payment Voucher')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
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
                  <Label>{L('الفاتورة (اختياري)', 'Invoice (Optional)')}</Label>
                  <Select value={invoiceId} onValueChange={(v) => {
                    setInvoiceId(v)
                    const inv = invoices.find((i) => i.id === v)
                    if (inv) setAmount(String(Math.max(0, inv.total - inv.paid)))
                  }}>
                    <SelectTrigger><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter((i) => !partnerId || i.partnerId === partnerId)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            <span dir="ltr" className="font-mono text-xs">{i.code}</span> — {L('متبقي', 'Remaining')} {formatCurrency(i.total - i.paid)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">{L('المبلغ', 'Amount')} *</Label>
                  <Input id="amount" type="number" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paymentDate">{L('التاريخ', 'Date')}</Label>
                  <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{L('طريقة الدفع', 'Payment Method')}</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference">{L('المرجع', 'Reference')}</Label>
                  <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={L('رقم شيك / مرجع تحويل', 'Check No. / Transfer Ref')} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="gap-3 ">
            <Button className="w-18" type="button" variant="outline" onClick={() => setAddOpen(false)}>{L('إلغاء', 'Cancel')}</Button>
            <div className="flex items-center gap-3 ">
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(false)}
                className="bg-emerald-600 w-24 hover:bg-emerald-700 text-white font-medium"
              >
                {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ', 'Save')}
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(true)}
              >
                {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ وترحيل', 'Save & Post')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              {L('تأكيد حذف السند', 'Confirm Delete Voucher')}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-foreground/80 flex  ">
              {L(
                `هل أنت متأكد من حذف السند نهائياً لا يمكن التراجع عن هذا الإجراء.`,
                `Are you sure you want to permanently delete voucher? This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3 pt-4">
            <AlertDialogCancel className="sm:w-18">{L('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id)
                  setDeleteTarget(null)
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {L('حذف', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}


