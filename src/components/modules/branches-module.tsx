'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Building2, Store, Users, CheckCircle2, Pencil, Trash2, Star, MapPin, Phone, Mail } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface Branch {
  id: string
  code: string
  name: string
  nameAr?: string
  nameEn?: string
  address?: string | null
  phone?: string | null
  email?: string | null
  taxNumber?: string | null
  isMain: boolean
  active: boolean
  createdAt: string
  _count?: { users?: number; warehouses?: number }
}

const emptyForm = {
  code: '',
  name: '',
  nameEn: '',
  address: '',
  phone: '',
  email: '',
  taxNumber: '',
  isMain: false,
  active: true,
}

export function BranchesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch Branches
  const { data, isLoading } = useQuery<{ data: Branch[]; total: number }>({
    queryKey: ['branches'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) throw new Error('فشل جلب بيانات الفروع')
      return r.json()
    },
  })

  // Save Mutation (POST / PUT)
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/branches/${editing.id}` : '/api/erp/branches'
      const r = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error?.message || err.error || 'حدث خطأ أثناء حفظ الفرع')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث بيانات الفرع بنجاح' : 'تم إضافة الفرع بنجاح')
      qc.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('branches') })
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
    },
    onError: (e: any) => {
      toast.error(e.message || 'حدث خطأ أثناء حفظ بيانات الفرع')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/branches/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error?.message || err.error || 'فشل حذف الفرع')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف الفرع بنجاح')
      qc.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('branches') })
      setDeleteId(null)
    },
    onError: (e: any) => {
      toast.error(e.message || 'تعذر حذف الفرع')
    },
  })

  const rawList = data?.data ?? []
  const list = rawList.filter((b) => {
    const branchName = b.nameAr || b.name || ''
    const branchCode = b.code || ''
    const branchAddr = b.address || ''
    const term = search.toLowerCase()
    return (
      !search ||
      branchName.toLowerCase().includes(term) ||
      branchCode.toLowerCase().includes(term) ||
      branchAddr.toLowerCase().includes(term)
    )
  })

  const totalBranches = data?.total ?? rawList.length
  const mainBranchCount = rawList.filter((b) => b.isMain).length
  const activeBranchCount = rawList.filter((b) => b.active).length
  const totalUsersCount = rawList.reduce((s, b) => s + (b._count?.users ?? 0), 0)

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(b: Branch) {
    setEditing(b)
    setForm({
      code: b.code || '',
      name: b.nameAr || b.name || '',
      nameEn: b.nameEn || '',
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      taxNumber: b.taxNumber ?? '',
      isMain: b.isMain,
      active: b.active,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('اسم الفرع بالعربي مطلوب')
      return
    }
    saveMutation.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'branches',
      list.map((b) => ({
        code: b.code,
        name: b.nameAr || b.name,
        nameEn: b.nameEn || '',
        phone: b.phone ?? '',
        email: b.email ?? '',
        address: b.address ?? '',
        taxNumber: b.taxNumber ?? '',
        isMain: b.isMain ? 'نعم' : 'لا',
        active: b.active ? 'نشط' : 'غير نشط',
      })),
      [
        { key: 'code', label: 'الرمز' },
        { key: 'name', label: 'الاسم (عربي)' },
        { key: 'nameEn', label: 'الاسم (إنجليزي)' },
        { key: 'phone', label: 'الهاتف' },
        { key: 'email', label: 'البريد الإلكتروني' },
        { key: 'address', label: 'العنوان' },
        { key: 'taxNumber', label: 'الرقم الضريبي' },
        { key: 'isMain', label: 'فرع رئيسي' },
        { key: 'active', label: 'الحالة' },
      ]
    )
  }

  return (
    <ModuleShell
      title="الفروع والشركات التابعة"
      description="إدارة الهيكل التنظيمي للفروع والمواقع الجغرافية للنظام"
      icon={<Building2 className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن فرع بالاسم أو الرمز أو العنوان..."
      onAdd={openAdd}
      addLabel="فرع جديد"
      onExport={handleExport}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الفروع" value={String(totalBranches)} icon={<Store className="size-5" />} accent="blue" />
            <KpiCard title="الفروع الرئيسية" value={String(mainBranchCount)} icon={<Star className="size-5" />} accent="amber" />
            <KpiCard title="الفروع النشطة" value={String(activeBranchCount)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title="المستخدمين بالفروع" value={String(totalUsersCount)} icon={<Users className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      {/* Main Branches Table */}
      <Card className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
        <ScrollArea className="max-h-[60vh] scrollbar-thin">
          <Table className="table-sticky">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[110px]">الرمز</TableHead>
                <TableHead>اسم الفرع</TableHead>
                <TableHead className="hidden md:table-cell">العنوان</TableHead>
                <TableHead className="hidden md:table-cell">الهاتف / التواصل</TableHead>
                <TableHead className="text-center w-24">الرئيسي</TableHead>
                <TableHead className="w-28">الحالة</TableHead>
                <TableHead className="text-end w-24">إجراءات</TableHead>
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
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                    <Building2 className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">لا توجد فروع مسجلة</p>
                    <p className="text-xs text-slate-500 mt-1">انقر على "فرع جديد" لإضافة فرع إلى النظام</p>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((b) => (
                  <TableRow key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                    <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {b.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-blue-500 shrink-0" />
                        <div>
                          <span>{b.nameAr || b.name}</span>
                          {b.nameEn && (
                            <span className="text-xs text-slate-400 block font-normal">{b.nameEn}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-500 dark:text-slate-400 text-xs">
                      {b.address ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 text-slate-400 shrink-0" />
                          {b.address}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-500 dark:text-slate-400 text-xs">
                      {b.phone ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="size-3 text-slate-400 shrink-0" />
                          {b.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {b.isMain ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          رئيسي
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => openEdit(b)}
                          title="تعديل البيانات"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => setDeleteId(b.id)}
                          disabled={b.isMain}
                          title={b.isMain ? 'لا يمكن حذف الفرع الرئيسي' : 'حذف الفرع'}
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
      </Card>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs">
                <Building2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editing ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 space-y-4 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Branch Code */}
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رمز الفرع
                </Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="تلقائي إن تُرك فارغاً"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Branch Name Arabic */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  اسم الفرع (بالعربي) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="الفرع الرئيسي - الرياض"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Branch Name English */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  اسم الفرع (بالإنجليزية)
                </Label>
                <Input
                  id="nameEn"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="Main Branch - Riyadh"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  العنوان الجغرافي
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="الرياض - طريق الملك فهد"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رقم الهاتف
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0112345678"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="branch@company.com"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Tax Number */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="taxNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الرقم الضريبي للفرع
                </Label>
                <Input
                  id="taxNumber"
                  value={form.taxNumber}
                  onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                  placeholder="300000000000003"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Switches Configuration */}
              <div className="sm:col-span-2 grid grid-cols-2 gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isMain}
                    onCheckedChange={(v) => setForm({ ...form, isMain: v })}
                    id="isMain"
                  />
                  <Label htmlFor="isMain" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                    فرع رئيسي
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                    id="active"
                  />
                  <Label htmlFor="active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                    فرع نشط
                  </Label>
                </div>
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
              onClick={handleSave}
              disabled={!form.name.trim() || saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMutation.isPending ? 'جاري الحفظ...' : editing ? 'تحديث الفرع' : 'إنشاء الفرع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">تأكيد حذف الفرع</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              هل أنت تأكد من رغبتك في حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-slate-200">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              حذف الفرع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}
