'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportRows, ExportColumn, ExportFormat } from '@/lib/export'
import { toast } from 'sonner'
import { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Warehouse, Plus, Pencil, Trash2, Building2, CheckCircle, XCircle, MapPin, Download, FileSpreadsheet, FileText, FileCheck, ChevronDown } from 'lucide-react'

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

const HEADER_HEIGHT = 44
const ROW_HEIGHT = 52
const VISIBLE_ROWS = 6

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function WarehousesModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)

  const branchName = (b?: any) => (isRTL ? b?.nameAr : (b?.nameEn || b?.nameAr)) ?? '—'

  // Fetch Warehouses
  const { data, isLoading } = useQuery<{ data: WarehouseItem[]; total: number }>({
    queryKey: ['warehouses', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/warehouses?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error(L('فشل جلب بيانات المستودعات', 'Failed to fetch warehouses'))
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
        throw new Error(err.error || L('حدث خطأ أثناء حفظ المستودع', 'An error occurred while saving warehouse'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editId ? L('تم تحديث بيانات المستودع بنجاح', 'Warehouse updated successfully') : L('تم إضافة المستودع بنجاح', 'Warehouse added successfully'))
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['storehouses'] })
      setDialogOpen(false)
      setEditId(null)
      setForm(EMPTY_FORM)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ غير متوقع', 'Unexpected error occurred')),
  })

  // Delete Mutation
  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/warehouses/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل حذف المستودع', 'Failed to delete warehouse'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم حذف المستودع بنجاح', 'Warehouse deleted successfully'))
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      qc.invalidateQueries({ queryKey: ['storehouses'] })
    },
    onError: (e: any) => toast.error(e.message || L('تعذر حذف المستودع', 'Failed to delete warehouse')),
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
    if (confirm(L(`هل أنت تأكد من رغبتك في حذف المستودع "${r.nameAr}"؟`, `Are you sure you want to delete warehouse "${r.nameEn || r.nameAr}"?`))) {
      delMut.mutate(r.id)
    }
  }

  const exportColumns: ExportColumn<WarehouseItem>[] = [
    {
      key: 'code',
      header: L('الرمز', 'Code'),
      width: 12,
      align: 'start',
      type: 'text',
      value: (r) => r.code,
    },
    {
      key: 'nameAr',
      header: L('الاسم (عربي)', 'Name (Arabic)'),
      width: 22,
      align: 'start',
      type: 'text',
      value: (r) => r.nameAr,
    },
    {
      key: 'nameEn',
      header: L('الاسم (إنجليزي)', 'Name (English)'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (r) => r.nameEn || '—',
    },
    {
      key: 'branch',
      header: L('الفرع التابع له', 'Branch'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (r) => branchName(r.branch),
    },
    {
      key: 'address',
      header: L('العنوان والموقع', 'Address & Location'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (r) => r.address || '—',
    },
    {
      key: 'active',
      header: L('الحالة', 'Status'),
      width: 10,
      align: 'center',
      type: 'text',
      value: (r) => (r.active ? L('نشط', 'Active') : L('غير نشط', 'Inactive')),
    },
  ]

  const handleExport = async (format: ExportFormat) => {
    if (!rows.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, rows, exportColumns, {
        fileName: `warehouses_${new Date().toISOString().split('T')[0]}`,
        title: L('تقرير المستودعات', 'Warehouses Report'),
        subtitle: L(`إجمالي السجلات: ${rows.length}`, `Total Records: ${rows.length}`),
        isRTL,
      })
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  const total = rows.length
  const activeCount = rows.filter(r => r.active).length
  const inactiveCount = total - activeCount
  const uniqueBranches = new Set(rows.map(r => r.branchId).filter(Boolean)).size

  return (
    <ModuleShell
      title={t('module.warehouses') || L('المستودعات', 'Warehouses')}
      description={L('إدارة المستودعات ومواقع التخزين المركزية بالفروع', 'Manage warehouses and central storage locations across branches')}
      icon={<Warehouse className="size-5 text-blue-600 dark:text-blue-400" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={L('ابحث عن مستودع بالرمز أو الاسم...', 'Search warehouse by code or name...')}
      onAdd={handleAdd}
      addLabel={L('مستودع جديد', 'New Warehouse')}
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
            <KpiCard title={L('إجمالي المستودعات', 'Total Warehouses')} value={String(total)} icon={<Warehouse className="size-5" />} accent="blue" />
            <KpiCard title={L('المستودعات النشطة', 'Active Warehouses')} value={String(activeCount)} icon={<CheckCircle className="size-5" />} accent="sky" />
            <KpiCard title={L('الفروع المرتبطة', 'Linked Branches')} value={String(uniqueBranches)} icon={<Building2 className="size-5" />} accent="violet" />
            <KpiCard title={L('غير نشطة', 'Inactive Warehouses')} value={String(inactiveCount)} icon={<XCircle className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Main Warehouses Table — Fixed Header + Body Scroll (~5 rows visible) */}
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* الرمز */}
              <col className="w-[20%]" />{/* الاسم (عربي) */}
              <col className="w-[18%]" />{/* الاسم (إنجليزي) */}
              <col className="w-[20%]" />{/* الفرع التابع له */}
              <col className="w-[18%]" />{/* العنوان والموقع */}
              <col className="w-[7%]" />{/* الحالة */}
              <col className="w-[5%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('اسم المستودع (عربي)', 'Warehouse Name (Ar)')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الاسم (إنجليزي)', 'Name (En)')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الفرع التابع له', 'Branch')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('العنوان والموقع', 'Address & Location')}</TableHead>
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
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 border-b">
                    <Warehouse className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">{L('لا توجد مستودعات مسجلة حالياً', 'No warehouses currently registered')}</p>
                    <p className="text-xs text-slate-500 mt-1">{L('انقر على "مستودع جديد" لإضافة مستودع إلى النظام', 'Click "New Warehouse" to add a warehouse to the system')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: WarehouseItem) => (
                  <TableRow key={r.id} className="h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-middle">
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" title={r.code}>
                      {r.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100 border-b truncate" title={r.nameAr}>
                      <div className="flex items-center gap-2 truncate">
                        <Warehouse className="size-4 text-blue-500 shrink-0" />
                        <span className="truncate">{r.nameAr}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={r.nameEn || '—'}>
                      {r.nameEn || '—'}
                    </TableCell>
                    <TableCell className="text-sm border-b truncate" title={branchName(r.branch)}>
                      {r.branch ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 max-w-full truncate">
                          <Building2 className="size-3 text-slate-500 shrink-0" />
                          <span className="truncate">{branchName(r.branch)} ({r.branch.code})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-slate-400 border-b truncate" title={r.address || '—'}>
                      {r.address ? (
                        <span className="inline-flex items-center gap-1 max-w-full truncate">
                          <MapPin className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{r.address}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={r.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end pe-4 border-b">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                          onClick={() => handleEdit(r)}
                          title={L('تعديل المستودع', 'Edit warehouse')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          onClick={() => handleDelete(r)}
                          title={L('حذف المستودع', 'Delete warehouse')}
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

      {/* Add / Edit Warehouse Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
          <DialogHeader >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs">
                <Warehouse className="size-5" />
              </div>
              <div>
                <DialogTitle>
                  {editId ? L('تعديل بيانات المستودع', 'Edit Warehouse Information') : L('إضافة مستودع جديد', 'Add New Warehouse')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-5 space-y-4 text-start">
            <div className="grid grid-cols-2 gap-4">
              {/* Warehouse Code */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('رمز المستودع', 'Warehouse Code')} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder={L('مثال: WH-001', 'e.g. WH-001')}
                  className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Branch Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {L('الفرع التابع له', 'Branch')} <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.branchId}
                  onValueChange={v => setForm({ ...form, branchId: v })}
                >
                  <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    <SelectValue placeholder={L('اختر الفرع...', 'Select branch...')} />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white z-50">
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                        {branchName(b)} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arabic Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {L('اسم المستودع (بالعربي)', 'Warehouse Name (Arabic)')} <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.nameAr}
                onChange={e => setForm({ ...form, nameAr: e.target.value })}
                placeholder={L('مثال: المستودع الرئيسي', 'e.g. Main Warehouse')}
                className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            {/* English Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {L('اسم المستودع (بالإنجليزية)', 'Warehouse Name (English)')}
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
                {L('العنوان والموقع الجغرافي', 'Address & Location')}
              </Label>
              <Textarea
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder={L('أدخل عنوان أو موقع المستودع...', 'Enter warehouse address or location...')}
                rows={2}
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <Label htmlFor="wh-active" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                  {L('حالة المستودع', 'Warehouse Status')}
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('تمكين أو تعطيل إجراء المعاملات المخزنية على هذا المستودع', 'Enable or disable inventory transactions for this warehouse')}
                </p>
              </div>
              <Switch
                id="wh-active"
                checked={form.active}
                onCheckedChange={v => setForm({ ...form, active: v })}
              />
            </div>
          </DialogBody>

          <DialogFooter >
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
              onClick={() => saveMut.mutate()}
              disabled={!form.nameAr.trim() || !form.branchId || saveMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-5"
            >
              {saveMut.isPending
                ? L('جاري الحفظ...', 'Saving...')
                : editId
                  ? L('تحديث ', 'Update')
                  : L('إنشاء ', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
