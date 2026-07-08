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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Shield, ShieldCheck, Lock, Plus, Pencil, Trash2, Crown, KeyRound,
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
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [matrix, setMatrix] = useState<PermMatrix>(emptyMatrix())

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الأدوار" value={formatInt(stats.total)} icon={<Shield className="size-5" />} accent="emerald" />
        <KpiCard title="أدوار النظام" value={formatInt(stats.system)} icon={<Crown className="size-5" />} accent="amber" />
        <KpiCard title="أدوار مخصصة" value={formatInt(stats.custom)} icon={<KeyRound className="size-5" />} accent="teal" />
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
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">مخصص</Badge>
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? `تعديل الدور: ${editing.nameAr}` : 'إضافة دور جديد'}</DialogTitle>
            <DialogDescription>
              {editing ? 'قم بتعديل بيانات الدور ومصفوفة الصلاحيات لكل وحدة' : 'أدخل بيانات الدور الجديد'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[68vh] pe-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1 mb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">الكود *</Label>
                  <Input
                    id="code"
                    name="code"
                    required
                    defaultValue={editing?.code}
                    disabled={!!editing}
                    placeholder="ACCOUNTANT"
                    dir="ltr"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                  <Input id="nameAr" name="nameAr" defaultValue={editing?.nameAr} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                  <Input id="nameEn" name="nameEn" defaultValue={editing?.nameEn} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">الوصف</Label>
                  <Input id="description" name="description" defaultValue={editing?.description ?? ''} />
                </div>
                <div className="md:col-span-2 flex items-center gap-2 pt-1">
                  <Switch id="active" name="active" defaultChecked={editing?.active ?? true} disabled={editing?.isSystem} />
                  <Label htmlFor="active">نشط {editing?.isSystem && <span className="text-xs text-amber-600 ms-1">(دور نظام — لا يمكن تعطيله)</span>}</Label>
                </div>
              </div>

              {editing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">مصفوفة الصلاحيات</h4>
                    <span className="text-xs text-muted-foreground">فعّل الصلاحيات لكل وحدة</span>
                  </div>
                  <div className="overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="ps-3 sticky start-0 bg-background">الوحدة</TableHead>
                          {ACTIONS.map((a) => (
                            <TableHead key={a.key} className="text-center text-[11px]">{a.label}</TableHead>
                          ))}
                          <TableHead className="text-center text-[11px]">الكل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((mod) => {
                          const allOn = ACTIONS.every((a) => matrix[mod.code][a.key])
                          const allOff = ACTIONS.every((a) => !matrix[mod.code][a.key])
                          return (
                            <TableRow key={mod.code} className="hover:bg-muted/30">
                              <TableCell className="ps-3 sticky start-0 bg-background font-medium">
                                <div className="flex flex-col">
                                  <span>{mod.nameAr}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">{mod.code}</span>
                                </div>
                              </TableCell>
                              {ACTIONS.map((a) => (
                                <TableCell key={a.key} className="text-center">
                                  <Checkbox
                                    checked={matrix[mod.code][a.key]}
                                    onCheckedChange={() => togglePerm(mod.code, a.key)}
                                  />
                                </TableCell>
                              ))}
                              <TableCell className="text-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px]"
                                  onClick={() => toggleAllForModule(mod.code, !allOn)}
                                >
                                  {allOn ? 'إلغاء الكل' : 'تحديد الكل'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {!editing && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground bg-muted/20">
                  💡 ستتمكن من ضبط مصفوفة الصلاحيات بعد إنشاء الدور (اضغط زر التعديل).
                </div>
              )}
            </ScrollArea>
            <DialogFooter className="mt-4">
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
