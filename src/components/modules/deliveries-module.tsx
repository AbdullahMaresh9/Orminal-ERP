'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { exportRows, printHTML, ExportColumn, ExportFormat } from '@/lib/export'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Truck, Plus, Trash2, CheckCircle, CheckCircle2, Clock, Package,
  Download, FileSpreadsheet, FileText, FileCheck, ChevronDown,
  MoreVertical, Eye, Printer, XCircle
} from 'lucide-react'

interface DeliveryLine {
  id?: string
  productId: string
  orderedQty: number
  deliveredQty: number
  product?: { id: string; nameAr: string; nameEn?: string; sku: string }
}

interface Delivery {
  id: string
  code: string
  partnerId: string | null
  warehouseId: string
  salesOrderId: string | null
  deliveryDate: string
  status: string
  notes: string | null
  createdAt: string
  partner?: { id: string; nameAr: string; nameEn?: string; code: string } | null
  warehouse?: { id: string; nameAr: string; nameEn?: string; code: string } | null
  salesOrder?: { id: string; code: string } | null
  lines: DeliveryLine[]
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  waiting: { ar: 'في الانتظار', en: 'Waiting' },
  picked: { ar: 'تم التجهيز', en: 'Picked' },
  packed: { ar: 'تم التغليف', en: 'Packed' },
  done: { ar: 'تم التسليم', en: 'Delivered' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled' },
}

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function DeliveriesModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()

  // Bilingual helper function
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const partnerName = (p?: any) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'
  const warehouseName = (w?: any) => (isRTL ? w?.nameAr : (w?.nameEn || w?.nameAr)) ?? '—'
  const productName = (p?: any) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailDelivery, setDetailDelivery] = useState<Delivery | null>(null)

  // Form State for creating new Delivery
  const [form, setForm] = useState({
    partnerId: '',
    warehouseId: '',
    notes: '',
    deliveryDate: new Date().toISOString().split('T')[0],
  })
  const [items, setItems] = useState<{ productId: string; orderedQty: number; deliveredQty: number }[]>([])

  // Query Deliveries
  const { data, isLoading } = useQuery<{ data: Delivery[]; total: number }>({
    queryKey: ['deliveries', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/deliveries?${params}`)
      if (!r.ok) throw new Error(L('فشل جلب أذونات التسليم', 'Failed to fetch deliveries'))
      return r.json()
    },
  })

  // Auxiliary data
  const { data: warehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['warehouses-for-deliveries'],
    queryFn: async () => {
      const r = await fetch('/api/erp/warehouses?pageSize=200')
      if (!r.ok) throw new Error(L('فشل جلب المستودعات', 'Failed to fetch warehouses'))
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: any[] }>({
    queryKey: ['customers-for-deliveries'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) throw new Error(L('فشل جلب العملاء', 'Failed to fetch customers'))
      const res = await r.json()
      if (!res?.data?.length) {
        const r2 = await fetch('/api/erp/partners?pageSize=200')
        if (r2.ok) return r2.json()
      }
      return res
    },
  })

  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-deliveries'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) throw new Error(L('فشل جلب المنتجات', 'Failed to fetch products'))
      return r.json()
    },
  })

  const rows = data?.data ?? []
  const warehouses = warehousesData?.data ?? []
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل إنشاء إذن التسليم', 'Failed to create delivery'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إنشاء إذن التسليم بنجاح', 'Delivery created successfully'))
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'Error occurred')),
  })

  const validateMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل اعتماد إذن التسليم', 'Failed to validate delivery'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم اعتماد وتسليم البضاعة وتحديث المخزون بنجاح', 'Delivery validated & stock updated'))
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      setDetailDelivery(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء التسليم', 'Error during delivery validation')),
  })

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل إلغاء التسليم', 'Failed to cancel delivery'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إلغاء التسليم بنجاح', 'Delivery cancelled successfully'))
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      setDetailDelivery(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'Error occurred')),
  })

  function resetForm() {
    setForm({
      partnerId: '',
      warehouseId: '',
      notes: '',
      deliveryDate: new Date().toISOString().split('T')[0],
    })
    setItems([])
  }

  function addItem() {
    setItems([...items, { productId: '', orderedQty: 1, deliveredQty: 1 }])
  }

  function updateItem(idx: number, field: 'productId' | 'orderedQty' | 'deliveredQty', value: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: value }
    setItems(next)
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.warehouseId) return toast.error(L('المستودع مطلوب', 'Warehouse is required'))
    const validItems = items.filter(i => i.productId && i.deliveredQty > 0)
    if (!validItems.length) return toast.error(L('أضف عنصراً واحداً على الأقل بكمية تسليم أكبر من صفر', 'Add at least one item with delivered qty > 0'))

    createMutation.mutate({
      ...form,
      status: 'draft',
      lines: validItems,
    })
  }

  //    Print Delivery Voucher
  async function handlePrintVoucher(del: Delivery) {
    const linesHtml = (del.lines || []).map((l, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${productName(l.product) || l.productId}</td>
        <td style="text-align: center;">${l.orderedQty || l.deliveredQty || 0}</td>
        <td style="text-align: center; font-weight: bold; color: #0284c7;">${l.deliveredQty || 0}</td>
      </tr>
    `).join('')

    const html = `
      <div style="font-family: system-ui, sans-serif; padding: 24px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; font-size: 24px; color: #0f172a;">${L('سند تسليم مبيعات', 'Sales Delivery Note')}</h1>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">${del.code}</p>
          </div>
          <div style="text-align: ${isRTL ? 'left' : 'right'}; font-size: 13px; color: #475569;">
            <p style="margin: 2px 0;"><strong>${L('التاريخ', 'Date')}:</strong> ${new Date(del.deliveryDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</p>
            <p style="margin: 2px 0;"><strong>${L('الحالة', 'Status')}:</strong> ${statusLabel(del.status)}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
          <div>
            <p style="margin: 4px 0;"><strong>${L('العميل', 'Customer')}:</strong> ${partnerName(del.partner)}</p>
            <p style="margin: 4px 0;"><strong>${L('المستودع المصدر', 'Source Warehouse')}:</strong> ${warehouseName(del.warehouse)}</p>
          </div>
          <div>
            <p style="margin: 4px 0;"><strong>${L('أمر المبيعات', 'Sales Order')}:</strong> ${del.salesOrder?.code || '—'}</p>
            <p style="margin: 4px 0;"><strong>${L('الملاحظات', 'Notes')}:</strong> ${del.notes || '—'}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <thead>
            <tr style="background: #0284c7; color: #ffffff;">
              <th style="padding: 10px; border: 1px solid #0284c7; width: 40px;">#</th>
              <th style="padding: 10px; border: 1px solid #0284c7; text-align: ${isRTL ? 'right' : 'left'};">${L('المنتج', 'Product')}</th>
              <th style="padding: 10px; border: 1px solid #0284c7; width: 120px; text-align: center;">${L('الكمية المطلوبة', 'Ordered Qty')}</th>
              <th style="padding: 10px; border: 1px solid #0284c7; width: 120px; text-align: center;">${L('الكمية المسلمة', 'Delivered Qty')}</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div style="margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 13px; color: #475569;">
          <div>
            <p style="margin-bottom: 40px; font-weight: bold;">${L('أمين المخزن', 'Storekeeper')}</p>
            <p>____________________</p>
          </div>
          <div>
            <p style="margin-bottom: 40px; font-weight: bold;">${L('المندوب / السائق', 'Driver / Agent')}</p>
            <p>____________________</p>
          </div>
          <div>
            <p style="margin-bottom: 40px; font-weight: bold;">${L('مستلم البضاعة (العميل)', 'Received By (Customer)')}</p>
            <p>____________________</p>
          </div>
        </div>
      </div>
    `

    printHTML(html, `${L('سند تسليم', 'Delivery Note')} - ${del.code}`)
  }

  // Export Columns Setup
  const exportColumns: ExportColumn<Delivery>[] = [
    {
      key: 'code',
      header: L('الرمز', 'Code'),
      width: 14,
      align: 'center',
      type: 'text',
      value: (r) => r.code,
    },
    {
      key: 'partner',
      header: L('العميل', 'Customer'),
      width: 25,
      align: 'start',
      type: 'text',
      value: (r) => partnerName(r.partner),
    },
    {
      key: 'warehouse',
      header: L('المستودع', 'Warehouse'),
      width: 22,
      align: 'start',
      type: 'text',
      value: (r) => warehouseName(r.warehouse),
    },
    {
      key: 'deliveryDate',
      header: L('التاريخ', 'Date'),
      width: 16,
      align: 'center',
      type: 'date',
      value: (r) => r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—',
      dateValue: (r) => r.deliveryDate ? new Date(r.deliveryDate) : null,
    },
    {
      key: 'status',
      header: L('الحالة', 'Status'),
      width: 15,
      align: 'center',
      type: 'text',
      value: (r) => statusLabel(r.status),
    },
  ]

  const handleExportFormat = (format: ExportFormat) => {
    exportRows(format, rows, exportColumns, {
      fileName: `deliveries_${new Date().toISOString().split('T')[0]}`,
      title: L('تقرير تسليمات المبيعات', 'Sales Deliveries Report'),
      subtitle: L(`إجمالي السجلات: ${rows.length}`, `Total Records: ${rows.length}`),
      isRTL,
    })
  }

  return (
    <ModuleShell
      title={t('module.deliveries') || L('التسليمات', 'Deliveries')}
      description={L('إدارة ومتابعة تسليمات المبيعات وخروج البضائع من المستودعات', 'Manage sales order deliveries and stock dispatches')}
      icon={<Truck className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={L('ابحث برمز التسليم أو اسم العميل...', 'Search by delivery code or customer name...')}
      addLabel={L('إذن تسليم جديد', 'New Delivery')}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder={L('تصفية حسب الحالة', 'Filter by Status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L('جميع الحالات', 'All Statuses')}</SelectItem>
              {Object.keys(STATUS_LABELS).map((key) => (
                <SelectItem key={key} value={key}>
                  {statusLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dropdown Export Button */}
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold">
              <Download className="size-4 text-emerald-600" />
              <span>{L('تصدير', 'Export')}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-30 z-50">
            <DropdownMenuItem onClick={() => handleExportFormat('excel')} className="gap-2 cursor-pointer text-xs">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>{L('تصدير Excel', 'Export Excel')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportFormat('pdf')} className="gap-2 cursor-pointer text-xs">
              <FileText className="size-4 text-rose-600" />
              <span>{L('تصدير PDF', 'Export PDF')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportFormat('csv')} className="gap-2 cursor-pointer text-xs">
              <FileCheck className="size-4 text-blue-600" />
              <span>{L('تصدير CSV', 'Export CSV')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title={L('إجمالي التسليمات', 'Total Deliveries')}
              value={String(rows.length)}
              icon={<Truck className="size-5" />}
              accent="blue"
            />
            <KpiCard
              title={L('مكتملة ومُسلّمة', 'Completed / Delivered')}
              value={String(rows.filter((r) => r.status === 'done').length)}
              icon={<CheckCircle className="size-5" />}
              accent="sky"
            />
            <KpiCard
              title={L('قيد المعالجة', 'In Progress')}
              value={String(rows.filter((r) => ['draft', 'waiting', 'picked', 'packed'].includes(r.status)).length)}
              icon={<Clock className="size-5" />}
              accent="amber"
            />
            <KpiCard
              title={L('ملغاة', 'Cancelled')}
              value={String(rows.filter((r) => r.status === 'cancelled').length)}
              icon={<Package className="size-5" />}
              accent="rose"
            />
          </>
        )}
      </div>

      {/* Main Deliveries Table */}
      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <div className="overflow-y-auto max-h-[360px] relative">
            <Table className="w-full min-w-[850px] border-collapse text-sm">
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className={cn(stickyHead, 'w-[14%] min-w-[120px] text-start')}>
                    {L('الرمز', 'Code')}
                  </TableHead>
                  <TableHead className={cn(stickyHead, 'w-[24%] min-w-[160px] text-start')}>
                    {L('العميل', 'Customer')}
                  </TableHead>
                  <TableHead className={cn(stickyHead, 'w-[20%] min-w-[150px] text-start')}>
                    {L('المستودع المصدر', 'Warehouse')}
                  </TableHead>
                  <TableHead className={cn(stickyHead, 'w-[16%] min-w-[130px] text-start')}>
                    {L('تاريخ التسليم', 'Delivery Date')}
                  </TableHead>
                  <TableHead className={cn(stickyHead, 'w-[14%] min-w-[110px] text-center')}>
                    {L('الحالة', 'Status')}
                  </TableHead>
                  <TableHead className={cn(stickyHead, 'w-[12%] min-w-[100px] text-end pe-4')}>
                    {L('إجراءات', 'Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-[52px]">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      {L('لا توجد أذونات تسليم مطابقة', 'No delivery records found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="h-[52px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => setDetailDelivery(r)}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b">
                        {r.code}
                      </TableCell>
                      <TableCell className="text-sm font-medium border-b">
                        {partnerName(r.partner)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300 border-b">
                        {warehouseName(r.warehouse)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground border-b whitespace-nowrap">
                        {r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—'}
                      </TableCell>
                      <TableCell className="text-center border-b">
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="pe-4 text-end border-b" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-30 z-50 min-w-[140px] shadow-lg">
                            <DropdownMenuItem onClick={() => setDetailDelivery(r)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Eye className="size-4 text-blue-600" />
                              <span>{L('عرض', 'View')}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintVoucher(r)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Printer className="size-4 text-slate-700 dark:text-slate-300" />
                              <span>{L('طباعة', 'Print')}</span>
                            </DropdownMenuItem>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                            {['draft', 'waiting', 'picked', 'packed'].includes(r.status) && (
                              <DropdownMenuItem
                                onClick={() => validateMut.mutate(r.id)}
                                className="gap-2 cursor-pointer text-sm font-medium text-emerald-600"
                              >
                                <CheckCircle2 className="size-4 text-emerald-600" />
                                <span>{L('تسليم', 'Fulfill')}</span>
                              </DropdownMenuItem>
                            )}

                            {r.status !== 'done' && r.status !== 'cancelled' && (
                              <DropdownMenuItem
                                onClick={() => cancelMut.mutate(r.id)}
                                className="gap-2 cursor-pointer text-sm font-medium text-rose-600"
                              >
                                <XCircle className="size-4 text-rose-600" />
                                <span>{L('إلغاء', 'Cancel')}</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* New Delivery Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Truck className="size-5 text-blue-600" />
              <span>{L('إنشاء إذن تسليم مبيعات جديد', 'Create Sales Delivery Note')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {L('أدخل تفاصيل العميل والمستودع والأصناف المراد تسليمها', 'Enter customer, warehouse, and items for delivery')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{L('العميل', 'Customer')}</Label>
                  <Select value={form.partnerId} onValueChange={(val) => setForm({ ...form, partnerId: val })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={L('اختر العميل', 'Select Customer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {partnerName(p)} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{L('المستودع المصدر *', 'Source Warehouse *')}</Label>
                  <Select value={form.warehouseId} onValueChange={(val) => setForm({ ...form, warehouseId: val })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={L('اختر المستودع', 'Select Warehouse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-xs">
                          {warehouseName(w)} ({w.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{L('تاريخ التسليم', 'Delivery Date')}</Label>
                <DatePicker
                  value={form.deliveryDate}
                  onChange={(val) => setForm({ ...form, deliveryDate: val })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{L('ملاحظات', 'Notes')}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={L('ملاحظات التسليم...', 'Delivery notes...')}
                  rows={2}
                  className="text-xs"
                />
              </div>

              {/* Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold">{L('قائمة المنتجات للتسليم', 'Delivery Items')}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 text-xs gap-1">
                    <Plus className="size-3.5" />
                    <span>{L('إضافة منتج', 'Add Item')}</span>
                  </Button>
                </div>

                {!items.length ? (
                  <div className="p-4 border border-dashed rounded-lg text-center text-xs text-muted-foreground">
                    {L('لم يتم إضافة منتجات بعد. انقر على "إضافة منتج" للأعلى.', 'No items added yet. Click "Add Item" above.')}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pe-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex-1 min-w-[200px]">
                          <Select
                            value={item.productId}
                            onValueChange={(val) => updateItem(idx, 'productId', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={L('اختر المنتج', 'Select Product')} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {productName(p)} ({p.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            min={1}
                            value={item.deliveredQty}
                            onChange={(e) => updateItem(idx, 'deliveredQty', Number(e.target.value))}
                            placeholder={L('الكمية', 'Qty')}
                            className="h-8 text-xs text-center"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          className="size-8 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogBody>

            <DialogFooter className="px-2 py-4 bg-slate-50 dark:bg-slate-950 border-t flex flex-row items-center justify-between sm:justify-between shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-9 w-20 px-4 border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="h-9 w-30 px-5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
                {createMutation.isPending ? L('جاري الحفظ...', 'Saving...') : L('حفظ', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailDelivery} onOpenChange={(open) => !open && setDetailDelivery(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {detailDelivery && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="flex items-center gap-3">
                    <Truck className="size-5 text-blue-300 " />
                    <span>{L(`تفاصيل إذن التسليم: ${detailDelivery.code}`, `Delivery Note Details: ${detailDelivery.code}`)}</span>
                  </DialogTitle>
                </div>
              </DialogHeader>

              <DialogBody className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-1">{L('العميل', 'Customer')}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{partnerName(detailDelivery.partner)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">{L('المستودع المصدر', 'Source Warehouse')}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{warehouseName(detailDelivery.warehouse)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">{L('أمر المبيعات المرتبط', 'Sales Order')}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{detailDelivery.salesOrder?.code || '—'}</span>
                  </div>
                  {detailDelivery.notes && (
                    <div className="col-span-full border-t pt-2 mt-1">
                      <span className="text-muted-foreground block mb-1">{L('الملاحظات', 'Notes')}</span>
                      <span className="text-slate-800 dark:text-slate-200">{detailDelivery.notes}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold mb-3">{L('الأصناف المسلمة', 'Delivered Items')}</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>{L('المنتج', 'Product')}</TableHead>
                          <TableHead className="w-28 text-center">{L('الكمية المطلوبة', 'Ordered Qty')}</TableHead>
                          <TableHead className="w-28 text-center">{L('الكمية المسلمة', 'Delivered Qty')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailDelivery.lines?.map((line, idx) => (
                          <TableRow key={line.id || idx}>
                            <TableCell className="text-center font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{productName(line.product) || line.productId}</TableCell>
                            <TableCell className="text-center">{line.orderedQty || line.deliveredQty || 0}</TableCell>
                            <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">{line.deliveredQty || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t flex flex-row items-center justify-between sm:justify-between shrink-0">
                <Button type="button" variant="outline" onClick={() => setDetailDelivery(null)} className="h-10 w-20 px-5 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 font-semibold">
                  {L('إغلاق', 'Close')}
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => handlePrintVoucher(detailDelivery)} className="h-10 px-4 text-sm font-semibold gap-1.5 border-slate-400 dark:border-slate-600">
                    <Printer className="size-4" />
                    <span>{L('طباعة', 'Print')}</span>
                  </Button>
                  {['draft', 'waiting', 'picked', 'packed'].includes(detailDelivery.status) && (
                    <Button
                      type="button"
                      onClick={() => validateMut.mutate(detailDelivery.id)}
                      disabled={validateMut.isPending}
                      className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>{validateMut.isPending ? L('جاري الصرف...', 'Fulfilling...') : L('تسليم وصرف ', 'Fulfill & Dispatch ')}</span>
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
