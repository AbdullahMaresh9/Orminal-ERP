'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt } from '@/lib/format'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Shield, ShieldCheck, Lock, Plus, Pencil, Trash2, Crown, KeyRound, Search, ChevronDown, ChevronUp, CheckSquare, Eraser,
} from 'lucide-react'

interface RolePermission {
  id: string
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  canApprove: boolean
  canPost: boolean
  canCancel: boolean
  canReverse: boolean
  canExport: boolean
  permission: { id: string; moduleCode: string; actionCode: string; nameAr: string; nameEn: string }
}
interface Role {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  description?: string
  isSystem: boolean
  active: boolean
  createdAt: string
  rolePermissions?: RolePermission[]
  _count?: { userRoles: number; rolePermissions: number }
}

// Module codes used in the permission matrix (matches Permission.moduleCode)
const MODULES = [
  { code: 'FIN', nameAr: 'مالية', nameEn: 'Finance' },
  { code: 'SAL', nameAr: 'مبيعات', nameEn: 'Sales' },
  { code: 'PUR', nameAr: 'مشتريات', nameEn: 'Procurement' },
  { code: 'INV', nameAr: 'مخزون', nameEn: 'Inventory' },
  { code: 'MFG', nameAr: 'تصنيع', nameEn: 'Manufacturing' },
  { code: 'HR', nameAr: 'موارد بشرية', nameEn: 'HR' },
] as const

const ACTIONS = [
  { key: 'canCreate', label: 'إنشاء' },
  { key: 'canRead', label: 'قراءة' },
  { key: 'canUpdate', label: 'تحديث' },
  { key: 'canDelete', label: 'حذف' },
  { key: 'canApprove', label: 'اعتماد' },
  { key: 'canPost', label: 'ترحيل' },
  { key: 'canCancel', label: 'إلغاء' },
  { key: 'canReverse', label: 'عكس' },
  { key: 'canExport', label: 'تصدير' },
] as const

type ActionKey = typeof ACTIONS[number]['key']
type PermMatrix = Record<string, Record<ActionKey, boolean>>

function emptyMatrix(): PermMatrix {
  const m: PermMatrix = {}
  for (const mod of MODULES) {
    m[mod.code] = {
      canCreate: false, canRead: true, canUpdate: false, canDelete: false,
      canApprove: false, canPost: false, canCancel: false, canReverse: false,
      canExport: false,
    }
  }
  return m
}

function matrixFromRole(role: Role): PermMatrix {
  const m = emptyMatrix()
  for (const rp of role.rolePermissions ?? []) {
    const mc = rp.permission.moduleCode
    if (m[mc]) {
      m[mc] = {
        canCreate: rp.canCreate, canRead: rp.canRead, canUpdate: rp.canUpdate,
        canDelete: rp.canDelete, canApprove: rp.canApprove, canPost: rp.canPost,
        canCancel: rp.canCancel, canReverse: rp.canReverse, canExport: rp.canExport,
      }
    }
  }
  return m
}

export function RolesModule() {
  const { t, locale, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [matrix, setMatrix] = useState<PermMatrix>(emptyMatrix())
  const [matrixSearch, setMatrixSearch] = useState('')
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    MODULES.forEach((m) => { initial[m.code] = true })
    return initial
  })

  const filteredModules = MODULES.filter((m) => {
    const q = matrixSearch.toLowerCase()
    return (
      m.nameAr.toLowerCase().includes(q) ||
      m.nameEn.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q)
    )
  })

  const { data, isLoading } = useQuery<{ data: Role[]; meta: any }>({
    queryKey: ['roles', search, filterType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '200')
      const r = await fetch(`/api/erp/roles?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const roles = (data?.data ?? []).filter((r) => {
    if (filterType === 'system') return r.isSystem
    if (filterType === 'custom') return !r.isSystem
    return true
  })

  const stats = {
    total: data?.data?.length ?? 0,
    system: (data?.data ?? []).filter((r) => r.isSystem).length,
    custom: (data?.data ?? []).filter((r) => !r.isSystem).length,
    perms: (data?.data ?? []).reduce((s, r) => s + (r._count?.rolePermissions ?? 0), 0),
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/roles/${editing.id}` : '/api/erp/roles'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(editing ? 'تم تحديث الدور' : 'تم إنشاء الدور')
      qc.invalidateQueries({ queryKey: ['roles'] })
      setDialogOpen(false)
      setEditing(null)
      setMatrix(emptyMatrix())
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/roles/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف الدور')
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  // Load role detail (with rolePermissions) when editing
  const loadRoleDetail = async (role: Role) => {
    setEditing(role)
    setDialogOpen(true)
    setMatrix(emptyMatrix())
    try {
      const r = await fetch(`/api/erp/roles/${role.id}`)
      if (!r.ok) throw new Error()
      const json = await r.json()
      const detailed: Role = json.data ?? json
      setEditing(detailed)
      setMatrix(matrixFromRole(detailed))
    } catch {
      toast.error('فشل تحميل تفاصيل الدور')
    }
  }

  const togglePerm = (modCode: string, action: ActionKey) => {
    setMatrix((prev) => ({
      ...prev,
      [modCode]: { ...prev[modCode], [action]: !prev[modCode][action] },
    }))
  }

  const toggleAllForModule = (modCode: string, value: boolean) => {
    setMatrix((prev) => {
      const next = { ...prev }
      const row: Record<ActionKey, boolean> = { ...next[modCode] }
      for (const a of ACTIONS) row[a.key] = value
      next[modCode] = row
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload: any = {
      code: editing ? undefined : fd.get('code'),
      nameAr: fd.get('nameAr'),
      nameEn: fd.get('nameEn') || fd.get('nameAr'),
      description: fd.get('description') || undefined,
      active: fd.get('active') === 'on',
    }
    if (editing) {
      // Permission matrix payload
      payload.permissions = MODULES.map((m) => ({
        moduleCode: m.code,
        ...matrix[m.code],
      }))
    }
    saveMutation.mutate(payload)
  }

  const handleExport = () => {
    const rows = (data?.data ?? []).map((r) => ({
      'الكود': r.code,
      'الاسم': r.nameAr,
      'الاسم الإنجليزي': r.nameEn ?? '',
      'النوع': r.isSystem ? 'نظام' : 'مخصص',
      'نشط': r.active ? 'نعم' : 'لا',
      'عدد المستخدمين': r._count?.userRoles ?? 0,
      'عدد الصلاحيات': r._count?.rolePermissions ?? 0,
    }))
    exportToCSV('roles', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.roles')}
      description="إدارة الأدوار والصلاحيات ومصفوفة الوصول للوحدات"
      icon={<Shield className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الدور أو الاسم..."
      onAdd={() => { setEditing(null); setMatrix(emptyMatrix()); setDialogOpen(true) }}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <>
          <Button size="sm" variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')}>الكل</Button>
          <Button size="sm" variant={filterType === 'system' ? 'default' : 'outline'} onClick={() => setFilterType('system')}>نظام</Button>
          <Button size="sm" variant={filterType === 'custom' ? 'default' : 'outline'} onClick={() => setFilterType('custom')}>مخصصة</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي الأدوار" value={formatInt(stats.total)} icon={<Shield className="size-5" />} accent="blue" />
        <KpiCard title="أدوار النظام" value={formatInt(stats.system)} icon={<Crown className="size-5" />} accent="amber" />
        <KpiCard title="أدوار مخصصة" value={formatInt(stats.custom)} icon={<KeyRound className="size-5" />} accent="sky" />
        <KpiCard title="إجمالي الصلاحيات" value={formatInt(stats.perms)} icon={<ShieldCheck className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead className="text-center">المستخدمون</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد أدوار. ابدأ بإضافة أول دور.</TableCell></TableRow>
              ) : roles.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.nameAr}
                      {r.isSystem && <Lock className="size-3 text-amber-600" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.isSystem ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">نظام</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[10px]">مخصص</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground line-clamp-1 max-w-xs">{r.description ?? '—'}</TableCell>
                  <TableCell className="text-center num-cell">
                    <span className="num font-semibold tabular-nums" dir="ltr">{r._count?.userRoles ?? 0}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={r.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => loadRoleDetail(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-500 hover:text-rose-600 disabled:opacity-30"
                        disabled={r.isSystem}
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col max-h-[90vh] h-full overflow-hidden"
          >
            <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                  <Shield className="size-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-white">
                    {editing ? (isRTL ? `تعديل الدور: ${editing.nameAr}` : `Edit Role: ${editing.nameEn || editing.nameAr}`) : (isRTL ? 'إضافة دور جديد' : 'Add New Role')}
                  </DialogTitle>

                </div>
              </div>
            </DialogHeader>

            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              {/* Role Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'معلومات الدور وصلاحيات الوصول' : 'Role Information'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Role Code */}
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'رمز الدور / الكود *' : 'Role Code / Identifier *'}
                    </Label>
                    <Input
                      id="code"
                      name="code"
                      required
                      defaultValue={editing?.code}
                      disabled={!!editing}
                      placeholder="ACCOUNTANT"
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono text-sm bg-slate-50 dark:bg-slate-900/50 disabled:opacity-75 disabled:cursor-not-allowed", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  {/* Arabic Name */}
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الاسم بالكامل (عربي) *' : 'Role Name (Arabic) *'}
                    </Label>
                    <Input
                      id="nameAr"
                      name="nameAr"
                      defaultValue={editing?.nameAr}
                      placeholder={isRTL ? 'مثال: محاسب عام' : 'e.g. Accountant'}
                      required
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  {/* English Name */}
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الاسم بالكامل (إنجليزي)' : 'Role Name (English)'}
                    </Label>
                    <Input
                      id="nameEn"
                      name="nameEn"
                      defaultValue={editing?.nameEn}
                      placeholder="e.g. Accountant"
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  {/* Description */}
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="description" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'وصف الصلاحية' : 'Description'}
                    </Label>
                    <Input
                      id="description"
                      name="description"
                      defaultValue={editing?.description ?? ''}
                      placeholder={isRTL ? 'وصف موجز للمسؤوليات والوصول' : 'Short description of responsibilities'}
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  {/* Active Switch */}
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="active" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                        {isRTL ? 'حالة الدور (نشط)' : 'Role Status (Active)'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {editing?.isSystem
                          ? (isRTL ? 'هذا الدور خاص بالنظام ولا يمكن تعطيله' : 'This is a system role and cannot be deactivated')
                          : (isRTL ? 'تنشيط أو تعطيل الدور في النظام للمستخدمين' : 'Activate or deactivate this role for users')}
                      </p>
                    </div>
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} disabled={editing?.isSystem} />
                  </div>
                </div>
              </div>

              {/* Permission Matrix Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'مصفوفة الصلاحيات والوصول' : 'Access Control Matrix'}
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                    {isRTL ? 'تحكم في أذونات الوصول للوحدات' : 'Control module access permissions'}
                  </span>
                </div>

                {editing ? (
                  <div className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-100/80 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-t-xl">
                      {/* Left: Search input */}
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                        <Input
                          placeholder={isRTL ? 'ابحث عن وحدة...' : 'Search modules...'}
                          value={matrixSearch}
                          onChange={(e) => setMatrixSearch(e.target.value)}
                          className="h-9 ps-9 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-blue-500"
                        />
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const next: Record<string, boolean> = {}
                            MODULES.forEach((m) => { next[m.code] = true })
                            setExpandedModules(next)
                          }}
                          className="h-8 gap-1 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        >
                          <ChevronDown className="size-3.5" />
                          {isRTL ? 'توسيع الكل' : 'Expand All'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const next: Record<string, boolean> = {}
                            MODULES.forEach((m) => { next[m.code] = false })
                            setExpandedModules(next)
                          }}
                          className="h-8 gap-1 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        >
                          <ChevronUp className="size-3.5" />
                          {isRTL ? 'طي الكل' : 'Collapse All'}
                        </Button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMatrix((prev) => {
                              const next = { ...prev }
                              for (const m of MODULES) {
                                next[m.code] = {
                                  canCreate: true, canRead: true, canUpdate: true, canDelete: true,
                                  canApprove: true, canPost: true, canCancel: true, canReverse: true,
                                  canExport: true
                                }
                              }
                              return next
                            })
                          }}
                          className="h-8 gap-1 text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-800"
                        >
                          <CheckSquare className="size-3.5" />
                          {isRTL ? 'تحديد الكل' : 'Select All'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMatrix((prev) => {
                              const next = { ...prev }
                              for (const m of MODULES) {
                                next[m.code] = {
                                  canCreate: false, canRead: false, canUpdate: false, canDelete: false,
                                  canApprove: false, canPost: false, canCancel: false, canReverse: false,
                                  canExport: false
                                }
                              }
                              return next
                            })
                          }}
                          className="h-8 gap-1 text-rose-600 dark:text-rose-400 border-slate-200 dark:border-slate-800"
                        >
                          <Eraser className="size-3.5" />
                          {isRTL ? 'إلغاء الكل' : 'Clear All'}
                        </Button>
                      </div>
                    </div>

                    {/* Desktop Table Matrix */}
                    <div className="hidden md:block overflow-x-auto rounded-b-xl border border-t-0 border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/75 dark:bg-slate-900/50 hover:bg-slate-50/75 border-b border-slate-200 dark:border-slate-800">
                            <TableHead className="ps-4 text-start font-bold text-slate-800 dark:text-slate-200 w-44 sticky start-0 bg-slate-50 dark:bg-slate-900/50 z-20">
                              {isRTL ? 'الوحدة / الموديول' : 'Module / Feature'}
                            </TableHead>
                            {ACTIONS.map((a) => (
                              <TableHead key={a.key} className="text-center font-bold text-slate-800 dark:text-slate-200 text-xs py-3 w-16">
                                {a.label}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-slate-800 dark:text-slate-200 text-xs py-3 w-20">
                              {isRTL ? 'الكل' : 'All'}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredModules.map((mod, idx) => {
                            const allOn = ACTIONS.every((a) => matrix[mod.code][a.key])
                            const isExpanded = expandedModules[mod.code] ?? true

                            return (
                              <>
                                {/* Main Module Row */}
                                <TableRow
                                  key={mod.code}
                                  className={cn(
                                    "hover:bg-slate-50/60 dark:hover:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/60 transition-colors",
                                    idx % 2 === 1 && "bg-slate-50/20 dark:bg-slate-900/10"
                                  )}
                                >
                                  <TableCell className="ps-4 py-3.5 font-medium text-slate-800 dark:text-slate-200 sticky start-0 bg-white dark:bg-slate-950 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2.5">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setExpandedModules(prev => ({ ...prev, [mod.code]: !isExpanded }))}
                                        className="size-6 text-slate-400 hover:text-slate-600"
                                      >
                                        <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                                      </Button>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold leading-none">{mod.nameAr}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono mt-1" dir="ltr">{mod.code}</span>
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Permissions Columns */}
                                  {ACTIONS.map((a) => (
                                    <TableCell key={a.key} className="text-center py-3.5">
                                      <div className="flex justify-center items-center">
                                        <Checkbox
                                          checked={matrix[mod.code][a.key]}
                                          onCheckedChange={() => togglePerm(mod.code, a.key)}
                                          className="size-4.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                                        />
                                      </div>
                                    </TableCell>
                                  ))}

                                  {/* Select All Row Toggle Column */}
                                  <TableCell className="text-center py-3.5">
                                    <div className="flex justify-center items-center">
                                      <Checkbox
                                        checked={allOn}
                                        onCheckedChange={() => toggleAllForModule(mod.code, !allOn)}
                                        className="size-4.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {/* Expanded Details Row */}
                                {isExpanded && (
                                  <TableRow className="bg-slate-50/10 dark:bg-slate-900/5 hover:bg-slate-50/10 border-b border-slate-100 dark:border-slate-800/60">
                                    <TableCell colSpan={11} className="ps-14 py-2 text-[11px] text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-block size-1.5 rounded-full bg-blue-500" />
                                        <span>
                                          {isRTL
                                            ? `الصلاحيات المفعلة لوحدة ${mod.nameAr}: ${ACTIONS.filter(a => matrix[mod.code][a.key]).map(a => a.label).join(', ') || 'لا يوجد'}`
                                            : `Enabled actions for ${mod.nameEn}: ${ACTIONS.filter(a => matrix[mod.code][a.key]).map(a => a.key.replace('can', '')).join(', ') || 'None'}`}
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card-based Matrix */}
                    <div className="md:hidden space-y-4">
                      {filteredModules.map((mod) => {
                        const isExpanded = expandedModules[mod.code] ?? true
                        const allOn = ACTIONS.every((a) => matrix[mod.code][a.key])

                        return (
                          <div key={mod.code} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            {/* Card Header */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
                                  {mod.code}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{mod.nameAr}</h4>
                                  <p className="text-[10px] text-muted-foreground">{mod.nameEn}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Select All Toggle */}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleAllForModule(mod.code, !allOn)}
                                  className="h-7 text-[10px] text-blue-600 dark:text-blue-400 animate-fade-in"
                                >
                                  {allOn ? (isRTL ? 'إلغاء الكل' : 'Clear All') : (isRTL ? 'تحديد الكل' : 'Select All')}
                                </Button>
                                {/* Expand Card button */}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setExpandedModules(prev => ({ ...prev, [mod.code]: !isExpanded }))}
                                  className="size-7"
                                >
                                  <ChevronDown className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                                </Button>
                              </div>
                            </div>

                            {/* Card Body (Perms List) */}
                            {isExpanded && (
                              <div className="p-4 grid grid-cols-2 gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/50">
                                {ACTIONS.map((a) => (
                                  <label
                                    key={a.key}
                                    className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-100/50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors border border-slate-200/40 dark:border-slate-800/40"
                                  >
                                    <Checkbox
                                      checked={matrix[mod.code][a.key]}
                                      onCheckedChange={() => togglePerm(mod.code, a.key)}
                                      className="size-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{a.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50">
                    💡 {isRTL
                      ? 'ستتمكن من ضبط مصفوفة الصلاحيات بالكامل بعد إنشاء الدور وحفظه.'
                      : 'You will be able to configure the permission matrix after creating and saving the role.'}
                  </div>
                )}
              </div>
            </DialogBody>

            <DialogFooter className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-4 shrink-0">
              <div className="flex items-center justify-end gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="px-5 py-2.5 h-11 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-6 py-2.5 h-11 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                >
                  {saveMutation.isPending ? (
                    isRTL ? 'جاري الحفظ...' : 'Saving...'
                  ) : editing ? (
                    isRTL ? 'حفظ التعديلات' : 'Save Changes'
                  ) : (
                    isRTL ? 'حفظ' : 'Save'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
