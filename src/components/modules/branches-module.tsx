'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportRows, ExportColumn, ExportFormat } from '@/lib/export'
import { toast } from 'sonner'
import { Building2, Store, Users, CheckCircle2, Pencil, Trash2, Star, MapPin, Phone, Mail, Download, FileSpreadsheet, FileText, FileCheck, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu'

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

const HEADER_HEIGHT = 44
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 6

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function BranchesModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
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
      if (!r.ok) throw new Error(L('فشل جلب بيانات الفروع', 'Failed to fetch branches'))
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
        throw new Error(err.error?.message || err.error || L('حدث خطأ أثناء حفظ الفرع', 'An error occurred while saving branch'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editing ? L('تم تحديث بيانات الفرع بنجاح', 'Branch updated successfully') : L('تم إضافة الفرع بنجاح', 'Branch added successfully'))
      qc.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('branches') })
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
    },
    onError: (e: any) => {
      toast.error(e.message || L('حدث خطأ أثناء حفظ بيانات الفرع', 'An error occurred while saving branch'))
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/branches/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error?.message || err.error || L('فشل حذف الفرع', 'Failed to delete branch'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف الفرع بنجاح', 'Branch deleted successfully'))
      qc.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('branches') })
      setDeleteId(null)
    },
    onError: (e: any) => {
      toast.error(e.message || L('تعذر حذف الفرع', 'Failed to delete branch'))
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
      toast.error(L('اسم الفرع بالعربي مطلوب', 'Arabic branch name is required'))
      return
    }
    saveMutation.mutate(form)
  }

  const exportColumns: ExportColumn<Branch>[] = [
    {
      key: 'code',
      header: L('الرمز', 'Code'),
      width: 12,
      align: 'start',
      type: 'text',
      value: (b) => b.code,
    },
    {
      key: 'name',
      header: L('اسم الفرع (عربي)', 'Branch Name (Arabic)'),
      width: 22,
      align: 'start',
      type: 'text',
      value: (b) => b.nameAr || b.name,
    },
    {
      key: 'nameEn',
      header: L('الاسم (إنجليزي)', 'Name (English)'),
      width: 18,
      align: 'start',
      type: 'text',
      value: (b) => b.nameEn || '—',
    },
    {
      key: 'address',
      header: L('العنوان', 'Address'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (b) => b.address || '—',
    },
    {
      key: 'phone',
      header: L('الهاتف', 'Phone'),
      width: 18,
      align: 'start',
      type: 'number',
      numFmt: '0',
      value: (b) => (b.phone ? Number(b.phone.replace(/[^\d]/g, '')) || b.phone : ''),
    },
    {
      key: 'isMain',
      header: L('فرع رئيسي', 'Main Branch'),
      width: 10,
      align: 'center',
      type: 'text',
      value: (b) => (b.isMain ? L('رئيسي', 'Main') : '—'),
    },
    {
      key: 'active',
      header: L('الحالة', 'Status'),
      width: 10,
      align: 'center',
      type: 'text',
      value: (b) => (b.active ? L('نشط', 'Active') : L('غير نشط', 'Inactive')),
    },
  ]

  const handleExport = async (format: ExportFormat) => {
    if (!list.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, list, exportColumns, {
        fileName: `branches_${new Date().toISOString().split('T')[0]}`,
        title: L('تقرير الفروع والشركات التابعة', 'Branches & Affiliates Report'),
        subtitle: L(`إجمالي السجلات: ${list.length}`, `Total Records: ${list.length}`),
        isRTL,
      })
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  return (
    <ModuleShell
      title={t('module.branches') || L('الفروع والشركات التابعة', 'Branches & Affiliates')}
      description={L('إدارة الهيكل التنظيمي للفروع والمواقع الجغرافية للنظام', 'Manage organizational structure and branch locations')}
      icon={<Building2 className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={L('ابحث عن فرع بالاسم أو الرمز أو العنوان...', 'Search branch by name, code or address...')}
      onAdd={openAdd}
      addLabel={L('فرع جديد', 'New Branch')}
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
            <KpiCard title={L('إجمالي الفروع', 'Total Branches')} value={String(totalBranches)} icon={<Store className="size-5" />} accent="blue" />
            <KpiCard title={L('الفروع الرئيسية', 'Main Branches')} value={String(mainBranchCount)} icon={<Star className="size-5" />} accent="amber" />
            <KpiCard title={L('الفروع النشطة', 'Active Branches')} value={String(activeBranchCount)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title={L('المستخدمين بالفروع', 'Branch Users')} value={String(totalUsersCount)} icon={<Users className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      {/* Main Branches Table — Fixed Header + Body Scroll (~5 rows visible) */}
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[22%]" />{/* اسم الفرع */}
              <col className="w-[20%]" />{/* العنوان */}
              <col className="w-[18%]" />{/* الهاتف / التواصل */}
              <col className="w-[10%]" />{/* الرئيسي */}
              <col className="w-[10%]" />{/* الحالة */}
              <col className="w-[8%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('اسم الفرع', 'Branch Name')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العنوان', 'Address')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الهاتف / التواصل', 'Phone / Contact')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الرئيسي', 'Main')}</TableHead>
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
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 border-b">
                    <Building2 className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">{L('لا توجد فروع مسجلة حالياً', 'No branches currently registered')}</p>
                    <p className="text-xs text-slate-500 mt-1">{L('انقر على "فرع جديد" لإضافة فرع إلى النظام', 'Click "New Branch" to add a branch to the system')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((b) => (
                  <TableRow key={b.id} className="h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-middle">
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" title={b.code}>
                      {b.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100 border-b truncate" title={isRTL ? b.nameAr || b.name : b.nameEn || b.nameAr || b.name}>
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="size-4 text-blue-500 shrink-0" />
                        <div className="truncate">
                          <span className="truncate block">{isRTL ? b.nameAr || b.name : b.nameEn || b.nameAr || b.name}</span>
                          {b.nameEn && isRTL && (
                            <span className="text-xs text-slate-400 block font-normal truncate">{b.nameEn}</span>
                          )}
                          {b.nameAr && !isRTL && b.nameEn && (
                            <span className="text-xs text-slate-400 block font-normal truncate">{b.nameAr}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={b.address || '—'}>
                      {b.address ? (
                        <span className="inline-flex items-center gap-1 max-w-full truncate">
                          <MapPin className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{b.address}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={b.phone || b.email || '—'}>
                      {b.phone ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs max-w-full truncate">
                          <Phone className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{b.phone}</span>
                        </span>
                      ) : b.email ? (
                        <span className="inline-flex items-center gap-1 text-xs max-w-full truncate">
                          <Mail className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{b.email}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center border-b">
                      {b.isMain ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          <span>{L('رئيسي', 'Main')}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={b.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end pe-4 border-b">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => openEdit(b)}
                          title={L('تعديل البيانات', 'Edit branch')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => setDeleteId(b.id)}
                          disabled={b.isMain}
                          title={b.isMain ? L('لا يمكن حذف الفرع الرئيسي', 'Cannot delete main branch') : L('حذف الفرع', 'Delete branch')}
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

      {/* Add / Edit Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs">
                <Building2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {editing ? L('تعديل بيانات الفرع', 'Edit Branch Information') : L('إضافة فرع جديد', 'Add New Branch')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 space-y-4 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Branch Code */}
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('رمز الفرع', 'Branch Code')}
                </Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={L('تلقائي إن تُرك فارغاً', 'Auto-generated if empty')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Branch Name Arabic */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('اسم الفرع (بالعربي)', 'Branch Name (Arabic)')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={L('مثال: الفرع الرئيسي - الرياض', 'e.g. Main Branch - Riyadh')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Branch Name English */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('اسم الفرع (بالإنجليزية)', 'Branch Name (English)')}
                </Label>
                <Input
                  id="nameEn"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="e.g. Main Branch - Riyadh"
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('العنوان الجغرافي', 'Geographic Address')}
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder={L('أدخل عنوان أو موقع الفرع...', 'Enter branch address or location...')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('رقم الهاتف', 'Phone Number')}
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
                  {L('البريد الإلكتروني', 'Email Address')}
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
                  {L('الرقم الضريبي للفرع', 'Tax Identification Number')}
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
                    {L('فرع رئيسي', 'Main Branch')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                    id="active"
                  />
                  <Label htmlFor="active" className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-white">
                    {L('فرع نشط', 'Active Branch')}
                  </Label>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between sm:justify-between w-full shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim() || saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMutation.isPending
                ? L('جاري الحفظ...', 'Saving...')
                : editing
                  ? L('تحديث الفرع', 'Update Branch')
                  : L('إنشاء الفرع', 'Create Branch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">{L('تأكيد حذف الفرع', 'Confirm Branch Deletion')}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {L('هل أنت تأكد من رغبتك في حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.', 'Are you sure you want to delete this branch? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-slate-200">{L('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {L('حذف الفرع', 'Delete Branch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}
