'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatDate } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { FolderTree, Folder, FolderPlus, MoreVertical, Pencil, Trash2, Boxes } from 'lucide-react'

interface Category {
  id: string
  name: string
  nameAr: string | null
  parentId: string | null
  active: boolean
  createdAt: string
  parent?: { id: string; name: string; nameAr: string | null } | null
  _count?: { products: number }
}

const EMPTY_FORM = { name: '', nameAr: '', parentId: '', active: true }

export function CategoriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ data: Category[]; total: number }>({
    queryKey: ['categories', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      const r = await fetch(`/api/erp/categories?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const categories = data?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingId
      const url = isEdit ? `/api/erp/categories/${editingId}` : '/api/erp/categories'
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
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
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['categories-for-products'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/categories/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'delete failed')
      }
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDialogOpen(true)
  }
  function openEdit(c: Category) {
    setForm({
      name: c.name,
      nameAr: c.nameAr ?? '',
      parentId: c.parentId ?? '',
      active: c.active,
    })
    setEditingId(c.id)
    setDialogOpen(true)
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    saveMutation.mutate(form)
  }
  function handleExport() {
    exportToCSV('categories', categories.map(c => ({
      name: c.name,
      nameAr: c.nameAr ?? '',
      parent: c.parent?.name ?? '',
      products: c._count?.products ?? 0,
      active: c.active ? 'نعم' : 'لا',
    })), [
      { key: 'name', label: 'الاسم' },
      { key: 'nameAr', label: 'الاسم العربي' },
      { key: 'parent', label: 'الفئة الأب' },
      { key: 'products', label: 'عدد المنتجات' },
      { key: 'active', label: 'نشط' },
    ])
  }

  const totalCats = categories.length
  const rootCats = categories.filter(c => !c.parentId).length
  const totalProducts = categories.reduce((s, c) => s + (c._count?.products ?? 0), 0)
  const activeCats = categories.filter(c => c.active).length

  return (
    <ModuleShell
      title={t('module.categories')}
      description="إدارة فئات المنتجات (شجري)"
      icon={<FolderTree className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث عن فئة..."
      onAdd={openAdd}
      addLabel="فئة جديدة"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الفئات" value={String(totalCats)} icon={<FolderTree className="size-5" />} accent="emerald" />
            <KpiCard title="فئات رئيسية" value={String(rootCats)} icon={<Folder className="size-5" />} accent="teal" />
            <KpiCard title="إجمالي المنتجات" value={String(totalProducts)} icon={<Boxes className="size-5" />} accent="violet" />
            <KpiCard title="فئات نشطة" value={String(activeCats)} icon={<FolderPlus className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الاسم العربي</TableHead>
                <TableHead>الفئة الأب</TableHead>
                <TableHead className="text-end">عدد المنتجات</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">تاريخ الإنشاء</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <FolderTree className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد فئات. ابدأ بإضافة فئة جديدة.
                  </TableCell>
                </TableRow>
              ) : categories.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Folder className="size-4 text-primary" />
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-sm">{c.parent?.name ?? '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{c._count?.products ?? 0}</TableCell>
                  <TableCell className="text-end"><StatusBadge status={c.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="size-4 ms-2" /> تعديل</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600" onClick={() => {
                          if (confirm(`حذف الفئة "${c.name}"؟`)) deleteMutation.mutate(c.id)
                        }}><Trash2 className="size-4 ms-2" /> حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل فئة' : 'فئة جديدة'}</DialogTitle>
            <DialogDescription>{editingId ? 'تحديث بيانات الفئة' : 'إضافة فئة جديدة'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم (عربي)</Label>
              <Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
            </div>
            <div className="space-y-1.5">
              <Label>الفئة الأب</Label>
              <Select value={form.parentId || 'none'} onValueChange={v => setForm({ ...form, parentId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون (فئة رئيسية)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون (فئة رئيسية)</SelectItem>
                  {categories.filter(c => c.id !== editingId).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.nameAr ? ' / ' + c.nameAr : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={c => setForm({ ...form, active: c })} id="cat-active" />
              <Label htmlFor="cat-active">الفئة نشطة</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
