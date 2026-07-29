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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table'
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
  ReceiptText, Plus, Printer, Hash, CalendarDays, Coins, FileMinus, Download, FileSpreadsheet, FileText, FileDown,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface SalesCreditNote {
  id: string
  code: string
  partnerId: string
  invoiceId?: string | null
  date: string
  reason?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  notes?: string
  partner?: Partner
}

const REASON_OPTIONS = [
  { value: 'returned', ar: 'مرتجع بضاعة', en: 'Returned Goods' },
  { value: 'discount', ar: 'خصم بعد الفوترة', en: 'Post-invoicing Discount' },
  { value: 'correction', ar: 'تصحيح خطأ', en: 'Error Correction' },
  { value: 'cancellation', ar: 'إلغاء فاتورة', en: 'Invoice Cancellation' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
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

export function SalesCreditNotesModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const partnerName = (p?: Partner) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesCreditNote[]; meta: any }>({
    queryKey: ['sales-credit-notes', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-credit-notes?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-scn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['sales-invoices-for-scn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/sales-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const notes = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = notes.filter((n) => {
      const d = new Date(n.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      total: notes.reduce((s, n) => s + n.total, 0),
      count: notes.length,
      thisMonthTotal: thisMonth.reduce((s, n) => s + n.total, 0),
      thisMonthCount: thisMonth.length,
    }
  }, [notes])

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('returned')
  const [subtotal, setSubtotal] = useState('0')
  const [taxRate, setTaxRate] = useState('15')
  const [notes_, setNotes] = useState('')

  const taxTotal = useMemo(() => (Number(subtotal) || 0) * (Number(taxRate) || 0) / 100, [subtotal, taxRate])
  const total_ = useMemo(() => (Number(subtotal) || 0) + taxTotal, [subtotal, taxRate, taxTotal])

  const resetForm = () => {
    setPartnerId(''); setInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason('returned'); setSubtotal('0'); setTaxRate('15'); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر العميل', 'Select a customer'))
      const sub = Number(subtotal) || 0
      if (sub <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero'))
      const selectedReasonObj = REASON_OPTIONS.find((r) => r.value === reason)
      const reasonLabel = selectedReasonObj ? (isRTL ? selectedReasonObj.ar : selectedReasonObj.en) : reason
      const payload = {
        partnerId,
        invoiceId: invoiceId || undefined,
        date,
        reason: reasonLabel,
        status: 'posted',
        subtotal: sub,
        taxTotal,
        total: total_,
        notes: notes_,
      }
      const r = await fetch('/api/erp/sales-credit-notes', {
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
      toast.success(L('تم إنشاء الإشعار الدائن بنجاح', 'Sales credit note created successfully'))
      qc.invalidateQueries({ queryKey: ['sales-credit-notes'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<SalesCreditNote>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'center', value: (n) => n.code },
    { key: 'customer', header: L('العميل', 'Customer'), width: 22, align: 'center', value: (n) => partnerName(n.partner) },
    { key: 'invoice', header: L('الفاتورة', 'Invoice'), width: 16, align: 'center', value: (n) => invoices.find((i) => i.id === n.invoiceId)?.code ?? '—' },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (n) => formatDate(n.date), dateValue: (n) => n.date },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 16, align: 'center', type: 'currency', summable: true, value: (n) => n.total },
    { key: 'status', header: L('الحالة', 'Status'), width: 12, align: 'center', value: (n) => STATUS_LABELS[n.status]?.[isRTL ? 'ar' : 'en'] ?? n.status },
    { key: 'reason', header: L('السبب', 'Reason'), width: 18, align: 'center', value: (n) => n.reason ?? '—' },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('الإشعارات_الدائنة_مبيعات', 'sales-credit-notes'),
    title: L('تقرير الإشعارات الدائنة - المبيعات', 'Sales Credit Notes Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي الإشعارات', 'Total Amount'), value: formatCurrency(stats.total) },
      { label: L('عدد الإشعارات', 'Total Count'), value: formatInt(stats.count) },
      { label: L('هذا الشهر', 'This Month Amount'), value: formatCurrency(stats.thisMonthTotal) },
      { label: L('عدد هذا الشهر', 'This Month Count'), value: formatInt(stats.thisMonthCount) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!notes.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, notes, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (n: SalesCreditNote) => {
    const inv = invoices.find((i) => i.id === n.invoiceId)
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
          <div class="type">${L('إشعار دائن - مبيعات', 'Sales Credit Note')}</div>
          <div class="code">${n.code}</div>
          <div class="date">${formatDate(n.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('العميل', 'Customer')}</div>
        <div class="name">${partnerName(n.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${n.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">${L('فاتورة مرتبطة', 'Linked Invoice')}: ${inv.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>${L('البيان', 'Description')}</th>
            <th>${L('القيمة', 'Amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>${L('المجموع الفرعي', 'Subtotal')}</td><td>${formatCurrency(n.subtotal)}</td></tr>
          <tr><td>${L('الضريبة', 'Tax')}</td><td>${formatCurrency(n.taxTotal)}</td></tr>
          <tr><td>${L('السبب', 'Reason')}</td><td>${n.reason ?? ''}</td></tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(n.total)}</span></div>
      </div>
      ${n.notes ? `<div class="notes">${n.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('العميل', 'Customer')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('إشعار دائن', 'Credit Note')} ${n.code}`)
  }

  return (
    <ModuleShell
      title={L('الإشعارات الدائنة - المبيعات', 'Sales Credit Notes')}
      description={L('إشعارات دائنة للمبيعات مع عكس القيود تلقائياً', 'Sales credit notes with automatic entry reversal')}
      icon={<FileMinus className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الإشعار أو السبب...', 'Search by credit note code or reason...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('إشعار دائن جديد', 'New Credit Note')}
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
        <KpiCard title={L('إجمالي الإشعارات', 'Total Amount')} value={formatCurrency(stats.total)} icon={<Coins className="size-5" />} accent="blue" />
        <KpiCard title={L('عدد الإشعارات', 'Total Count')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title={L('هذا الشهر', 'This Month')} value={formatCurrency(stats.thisMonthTotal)} icon={<CalendarDays className="size-5" />} accent="amber" />
        <KpiCard title={L('عدد هذا الشهر', 'This Month Count')} value={formatInt(stats.thisMonthCount)} icon={<ReceiptText className="size-5" />} accent="violet" />
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
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-6 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العميل', 'Customer')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الفاتورة', 'Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('السبب', 'Reason')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : notes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد إشعارات دائنة.', 'No sales credit notes found.')}</TableCell></TableRow>
              ) : notes.map((n) => (
                <TableRow key={n.id} className="hover:bg-muted/40 align-middle">
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={n.code}>{n.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(n.partner)}>{partnerName(n.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === n.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(n.date)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(n.total)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={n.status} /></div></TableCell>
                  <TableCell className="text-sm text-center border-b truncate text-muted-foreground" title={n.reason ?? ''}>{n.reason ?? '—'}</TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <Button size="icon" variant="ghost" className="size-8" title={L('طباعة الإشعار الدائن', 'Print Credit Note')} onClick={() => handlePrint(n)}>
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
            <DialogTitle>{L('إشعار دائن جديد', 'New Sales Credit Note')}</DialogTitle>
            <DialogDescription>{L('إنشاء إشعار دائن لعميل — سيتم عكس قيد الفاتورة الأصلية تلقائياً عند الترحيل', 'Create credit note for customer — original invoice entry will be automatically reversed upon posting')}</DialogDescription>
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
                  <Label>{L('الفاتورة المرتبطة (اختياري)', 'Linked Invoice (Optional)')}</Label>
                  <Select value={invoiceId} onValueChange={(v) => {
                    setInvoiceId(v)
                    const inv = invoices.find((i) => i.id === v)
                    if (inv) setSubtotal(String(inv.total))
                  }}>
                    <SelectTrigger><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
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
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date">{L('التاريخ', 'Date')}</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subtotal">{L('المبلغ قبل الضريبة', 'Subtotal')}</Label>
                  <Input id="subtotal" type="number" step="0.01" dir="ltr" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxRate">{L('نسبة الضريبة %', 'Tax %')}</Label>
                  <Input id="taxRate" type="number" step="0.01" dir="ltr" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{L('السبب', 'Reason')}</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
                      {REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{isRTL ? r.ar : r.en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(Number(subtotal) || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">{L('الضريبة', 'Tax')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(taxTotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <p className="text-xs text-blue-700 dark:text-blue-400">{L('الإجمالي', 'Total')}</p>
                  <p className="font-bold tabular-nums text-blue-700 dark:text-blue-400" dir="ltr">{formatCurrency(total_)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes_">{L('ملاحظات', 'Notes')}</Label>
                <Textarea id="notes_" value={notes_} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
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
