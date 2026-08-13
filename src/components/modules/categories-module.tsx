'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportRows, printHTML, ExportColumn, ExportFormat } from '@/lib/export'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { FolderTree, Pencil, Trash2, Boxes, GitBranch, CheckCircle, Download, FileSpreadsheet, FileText, FileCheck, ChevronDown, Printer, Eye } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu'

interface CategoryItem {
  id: string
  code: string
  nameAr: string
  nameEn?: string | null
  parentId?: string | null
  type: string
  active: boolean
  parent?: { id: string; code: string; nameAr: string; nameEn?: string } | null
  _count?: { products?: number }
}

const EMPTY_FORM = {
  code: '',
  nameAr: '',
  nameEn: '',
  parentId: '',
  type: 'product',
  active: true,
}

const HEADER_HEIGHT = 44
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 6

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function CategoriesModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)

  const categoryTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return L('منتج', 'Product')
      case 'partner': return L('شريك', 'Partner')
      case 'expense': return L('مصروف', 'Expense')
      case 'revenue': return L('إيراد', 'Revenue')
      default: return type
    }
  }

  // Fetch Categories
  const { data, isLoading } = useQuery<{ data: CategoryItem[]; total: number }>({
    queryKey: ['categories', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/categories?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error(L('فشل جلب بيانات الفئات', 'Failed to fetch categories'))
      return r.json()
    },
  })
  const categories = data?.data ?? []

  // Save Mutation (POST / PUT)
  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/erp/categories/${editId}` : '/api/erp/categories'
      const method = editId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, parentId: form.parentId || null }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || L('فشل حفظ الفئة', 'Failed to save category'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editId ? L('تم تحديث الفئة بنجاح', 'Category updated successfully') : L('تم إنشاء الفئة بنجاح', 'Category created successfully'))
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['categories-list'] })
      setDialogOpen(false)
      setEditId(null)
      setForm(EMPTY_FORM)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ أثناء حفظ الفئة', 'An error occurred while saving category')),
  })

  // Delete Mutation
  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/categories/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || L('تعذر حذف الفئة', 'Failed to delete category'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف الفئة بنجاح', 'Category deleted successfully'))
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['categories-list'] })
    },
    onError: (e: any) => toast.error(e.message || L('تعذر حذف الفئة', 'Failed to delete category')),
  })

  const handleAdd = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (c: CategoryItem) => {
    setForm({
      code: c.code,
      nameAr: c.nameAr,
      nameEn: c.nameEn || '',
      parentId: c.parentId || '',
      type: c.type || 'product',
      active: c.active,
    })
    setEditId(c.id)
    setDialogOpen(true)
  }

  const handleDelete = (c: CategoryItem) => {
    if (confirm(L(`هل أنت تأكد من رغبتك في حذف الفئة "${c.nameAr}"؟`, `Are you sure you want to delete category "${c.nameEn || c.nameAr}"?`))) {
      delMut.mutate(c.id)
    }
  }

  const getParentName = (c: CategoryItem) => {
    if (!c.parentId) return '—'
    if (c.parent) return isRTL ? c.parent.nameAr : (c.parent.nameEn || c.parent.nameAr)
    const p = categories.find(x => x.id === c.parentId)
    return p ? (isRTL ? p.nameAr : (p.nameEn || p.nameAr)) : '—'
  }

  const handlePrintCategory = (c: CategoryItem) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال للأنظمة المحاسبية</h2>
            <p>بطاقة تفاصيل الفئة</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">فئة / تصنيف</div>
          <div class="code">${c.code}</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">اسم الفئة</div>
        <div class="name">${c.nameAr}</div>
        ${c.nameEn ? `<div class="sub">Name: ${c.nameEn}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr><th>المعيار</th><th>القيمة</th></tr>
        </thead>
        <tbody>
          <tr><td>رمز الفئة</td><td>${c.code}</td></tr>
          <tr><td>نوع الفئة</td><td>${categoryTypeLabel(c.type)}</td></tr>
          <tr><td>الفئة الأم</td><td>${getParentName(c)}</td></tr>
          <tr><td>عدد المنتجات المرتبطة</td><td>${c._count?.products ?? 0}</td></tr>
          <tr><td>الحالة</td><td>${c.active ? 'نشطة' : 'غير نشطة'}</td></tr>
        </tbody>
      </table>
    `
    printHTML(html, `فئة - ${c.nameAr}`)
  }

  const exportColumns: ExportColumn<CategoryItem>[] = [
    {
      key: 'code',
      header: L('الرمز', 'Code'),
      width: 12,
      align: 'start',
      type: 'text',
      value: (c) => c.code,
    },
    {
      key: 'nameAr',
      header: L('الاسم (عربي)', 'Name (Arabic)'),
      width: 24,
      align: 'start',
      type: 'text',
      value: (c) => c.nameAr,
    },
    {
      key: 'nameEn',
      header: L('الاسم (إنجليزي)', 'Name (English)'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (c) => c.nameEn || '—',
    },
    {
      key: 'parent',
      header: L('الفئة الأم', 'Parent Category'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (c) => getParentName(c),
    },
    {
      key: 'type',
      header: L('النوع', 'Type'),
      width: 12,
      align: 'start',
      type: 'text',
      value: (c) => categoryTypeLabel(c.type),
    },
    {
      key: 'active',
      header: L('الحالة', 'Status'),
      width: 12,
      align: 'center',
      type: 'text',
      value: (c) => (c.active ? L('نشط', 'Active') : L('غير نشط', 'Inactive')),
    },
  ]

  const handleExport = async (format: ExportFormat) => {
    if (!categories.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, categories, exportColumns, {
        fileName: `categories_${new Date().toISOString().split('T')[0]}`,
        title: L('تقرير الفئات والتصنيفات', 'Categories & Classifications Report'),
        subtitle: L(`إجمالي السجلات: ${categories.length}`, `Total Records: ${categories.length}`),
        isRTL,
      })
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const rootCount = categories.filter((c: CategoryItem) => !c.parentId).length
  const activeCount = categories.filter((c: CategoryItem) => c.active).length
  const withProductsCount = categories.filter((c: CategoryItem) => (c._count?.products ?? 0) > 0).length

  return (
    <ModuleShell
      title={t('module.categories') || L('الفئات والتصنيفات', 'Categories & Classifications')}
      description={L('إدارة فئات المنتجات والشركاء والمصروفات والهيكل الشجري', 'Manage product categories, partners, expenses, and tree structure')}
      icon={<FolderTree className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={L('ابحث عن فئة بالرمز أو الاسم...', 'Search category by code or name...')}
      onAdd={handleAdd}
      addLabel={L('فئة جديدة', 'New Category')}
      actions={
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold">
              <Download className="size-4 text-emerald-600" />
              <span>{L('تصدير', 'Export')}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-36 z-50">
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
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={L('إجمالي الفئات', 'Total Categories')} value={String(categories.length)} icon={<Boxes className="size-5" />} accent="blue" />
            <KpiCard title={L('الفئات الجذرية', 'Root Categories')} value={String(rootCount)} icon={<GitBranch className="size-5" />} accent="sky" />
            <KpiCard title={L('النشطة', 'Active Categories')} value={String(activeCount)} icon={<CheckCircle className="size-5" />} accent="violet" />
            <KpiCard title={L('تضم منتجات', 'With Products')} value={String(withProductsCount)} icon={<FolderTree className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Main Categories Table — Fixed Header + Body Scroll (~5 rows visible) */}
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[24%]" />{/* الاسم (عربي) */}
              <col className="w-[20%]" />{/* الاسم (إنجليزي) */}
              <col className="w-[20%]" />{/* الفئة الأم */}
              <col className="w-[10%]" />{/* النوع */}
              <col className="w-[8%]" />{/* الحالة */}
              <col className="w-[6%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الاسم (عربي)', 'Name (Ar)')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الاسم (إنجليزي)', 'Name (En)')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الفئة الأم', 'Parent Category')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('النوع', 'Type')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-[52px]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="border-b">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !categories.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 border-b">
                    <FolderTree className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">{L('لا توجد فئات مسجلة حالياً', 'No categories currently registered')}</p>
                    <p className="text-xs text-slate-500 mt-1">{L('انقر على "فئة جديدة" لإضافة فئة إلى النظام', 'Click "New Category" to add a category to the system')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c: CategoryItem) => (
                  <TableRow
                    key={c.id}
                    className="h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-middle cursor-pointer"
                    onClick={() => handleEdit(c)}
                  >
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" title={c.code}>
                      {c.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100 border-b truncate" title={c.nameAr}>
                      <div className="flex items-center gap-2 truncate">
                        <FolderTree className="size-4 text-blue-500 shrink-0" />
                        <span className="truncate">{c.nameAr}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={c.nameEn || '—'}>
                      {c.nameEn || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={getParentName(c)}>
                      {c.parentId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-full truncate">
                          <GitBranch className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{getParentName(c)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-medium border-b truncate" title={categoryTypeLabel(c.type)}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                        {categoryTypeLabel(c.type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={c.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => handleEdit(c)}
                          title={L('عرض أو تعديل الفئة', 'View or edit category')}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => handleEdit(c)}
                          title={L('تعديل الفئة', 'Edit category')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => handleDelete(c)}
                          title={L('حذف الفئة', 'Delete category')}
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

      {/* Add / Edit Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-[95vw] max-w-xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 sm:size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <FolderTree className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editId ? L('تعديل / عرض بيانات الفئة', 'Edit / View Category Information') : L('إضافة فئة جديدة', 'Add New Category')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-950 text-start space-y-3 sm:space-y-4">
            {/* Category Code & Category Type */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* Category Code */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('رمز الفئة', 'Category Code')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={L('مثال: CAT-001', 'e.g. CAT-001')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Category Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('نوع الفئة', 'Category Type')}
                </Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                    <SelectItem value="product">{L('منتج', 'Product')}</SelectItem>
                    <SelectItem value="partner">{L('شريك', 'Partner')}</SelectItem>
                    <SelectItem value="expense">{L('مصروف', 'Expense')}</SelectItem>
                    <SelectItem value="revenue">{L('إيراد', 'Revenue')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arabic Name & English Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              {/* Arabic Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('الاسم (بالعربي)', 'Name (Arabic)')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder={L('مثال: أجهزة إلكترونية', 'e.g. Electronics')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* English Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('الاسم (بالإنجليزية)', 'Name (English)')}
                </Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="e.g. Electronics"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>
            </div>

            {/*  Parent Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {L('الفئة الأم (الهيكل الشجري)', 'Parent Category (Tree Structure)')}
              </Label>
              <Select value={form.parentId || 'root'} onValueChange={(v) => setForm({ ...form, parentId: v === 'root' ? '' : v })}>
                <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  <SelectValue placeholder={L('فئة رئيسية (بدون)', 'Root Category (None)')} />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50 max-h-60 overflow-y-auto">
                  <SelectItem value="root">{L('فئة رئيسية (بدون)', 'Root Category (None)')}</SelectItem>
                  {categories
                    .filter((c: CategoryItem) => c.id !== editId)
                    .map((c: CategoryItem) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.nameAr}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <Label htmlFor="cat-active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                  {L('فئة نشطة', 'Active Category')}
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('تمكين أو تعطيل ربط الأصناف والمعاملات بهذه الفئة', 'Enable or disable linking items and transactions to this category')}
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                id="cat-active"
              />
            </div>
          </DialogBody>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 px-4 sm:px-6 py-3 border-t shrink-0 bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto sm:min-w-25 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            {editId && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const currentCat = categories.find(x => x.id === editId)
                  if (currentCat) handlePrintCategory(currentCat)
                }}
                className="w-full border sm:w-auto sm:min-w-25 gap-1.5"
              >
                <Printer className="size-4" />
                {L('طباعة', 'Print')}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={!form.code.trim() || !form.nameAr.trim() || saveMut.isPending}
              className="w-full sm:w-auto sm:min-w-30 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
            >
              {saveMut.isPending
                ? L('جاري الحفظ...', 'Saving...')
                : editId
                  ? L('تحديث الفئة', 'Update Category')
                  : L('إنشاء الفئة', 'Create Category')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
