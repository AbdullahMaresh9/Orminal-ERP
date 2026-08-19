'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDateTime } from '@/lib/format'
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
import {
  Users as UsersIcon, ShieldCheck, UserCheck, KeyRound, Plus, Pencil, Trash2,
  Lock, Eye, EyeOff,
} from 'lucide-react'

interface Role {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  isSystem: boolean
}
interface Branch {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}
interface User {
  id: string
  username: string
  email: string
  nameAr: string
  nameEn?: string
  phone?: string
  avatar?: string
  active: boolean
  mfaEnabled: boolean
  defaultBranchId?: string
  locale: string
  timezone: string
  lastLoginAt?: string
  createdAt: string
  defaultBranch?: Branch
  userRoles: { role: Role }[]
  _count?: { auditLogs: number }
}

export function UsersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')

  const { data, isLoading } = useQuery<{ data: User[]; meta: any }>({
    queryKey: ['users', search, filterActive],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterActive === 'active') params.set('active', 'true')
      if (filterActive === 'inactive') params.set('active', 'false')
      params.set('pageSize', '200')
      const r = await fetch(`/api/erp/users?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: rolesData } = useQuery<{ data: Role[] }>({
    queryKey: ['roles-for-users'],
    queryFn: async () => {
      const r = await fetch('/api/erp/roles?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const roles = rolesData?.data ?? []

  const { data: branchesData } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches-for-users'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const branches = branchesData?.data ?? []

  const users = data?.data ?? []
  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    withMfa: users.filter((u) => u.mfaEnabled).length,
    byRole: users.reduce((acc, u) => {
      const r = u.userRoles?.[0]?.role
      if (r) acc[r.nameAr] = (acc[r.nameAr] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }
  const topRole = Object.entries(stats.byRole).sort((a, b) => b[1] - a[1])[0]
  const topRoleLabel = topRole ? `${topRole[0]} (${topRole[1]})` : '—'

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/users/${editing.id}` : '/api/erp/users'
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
      toast.success(editing ? 'تم تحديث المستخدم بنجاح' : 'تم إنشاء المستخدم بنجاح')
      qc.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
      setEditing(null)
      setChangePasswordOpen(false)
      setShowPassword(false)
      setSelectedRole('')
      setSelectedBranch('')
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/users/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف المستخدم')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const openEdit = (u: User) => {
    setEditing(u)
    setSelectedRole(u.userRoles?.[0]?.role?.id ?? '')
    setSelectedBranch(u.defaultBranchId ?? '')
    setChangePasswordOpen(false)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const openAdd = () => {
    setEditing(null)
    setSelectedRole('')
    setSelectedBranch('')
    setChangePasswordOpen(false)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload: any = {
      username: editing ? editing.username : fd.get('username'),
      nameAr: fd.get('nameAr'),
      nameEn: fd.get('nameEn') || undefined,
      email: fd.get('email'),
      phone: fd.get('phone') || undefined,
      roleId: selectedRole || undefined,
      defaultBranchId: selectedBranch || undefined,
      active: fd.get('active') === 'on',
      mfaEnabled: fd.get('mfaEnabled') === 'on',
    }
    if (!editing) {
      const pw = fd.get('password')
      if (!pw) {
        toast.error('كلمة المرور مطلوبة للمستخدم الجديد')
        return
      }
      payload.password = pw
    } else if (changePasswordOpen) {
      const pw = fd.get('password')
      if (pw) payload.password = pw
    }
    saveMutation.mutate(payload)
  }

  const handleExport = () => {
    const rows = users.map((u) => ({
      'اسم المستخدم': u.username,
      'الاسم': u.nameAr,
      'البريد': u.email,
      'الدور': u.userRoles?.[0]?.role?.nameAr ?? '',
      'الفرع': u.defaultBranch?.nameAr ?? '',
      'نشط': u.active ? 'نعم' : 'لا',
      'MFA': u.mfaEnabled ? 'مفعّل' : 'معطّل',
      'آخر دخول': u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—',
    }))
    exportToCSV('users', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.users')}
      description="إدارة مستخدمي النظام وأدوارهم وصلاحيات الوصول"
      icon={<UsersIcon className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث باسم المستخدم أو الاسم أو البريد..."
      onAdd={openAdd}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <>
          <Button size="sm" variant={filterActive === 'all' ? 'default' : 'outline'} onClick={() => setFilterActive('all')}>الكل</Button>
          <Button size="sm" variant={filterActive === 'active' ? 'default' : 'outline'} onClick={() => setFilterActive('active')}>نشط</Button>
          <Button size="sm" variant={filterActive === 'inactive' ? 'default' : 'outline'} onClick={() => setFilterActive('inactive')}>غير نشط</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
        <KpiCard title="إجمالي المستخدمين" value={formatInt(stats.total)} icon={<UsersIcon className="size-5" />} accent="blue" />
        <KpiCard title="المستخدمون النشطون" value={formatInt(stats.active)} icon={<UserCheck className="size-5" />} accent="sky" />
        <KpiCard title="الأكثر دوراً" value={topRoleLabel} icon={<KeyRound className="size-5" />} accent="amber" />
        <KpiCard title="مع التحقق الثنائي (MFA)" value={formatInt(stats.withMfa)} icon={<ShieldCheck className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">اسم المستخدم</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر دخول</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا يوجد مستخدمون. ابدأ بإضافة أول مستخدم.</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{u.username}</TableCell>
                  <TableCell className="font-medium">{u.nameAr}</TableCell>
                  <TableCell className="text-sm font-mono" dir="ltr">{u.email}</TableCell>
                  <TableCell>
                    {u.userRoles?.[0]?.role ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[11px]">
                        {u.userRoles[0].role.nameAr}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{u.defaultBranch?.nameAr ?? '—'}</TableCell>
                  <TableCell>
                    {u.mfaEnabled ? (
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 text-[10px] gap-1">
                        <ShieldCheck className="size-3" /> مفعّل
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">معطّل</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={u.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastLoginAt ? <span className="num" dir="ltr">{formatDateTime(u.lastLoginAt)}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(u)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-500 hover:text-rose-600 disabled:opacity-30"
                        disabled={u.username === 'admin'}
                        onClick={() => deleteMutation.mutate(u.id)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
            <DialogDescription>
              {editing ? `تعديل بيانات: ${editing.nameAr}` : 'أدخل بيانات المستخدم الجديد'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[60vh] pe-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                {!editing && (
                  <div className="space-y-1.5">
                    <Label htmlFor="username">اسم المستخدم *</Label>
                    <Input id="username" name="username" required placeholder="admin" dir="ltr" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                  <Input id="nameAr" name="nameAr" defaultValue={editing?.nameAr} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                  <Input id="nameEn" name="nameEn" defaultValue={editing?.nameEn} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <Input id="email" name="email" type="email" defaultValue={editing?.email} required dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">الهاتف</Label>
                  <Input id="phone" name="phone" defaultValue={editing?.phone} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>الدور</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر دوراً" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nameAr} <span className="text-xs text-muted-foreground ms-1" dir="ltr">({r.code})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الفرع</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر فرعاً" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.length === 0 ? (
                        <SelectItem value="_none" disabled>لا توجد فروع</SelectItem>
                      ) : (
                        branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.nameAr} <span className="text-xs text-muted-foreground ms-1" dir="ltr">({b.code})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Password section */}
                {!editing && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password">كلمة المرور *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        className="pe-9"
                        dir="ltr"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute end-1 top-1/2 -translate-y-1/2 size-7"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
                {editing && (
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                      <Lock className="size-4 text-muted-foreground" />
                      <span className="text-sm flex-1">كلمة المرور محمية</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={changePasswordOpen ? 'default' : 'outline'}
                        onClick={() => setChangePasswordOpen((v) => !v)}
                      >
                        {changePasswordOpen ? 'إلغاء التغيير' : 'تغيير كلمة المرور'}
                      </Button>
                    </div>
                    {changePasswordOpen && (
                      <div className="mt-3 space-y-1.5">
                        <Label htmlFor="password">كلمة المرور الجديدة</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="اتركها فارغة للإبقاء على الحالية"
                            className="pe-9"
                            dir="ltr"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute end-1 top-1/2 -translate-y-1/2 size-7"
                            onClick={() => setShowPassword((v) => !v)}
                          >
                            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                    <Label htmlFor="active">نشط</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="mfaEnabled" name="mfaEnabled" defaultChecked={editing?.mfaEnabled ?? false} />
                    <Label htmlFor="mfaEnabled">تفعيل التحقق الثنائي (MFA)</Label>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
