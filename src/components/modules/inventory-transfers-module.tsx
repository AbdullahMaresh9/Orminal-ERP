'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatDate } from '@/lib/format'
import { exportRows, printHTML, ExportColumn, ExportMeta, ExportFormat } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeftRight, Plus, Trash2, CheckCircle2, XCircle, MoreVertical, Package, Truck,
  Download, FileSpreadsheet, FileText, FileCheck, ChevronDown, Eye, Printer
} from 'lucide-react'

interface Transfer {
  id: string
  code: string
  fromStorehouseId: string
  toStorehouseId: string
  status: string
  itemsJson: string
  note: string | null
  createdAt: string
  updatedAt: string
  fromStorehouse: { id: string; name: string; code: string }
  toStorehouse: { id: string; name: string; code: string }
}

// أبعاد الجدول وحساب الارتفاع الثابت لخمسة/ستة صفوف تماشياً مع نمط مرتجعات المشتريات
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 7
const ROW_HEIGHT = 52
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function InventoryTransfersModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null)
  const [form, setForm] = useState({
    fromStorehouseId: '',
    toStorehouseId: '',
    note: '',
    status: 'draft' as 'draft' | 'in_transit',
  })
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([])

  const { data: transfersData, isLoading } = useQuery<{ data: Transfer[]; total: number }>({
    queryKey: ['inventory-transfers', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/inventory-transfers?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-transfers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-transfers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const transfers = transfersData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'save failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم إنشاء التحويل بنجاح' : 'Transfer created successfully')
      qc.invalidateQueries({ queryKey: ['inventory-transfers'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ' : 'Error occurred')),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const r = await fetch(`/api/erp/inventory-transfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'update failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully')
      qc.invalidateQueries({ queryKey: ['inventory-transfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDetailTransfer(null)
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ' : 'Error occurred')),
  })

  function resetForm() {
    setForm({ fromStorehouseId: '', toStorehouseId: '', note: '', status: 'draft' })
    setItems([])
  }
  function addItem() {
    setItems([...items, { productId: '', quantity: 1 }])
  }
  function updateItem(idx: number, field: 'productId' | 'quantity', value: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: value }
    setItems(next)
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fromStorehouseId || !form.toStorehouseId) return toast.error(isRTL ? 'المستودع المصدر والوجهة مطلوبان' : 'Source and destination storehouses required')
    if (form.fromStorehouseId === form.toStorehouseId) return toast.error(isRTL ? 'لا يمكن التحويل لنفس المستودع' : 'Cannot transfer to the same storehouse')
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) return toast.error(isRTL ? 'أضف عنصراً واحداً على الأقل' : 'Add at least one item')
    saveMutation.mutate({ ...form, items: validItems })
  }

  const kpis = useMemo(() => {
    const total = transfers.length
    const inTransit = transfers.filter(t => t.status === 'in_transit').length
    const received = transfers.filter(t => t.status === 'received').length
    const draft = transfers.filter(t => t.status === 'draft').length
    return { total, inTransit, received, draft }
  }, [transfers])

  // إعدادات التصدير الموحدة عالية الجودة مع محاذاة في الوسط لتطابق عناوين الأعمدة
  const exportColumns: ExportColumn<Transfer>[] = [
    {
      key: 'code',
      header: isRTL ? 'الرمز' : 'Code',
      width: 14,
      align: 'center',
      type: 'text',
      value: (tr) => tr.code,
    },
    {
      key: 'createdAt',
      header: isRTL ? 'التاريخ' : 'Date',
      width: 16,
      align: 'center',
      type: 'date',
      value: (tr) => (tr.createdAt ? formatDate(tr.createdAt) : '—'),
      dateValue: (tr) => tr.createdAt,
    },
    {
      key: 'from',
      header: isRTL ? 'من مستودع' : 'From Storehouse',
      width: 20,
      align: 'center',
      type: 'text',
      value: (tr) => tr.fromStorehouse?.name ?? '—',
    },
    {
      key: 'to',
      header: isRTL ? 'إلى مستودع' : 'To Storehouse',
      width: 20,
      align: 'center',
      type: 'text',
      value: (tr) => tr.toStorehouse?.name ?? '—',
    },
    {
      key: 'itemsCount',
      header: isRTL ? 'عدد العناصر' : 'Items Count',
      width: 12,
      align: 'center',
      type: 'number',
      summable: true,
      value: (tr) => {
        const parsed: any[] = JSON.parse(tr.itemsJson || '[]')
        return parsed.length
      },
    },
    {
      key: 'totalQty',
      header: isRTL ? 'إجمالي الكمية' : 'Total Qty',
      width: 12,
      align: 'center',
      type: 'number',
      summable: true,
      value: (tr) => {
        const parsed: any[] = JSON.parse(tr.itemsJson || '[]')
        return parsed.reduce((s: number, x: any) => s + Number(x.quantity ?? 0), 0)
      },
    },
    {
      key: 'status',
      header: isRTL ? 'الحالة' : 'Status',
      width: 14,
      align: 'center',
      type: 'text',
      value: (tr) => tr.status,
    },
  ]

  const exportMeta: ExportMeta = {
    fileName: isRTL ? 'تحويلات-المخزون' : 'inventory-transfers',
    title: isRTL ? 'تقرير تحويلات المخزون' : 'Inventory Transfers Report',
    subtitle: isRTL ? 'أورمنال' : 'Orminal ERP',
    isRTL,
    summary: [
      { label: isRTL ? 'إجمالي التحويلات' : 'Total Transfers', value: String(kpis.total) },
      { label: isRTL ? 'مسودة' : 'Draft', value: String(kpis.draft) },
      { label: isRTL ? 'قيد النقل' : 'In Transit', value: String(kpis.inTransit) },
      { label: isRTL ? 'مستلمة' : 'Received', value: String(kpis.received) },
    ],
    labels: {
      generatedAt: isRTL ? 'تاريخ الإنشاء' : 'Generated',
      totalRecords: isRTL ? 'عدد السجلات' : 'Records',
      grandTotal: isRTL ? 'الإجمالي' : 'Total',
    },
  }

  const handleExportFormat = async (format: ExportFormat) => {
    if (!transfers.length) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }
    try {
      await exportRows(format, transfers, exportColumns, exportMeta)
      toast.success(isRTL ? 'تم التصدير بنجاح' : 'Export completed successfully')
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed'))
    }
  }

  async function handlePrintVoucher(tr: Transfer) {
    const parsed: any[] = JSON.parse(tr.itemsJson || '[]')
    const itemsHtml = parsed.map((it: any) => {
      const p = products.find(x => x.id === it.productId)
      return `
        <tr>
          <td style="padding:10px; border:1px solid #E2E8F0; font-weight:bold;">${p?.name || it.productId}</td>
          <td style="padding:10px; border:1px solid #E2E8F0; text-align:center; font-family:monospace;">${p?.sku || '—'}</td>
          <td style="padding:10px; border:1px solid #E2E8F0; text-align:center; font-weight:bold; color:#2563EB;">${it.quantity}</td>
        </tr>
      `
    }).join('')

    const html = `
      <div style="padding: 24px; font-family: system-ui, -apple-system, sans-serif; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2563EB; padding-bottom:14px; margin-bottom:20px;">
          <div>
            <h1 style="margin:0; font-size:22px; color:#2563EB;">${isRTL ? 'سند تحويل مخزني داخلي' : 'Internal Stock Transfer Voucher'}</h1>
            <p style="margin:4px 0 0 0; color:#64748B; font-size:12px;">${isRTL ? 'كود التحويل' : 'Transfer Code'}: <strong>${tr.code}</strong></p>
          </div>
          <div style="text-align:${isRTL ? 'left' : 'right'}; font-size:12px; color:#475569;">
            <p style="margin:0;">${isRTL ? 'التاريخ' : 'Date'}: ${formatDate(tr.createdAt)}</p>
            <p style="margin:4px 0 0 0;">${isRTL ? 'من مستودع' : 'From'}: <strong>${tr.fromStorehouse?.name || '—'}</strong> &rarr; ${isRTL ? 'إلى مستودع' : 'To'}: <strong>${tr.toStorehouse?.name || '—'}</strong></p>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;">
          <thead>
            <tr style="background:#EFF6FF; color:#1E40AF;">
              <th style="padding:10px; border:1px solid #BFDBFE; text-align:${isRTL ? 'right' : 'left'};">${isRTL ? 'اسم المنتج' : 'Product Name'}</th>
              <th style="padding:10px; border:1px solid #BFDBFE; text-align:center;">SKU</th>
              <th style="padding:10px; border:1px solid #BFDBFE; text-align:center;">${isRTL ? 'الكمية المحولة' : 'Transferred Qty'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${tr.note ? `<div style="margin-top:20px; padding:12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; font-size:12px;"><strong>${isRTL ? 'ملاحظات التحويل' : 'Notes'}:</strong> ${tr.note}</div>` : ''}

        <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:12px; padding-top:20px; border-top:1px dashed #CBD5E1;">
          <div>
            <p style="margin:0 0 35px 0;">${isRTL ? 'توقيع أمين المستودع المصدر:' : 'Source Storekeeper Signature:'}</p>
            <p style="margin:0;">__________________________</p>
          </div>
          <div>
            <p style="margin:0 0 35px 0;">${isRTL ? 'توقيع أمين مستودع الوجهة:' : 'Destination Storekeeper Signature:'}</p>
            <p style="margin:0;">__________________________</p>
          </div>
        </div>
      </div>
    `

    await printHTML(html, isRTL ? `سند-تحويل-${tr.code}` : `Transfer-Voucher-${tr.code}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }

  return (
    <ModuleShell
      title={t('module.inventory-transfers')}
      description={isRTL ? "تحويلات المخزون بين المستودعات" : "Manage stock transfers between storehouses"}
      icon={<ArrowLeftRight className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel={isRTL ? "تحويل جديد" : "New Transfer"}
      actions={
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 font-medium border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isRTL ? 'التصدير' : 'Export'}</span>
              <ChevronDown className="size-4 text-slate-400 ms-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} className="w-30 z-50">
            <DropdownMenuItem onClick={() => handleExportFormat('excel')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>{isRTL ? 'تصدير إكسل' : 'Export Excel'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportFormat('csv')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileText className="size-4 text-sky-600" />
              <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportFormat('pdf')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileCheck className="size-4 text-rose-600" />
              <span>{isRTL ? 'تصدير PDF' : 'Export PDF'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger dir={dir} className={cn("w-40", isRTL ? "text-right" : "text-left")}><SelectValue /></SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all">{isRTL ? "كل الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
            <SelectItem value="in_transit">{isRTL ? "قيد النقل" : "In Transit"}</SelectItem>
            <SelectItem value="received">{isRTL ? "مستلم" : "Received"}</SelectItem>
            <SelectItem value="cancelled">{isRTL ? "ملغي" : "Cancelled"}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={isRTL ? "إجمالي التحويلات" : "Total Transfers"} value={String(kpis.total)} icon={<ArrowLeftRight className="size-5" />} accent="blue" />
            <KpiCard title={isRTL ? "مسودة" : "Draft"} value={String(kpis.draft)} icon={<Package className="size-5" />} accent="amber" />
            <KpiCard title={isRTL ? "قيد النقل" : "In Transit"} value={String(kpis.inTransit)} icon={<Truck className="size-5" />} accent="violet" />
            <KpiCard title={isRTL ? "مستلمة" : "Received"} value={String(kpis.received)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
          </>
        )}
      </div>

      {/* جدول تحويلات المخزون — رأس ثابت + تمرير للصفوف فقط + محاذاة دقيقة بالأعمدة تماشياً مع جدول مرتجعات المشتريات */}
      <Card className="rounded-xl overflow-hidden border border-border">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[12%]" />{/* التاريخ */}
              <col className="w-[18%]" />{/* من */}
              <col className="w-[18%]" />{/* إلى */}
              <col className="w-[12%]" />{/* عدد العناصر */}
              <col className="w-[12%]" />{/* إجمالي الكمية */}
              <col className="w-[10%]" />{/* الحالة */}
              <col className="w-[6%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{isRTL ? "الرمز" : "Code"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "التاريخ" : "Date"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "من" : "From"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "إلى" : "To"}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? "عدد العناصر" : "Items Count"}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? "إجمالي الكمية" : "Total Qty"}</TableHead>
                <TableHead className={`${stickyHead} text-end`}>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{isRTL ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground border-b">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground border-b">
                    <ArrowLeftRight className="size-10 mx-auto mb-2 opacity-50" />
                    {isRTL ? 'لا توجد تحويلات. ابدأ بإنشاء تحويل جديد.' : 'No transfers recorded. Start by creating a new transfer.'}
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((tr) => {
                  const parsed: any[] = JSON.parse(tr.itemsJson || '[]')
                  const totalQty = parsed.reduce((s, x) => s + Number(x.quantity ?? 0), 0)
                  return (
                    <TableRow key={tr.id} className="hover:bg-muted/40 align-middle cursor-pointer" onClick={() => setDetailTransfer(tr)}>
                      <TableCell className="ps-4 font-mono text-xs font-semibold text-primary border-b truncate">
                        {tr.code}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap border-b">
                        {formatDate(tr.createdAt)}
                      </TableCell>
                      <TableCell className="border-b truncate">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Truck className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{tr.fromStorehouse?.name ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-b truncate">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Package className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{tr.toStorehouse?.name ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="num-cell text-xs text-center border-b">
                        <span className="num">{parsed.length}</span>
                      </TableCell>
                      <TableCell className="num-cell text-sm font-medium text-center border-b">
                        <span className="num">{totalQty}</span>
                      </TableCell>
                      <TableCell className="text-end border-b">
                        <StatusBadge status={tr.status} />
                      </TableCell>
                      <TableCell className="pe-4 text-end border-b" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} collisionPadding={8} className="w-25 z-50">
                            <DropdownMenuItem onClick={() => setDetailTransfer(tr)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Eye className="size-4 text-blue-600" />
                              <span>{isRTL ? 'عرض' : 'View'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintVoucher(tr)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Printer className="size-4 text-slate-700 dark:text-slate-300" />
                              <span>{isRTL ? 'طباعة' : 'Print'}</span>
                            </DropdownMenuItem>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                            {tr.status !== 'in_transit' && tr.status !== 'received' && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: tr.id, body: { status: 'in_transit' } })} className="gap-2 cursor-pointer text-sm font-medium">
                                <Truck className="size-4 text-amber-600" />
                                <span>{isRTL ? 'تحويل' : 'Transfer'}</span>
                              </DropdownMenuItem>
                            )}

                            {tr.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: tr.id, body: { status: 'cancelled' } })} className="gap-2 cursor-pointer text-sm font-medium text-rose-600">
                                <XCircle className="size-4 text-rose-600" />
                                <span>{isRTL ? 'إلغاء' : 'Cancel'}</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ArrowLeftRight className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تحويل مخزني جديد' : 'New Stock Transfer'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                {/* Warehouses configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Truck className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'تحديد المستودعات' : 'Storehouses Configuration'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'من مستودع (المصدر) *' : 'From Warehouse (Source) *'}
                      </Label>
                      <Select value={form.fromStorehouseId} onValueChange={v => setForm({ ...form, fromStorehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع المصدر' : 'Select source warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'إلى مستودع (الوجهة) *' : 'To Warehouse (Destination) *'}
                      </Label>
                      <Select value={form.toStorehouseId} onValueChange={v => setForm({ ...form, toStorehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع الوجهة' : 'Select destination warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.filter(s => s.id !== form.fromStorehouseId).map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Status Options */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'حالة تحويل المخزون عند الحفظ' : 'Transfer Status'}
                  </Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      <SelectItem value="draft">{isRTL ? 'مسودة (حفظ بدون نقل مخزني)' : 'Draft (Save without moving stock)'}</SelectItem>
                      <SelectItem value="in_transit">{isRTL ? 'قيد النقل مباشرة (تخفيض المخزون للمصدر)' : 'In Transit (Reduce source stock)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Grid */}
                <div className="space-y-4">
                  <div className={cn("flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60", isRTL ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المراد تحويلها' : 'Items to Transfer'}
                      </h3>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1.5 text-xs">
                      <Plus className="size-3.5" /> {isRTL ? 'إضافة صنف' : 'Add Item'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm border-separate border-spacing-0">
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                          <TableRow>
                            <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                            <TableHead className={cn("num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                                {isRTL ? 'اضغط "إضافة صنف" لإدخال عناصر التحويل' : 'Click "Add Item" to start adding transfer items'}
                              </TableCell>
                            </TableRow>
                          ) : items.map((it, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                              <TableCell className="p-2">
                                <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                                  <SelectTrigger dir={dir} className={cn("h-9 border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                                    <SelectValue placeholder={isRTL ? 'اختر منتج' : 'Select product'} />
                                  </SelectTrigger>
                                  <SelectContent dir={dir}>
                                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2">
                                <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-200 dark:border-slate-800 text-xs", isRTL ? "text-right" : "text-left")} />
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg" onClick={() => removeItem(idx)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Additional notes */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات إضافية' : 'Notes / Remarks'}</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي تفاصيل أو ملاحظات عن الشحن أو السائق...' : 'Any shipping notes or carrier information...'} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {saveMutation.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء وتأكيد التحويل' : 'Create & Save Transfer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTransfer} onOpenChange={(o) => !o && setDetailTransfer(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Package className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                    {isRTL ? `تفاصيل التحويل المخزني ${detailTransfer?.code}` : `Transfer Details ${detailTransfer?.code}`}
                  </DialogTitle>

                </div>
                <DialogDescription className="text-sm text-blue-800/80 dark:text-blue-100/90 font-normal leading-normal">
                  {detailTransfer?.fromStorehouse?.name} &rarr; {detailTransfer?.toStorehouse?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailTransfer && (
            <div className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                <div className="space-y-6">
                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl shadow-sm">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'تاريخ الإنشاء' : 'Date Created'}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(detailTransfer.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'تاريخ التحديث' : 'Last Updated'}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(detailTransfer.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Transfer Items */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المحوّلة' : 'Transferred Items'}
                      </h3>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                      <Table className="table-sticky">
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                          <TableRow>
                            <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'المنتج' : 'Product'}</TableHead>
                            <TableHead className="num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'الكمية المحولة' : 'Transferred Qty'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {JSON.parse(detailTransfer.itemsJson || '[]').map((it: any, idx: number) => {
                            const p = products.find(x => x.id === it.productId)
                            return (
                              <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                                <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p?.name ?? it.productId}</TableCell>
                                <TableCell className="num-cell text-sm font-semibold text-slate-900 dark:text-white"><span className="num">{it.quantity}</span></TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Notes Section */}
                  {detailTransfer.note && (
                    <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-xl">
                      <span className="text-xs text-amber-800 dark:text-amber-300 font-bold block mb-1">{isRTL ? 'ملاحظات التحويل' : 'Transfer Notes'}</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{detailTransfer.note}</p>
                    </div>
                  )}
                </div>
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button variant="outline" className="h-10 px-4 border-slate-400 dark:border-slate-500 text-sm font-semibold gap-1.5" onClick={() => handlePrintVoucher(detailTransfer)}>
                  <Printer className="size-4" /> {isRTL ? 'طباعة' : 'Print'}
                </Button>
                {detailTransfer.status === 'draft' && (
                  <Button variant="outline" className="h-10 px-4 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold flex items-center gap-1.5" onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'in_transit' } })}>
                    <Truck className="size-4" /> {isRTL ? 'تحويل' : 'Transfer'}
                  </Button>
                )}
                {detailTransfer.status === 'in_transit' && (
                  <Button className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5" onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'received' } })}>
                    <CheckCircle2 className="size-4" /> {isRTL ? 'استلام التحويل' : 'Confirm Receipt'}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailTransfer(null)} className="h-10 px-5 border-rose-400 dark:border-rose-800 text-sm font-semibold">
                  {isRTL ? 'إغلاق' : 'Close'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
