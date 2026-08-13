'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import {
  exportRows,
  type ExportColumn,
  type ExportMeta,
  type ExportFormat,
} from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Boxes, Tag, Pencil, Trash2, Download, FileSpreadsheet, FileText, FileCheck, Eye } from 'lucide-react'

interface Category { id: string; code: string; nameAr: string; nameEn?: string }
interface Uom { id: string; code: string; nameAr: string; nameEn?: string }
interface TaxCode { id: string; code: string; rate: number }
interface Product {
  id: string
  sku: string
  barcode?: string
  nameAr: string
  nameEn?: string
  type: string
  costPrice: number
  salePrice: number
  minStock: number
  active: boolean
  category?: Category
  uom?: Uom
  taxCode?: TaxCode
}

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  product: { ar: 'منتج', en: 'Product' },
  service: { ar: 'خدمة', en: 'Service' },
  raw_material: { ar: 'مادة خام', en: 'Raw Material' },
  finished: { ar: 'منتج نهائي', en: 'Finished Good' },
  consumable: { ar: 'مستهلك', en: 'Consumable' },
}

const HEADER_HEIGHT = 44
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 7

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function ProductsModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const getTypeLabel = (type: string) =>
    TYPE_LABELS[type] ? (isRTL ? TYPE_LABELS[type].ar : TYPE_LABELS[type].en) : type

  const { data, isLoading } = useQuery<{ data: Product[]; meta: any }>({
    queryKey: ['products', search, filterType, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterType !== 'all') params.set('type', filterType)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/products?${params}`)
      if (!r.ok) throw new Error(L('فشل جلب المنتجات', 'Failed to fetch products'))
      return r.json()
    },
  })

  const { data: catsData } = useQuery<{ data: Category[] }>({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/categories?pageSize=100')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const products = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const categories = catsData?.data ?? []

  const stats = {
    total,
    active: products.filter((p) => p.active).length,
    totalValue: products.reduce((s, p) => s + p.costPrice, 0),
    avgPrice: products.length ? products.reduce((s, p) => s + p.salePrice, 0) / products.length : 0,
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/products/${editing.id}` : '/api/erp/products'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? L('فشل حفظ بيانات المنتج', 'Failed to save product data'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editing ? L('تم تحديث بيانات المنتج بنجاح', 'Product updated successfully') : L('تم إضافة المنتج بنجاح', 'Product added successfully'))
      qc.invalidateQueries({ queryKey: ['products'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء حفظ المنتج', 'An error occurred while saving product')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/products/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(L('فشل حذف المنتج', 'Failed to delete product'))
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف المنتج بنجاح', 'Product deleted successfully'))
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: any) => toast.error(e.message || L('تعذر حذف المنتج', 'Failed to delete product')),
  })

  const handleDelete = (p: Product) => {
    if (confirm(L(`هل أنت تأكد من رغبتك في حذف المنتج "${p.nameAr}"؟`, `Are you sure you want to delete product "${p.nameEn || p.nameAr}"?`))) {
      deleteMutation.mutate(p.id)
    }
  }

  const handleSave = (formData: FormData) => {
    const payload: any = {
      sku: formData.get('sku') || undefined,
      barcode: formData.get('barcode') || undefined,
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      categoryId: formData.get('categoryId') || undefined,
      uomId: formData.get('uomId') || undefined,
      type: formData.get('type') || 'product',
      costPrice: Number(formData.get('costPrice')) || 0,
      salePrice: Number(formData.get('salePrice')) || 0,
      minStock: Number(formData.get('minStock')) || 0,
      active: formData.get('active') === 'on',
    }
    saveMutation.mutate(payload)
  }

  const exportColumns: ExportColumn<Product>[] = [
    { key: 'sku', header: 'SKU', width: 16, align: 'start', type: 'text', value: (p) => p.sku },
    { key: 'barcode', header: L('الباركود', 'Barcode'), width: 18, align: 'start', type: 'text', value: (p) => p.barcode ?? '' },
    { key: 'name', header: L('اسم المنتج', 'Product Name'), width: 28, align: 'start', type: 'text', value: (p) => (isRTL ? p.nameAr : (p.nameEn || p.nameAr)) },
    { key: 'category', header: L('الفئة', 'Category'), width: 20, align: 'start', type: 'text', value: (p) => ((isRTL ? p.category?.nameAr : (p.category?.nameEn || p.category?.nameAr)) ?? '') },
    { key: 'type', header: L('النوع', 'Type'), width: 16, align: 'start', type: 'text', value: (p) => getTypeLabel(p.type) },
    { key: 'uom', header: L('الوحدة', 'Unit'), width: 14, align: 'start', type: 'text', value: (p) => ((isRTL ? p.uom?.nameAr : (p.uom?.nameEn || p.uom?.nameAr)) ?? '') },
    { key: 'costPrice', header: L('سعر التكلفة', 'Cost Price'), width: 18, align: 'end', type: 'currency', summable: true, value: (p) => p.costPrice },
    { key: 'salePrice', header: L('سعر البيع', 'Sale Price'), width: 18, align: 'end', type: 'currency', summable: true, value: (p) => p.salePrice },
    { key: 'minStock', header: L('الحد الأدنى', 'Min Stock'), width: 14, align: 'end', type: 'number', numFmt: '#,##0', summable: true, value: (p) => p.minStock },
    { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', type: 'text', value: (p) => (p.active ? L('نشط', 'Active') : L('غير نشط', 'Inactive')) },
  ]

  const exportMeta: ExportMeta = {
    fileName: L('تقرير-المنتجات', 'products-report'),
    title: L('تقرير قائمة المنتجات والخدمات', 'Products & Services Report'),
    subtitle: L('أورمنال ERP', 'Orminal ERP'),
    isRTL,
    summary: [
      { label: L('إجمالي المنتجات', 'Total Products'), value: formatInt(total) },
      { label: L('المنتجات النشطة', 'Active Products'), value: formatInt(stats.active) },
      { label: L('إجمالي قيم التكلفة', 'Total Cost Value'), value: formatCurrency(stats.totalValue) },
      { label: L('متوسط سعر البيع', 'Avg Sale Price'), value: formatCurrency(stats.avgPrice) },
    ],
    labels: {
      generatedAt: L('تاريخ الإنشاء', 'Generated At'),
      totalRecords: L('إجمالي السجلات', 'Total Records'),
      grandTotal: L('الإجمالي', 'Total'),
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!products.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, products, exportColumns, exportMeta)
      toast.success(L('تم تصدير الملف بنجاح', 'File exported successfully'))
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  return (
    <ModuleShell
      title={t('module.products') || L('المنتجات والخدمات', 'Products & Services')}
      description={L('إدارة المنتجات والخدمات والمواد الخام والأسعار', 'Manage products, services, raw materials, and pricing')}
      icon={<Package className="size-5 text-blue-600 dark:text-blue-400" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('ابحث برمز SKU أو الاسم...', 'Search by SKU or name...')}
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={L('منتج جديد', 'New Product')}
      actions={
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold">
              <Download className="size-4 text-emerald-600" />
              <span>{L('تصدير', 'Export')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-44 z-50">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer text-xs">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>{L('تصدير Excel', 'Export Excel')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer text-xs">
              <FileText className="size-4 text-rose-600" />
              <span>{L('تصدير PDF', 'Export PDF')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer text-xs">
              <FileCheck className="size-4 text-blue-600" />
              <span>{L('تصدير CSV', 'Export CSV')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
            <SelectValue placeholder={L('النوع', 'Type')} />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
            <SelectItem value="all">{L('الكل', 'All Types')}</SelectItem>
            <SelectItem value="product">{L('منتج', 'Product')}</SelectItem>
            <SelectItem value="service">{L('خدمة', 'Service')}</SelectItem>
            <SelectItem value="raw_material">{L('مادة خام', 'Raw Material')}</SelectItem>
            <SelectItem value="finished">{L('منتج نهائي', 'Finished Good')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={L('إجمالي المنتجات', 'Total Products')} value={formatInt(total)} icon={<Package className="size-5" />} accent="blue" />
        <KpiCard title={L('المنتجات النشطة', 'Active Products')} value={formatInt(stats.active)} icon={<Boxes className="size-5" />} accent="sky" />
        <KpiCard title={L('قيمة التكلفة', 'Cost Value')} value={formatCurrency(stats.totalValue)} icon={<Tag className="size-5" />} accent="amber" />
        <KpiCard title={L('متوسط سعر البيع', 'Avg Sale Price')} value={formatCurrency(stats.avgPrice)} icon={<Tag className="size-5" />} accent="violet" />
      </div>

      {/* Main Products Table — Fixed Header + Body Scroll (~6 rows visible) */}
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[1050px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[8%]" />{/* SKU */}
              <col className="w-[18%]" />{/* الاسم */}
              <col className="w-[12%]" />{/* الفئة */}
              <col className="w-[7%]" />{/* النوع */}
              <col className="w-[6%]" />{/* الوحدة */}
              <col className="w-[9%]" />{/* التكلفة */}
              <col className="w-[10%]" />{/* البيع */}
              <col className="w-[8%]" />{/* الحد الأدنى */}
              <col className="w-[9%]" />{/* الحالة */}
              <col className="w-[11%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className={`${stickyHead} ps-4 text-start`}>SKU</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('اسم المنتج', 'Product Name')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الفئة', 'Category')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('النوع', 'Type')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الوحدة', 'Unit')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('التكلفة', 'Cost Price')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('البيع', 'Sale Price')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('الحد الأدنى', 'Min Stock')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="h-[52px]">
                    <TableCell className="ps-4 border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="border-b"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="pe-4 border-b"><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-muted-foreground border-b">
                    <Package className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">{L('لا توجد منتجات. ابدأ بإضافة أول منتج.', 'No products found. Start by adding your first product.')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow
                    key={p.id}
                    className="h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-middle cursor-pointer"
                    onClick={() => { setEditing(p); setDialogOpen(true) }}
                  >
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" dir="ltr" title={p.sku}>
                      {p.sku}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100 border-b truncate" title={isRTL ? p.nameAr : (p.nameEn || p.nameAr)}>
                      {isRTL ? p.nameAr : (p.nameEn || p.nameAr)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={(isRTL ? p.category?.nameAr : (p.category?.nameEn || p.category?.nameAr)) ?? '—'}>
                      {(isRTL ? p.category?.nameAr : (p.category?.nameEn || p.category?.nameAr)) ?? '—'}
                    </TableCell>
                    <TableCell className="border-b">
                      <Badge variant="outline" className="text-[10px] font-normal border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        {getTypeLabel(p.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={(isRTL ? p.uom?.nameAr : (p.uom?.nameEn || p.uom?.nameAr)) ?? '—'}>
                      {(isRTL ? p.uom?.nameAr : (p.uom?.nameEn || p.uom?.nameAr)) ?? '—'}
                    </TableCell>
                    <TableCell className="text-center num-cell border-b">
                      <span className="num tabular-nums text-slate-600 dark:text-slate-400 text-xs" dir="ltr">{formatCurrency(p.costPrice)}</span>
                    </TableCell>
                    <TableCell className="text-center num-cell border-b">
                      <span className="num tabular-nums font-semibold text-slate-900 dark:text-slate-100 text-xs" dir="ltr">{formatCurrency(p.salePrice)}</span>
                    </TableCell>
                    <TableCell className="text-center num-cell border-b">
                      <span className="num tabular-nums text-slate-600 dark:text-slate-400 text-xs" dir="ltr">{formatInt(p.minStock)}</span>
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={p.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => { setEditing(p); setDialogOpen(true) }}
                          title={L('عرض أو تعديل المنتج', 'View or edit product')}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => { setEditing(p); setDialogOpen(true) }}
                          title={L('تعديل المنتج', 'Edit product')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => handleDelete(p)}
                          title={L('حذف المنتج', 'Delete product')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir={dir as 'rtl' | 'ltr'} className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-4 sm:p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="size-10 sm:size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Package className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white rtl:text-right ltr:text-left">
                  {editing ? L('تعديل / عرض بيانات المنتج', 'Edit / View Product Information') : L('إضافة منتج جديد', 'Add New Product')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-950 rtl:text-right ltr:text-left">
            <form id="product-form" dir={dir as 'rtl' | 'ltr'} onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)) }}>
              <div className="space-y-3 sm:space-y-4 rtl:text-right ltr:text-left">
                {/* 1. رمز المنتج (SKU) والباركود جنب بعض للجوال */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 rtl:text-right ltr:text-left">
                  {/* SKU */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="sku" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('رمز المنتج (SKU)', 'Product Code (SKU)')}
                    </Label>
                    <Input
                      id="sku"
                      name="sku"
                      defaultValue={editing?.sku}
                      placeholder={L('تلقائي', 'Auto')}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>

                  {/* Barcode */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="barcode" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('الباركود', 'Barcode')}
                    </Label>
                    <Input
                      id="barcode"
                      name="barcode"
                      defaultValue={editing?.barcode}
                      placeholder="6291100000000"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>
                </div>

                {/* الاسم بالعربي والاسم بالإنجليزي */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 rtl:text-right ltr:text-left">
                  {/* Arabic Name */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('اسم المنتج (بالعربي)', 'Product Name (Arabic)')} <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="nameAr"
                      name="nameAr"
                      defaultValue={editing?.nameAr}
                      required
                      placeholder={L('مثال: جهاز حاسوب محمول', 'e.g. Laptop Computer')}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>

                  {/* English Name */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('اسم المنتج (بالإنجليزية)', 'Product Name (English)')}
                    </Label>
                    <Input
                      id="nameEn"
                      name="nameEn"
                      defaultValue={editing?.nameEn}
                      placeholder="e.g. Laptop Computer"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>
                </div>

                {/* 2. الفئة ونوع المنتج جنب بعض للجوال */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 rtl:text-right ltr:text-left">
                  {/* Category */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="categoryId" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('الفئة', 'Category')}
                    </Label>
                    <Select name="categoryId" defaultValue={editing?.category?.id} dir={dir as 'rtl' | 'ltr'}>
                      <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left">
                        <SelectValue placeholder={L('اختر الفئة...', 'Select category...')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50 rtl:text-right ltr:text-left" dir={dir as 'rtl' | 'ltr'}>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {isRTL ? c.nameAr : (c.nameEn || c.nameAr)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="type" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('نوع المنتج', 'Product Type')}
                    </Label>
                    <Select name="type" defaultValue={editing?.type ?? 'product'} dir={dir as 'rtl' | 'ltr'}>
                      <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50 rtl:text-right ltr:text-left" dir={dir as 'rtl' | 'ltr'}>
                        <SelectItem value="product">{L('منتج', 'Product')}</SelectItem>
                        <SelectItem value="service">{L('خدمة', 'Service')}</SelectItem>
                        <SelectItem value="raw_material">{L('مادة خام', 'Raw Material')}</SelectItem>
                        <SelectItem value="finished">{L('منتج نهائي', 'Finished Good')}</SelectItem>
                        <SelectItem value="consumable">{L('مستهلك', 'Consumable')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3. سعر التكلفة وسعر البيع جنب بعض للجوال */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 rtl:text-right ltr:text-left">
                  {/* Cost Price */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="costPrice" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('سعر التكلفة', 'Cost Price')}
                    </Label>
                    <Input
                      id="costPrice"
                      name="costPrice"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.costPrice ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>

                  {/* Sale Price */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="salePrice" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('سعر البيع', 'Sale Price')}
                    </Label>
                    <Input
                      id="salePrice"
                      name="salePrice"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.salePrice ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>
                </div>

                {/* 4. الحد الأدنى للمخزون وحالة المنتج جنب بعض للجوال */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 items-end rtl:text-right ltr:text-left">
                  {/* Min Stock */}
                  <div className="space-y-1.5 rtl:text-right ltr:text-left">
                    <Label htmlFor="minStock" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block rtl:text-right ltr:text-left">
                      {L('الحد الأدنى للمخزون', 'Minimum Stock')}
                    </Label>
                    <Input
                      id="minStock"
                      name="minStock"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.minStock ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rtl:text-right ltr:text-left"
                      dir={dir as 'rtl' | 'ltr'}
                    />
                  </div>

                  {/* Active Switch */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 h-10">
                    <Label htmlFor="active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                      {L('منتج نشط', 'Active Product')}
                    </Label>
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                  </div>
                </div>
              </div>
            </form>
          </DialogBody>

          {/* Footer Buttons — Styled matching Category modal */}
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t shrink-0 bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto sm:min-w-25 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              form="product-form"
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto sm:min-w-30 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMutation.isPending
                ? L('جاري الحفظ...', 'Saving...')
                : editing
                  ? L('تحديث المنتج', 'Update Product')
                  : L('إنشاء المنتج', 'Create Product')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
