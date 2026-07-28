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
import {
  Receipt, Wallet, Hash, TrendingUp, Plus, Printer, CreditCard, Download, FileSpreadsheet, FileText, FileDown,
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

const STATUS_FLOW = ['draft', 'posted', 'cancelled']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  posted: { ar: 'مُرحّل', en: 'Posted' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const VISIBLE_ROWS = 5
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
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
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
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر العميل', 'Select a customer'))
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
        status: 'posted',
      }
      const r = await fetch('/api/erp/sales-payments', {
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
      toast.success(L('تم إنشاء سند القبض بنجاح', 'Receipt created successfully'))
      qc.invalidateQueries({ queryKey: ['sales-payments'] })
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setAddOpen(false); resetForm()
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
        </div>
      </div>
      <div class="party">
        <div class="label">${L('استلمنا من', 'Received From')}</div>
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
          <tr><td>${L('المبلغ المستلم', 'Received Amount')}</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>${L('طريقة الدفع', 'Payment Method')}</td><td>${methodLabel(p.method)}</td></tr>
          ${p.reference ? `<tr><td>${L('المرجع', 'Reference')}</td><td>${p.reference}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(p.amount)}</span></div>
      </div>
      ${p.notes ? `<div class="notes">${p.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('العامل', 'Cashier')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('العميل', 'Customer')}</div></div>
      </div>
    `
    printHTML(html, `${L('سند قبض', 'Receipt')} ${p.code}`)
  }

  return (
    <ModuleShell
      title={L('سندات القبض - المبيعات', 'Sales Receipts')}
      description={L('سندات قبض العملاء وإيصالات الاستلام', 'Customer receipts and payment collection vouchers')}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('قبوض هذا الشهر', 'This Month Total')} value={formatCurrency(stats.monthTotal)} icon={<Receipt className="size-5" />} accent="blue" />
        <KpiCard title={L('عدد السندات', 'Total Count')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
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
                <TableRow key={p.id} className="hover:bg-muted/40 align-middle">
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={p.code}>{p.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(p.partner)}>{partnerName(p.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === p.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(p.amount)}</span></TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="text-xs">{methodLabel(p.method)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={p.status} /></div></TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <Button size="icon" variant="ghost" className="size-8" title={L('طباعة سند القبض', 'Print Receipt')} onClick={() => handlePrint(p)}>
                      <Printer className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{L('سند قبض جديد', 'New Receipt')}</DialogTitle>
            <DialogDescription>{L('إنشاء سند قبض من عميل — سيُرحّل القيد المحاسبي تلقائياً (من ح/ النقدية إلى ح/ الذمم المدينة)', 'Create customer receipt — entry will be automatically posted (Cash/Bank to Accounts Receivable)')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
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
                  <Label>{L('الفاتورة (اختياري)', 'Linked Invoice (Optional)')}</Label>
                  <Select value={invoiceId} onValueChange={(v) => {
                    setInvoiceId(v)
                    const inv = invoices.find((i) => i.id === v)
                    if (inv) setAmount(String(Math.max(0, inv.total - inv.paid)))
                  }}>
                    <SelectTrigger><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
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
                  <Label htmlFor="amount">{L('المبلغ *', 'Amount *')}</Label>
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
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{isRTL ? m.ar : m.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference">{L('المرجع', 'Reference')}</Label>
                  <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={L('رقم شيك / مرجع تحويل', 'Check # / Transfer Ref')} />
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
              {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('إنشاء وترحيل', 'Create & Post')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
