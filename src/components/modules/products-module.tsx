'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Boxes, Tag, Pencil, Trash2 } from 'lucide-react'

interface Category { id: string; code: string; nameAr: string }
interface Uom { id: string; code: string; nameAr: string }
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

const TYPE_LABELS: Record<string, string> = {
  product: 'منتج',
  service: 'خدمة',
  raw_material: 'مادة خام',
  finished: 'منتج نهائي',
  consumable: 'مستهلك',
}

export function ProductsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: Product[]; meta: any }>({
    queryKey: ['products', search, filterType, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterType !== 'all') params.set('type', filterType)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/products?${params}`)
      if (!r.ok) throw new Error('Failed')
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
        throw new Error(err?.error?.message ?? 'فشل حفظ بيانات المنتج')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث بيانات المنتج بنجاح' : 'تم إضافة المنتج بنجاح')
      qc.invalidateQueries({ queryKey: ['products'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ أثناء حفظ المنتج'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/products/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف المنتج بنجاح')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('تعذر حذف المنتج'),
  })

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

  const handleExport = () => {
    const rows = products.map((p) => ({
      'SKU': p.sku,
      'الباركود': p.barcode ?? '',
      'الاسم': p.nameAr,
      'الفئة': p.category?.nameAr ?? '',
      'النوع': TYPE_LABELS[p.type] ?? p.type,
      'الوحدة': p.uom?.nameAr ?? '',
      'سعر التكلفة': p.costPrice,
      'سعر البيع': p.salePrice,
      'الحد الأدنى': p.minStock,
      'الحالة': p.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('products', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.products')}
      description="إدارة المنتجات والخدمات والمواد الخام"
      icon={<Package className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز SKU أو الاسم..."
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
            <SelectValue placeholder="النوع" />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="product">منتج</SelectItem>
            <SelectItem value="service">خدمة</SelectItem>
            <SelectItem value="raw_material">مادة خام</SelectItem>
            <SelectItem value="finished">منتج نهائي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي المنتجات" value={formatInt(total)} icon={<Package className="size-5" />} accent="blue" />
        <KpiCard title="المنتجات النشطة" value={formatInt(stats.active)} icon={<Boxes className="size-5" />} accent="sky" />
        <KpiCard title="قيمة التكلفة" value={formatCurrency(stats.totalValue)} icon={<Tag className="size-5" />} accent="amber" />
        <KpiCard title="متوسط سعر البيع" value={formatCurrency(stats.avgPrice)} icon={<Tag className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="ps-4">SKU</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead className="text-end num-cell">التكلفة</TableHead>
                <TableHead className="text-end num-cell">البيع</TableHead>
                <TableHead className="text-end num-cell">الحد الأدنى</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد منتجات. ابدأ بإضافة أول منتج.</TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                  <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400" dir="ltr">{p.sku}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">{p.nameAr}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-slate-400">{p.category?.nameAr ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-normal">{TYPE_LABELS[p.type] ?? p.type}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-slate-400">{p.uom?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">{formatCurrency(p.costPrice)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-slate-900 dark:text-white" dir="ltr">{formatCurrency(p.salePrice)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">{formatInt(p.minStock)}</span></TableCell>
                  <TableCell><StatusBadge status={p.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400" onClick={() => { setEditing(p); setDialogOpen(true) }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          عرض {products.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + products.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      {/* Add / Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60  dark:text-blue-100 text-white shadow-xs">
                <Package className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editing ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 bg-white dark:bg-slate-900 text-start">
            <form id="product-form" onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)) }}>
              <ScrollArea className="max-h-[60vh] pe-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sku" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      رمز المنتج (SKU)
                    </Label>
                    <Input
                      id="sku"
                      name="sku"
                      defaultValue={editing?.sku}
                      placeholder="تلقائي إن تُرك فارغاً"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Barcode */}
                  <div className="space-y-1.5">
                    <Label htmlFor="barcode" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      الباركود
                    </Label>
                    <Input
                      id="barcode"
                      name="barcode"
                      defaultValue={editing?.barcode}
                      placeholder="6291100000000"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Arabic Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      اسم المنتج (بالعربي) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="nameAr"
                      name="nameAr"
                      defaultValue={editing?.nameAr}
                      required
                      placeholder="مثال: جهاز حاسوب محمول"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* English Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      اسم المنتج (بالإنجليزية)
                    </Label>
                    <Input
                      id="nameEn"
                      name="nameEn"
                      defaultValue={editing?.nameEn}
                      placeholder="e.g. Laptop Computer"
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label htmlFor="categoryId" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      الفئة
                    </Label>
                    <Select name="categoryId" defaultValue={editing?.category?.id}>
                      <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        <SelectValue placeholder="اختر الفئة..." />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      نوع المنتج
                    </Label>
                    <Select name="type" defaultValue={editing?.type ?? 'product'}>
                      <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                        <SelectItem value="product">منتج</SelectItem>
                        <SelectItem value="service">خدمة</SelectItem>
                        <SelectItem value="raw_material">مادة خام</SelectItem>
                        <SelectItem value="finished">منتج نهائي</SelectItem>
                        <SelectItem value="consumable">مستهلك</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cost Price */}
                  <div className="space-y-1.5">
                    <Label htmlFor="costPrice" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      سعر التكلفة
                    </Label>
                    <Input
                      id="costPrice"
                      name="costPrice"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.costPrice ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Sale Price */}
                  <div className="space-y-1.5">
                    <Label htmlFor="salePrice" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      سعر البيع
                    </Label>
                    <Input
                      id="salePrice"
                      name="salePrice"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.salePrice ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Min Stock */}
                  <div className="space-y-1.5">
                    <Label htmlFor="minStock" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      الحد الأدنى للمخزون
                    </Label>
                    <Input
                      id="minStock"
                      name="minStock"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.minStock ?? 0}
                      className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>

                  {/* Active Switch */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 self-end h-10">
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                    <Label htmlFor="active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                      منتج نشط
                    </Label>
                  </div>
                </div>
              </ScrollArea>
            </form>
          </DialogBody>

          <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 gap-2 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              form="product-form"
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMutation.isPending ? 'جاري الحفظ...' : editing ? 'تحديث المنتج' : 'إنشاء المنتج'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
