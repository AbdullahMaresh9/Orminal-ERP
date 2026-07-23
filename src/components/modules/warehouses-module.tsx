'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Warehouse, Plus, Pencil, Trash2, Building2, CheckCircle, XCircle, MapPin } from 'lucide-react'

interface WarehouseItem {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  branchId: string
  address: string | null
  active: boolean
  branch?: { id: string; code: string; nameAr: string; nameEn?: string } | null
}

const EMPTY_FORM = {
  code: '',
  nameAr: '',
  nameEn: '',
  branchId: '',
  address: '',
  active: true,
}

export function WarehousesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)

  // Fetch Warehouses
  const { data, isLoading } = useQuery<{ data: WarehouseItem[]; total: number }>({
    queryKey: ['warehouses', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/warehouses?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error('فشل جلب بيانات المستودعات')
      return r.json()
    },
  })
  const rows = data?.data ?? []

  // Fetch Branches for Selection
  const { data: branchesData } = useQuery<{ data: any[] }>({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const branches = branchesData?.data ?? []

  // Save Mutation (POST / PUT)
  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/erp/warehouses/${editId}` : '/api/erp/warehouses'
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'حدث خطأ أثناء حفظ المستودع')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editId ? 'تم تحديث بيانات المستودع بنجاح' : 'تم إضافة المستودع بنجاح')
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['storehouses'] })
      setDialogOpen(false)
      setEditId(null)
      setForm(EMPTY_FORM)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ غير متوقع'),
  })

  // Delete Mutation
  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/warehouses/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'فشل حذف المستودع')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف المستودع بنجاح')
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['storehouses'] })
    },
    onError: (e: any) => toast.error(e.message || 'تعذر حذف المستودع'),
  })

  const handleAdd = () => {
    const defaultBranchId = branches.length > 0 ? branches[0].id : ''
    setForm({ ...EMPTY_FORM, branchId: defaultBranchId })
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (r: WarehouseItem) => {
    setForm({
      code: r.code,
      nameAr: r.nameAr,
      nameEn: r.nameEn || '',
      branchId: r.branchId || '',
      address: r.address || '',
      active: r.active,
    })
    setEditId(r.id)
    setDialogOpen(true)
  }

  const handleDelete = (r: WarehouseItem) => {
    if (confirm(`هل أنت تأكد من رغبتك في حذف المستودع "${r.nameAr}"؟`)) {
      delMut.mutate(r.id)
    }
  }

  const handleExport = () => {
    exportToCSV(
      'warehouses',
      rows.map((r: WarehouseItem) => ({
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn || '',
        branch: r.branch?.nameAr || '',
        address: r.address || '',
        active: r.active ? 'نشط' : 'غير نشط',
      })),
      [
        { key: 'code', label: 'الرمز' },
        { key: 'nameAr', label: 'الاسم (عربي)' },
        { key: 'nameEn', label: 'الاسم (إنجليزي)' },
        { key: 'branch', label: 'الفرع' },
        { key: 'address', label: 'العنوان' },
        { key: 'active', label: 'الحالة' },
      ]
    )
  }

  const total = rows.length
  const activeCount = rows.filter(r => r.active).length
  const inactiveCount = total - activeCount
  const uniqueBranches = new Set(rows.map(r => r.branchId).filter(Boolean)).size

  return (
    <ModuleShell
      title="المستودعات"
      description="إدارة المستودعات ومواقع التخزين المركزية بالفروع"
      icon={<Warehouse className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن مستودع بالرمز أو الاسم..."
      onAdd={handleAdd}
      addLabel="مستودع جديد"
      onExport={handleExport}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المستودعات" value={String(total)} icon={<Warehouse className="size-5" />} accent="blue" />
            <KpiCard title="المستودعات النشطة" value={String(activeCount)} icon={<CheckCircle className="size-5" />} accent="sky" />
            <KpiCard title="الفروع المرتبطة" value={String(uniqueBranches)} icon={<Building2 className="size-5" />} accent="violet" />
            <KpiCard title="غير نشطة" value={String(inactiveCount)} icon={<XCircle className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Main Warehouses Table */}
      <div className="rounded-xl border bg-card border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[120px]">الرمز</TableHead>
                <TableHead>اسم المستودع (عربي)</TableHead>
                <TableHead>الاسم (إنجليزي)</TableHead>
                <TableHead>الفرع التابع له</TableHead>
                <TableHead>العنوان والموقع</TableHead>
                <TableHead className="w-[100px]">الحالة</TableHead>
                <TableHead className="text-end w-[100px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                    <Warehouse className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">لا توجد مستودعات مسجلة حالياً</p>
                    <p className="text-xs text-slate-500 mt-1">انقر على "مستودع جديد" لإضافة مستودع إلى النظام</p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: WarehouseItem) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                    <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {r.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Warehouse className="size-4 text-blue-500 shrink-0" />
                        {r.nameAr}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                      {r.nameEn || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.branch ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <Building2 className="size-3 text-slate-500" />
                          {r.branch.nameAr} ({r.branch.code})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                      {r.address ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5 text-slate-400 shrink-0" />
                          {r.address}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => handleEdit(r)}
                          title="تعديل المستودع"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => handleDelete(r)}
                          title="حذف المستودع"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs">
                <Warehouse className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editId ? 'تعديل بيانات المستودع' : 'إضافة مستودع جديد'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 space-y-4 text-start">
            <div className="grid grid-cols-2 gap-4">
              {/* Warehouse Code */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رمز المستودع <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="مثال: WH-001"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Branch Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الفرع التابع له <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.branchId}
                  onValueChange={v => setForm({ ...form, branchId: v })}
                >
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    <SelectValue placeholder="اختر الفرع..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                        {b.nameAr || b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arabic Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                اسم المستودع (بالعربي) <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.nameAr}
                onChange={e => setForm({ ...form, nameAr: e.target.value })}
                placeholder="مثال: المستودع الرئيسي"
                className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            {/* English Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                اسم المستودع (بالإنجليزية)
              </Label>
              <Input
                value={form.nameEn}
                onChange={e => setForm({ ...form, nameEn: e.target.value })}
                placeholder="e.g. Main Warehouse"
                className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                العنوان والموقع الجغرافي
              </Label>
              <Textarea
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="أدخل عنوان أو موقع المستودع..."
                rows={2}
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <Label htmlFor="wh-active" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                  حالة المستودع
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تمكين أو تعطيل إجراء المعاملات المخزنية على هذا المستودع
                </p>
              </div>
              <Switch
                id="wh-active"
                checked={form.active}
                onCheckedChange={v => setForm({ ...form, active: v })}
              />
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
              disabled={!form.nameAr.trim() || !form.branchId || saveMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث المستودع' : 'إنشاء المستودع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
