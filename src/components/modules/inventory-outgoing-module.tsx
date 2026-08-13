'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format'
import { exportRows, ExportColumn, ExportMeta, ExportFormat, printHTML } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowUpFromLine, Plus, Trash2, Package, Boxes,
  Download, FileSpreadsheet, FileText, FileCheck, ChevronDown,
  MoreVertical, Eye, Printer, Edit3, CheckCircle2
} from 'lucide-react'

interface Movement {
  id: string
  productId: string
  storehouseId: string
  type: string
  quantity: number
  refType: string | null
  note: string | null
  createdAt: string
  product: { id: string; name: string; sku: string; salePrice: number }
  storehouse: { id: string; name: string; code: string }
}

//  أبعاد الجدول وحساب الارتفاع الثابت لخمسة/ستة صفوف تماشياً مع نمط مرتجعات المشتريات
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 6
const ROW_HEIGHT = 52
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function InventoryOutgoingModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [storehouseFilter, setStorehouseFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    storehouseId: '',
    clientId: '',
    note: '',
  })
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([])

  const { data: movementsData, isLoading } = useQuery<{ data: Movement[]; total: number }>({
    queryKey: ['inventory-outgoing', storehouseFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (storehouseFilter !== 'all') params.set('storehouseId', storehouseFilter)
      const r = await fetch(`/api/erp/inventory-outgoing?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const [detailMovement, setDetailMovement] = useState<Movement | null>(null)

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  async function handlePrintVoucher(m: Movement) {
    const price = m.product?.salePrice ?? 0
    const qty = m.quantity ?? 0
    const total = qty * price

    const html = `
      <div style="padding: 24px; font-family: system-ui, -apple-system, sans-serif; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #E11D48; padding-bottom:14px; margin-bottom:20px;">
          <div>
            <h1 style="margin:0; font-size:22px; color:#2563EB;">${isRTL ? 'سند صرف مخزني' : 'Stock Issue Voucher'}</h1>
            <p style="margin:4px 0 0 0; color:#64748B; font-size:12px;">${isRTL ? 'المرجع' : 'Ref'}: <strong>${m.refType || m.id}</strong></p>
          </div>
          <div style="text-align:${isRTL ? 'left' : 'right'}; font-size:12px; color:#475569;">
            <p style="margin:0;">${isRTL ? 'التاريخ' : 'Date'}: ${formatDateTime(m.createdAt)}</p>
            <p style="margin:4px 0 0 0;">${isRTL ? 'المستودع المصدر' : 'Source Warehouse'}: <strong>${m.storehouse?.name || '—'}</strong></p>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;">
          <thead>
            <tr style="background:#FFF1F2; color:#9F1239;">
              <th style="padding:10px; border:1px solid #FECDD3; text-align:${isRTL ? 'right' : 'left'};">${isRTL ? 'اسم المنتج' : 'Product Name'}</th>
              <th style="padding:10px; border:1px solid #FECDD3; text-align:center;">SKU</th>
              <th style="padding:10px; border:1px solid #FECDD3; text-align:center;">${isRTL ? 'الكمية' : 'Qty'}</th>
              <th style="padding:10px; border:1px solid #FECDD3; text-align:center;">${isRTL ? 'السعر' : 'Price'}</th>
              <th style="padding:10px; border:1px solid #FECDD3; text-align:center;">${isRTL ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px; border:1px solid #E2E8F0; font-weight:bold;">${m.product?.name || '—'}</td>
              <td style="padding:10px; border:1px solid #E2E8F0; text-align:center; font-family:monospace;">${m.product?.sku || '—'}</td>
              <td style="padding:10px; border:1px solid #E2E8F0; text-align:center; color:#E11D48; font-weight:bold;">-${formatNumber(qty, 0)}</td>
              <td style="padding:10px; border:1px solid #E2E8F0; text-align:center;">${formatNumber(price)}</td>
              <td style="padding:10px; border:1px solid #E2E8F0; text-align:center; font-weight:bold;">${formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>

        ${m.note ? `<div style="margin-top:20px; padding:12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; font-size:12px;"><strong>${isRTL ? 'ملاحظات الصرف' : 'Notes'}:</strong> ${m.note}</div>` : ''}

        <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:12px; padding-top:20px; border-top:1px dashed #CBD5E1;">
          <div>
            <p style="margin:0 0 35px 0;">${isRTL ? 'توقيع المستلم:' : 'Receiver Signature:'}</p>
            <p style="margin:0;">__________________________</p>
          </div>
          <div>
            <p style="margin:0 0 35px 0;">${isRTL ? 'توقيع أمين المستودع:' : 'Storekeeper Signature:'}</p>
            <p style="margin:0;">___________________________</p>
          </div>
        </div>
      </div>
    `

    await printHTML(html, isRTL ? `سند-صرف-${m.refType || m.id}` : `Issue-Voucher-${m.refType || m.id}`, { dir: isRTL ? 'rtl' : 'ltr' })
  }
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: clientsData } = useQuery<{ data: any[] }>({
    queryKey: ['clients-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=100')
      if (!r.ok) return { data: [] }
      const json = await r.json()
      if (!json.data || json.data.length === 0) {
        const rAll = await fetch('/api/erp/partners?pageSize=100')
        if (rAll.ok) return rAll.json()
      }
      return json
    },
  })

  const movements = movementsData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []
  const clients = clientsData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-outgoing', {
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
      toast.success(isRTL ? 'تم تسجيل الصرف بنجاح' : 'Issue recorded successfully')
      qc.invalidateQueries({ queryKey: ['inventory-outgoing'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ' : 'Error occurred')),
  })

  function resetForm() {
    setForm({ storehouseId: '', clientId: '', note: '' })
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
    if (!form.storehouseId) return toast.error(isRTL ? 'المستودع مطلوب' : 'Storehouse is required')
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) return toast.error(isRTL ? 'أضف عنصراً واحداً على الأقل' : 'Add at least one valid item')
    saveMutation.mutate({ ...form, items: validItems })
  }

  const kpis = useMemo(() => {
    const total = movements.length
    const totalQty = movements.reduce((s, m) => s + (m.quantity ?? 0), 0)
    const totalValue = movements.reduce((s, m) => s + (m.quantity ?? 0) * (m.product?.salePrice ?? 0), 0)
    const uniqueProducts = new Set(movements.map(m => m.productId)).size
    return { total, totalQty, totalValue, uniqueProducts }
  }, [movements])

  // إعدادات التصدير الموحدة عالية الجودة مع محاذاة في الوسط لتطابق عناوين الأعمدة
  const exportColumns: ExportColumn<Movement>[] = [
    {
      key: 'createdAt',
      header: isRTL ? 'التاريخ' : 'Date',
      width: 18,
      align: 'center',
      type: 'date',
      value: (m) => (m.createdAt ? formatDateTime(m.createdAt) : '—'),
      dateValue: (m) => m.createdAt,
    },
    {
      key: 'product',
      header: isRTL ? 'المنتج' : 'Product',
      width: 22,
      align: 'center',
      type: 'text',
      value: (m) => m.product?.name ?? '—',
    },
    {
      key: 'sku',
      header: 'SKU',
      width: 12,
      align: 'center',
      type: 'text',
      value: (m) => m.product?.sku ?? '—',
    },
    {
      key: 'storehouse',
      header: isRTL ? 'المستودع' : 'Storehouse',
      width: 16,
      align: 'center',
      type: 'text',
      value: (m) => m.storehouse?.name ?? '—',
    },
    {
      key: 'refType',
      header: isRTL ? 'المرجع' : 'Reference',
      width: 12,
      align: 'center',
      type: 'text',
      value: (m) => m.refType ?? '—',
    },
    {
      key: 'quantity',
      header: isRTL ? 'الكمية' : 'Qty',
      width: 10,
      align: 'center',
      type: 'number',
      summable: true,
      value: (m) => m.quantity ?? 0,
    },
    {
      key: 'price',
      header: isRTL ? 'السعر' : 'Price',
      width: 12,
      align: 'center',
      type: 'currency',
      value: (m) => m.product?.salePrice ?? 0,
    },
    {
      key: 'total',
      header: isRTL ? 'الإجمالي' : 'Total',
      width: 14,
      align: 'center',
      type: 'currency',
      summable: true,
      value: (m) => (m.quantity ?? 0) * (m.product?.salePrice ?? 0),
    },
    {
      key: 'note',
      header: isRTL ? 'ملاحظات' : 'Notes',
      width: 14,
      align: 'center',
      type: 'text',
      value: (m) => m.note ?? '—',
    },
  ]

  const exportMeta: ExportMeta = {
    fileName: isRTL ? 'إخراجات-المخزون' : 'inventory-outgoing',
    title: isRTL ? 'تقرير إخراجات المخزون (الصادر)' : 'Inventory Outgoing Report',
    subtitle: isRTL ? 'أورمنال' : 'Orminal ERP',
    isRTL,
    summary: [
      { label: isRTL ? 'إجمالي عمليات الصرف' : 'Total Issues', value: String(kpis.total) },
      { label: isRTL ? 'الكمية المصروفة' : 'Outgoing Qty', value: formatNumber(kpis.totalQty, 0) },
      { label: isRTL ? 'قيمة المصروف' : 'Outgoing Value', value: formatCurrency(kpis.totalValue) },
      { label: isRTL ? 'منتجات متنوعة' : 'Unique Products', value: String(kpis.uniqueProducts) },
    ],
    labels: {
      generatedAt: isRTL ? 'تاريخ الإنشاء' : 'Generated',
      totalRecords: isRTL ? 'عدد السجلات' : 'Records',
      grandTotal: isRTL ? 'الإجمالي' : 'Total',
    },
  }

  const handleExportFormat = async (format: ExportFormat) => {
    if (!movements.length) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }
    try {
      await exportRows(format, movements, exportColumns, exportMeta)
      toast.success(isRTL ? 'تم التصدير بنجاح' : 'Export completed successfully')
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed'))
    }
  }

  const formTotal = items.reduce((s, it) => {
    const p = products.find(x => x.id === it.productId)
    return s + (p ? Number(it.quantity) * p.salePrice : 0)
  }, 0)

  return (
    <ModuleShell
      title={t('module.inventory-outgoing')}
      description={isRTL ? "تسجيل عمليات صرف (صادر) المخزون" : "Record inventory outgoing transactions"}
      icon={<ArrowUpFromLine className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel={isRTL ? "صرف جديد" : "New Issue"}
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
        <Select value={storehouseFilter} onValueChange={setStorehouseFilter}>
          <SelectTrigger dir={dir} className={cn("w-44", isRTL ? "text-right" : "text-left")}><SelectValue /></SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all">{isRTL ? "كل المستودعات" : "All Storehouses"}</SelectItem>
            {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={isRTL ? "إجمالي عمليات الصرف" : "Total Issues"} value={String(kpis.total)} icon={<ArrowUpFromLine className="size-5" />} accent="rose" />
            <KpiCard title={isRTL ? "الكمية المصروفة" : "Outgoing Qty"} value={formatNumber(kpis.totalQty, 0)} icon={<Boxes className="size-5" />} accent="amber" />
            <KpiCard title={isRTL ? "قيمة المصروف" : "Outgoing Value"} value={formatCurrency(kpis.totalValue)} icon={<Package className="size-5" />} accent="violet" />
            <KpiCard title={isRTL ? "منتجات متنوعة" : "Unique Products"} value={String(kpis.uniqueProducts)} icon={<Package className="size-5" />} accent="sky" />
          </>
        )}
      </div>

      {/* جدول إخراجات المخزون — رأس ثابت + تمرير للصفوف فقط + محاذاة دقيقة بالأعمدة تماشياً مع جدول مرتجعات المشتريات */}
      <Card className="rounded-xl overflow-hidden border border-border">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[980px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* التاريخ */}
              <col className="w-[18%]" />{/* المنتج */}
              <col className="w-[10%]" />{/* SKU */}
              <col className="w-[12%]" />{/* المستودع */}
              <col className="w-[10%]" />{/* المرجع */}
              <col className="w-[8%]" />{/* الكمية */}
              <col className="w-[8%]" />{/* السعر */}
              <col className="w-[10%]" />{/* الإجمالي */}
              <col className="w-[12%]" />{/* ملاحظات */}
              <col className="w-[10%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{isRTL ? "التاريخ" : "Date"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "المنتج" : "Product"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>SKU</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "المستودع" : "Storehouse"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "المرجع" : "Reference"}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? "الكمية" : "Qty"}</TableHead>
                <TableHead className={`${stickyHead} text-end`}>{isRTL ? "السعر" : "Price"}</TableHead>
                <TableHead className={`${stickyHead} text-end`}>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{isRTL ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground border-b">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground border-b">
                    <ArrowUpFromLine className="size-10 mx-auto mb-2 opacity-50" />
                    {isRTL ? 'لا توجد عمليات صرف مسجلة. ابدأ بتسجيل أول صرف.' : 'No outgoing inventory recorded. Start by adding a new issue.'}
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => {
                  const price = m.product?.salePrice ?? 0
                  const name = m.product?.name ?? '—'
                  const sku = m.product?.sku ?? '—'
                  const storehouseName = m.storehouse?.name ?? '—'
                  const qty = m.quantity ?? 0
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/40 align-middle cursor-pointer" onClick={() => setDetailMovement(m)}>
                      <TableCell className="ps-4 text-xs text-muted-foreground whitespace-nowrap border-b">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium border-b truncate" title={name}>
                        {name}
                      </TableCell>
                      <TableCell className="font-mono text-xs border-b truncate" title={sku}>
                        {sku}
                      </TableCell>
                      <TableCell className="text-sm border-b truncate" title={storehouseName}>
                        {storehouseName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground border-b truncate" title={m.refType ?? '—'}>
                        {m.refType ?? '—'}
                      </TableCell>
                      <TableCell className="num-cell text-sm font-semibold text-rose-600 dark:text-rose-400 text-center border-b">
                        <span className="num">-{formatNumber(qty, 0)}</span>
                      </TableCell>
                      <TableCell className="num-cell text-xs text-end border-b">
                        <span className="num">{formatNumber(price)}</span>
                      </TableCell>
                      <TableCell className="num-cell text-sm font-semibold text-end border-b">
                        <span className="num">{formatCurrency(qty * price)}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground border-b truncate" title={m.note ?? '—'}>
                        {m.note ?? '—'}
                      </TableCell>
                      <TableCell className="pe-4 text-end border-b" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} collisionPadding={8} className="w-25 z-50">
                            <DropdownMenuItem onClick={() => setDetailMovement(m)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Eye className="size-5 text-blue-600" />
                              <span>{isRTL ? 'عرض' : 'View'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintVoucher(m)} className="gap-2 cursor-pointer text-sm font-medium">
                              <Printer className="size-5 text-slate-700 dark:text-slate-300" />
                              <span>{isRTL ? 'طباعة' : 'Print'}</span>
                            </DropdownMenuItem>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-250 dark:border-blue-500/30" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm shadow-rose-100/40 dark:shadow-none shrink-0">
                <ArrowUpFromLine className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-white">
                  {isRTL ? 'تسجيل صرف مخزني جديد' : 'New Stock Issue'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                {/* General Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Boxes className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'بيانات الصرف والمستودع' : 'Issue & Warehouse Info'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'المستودع المصدر *' : 'Source Warehouse *'}
                      </Label>
                      <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع' : 'Select warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'العميل (اختياري)' : 'Client (Optional)'}
                      </Label>
                      <Select value={form.clientId || 'none'} onValueChange={v => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'بدون عميل' : 'No client'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          <SelectItem value="none">{isRTL ? 'بدون عميل (عميل افتراضي / عادي)' : 'No client (Default / Walk-in)'}</SelectItem>
                          {clients.map(c => {
                            const clientName = c.nameAr || c.nameEn || c.name || c.code || 'عميل'
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                {clientName} {c.code ? `(${c.code})` : ''}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="space-y-4">
                  <div className={cn("flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60", isRTL ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المراد صرفها' : 'Items to Issue'}
                      </h3>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1.5 text-xs">
                      <Plus className="size-3.5" /> {isRTL ? 'إضافة صنف' : 'Add Item'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-250 dark:border-blue-500/30 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm border-separate border-spacing-0">
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                          <TableRow>
                            <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                            <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                            <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'السعر' : 'Price'}</TableHead>
                            <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                {isRTL ? 'اضغط "إضافة صنف" لإدخال عناصر الصرف' : 'Click "Add Item" to start adding issue items'}
                              </TableCell>
                            </TableRow>
                          ) : items.map((it, idx) => {
                            const p = products.find(x => x.id === it.productId)
                            return (
                              <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                                <TableCell className="p-2">
                                  <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                                    <SelectTrigger dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                                      <SelectValue placeholder={isRTL ? 'اختر منتج' : 'Select product'} />
                                    </SelectTrigger>
                                    <SelectContent dir={dir}>
                                      {products.map(p => {
                                        const productName = p.nameAr || p.nameEn || p.name || 'منتج'
                                        return (
                                          <SelectItem key={p.id} value={p.id}>
                                            {productName} ({p.sku})
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs", isRTL ? "text-right" : "text-left")} />
                                </TableCell>
                                <TableCell className={cn("p-2 num-cell text-xs text-slate-650 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>
                                  {p ? <span className="num">{formatNumber(p.salePrice)}</span> : '—'}
                                </TableCell>
                                <TableCell className={cn("p-2 num-cell text-xs font-semibold text-slate-900 dark:text-white", isRTL ? "text-right" : "text-left")}>
                                  {p ? <span className="num">{formatCurrency(Number(it.quantity) * p.salePrice)}</span> : '—'}
                                </TableCell>
                                <TableCell className="p-2 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg" onClick={() => removeItem(idx)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </table>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-3 px-1", isRTL ? "flex-row-reverse" : "justify-end")}>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي قيمة الصرف:' : 'Total Value:'}</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white"><span className="num">{formatCurrency(formTotal)}</span></span>
                  </div>
                </div>

                {/* Additional notes */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات إضافية' : 'Notes / Remarks'}</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي ملاحظات تخص عملية صرف المخزون...' : 'Any remarks or comments regarding the stock issue...'} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-blue-700/30 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-250 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white text-xs font-semibold shadow-sm">
                {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'تسجيل وصرف المخزون' : 'Save & Issue Stock')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailMovement} onOpenChange={(o) => !o && setDetailMovement(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader >
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center shadow-sm shrink-0">
                <ArrowUpFromLine className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle>
                  {isRTL ? 'تفاصيل سند الصرف المخزني' : 'Stock Issue Details'}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
                  {isRTL ? `المرجع: ${detailMovement?.refType || detailMovement?.id}` : `Ref: ${detailMovement?.refType || detailMovement?.id}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailMovement && (
            <div className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDateTime(detailMovement.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'المستودع المصدر' : 'Source Storehouse'}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{detailMovement.storehouse?.name || '—'}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Package className="size-4 text-rose-600 dark:text-rose-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'بيانات المنتج المصروف' : 'Issued Product Info'}
                    </h3>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{isRTL ? 'المنتج' : 'Product'}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{detailMovement.product?.name || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">SKU</span>
                      <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{detailMovement.product?.sku || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{isRTL ? 'الكمية المصروفة' : 'Issued Qty'}</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400"><span className="num">-{formatNumber(detailMovement.quantity ?? 0, 0)}</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{isRTL ? 'سعر الوحدة' : 'Unit Price'}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white"><span className="num">{formatCurrency(detailMovement.product?.salePrice ?? 0)}</span></span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isRTL ? 'إجمالي قيمة الصرف' : 'Total Amount'}</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white"><span className="num">{formatCurrency((detailMovement.quantity ?? 0) * (detailMovement.product?.salePrice ?? 0))}</span></span>
                    </div>
                  </div>
                </div>

                {detailMovement.note && (
                  <div className="p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-xs text-slate-500 font-bold block mb-1">{isRTL ? 'الملاحظات' : 'Notes'}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{detailMovement.note}</p>
                  </div>
                )}
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" className="h-10 px-4 border-slate-400 dark:border-slate-500 text-sm font-semibold gap-1.5" onClick={() => handlePrintVoucher(detailMovement)}>
                  <Printer className="size-4" /> {isRTL ? 'طباعة' : 'Print'}
                </Button>
                <Button variant="outline" onClick={() => setDetailMovement(null)} className="h-10 px-5 border-rose-400 dark:border-rose-800 text-sm font-semibold">
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
