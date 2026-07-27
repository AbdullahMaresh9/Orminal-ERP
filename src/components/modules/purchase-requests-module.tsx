'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDate } from '@/lib/format'
import { printHTML, exportRows, type ExportColumn, type ExportMeta, type ExportFormat } from '@/lib/export'
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

import {
  ClipboardList, Plus, Trash2, Printer, CheckCircle2, Clock, FileCheck2, ShoppingCart,
  Download, FileSpreadsheet, FileText, FileDown,
} from 'lucide-react'

interface Product { id: string; sku: string; nameAr: string }
interface Partner { id: string; code: string; nameAr: string }
interface CostCenter { id: string; code: string; nameAr: string }
interface PurchaseRequestLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  requiredDate?: string
  costCenter?: CostCenter
  notes?: string
}
interface PurchaseRequest {
  id: string
  code: string
  requesterId?: string
  department?: string
  requiredDate?: string
  status: string
  notes?: string
  createdAt: string
  lines: PurchaseRequestLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  requiredDate: string
  costCenterId: string
  notes: string
}

const STATUS_FLOW = ['draft', 'submitted', 'approved', 'rejected', 'converted']
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  submitted: { ar: 'مُقدمة', en: 'Submitted' },
  approved: { ar: 'معتمدة', en: 'Approved' },
  rejected: { ar: 'مرفوضة', en: 'Rejected' },
  converted: { ar: 'تم تحويلها', en: 'Converted' },
}

// عدد الصفوف الظاهرة قبل ظهور الاسكرول
const VISIBLE_ROWS = 5
const ROW_HEIGHT = 52    // ارتفاع الصف التقريبي بالبكسل
const HEADER_HEIGHT = 44 // ارتفاع رأس الجدول

const DEPARTMENTS_BI: { ar: string; en: string }[] = [
  { ar: 'المشتريات', en: 'Procurement' },
  { ar: 'المالية', en: 'Finance' },
  { ar: 'المبيعات', en: 'Sales' },
  { ar: 'المخزون', en: 'Inventory' },
  { ar: 'تقنية المعلومات', en: 'IT' },
  { ar: 'الموارد البشرية', en: 'HR' },
  { ar: 'الإدارة', en: 'Management' },
]

export function PurchaseRequestsModule() {
  const { t, isRTL } = useT()
  const qc = useQueryClient()

  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const deptLabel = (d: typeof DEPARTMENTS_BI[0]) => isRTL ? d.ar : d.en

  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseRequest[]; meta: any }>({
    queryKey: ['purchase-requests', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-requests?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: costCentersData } = useQuery<{ data: CostCenter[] }>({
    queryKey: ['cost-centers-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/cost-centers?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: suppliersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const requests = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const products = productsData?.data ?? []
  const costCenters = costCentersData?.data ?? []
  const suppliers = suppliersData?.data ?? []

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'draft' || r.status === 'submitted').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    converted: requests.filter((r) => r.status === 'converted').length,
  }), [requests])

  // Form
  const [department, setDepartment] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' },
  ])
  const [convertTarget, setConvertTarget] = useState<PurchaseRequest | null>(null)
  const [convertPartnerId, setConvertPartnerId] = useState('')

  const resetForm = () => {
    setDepartment(''); setRequiredDate(''); setNotes('')
    setLines([{ key: '1', productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' }])
  }

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
  }
  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error(L('يجب وجود بند واحد على الأقل', 'At least one line is required')); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error(L('أضف بنداً واحداً على الأقل', 'Add at least one line item'))
      const payload = {
        department,
        requiredDate: requiredDate || undefined,
        status: 'submitted',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          requiredDate: l.requiredDate || undefined,
          costCenterId: l.costCenterId || undefined,
          notes: l.notes,
        })),
      }
      const r = await fetch('/api/erp/purchase-requests', {
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
      toast.success(L('تم إنشاء طلب الشراء', 'Purchase request created'))
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ req, action, partnerId: pid }: { req: PurchaseRequest; action: 'approve' | 'reject' | 'convert'; partnerId?: string }) => {
      if (action === 'convert') {
        if (!pid) throw new Error(L('اختر المورد أولاً', 'Please select a supplier first'))
        const payload = {
          partnerId: pid,
          orderDate: new Date().toISOString().slice(0, 10),
          status: 'draft',
          lines: req.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: 0,
          })),
        }
        const r = await fetch('/api/erp/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err?.error?.message ?? L('فشل التحويل', 'Conversion failed'))
        }
        // Update PR status to converted
        await fetch(`/api/erp/purchase-requests/${req.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'converted' }),
        })
        return r.json()
      }
      const r = await fetch(`/api/erp/purchase-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل الإجراء', 'Action failed'))
      }
      return r.json()
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'convert' ? L('تم التحويل إلى أمر شراء', 'Converted to purchase order') : L('تم تنفيذ الإجراء', 'Action completed'))
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (vars.action === 'convert') {
        setConvertTarget(null); setConvertPartnerId('')
      }
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const exportColumns: ExportColumn<PurchaseRequest>[] = [
    { key: 'code', header: L('الرمز', 'Code'), width: 16, align: 'start', type: 'text', value: (r) => r.code },
    { key: 'department', header: L('الإدارة', 'Department'), width: 18, align: 'start', type: 'text', value: (r) => r.department ?? '' },
    { key: 'requiredDate', header: L('التاريخ المطلوب', 'Required Date'), width: 14, align: 'center', type: 'date', value: (r) => r.requiredDate ? formatDate(r.requiredDate) : '', dateValue: (r) => r.requiredDate },
    { key: 'createdAt', header: L('تاريخ الإنشاء', 'Created'), width: 14, align: 'center', type: 'date', value: (r) => formatDate(r.createdAt), dateValue: (r) => r.createdAt },
    { key: 'lines', header: L('عدد البنود', 'Lines'), width: 10, align: 'center', type: 'number', value: (r) => r.lines.length },
    { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', type: 'text', value: (r) => statusLabel(r.status) },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('طلبات-الشراء', 'purchase-requests'),
    title: L('تقرير طلبات الشراء', 'Purchase Requests Report'),
    subtitle: L('أورمنال', 'Orminal'),
    isRTL,
    summary: [
      { label: L('إجمالي الطلبات', 'Total Requests'), value: formatInt(stats.total) },
      { label: L('قيد المعالجة', 'Pending'), value: formatInt(stats.pending) },
      { label: L('معتمدة', 'Approved'), value: formatInt(stats.approved) },
      { label: L('مُحوّلة', 'Converted'), value: formatInt(stats.converted) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated'),
      totalRecords: L('عدد السجلات', 'Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!requests.length) { toast.error(L('لا توجد بيانات للتصدير', 'No data to export')); return }
    try {
      await exportRows(format, requests, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف', 'File exported'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const handlePrint = (r: PurchaseRequest) => {
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
          <div class="type">${L('طلب شراء', 'Purchase Request')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.createdAt)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">${L('الإدارة', 'Department')}</div>
        <div class="name">${r.department ?? '—'}</div>
        ${r.requiredDate ? `<div class="sub">${L('التاريخ المطلوب', 'Required Date')}: ${formatDate(r.requiredDate)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>${L('المنتج', 'Product')}</th>
            <th>${L('الكمية', 'Qty')}</th>
            <th>${L('التاريخ المطلوب', 'Required Date')}</th>
            <th>${L('ملاحظات', 'Notes')}</th>
          </tr>
        </thead>
        <tbody>
          ${r.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.quantity}</td>
              <td>${l.requiredDate ? formatDate(l.requiredDate) : '—'}</td>
              <td>${l.notes ?? ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${r.notes ? `<div class="notes">${r.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">${L('طالب الشراء', 'Requester')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('مدير المشتريات', 'Procurement Manager')}</div></div>
        <div class="sig"><div class="line"></div><div class="label">${L('المدير المالي', 'Finance Manager')}</div></div>
      </div>
    `
    printHTML(html, `${L('طلب شراء', 'Purchase Request')} ${r.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  return (
    <ModuleShell
      title={t('module.purchase-requests')}
      description={L('طلبات الشراء الداخلية وتحويلها إلى أوامر شراء', 'Internal purchase requests and conversion to purchase orders')}
      icon={<ClipboardList className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز الطلب...', 'Search by request code...')}
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel={L('طلب شراء جديد', 'New Request')}
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
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي الطلبات', 'Total Requests')} value={formatInt(stats.total)} icon={<ClipboardList className="size-5" />} accent="blue" />
        <KpiCard title={L('قيد المعالجة', 'Pending')} value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title={L('معتمدة', 'Approved')} value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title={L('مُحوّلة', 'Converted')} value={formatInt(stats.converted)} icon={<FileCheck2 className="size-5" />} accent="violet" />
      </div>

      {/* جدول طلبات الشراء — رأس ثابت + تمرير للصفوف فقط + أعمدة بعرض ثابت لمحاذاة دقيقة */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[16%]" />{/* الإدارة */}
              <col className="w-[15%]" />{/* التاريخ المطلوب */}
              <col className="w-[14%]" />{/* تاريخ الإنشاء */}
              <col className="w-[10%]" />{/* عدد البنود */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[21%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الإدارة', 'Department')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ المطلوب', 'Required Date')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('تاريخ الإنشاء', 'Created')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('عدد البنود', 'Lines')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{L('جاري التحميل...', 'Loading...')}</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{L('لا توجد طلبات شراء.', 'No purchase requests found.')}</TableCell></TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium truncate">{r.department ?? '—'}</TableCell>
                  <TableCell className="text-center text-sm">{r.requiredDate ? formatDate(r.requiredDate) : '—'}</TableCell>
                  <TableCell className="text-center text-sm">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="text-center"><span className="num tabular-nums" dir="ltr">{r.lines.length}</span></TableCell>
                  <TableCell className="text-center"><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end pe-4">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'submitted' && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ req: r, action: 'approve' })}>
                            <CheckCircle2 className="size-3.5" /> {L('اعتماد', 'Approve')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-rose-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ req: r, action: 'reject' })}>
                            {L('رفض', 'Reject')}
                          </Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600" onClick={() => { setConvertTarget(r); setConvertPartnerId('') }}>
                          <ShoppingCart className="size-3.5" /> {L('تحويل لأمر شراء', 'Convert to PO')}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)}>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{L('طلب شراء جديد', 'New Purchase Request')}</DialogTitle>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{L('الإدارة', 'Department')}</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder={L('اختر الإدارة', 'Select department')} /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS_BI.map((d) => <SelectItem key={d.ar} value={d.ar}>{deptLabel(d)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requiredDate">{L('التاريخ المطلوب', 'Required Date')}</Label>
                <Input id="requiredDate" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
              </div>
            </div>

            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3 w-60">{L('المنتج', 'Product')}</TableHead>
                    <TableHead className="text-start w-42">{L('الكمية', 'Qty')}</TableHead>
                    <TableHead className="w-32">{L('التاريخ المطلوب', 'Required Date')}</TableHead>
                    <TableHead className="w-40">{L('مركز التكلفة', 'Cost Center')}</TableHead>
                    <TableHead className="w-40">{L('ملاحظات', 'Notes')}</TableHead>
                    <TableHead className="w-15"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key} >
                      <TableCell className="ps-3">
                        <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                          <SelectTrigger className="h-9 min-w-[210px]"><SelectValue placeholder={L('اختر المنتج', 'Select product')} /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-start ps-1 num-cell">
                        <Input className="h-9 text-start tabular-nums" type="number" step="1" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                      </TableCell>
                      <TableCell className="ps-1">
                        <Input className="h-9 ps-1" type="date" value={l.requiredDate} onChange={(e) => updateLine(l.key, 'requiredDate', e.target.value)} />
                      </TableCell>
                      <TableCell className="ps-1">
                        <Select value={l.costCenterId} onValueChange={(v) => updateLine(l.key, 'costCenterId', v)}>
                          <SelectTrigger className="h-9 ps-1"><SelectValue placeholder={L('بدون', 'None')} /></SelectTrigger>
                          <SelectContent >
                            {costCenters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span dir="ltr" className="font-mono text-xs">{c.code}</span> — {c.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="ps-1">
                        <Input className="h-9" value={l.notes} onChange={(e) => updateLine(l.key, 'notes', e.target.value)} placeholder="—" />
                      </TableCell>
                      <TableCell className="ps-1">
                        <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                          <Trash2 className="size-4.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                        <Plus className="size-3.5" /> {L('إضافة بند', 'Add Line')}
                      </Button>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>

            <div className="space-y-1.5">
              <Label htmlFor="notes">{L('ملاحظات', 'Notes')}</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('ملاحظات إضافية...', 'Additional notes...')} />
            </div>
          </div>

          </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{L('إلغاء', 'Cancel')}</Button>
              <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('إنشاء وتقديم', 'Create & Submit')}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertTarget} onOpenChange={(o) => { if (!o) { setConvertTarget(null); setConvertPartnerId('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{L('تحويل إلى أمر شراء', 'Convert to Purchase Order')}</DialogTitle>
            <DialogDescription>
              {L(`اختر المورد لإنشاء أمر شراء من الطلب ${convertTarget?.code}`, `Select a supplier to create a purchase order from request ${convertTarget?.code}`)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{L('المورد', 'Supplier')} *</Label>
              <Select value={convertPartnerId} onValueChange={setConvertPartnerId}>
                <SelectTrigger><SelectValue placeholder={L('اختر المورد', 'Select supplier')} /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span dir="ltr" className="font-mono text-xs">{p.code}</span> — {p.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {convertTarget && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">{L('عدد البنود', 'Lines')}: {convertTarget.lines.length}</p>
                <ul className="mt-1 space-y-0.5">
                  {convertTarget.lines.slice(0, 4).map((l) => (
                    <li key={l.id} className="text-xs">{l.product?.nameAr} × <span className="num" dir="ltr">{l.quantity}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setConvertTarget(null); setConvertPartnerId('') }}>{L('إلغاء', 'Cancel')}</Button>
              <Button type="button" disabled={actionMutation.isPending || !convertPartnerId} onClick={() => convertTarget && actionMutation.mutate({ req: convertTarget, action: 'convert', partnerId: convertPartnerId })}>
                {actionMutation.isPending ? L('جاري التحويل...', 'Converting...') : L('تحويل', 'Convert')}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
