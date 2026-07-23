'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { exportToCSV } from '@/lib/export'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { FolderTree, Pencil, Trash2, Boxes, GitBranch, CheckCircle } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

export function CategoriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', nameAr: '', nameEn: '', parentId: '', type: 'product', active: true })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['categories', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/categories?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error('fetch')
      return r.json()
    },
  })
  const categories = data?.data ?? []

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
        throw new Error(e.error || 'فشل حفظ الفئة')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editId ? 'تم تحديث الفئة بنجاح' : 'تم إنشاء الفئة بنجاح')
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['categories-list'] })
      setDialogOpen(false)
      setEditId(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ أثناء حفظ الفئة'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/categories/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف الفئة بنجاح')
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['categories-list'] })
    },
    onError: () => toast.error('تعذر حذف الفئة'),
  })

  const handleAdd = () => {
    setForm({ code: '', nameAr: '', nameEn: '', parentId: '', type: 'product', active: true })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (c: any) => {
    setForm({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn || '', parentId: c.parentId || '', type: c.type || 'product', active: c.active })
    setEditId(c.id)
    setDialogOpen(true)
  }

  const handleExport = () =>
    exportToCSV(
      'categories',
      categories.map((c: any) => ({
        code: c.code,
        nameAr: c.nameAr,
        nameEn: c.nameEn || '',
        type: c.type,
        active: c.active ? 'نشط' : 'غير نشط',
      }))
    )

  const rootCount = categories.filter((c: any) => !c.parentId).length
  const activeCount = categories.filter((c: any) => c.active).length

  return (
    <ModuleShell
      title="الفئات والتصنيفات"
      description="إدارة فئات المنتجات والشركاء والمصروفات"
      icon={<FolderTree className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      onAdd={handleAdd}
      addLabel="فئة جديدة"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الفئات" value={String(categories.length)} icon={<Boxes className="size-5" />} accent="blue" />
            <KpiCard title="الفئات الجذرية" value={String(rootCount)} icon={<GitBranch className="size-5" />} accent="sky" />
            <KpiCard title="النشطة" value={String(activeCount)} icon={<CheckCircle className="size-5" />} accent="violet" />
            <KpiCard title="بالمنتجات" value={String(categories.filter((c: any) => c._count?.products > 0).length)} icon={<FolderTree className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      <Card className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[120px]">الرمز</TableHead>
                <TableHead>الاسم (عربي)</TableHead>
                <TableHead>الاسم (إنجليزي)</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead className="w-28">الحالة</TableHead>
                <TableHead className="text-end w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-6" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !categories.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    لا توجد فئات مسجلة
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                    <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{c.code}</TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100">{c.nameAr}</TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">{c.nameEn || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {c.type === 'product' ? 'منتج' : c.type === 'partner' ? 'شريك' : c.type === 'expense' ? 'مصروف' : 'إيراد'}
                    </TableCell>
                    <TableCell><StatusBadge status={c.active ? 'active' : 'inactive'} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400" onClick={() => handleEdit(c)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300" onClick={() => delMut.mutate(c.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add / Edit Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <FolderTree className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editId ? 'تعديل بيانات الفئة' : 'إضافة فئة جديدة'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 bg-white dark:bg-slate-900 text-start space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Code */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رمز الفئة <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="CAT-001"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Category Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  نوع الفئة
                </Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                    <SelectItem value="product">منتج</SelectItem>
                    <SelectItem value="partner">شريك</SelectItem>
                    <SelectItem value="expense">مصروف</SelectItem>
                    <SelectItem value="revenue">إيراد</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Arabic Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الاسم (بالعربي) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="مثال: أجهزة إلكترونية"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* English Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الاسم (بالإنجليزية)
                </Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="e.g. Electronics"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Parent Category */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الفئة الأم (الهيكل الشجري)
                </Label>
                <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    <SelectValue placeholder="فئة رئيسية (بدون)" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                    <SelectItem value="">فئة رئيسية (بدون)</SelectItem>
                    {categories
                      .filter((c: any) => c.id !== editId)
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} — {c.nameAr}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Switch */}
              <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                  id="cat-active"
                />
                <Label htmlFor="cat-active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                  فئة نشطة
                </Label>
              </div>
            </div>
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
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={!form.code || !form.nameAr || saveMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث الفئة' : 'إنشاء الفئة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
