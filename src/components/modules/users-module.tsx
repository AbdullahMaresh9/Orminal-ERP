'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/use-t'
import { formatDate } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { UserPlus, Users, CheckCircle2, Shield, Building2, Pencil, Trash2, Mail, Phone } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const ROLES = ['developer', 'owner', 'admin', 'manager', 'accountant', 'cashier', 'employee', 'viewer'] as const

interface UserRow {
  id: string; name: string; email: string; role: string; phone?: string | null
  branchId?: string | null; active: boolean; createdAt: string
  branch?: { name: string; code: string } | null
}

export function UsersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<any>({ name: '', email: '', password: '', role: 'employee', branchId: '', phone: '', active: true })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: UserRow[]; total: number }>({
    queryKey: ['users'],
    queryFn: async () => {
      const r = await fetch('/api/erp/users')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  const { data: branchesData } = useQuery<{ data: any[] }>({
    queryKey: ['branches-mini'],
    queryFn: async () => (await fetch('/api/erp/branches').then((r) => r.json())),
  })
  const branches = branchesData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/users/${editing.id}` : '/api/erp/users'
      const r = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.saved'))
      qc.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/users/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteId(null)
    },
    onError: () => toast.error(t('error.delete')),
  })

  const list = (data?.data ?? []).filter((u) =>
    !search || u.name.includes(search) || u.email.includes(search) || u.role.includes(search)
  )

  const total = data?.total ?? 0
  const active = (data?.data ?? []).filter((u) => u.active).length
  const byRole = new Set((data?.data ?? []).map((u) => u.role)).size
  const byBranch = new Set((data?.data ?? []).filter((u) => u.branchId).map((u) => u.branchId)).size

  function openAdd() {
    setEditing(null)
    setForm({ name: '', email: '', password: '', role: 'employee', branchId: branches[0]?.id ?? '', phone: '', active: true })
    setDialogOpen(true)
  }
  function openEdit(u: UserRow) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, branchId: u.branchId ?? '', phone: u.phone ?? '', active: u.active })
    setDialogOpen(true)
  }
  function handleSave() {
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    if (!form.email.trim()) return toast.error('البريد مطلوب')
    if (!editing && !form.password) return toast.error('كلمة المرور مطلوبة')
    saveMutation.mutate(form)
  }
  function handleExport() {
    exportToCSV('users', list.map((u) => ({
      name: u.name, email: u.email, role: t(`role.${u.role}` as any),
      branch: u.branch?.name ?? '', active: u.active ? 'نشط' : 'غير نشط',
    })))
  }

  return (
    <ModuleShell
      title={t('module.users')}
      description="إدارة المستخدمين والأدوار"
      icon={<Users className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن مستخدم..."
      onAdd={openAdd}
      addLabel="مستخدم جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي المستخدمين" value={String(total)} icon={<Users className="size-5" />} accent="emerald" />
        <KpiCard title="نشط" value={String(active)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
        <KpiCard title="عدد الأدوار" value={String(byRole)} icon={<Shield className="size-5" />} accent="amber" />
        <KpiCard title="بالفروع" value={String(byBranch)} icon={<Building2 className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh] scrollbar-thin">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead className="hidden md:table-cell">الفرع</TableHead>
                <TableHead className="w-28">الحالة</TableHead>
                <TableHead className="text-end w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('loading')}</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell></TableRow>
              ) : list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{u.name}</p>
                        {u.phone && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="size-2.5" /><span className="num">{u.phone}</span></p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <Mail className="size-3 shrink-0" />
                      <span className="num">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
                      {t(`role.${u.role}` as any)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{u.branch?.name ?? '—'}</TableCell>
                  <TableCell><StatusBadge status={u.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(u)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="size-4" />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل مستخدم' : 'مستخدم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">الاسم الكامل *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{editing ? 'كلمة المرور (اتركها فارغة لعدم التغيير)' : 'كلمة المرور *'}</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? '••••••' : ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">الدور</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role.${r}` as any)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">الفرع</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger id="branch"><SelectValue placeholder="بدون فرع" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="active" />
              <Label htmlFor="active" className="cursor-pointer">المستخدم نشط</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('loading') : t('action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>{t('misc.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-rose-600 hover:bg-rose-700">
              {t('action.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleShell>
  )
}
