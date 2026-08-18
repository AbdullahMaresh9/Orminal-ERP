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
} from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Undo2, Plus, Trash2, Printer, CheckCircle2, Clock, Coins, PackageCheck, Download, FileSpreadsheet, FileText, FileDown, Eye,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string; nameEn?: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface SalesReturnLine {
  id?: string
  productId?: string
  product?: { id: string; sku: string; nameAr: string; nameEn?: string }
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
}

interface SalesReturn {
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
  lines: SalesReturnLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'approved', 'received', 'credited', 'closed', 'cancelled']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  approved: { ar: 'معتمد', en: 'Approved' },
  received: { ar: 'مستلم', en: 'Received' },
  credited: { ar: 'مُصدَر إشعار دائن', en: 'Credited' },
  closed: { ar: 'مغلق', en: 'Closed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const VISIBLE_ROWS = 7
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

export function SalesReturnsModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const partnerName = (p?: Partner) => (p ? (isRTL ? p.nameAr : p.nameEn || p.nameAr) : '')
  const productName = (pr?: { nameAr: string; nameEn?: string }) => (pr ? (isRTL ? pr.nameAr : pr.nameEn || pr.nameAr) : '')

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesReturn[]; meta: any }>({
    queryKey: ['sales-returns', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-returns?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-sr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['sales-invoices-for-sr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/sales-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: { id: string; sku: string; nameAr: string; nameEn?: string; salePrice: number }[] }>({
    queryKey: ['products-for-sr'],
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
    pending: returns.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'received').length,
    approved: returns.filter((r) => r.status === 'credited' || r.status === 'closed').length,
    totalValue: returns.reduce((s, r) => s + r.total, 0),
  }), [returns])

  // Form
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [originalInvoiceId, setOriginalInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitPrice: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0
    for (const l of lines) {
      const sub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
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
        if (p) next.unitPrice = String(p.salePrice)
      }
      return next
    }))
  }

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitPrice: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'At least one item line is required')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setSelectedReturn(null)
    setViewOnly(false)
    setPartnerId(''); setOriginalInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason(''); setNotes(''); setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', taxRate: '15' }])
  }

  const openView = (r: SalesReturn) => {
    setSelectedReturn(r)
    setViewOnly(true)
    setPartnerId(r.partnerId || r.partner?.id || '')
    setOriginalInvoiceId(r.originalInvoiceId || '')
    setDate((r.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10))
    setReason(r.reason || '')
    setNotes(r.notes || '')
    if (r.lines && r.lines.length > 0) {
      setLines(
        r.lines.map((l, idx) => ({
          key: l.id || String(idx + 1),
          productId: l.productId || l.product?.id || '',
          quantity: String(l.quantity ?? 1),
          unitPrice: String(l.unitPrice ?? 0),
          taxRate: String(l.taxRate ?? 15),
        }))
      )
    } else {
      setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', taxRate: '15' }])
    }
    setAddOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error(L('اختر العميل', 'Select a customer'))
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        partnerId,
        originalInvoiceId: originalInvoiceId || undefined,
        date,
        reason,
        status: 'draft',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/sales-returns', {
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
      toast.success(L('تم إنشاء مرتجع المبيعات', 'Sales return created successfully'))
      qc.invalidateQueries({ queryKey: ['sales-returns'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ ret, action }: { ret: SalesReturn; action: string }) => {
      const r = await fetch(`/api/erp/sales-returns/${ret.id}`, {
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
      toast.success(L('تم تنفيذ الإجراء', 'Action executed successfully'))
      qc.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<SalesReturn>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 14, align: 'center', value: (r) => r.code },
    { key: 'customer', header: L('العميل', 'Customer'), width: 22, align: 'center', value: (r) => partnerName(r.partner) },
    { key: 'invoice', header: L('الفاتورة الأصلية', 'Original Invoice'), width: 16, align: 'center', value: (r) => invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '—' },
    { key: 'date', header: L('التاريخ', 'Date'), width: 14, align: 'center', type: 'date', value: (r) => formatDate(r.date), dateValue: (r) => r.date },
    { key: 'total', header: L('الإجمالي', 'Total'), width: 16, align: 'center', type: 'currency', summable: true, value: (r) => r.total },
    { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', value: (r) => STATUS_LABELS[r.status]?.[isRTL ? 'ar' : 'en'] ?? r.status },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('مرتجعات_المبيعات', 'sales-returns'),
    title: L('تقرير مرتجعات المبيعات', 'Sales Returns Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي المرتجعات', 'Total Returns'), value: formatInt(stats.total) },
      { label: L('قيد المعالجة', 'In Progress'), value: formatInt(stats.pending) },
      { label: L('مُرحّلة', 'Approved/Closed'), value: formatInt(stats.approved) },
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
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (r: SalesReturn) => {
    const origInv = invoices.find((i) => i.id === r.originalInvoiceId)
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
          <div class="type">${L('مرتجع مبيعات', 'Sales Return')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('العميل', 'Customer')}</div>
        <div class="name">${partnerName(r.partner)}</div>
        <div class="sub">${L('رقم الحساب', 'Account Code')}: ${r.partner?.code ?? ''}</div>
        ${origInv ? `<div class="sub">${L('فاتورة أصلية', 'Original Invoice')}: ${origInv.code}</div>` : ''}
        ${r.reason ? `<div class="sub">${L('السبب', 'Reason')}: ${r.reason}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية', 'Qty')}</th>
            <th>${L('السعر', 'UnitPrice')}</th>
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
              <td>${formatCurrency(l.unitPrice)}</td>
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
        <div class="sig"><div class="line"></div><div class="label">${L('العميل', 'Customer')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير', 'Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('مرتجع مبيعات', 'Sales Return')} ${r.code}`)
  }

  return (
    <ModuleShell
      title={L('مرتجعات المبيعات', 'Sales Returns')}
      description={L('إدارة مرتجعات المبيعات مع عكس القيود تلقائياً عند الإصدار', 'Manage sales returns with automatic entry reversal upon posting')}
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز المرتجع أو السبب...', 'Search by code or reason...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('مرتجع جديد', 'New Return')}
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
          <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
            {STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي المرتجعات', 'Total Returns')} value={formatInt(stats.total)} icon={<Undo2 className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'In Progress')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('مُرحّلة', 'Approved/Closed')} value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title={L('إجمالي القيمة', 'Total Value')} value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[19%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-6 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العميل', 'Customer')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الفاتورة الأصلية', 'Original Invoice')}</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد مرتجعات.', 'No returns found.')}</TableCell></TableRow>
              ) : returns.map((r) => (
                <TableRow
                  key={r.id}
                  className="hover:bg-muted/40 align-middle cursor-pointer"
                  onClick={() => openView(r)}
                >
                  <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={r.code}>{r.code}</TableCell>
                  <TableCell className="font-medium border-b truncate" title={partnerName(r.partner)}>{partnerName(r.partner) || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-center border-b truncate" dir="ltr">{invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm text-center whitespace-nowrap border-b">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap border-b"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(r.total)}</span></TableCell>
                  <TableCell className="text-center border-b"><div className="flex justify-center"><StatusBadge status={r.status} /></div></TableCell>
                  <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-sky-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'approve' })}>
                          <CheckCircle2 className="size-3.5" /> {L('اعتماد', 'Approve')}
                        </Button>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'receive' })}>
                          <PackageCheck className="size-3.5" /> {L('استلام', 'Receive')}
                        </Button>
                      )}
                      {r.status === 'received' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'credit' })}>
                          <Coins className="size-3.5" /> {L('إصدار إشعار دائن', 'Issue Credit Note')}
                        </Button>
                      )}
                      {r.status === 'credited' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-700" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'close' })}>
                          {L('إغلاق', 'Close')}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" title={L('عرض مرتجع المبيعات', 'View Sales Return')} onClick={() => openView(r)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" title={L('طباعة مرتجع المبيعات', 'Print Sales Return')} onClick={() => handlePrint(r)}>
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm() }}>
        <DialogContent
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>
              {viewOnly ? L('عرض مرتجع مبيعات', 'View Sales Return') : L('مرتجع مبيعات جديد', 'New Sales Return')}
            </DialogTitle>
            {!viewOnly && (
              <DialogDescription>{L('حدد العميل والفاتورة الأصلية والبنود المرتجعة', 'Select customer, original invoice, and returned line items')}</DialogDescription>
            )}
          </DialogHeader>
          <DialogBody className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <fieldset disabled={viewOnly} className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label>{L('الفاتورة الأصلية', 'Original Invoice')}</Label>
                  <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={L('اختياري', 'Optional')} /></SelectTrigger>
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
                <div className="space-y-1.5">
                  <Label htmlFor="date">{L('التاريخ', 'Date')}</Label>
                  <DatePicker id="date" value={date} onChange={setDate} disabled={viewOnly} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">{L('سبب الإرجاع', 'Return Reason')}</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={L('مثال: تالف، خطأ في الشحن...', 'e.g. Damaged, Shipping Error...')} />
              </div>

              {/* ===== البنود: كروت على الجوال (md-) ===== */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm">{L('البنود المرتجعة', 'Return Items')}</Label>
                  {!viewOnly && (
                    <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 text-xs gap-1">
                      <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                    </Button>
                  )}
                </div>
                {lines.map((l, index) => {
                  const qty = Number(l.quantity) || 0
                  const price = Number(l.unitPrice) || 0
                  const taxRate = Number(l.taxRate) || 0
                  const lineTotal = qty * price * (1 + taxRate / 100)
                  return (
                    <Card key={l.key} className="p-3 space-y-3 relative bg-card">
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                        {!viewOnly && (
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-rose-500 hover:text-rose-600" onClick={() => removeLine(l.key)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1">
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

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{L('الكمية', 'Qty')}</Label>
                          <Input className="h-9 text-start tabular-nums" type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{L('السعر', 'Price')}</Label>
                          <Input className="h-9 text-start tabular-nums" type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
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
                {!viewOnly && (
                  <Button type="button" size="sm" variant="outline" onClick={addLine} className="w-full gap-1.5">
                    <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                  </Button>
                )}
              </div>

              {/* ===== البنود: جدول على التابلت/الديسكتوب (md+) ===== */}
              <Card className="rounded-lg overflow-hidden hidden md:block">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="ps-3 min-w-[200px]">{L('المنتج', 'Product')}</TableHead>
                        <TableHead className="text-end num-cell w-20">{L('الكمية', 'Qty')}</TableHead>
                        <TableHead className="text-end num-cell w-28">{L('السعر', 'Price')}</TableHead>
                        <TableHead className="text-end num-cell w-20">{L('الضريبة %', 'Tax %')}</TableHead>
                        <TableHead className="text-end num-cell w-28">{L('الإجمالي', 'Total')}</TableHead>
                        {!viewOnly && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => {
                        const qty = Number(l.quantity) || 0
                        const price = Number(l.unitPrice) || 0
                        const taxRate = Number(l.taxRate) || 0
                        const lineTotal = qty * price * (1 + taxRate / 100)
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
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-start num-cell">
                              <Input className="h-9 text-start tabular-nums" type="number" step="0.01" inputMode="decimal" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                            </TableCell>
                            <TableCell className="text-end num-cell">
                              <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                            </TableCell>
                            {!viewOnly && (
                              <TableCell>
                                <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4}>
                          {!viewOnly && (
                            <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                              <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(computed.total)}</span>
                        </TableCell>
                        {!viewOnly && <TableCell></TableCell>}
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Card>

              {/* ملخص المبالغ */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-muted-200 dark:border-muted-900">
                  <p className="text-xs text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.subtotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted-900/30 border border-muted-200 dark:border-muted-900">
                  <p className="text-xs text-muted-foreground">{L('الضريبة', 'Tax')}</p>
                  <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.taxTotal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 col-span-2 sm:col-span-1">
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
            {viewOnly && selectedReturn && (
              <Button type="button" variant="secondary" className="w-full border sm:w-auto sm:min-w-25 gap-1.5" onClick={() => handlePrint(selectedReturn)}>
                <Printer className="size-4" />
                {L('طباعة', 'Print')}
              </Button>
            )}
            {!viewOnly && (
              <Button type="button" className="w-full sm:w-auto sm:min-w-30" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('إنشاء', 'Create')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
