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
import { ScrollArea } from '@/components/ui/scroll-area'
import { DatePicker } from '@/components/ui/date-picker'
import {
  FileMinus, Plus, Printer, Hash, CalendarDays, Coins,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface PurchaseCreditNote {
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

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

const REASON_OPTIONS = [
  { value: 'returned', ar: 'مرتجع بضاعة للمورد', en: 'Goods Returned to Supplier' },
  { value: 'discount', ar: 'خصم بعد الفوترة', en: 'Post-invoicing Discount' },
  { value: 'correction', ar: 'تصحيح خطأ', en: 'Error Correction' },
  { value: 'cancellation', ar: 'إلغاء فاتورة', en: 'Invoice Cancellation' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
]

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  posted: { ar: 'مُرحّل', en: 'Posted' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

export function PurchaseCreditNotesModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: Partner) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'
  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseCreditNote[]; meta: any }>({
    queryKey: ['purchase-credit-notes', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-credit-notes?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['purchase-invoices-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices?pageSize=200')
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

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('returned')
  const [amount, setAmount] = useState('0')
  const [notes_, setNotes] = useState('')

  const resetForm = () => {
    setPartnerId(''); setInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason('returned'); setAmount('0'); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر المورد', 'Select supplier'))
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error(L('المبلغ يجب أن يكون أكبر من صفر', 'Amount must be greater than zero'))
      const opt = REASON_OPTIONS.find((r) => r.value === reason)
      const selectedReasonText = opt ? (isRTL ? opt.ar : opt.en) : reason
      const payload = {
        partnerId,
        invoiceId: invoiceId || null,
        date,
        reason: selectedReasonText,
        subtotal: amt,
        taxTotal: 0,
        total: amt,
        notes: notes_,
      }
      const r = await fetch('/api/erp/purchase-credit-notes', {
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
      toast.success(L('تم إنشاء الإشعار الدائن للمشتريات', 'Purchase credit note created successfully'))
      qc.invalidateQueries({ queryKey: ['purchase-credit-notes'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const handleExport = () => {
    const rows = notes.map((n) => ({
      [L('الرمز', 'Code')]: n.code,
      [L('المورد', 'Supplier')]: partnerName(n.partner),
      [L('الفاتورة', 'Invoice')]: invoices.find((i) => i.id === n.invoiceId)?.code ?? '',
      [L('التاريخ', 'Date')]: formatDate(n.date),
      [L('الإجمالي', 'Total')]: n.total,
      [L('الحالة', 'Status')]: statusLabel(n.status),
      [L('السبب', 'Reason')]: n.reason ?? '',
    }))
    exportToCSV('purchase-credit-notes', rows)
    toast.success(L('تم تصدير الملف', 'File exported successfully'))
  }

  const handlePrint = (n: PurchaseCreditNote) => {
    const inv = invoices.find((i) => i.id === n.invoiceId)
    const html = `
      <div class="doc-header" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>${L('أورمنال', 'Orminal')}</h2>
            <p>${L('نظام إدارة موارد المؤسسات ERP', 'Enterprise Resource Planning System')}</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">${L('إشعار دائن مشتريات', 'Purchase Credit Note')}</div>
          <div class="code">${n.code}</div>
          <div class="date">${formatDate(n.date)}</div>
        </div>
      </div>
      <div class="party" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="label">${L('المورد', 'Supplier')}</div>
        <div class="name">${partnerName(n.partner)}</div>
        <div class="sub">${L('رمز', 'Code')}: ${n.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">${L('فاتورة مرتبطة', 'Linked Invoice')}: ${inv.code}</div>` : ''}
      </div>
      <table dir="${isRTL ? 'rtl' : 'ltr'}">
        <thead>
          <tr>
            <th>${L('البيان', 'Description')}</th>
            <th>${L('القيمة', 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>${L('المبلغ', 'Amount')}</td><td>${formatCurrency(n.total)}</td></tr>
          <tr><td>${L('السبب', 'Reason')}</td><td>${n.reason ?? ''}</td></tr>
        </tbody>
      </table>
      <div class="totals" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="row grand"><span>${L('الإجمالي:', 'Total:')}</span><span>${formatCurrency(n.total)}</span></div>
      </div>
      ${n.notes ? `<div class="notes" dir="${isRTL ? 'rtl' : 'ltr'}">${n.notes}</div>` : ''}
      <div class="signatures" dir="${isRTL ? 'rtl' : 'ltr'}">
        <div class="sig"><div class="line"></div><div class="label">${L('المحاسب', 'Accountant')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المورد', 'Supplier')}</div></div>
      </div>
    `
    printHTML(html, `${L('إشعار دائن مشتريات', 'Purchase Credit Note')} ${n.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-credit-notes')}
      description={L('إشعارات دائنة للمشتريات مع تقليل رصيد المورد', 'Purchase credit notes with automatic supplier balance reduction')}
      icon={<FileMinus className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الإشعار أو السبب...', 'Search by credit note code or reason...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('إشعار دائن جديد', 'New Credit Note')}
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            <SelectItem value="draft">{L('مسودة', 'Draft')}</SelectItem>
            <SelectItem value="posted">{L('مُرحّل', 'Posted')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي الإشعارات', 'Total Credit Notes')} value={formatCurrency(stats.total)} icon={<Coins className="size-5" />} accent="blue" />
        <KpiCard title={L('عدد الإشعارات', 'Total Count')} value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title={L('هذا الشهر', 'This Month')} value={formatCurrency(stats.thisMonthTotal)} icon={<CalendarDays className="size-5" />} accent="amber" />
        <KpiCard title={L('عدد هذا الشهر', 'This Month Count')} value={formatInt(stats.thisMonthCount)} icon={<FileMinus className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[900px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المورد', 'Supplier')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الفاتورة', 'Invoice')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الإجمالي', 'Total')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('السبب', 'Reason')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : notes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{L('لا توجد إشعارات دائنة.', 'No purchase credit notes found.')}</TableCell></TableRow>
              ) : notes.map((n) => (
                <TableRow key={n.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">{n.code}</TableCell>
                  <TableCell className="font-medium border-b truncate">{partnerName(n.partner)}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === n.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center border-b whitespace-nowrap">{formatDate(n.date)}</TableCell>
                  <TableCell className="text-center border-b whitespace-nowrap"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(n.total)}</span></TableCell>
                  <TableCell className="text-center border-b"><StatusBadge status={n.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground border-b truncate">{n.reason ?? '—'}</TableCell>
                  <TableCell className="text-end pe-4 border-b">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(n)} title={L('طباعة', 'Print')}>
                      <Printer className="size-4.5" />
                    </Button>
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
            <DialogTitle>{L('إشعار دائن مشتريات جديد', 'New Purchase Credit Note')}</DialogTitle>

          </DialogHeader>

          <DialogBody>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{L('المورد *', 'Supplier *')}</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder={L('اختر المورد', 'Select Supplier')} /></SelectTrigger>
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
                  <Label>{L('الفاتورة المرتبطة (اختياري)', 'Linked Invoice (Optional)')}</Label>
                  <Select value={invoiceId} onValueChange={(v) => {
                    setInvoiceId(v)
                    const inv = invoices.find((i) => i.id === v)
                    if (inv) setAmount(String(inv.total))
                  }}>
                    <SelectTrigger><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
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
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date">{L('التاريخ', 'Date')}</Label>
                  <DatePicker id="date" value={date} onChange={setDate} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount">{L('المبلغ *', 'Amount *')}</Label>
                  <Input id="amount" type="number" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{L('السبب', 'Reason')}</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {isRTL ? r.ar : r.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
