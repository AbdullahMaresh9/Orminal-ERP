'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Building2, Store, Users, CheckCircle2, Plus, Pencil, Trash2, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface Branch {
  id: string; code: string; name: string; address?: string | null
  phone?: string | null; email?: string | null; taxNumber?: string | null
  isMain: boolean; active: boolean; createdAt: string
  _count?: { users: number; salesOrders: number; purchaseOrders: number }
}

const empty = { name: '', address: '', phone: '', email: '', taxNumber: '', isMain: false, active: true }

export function BranchesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState<any>(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: Branch[]; total: number }>({
    queryKey: ['branches'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/branches/${editing.id}` : '/api/erp/branches'
      const r = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('save failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.saved'))
      qc.invalidateQueries({ queryKey: ['branches'] })
      setDialogOpen(false)
    },
    onError: () => toast.error(t('error.save')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/branches/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'delete failed')
      }
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['branches'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const list = (data?.data ?? []).filter((b) =>
    !search || b.name.includes(search) || b.code.includes(search) || (b.address ?? '').includes(search)
  )

  const totalBranches = data?.total ?? 0
  const mainBranch = (data?.data ?? []).filter((b) => b.isMain).length
  const activeBranches = (data?.data ?? []).filter((b) => b.active).length
  const totalUsers = (data?.data ?? []).reduce((s, b) => s + (b._count?.users ?? 0), 0)

  function openAdd() {
    setEditing(null)
    setForm(empty)
    setDialogOpen(true)
  }

  function openEdit(b: Branch) {
    setEditing(b)
    setForm({
      name: b.name, address: b.address ?? '', phone: b.phone ?? '', email: b.email ?? '',
      taxNumber: b.taxNumber ?? '', isMain: b.isMain, active: b.active,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('الاسم مطلوب')
      return
    }
    saveMutation.mutate(form)
  }

  function handleExport() {
    exportToCSV('branches', list.map((b) => ({
      code: b.code, name: b.name, phone: b.phone ?? '', email: b.email ?? '',
      address: b.address ?? '', taxNumber: b.taxNumber ?? '',
      isMain: b.isMain ? 'نعم' : 'لا', active: b.active ? 'نعم' : 'لا',
    })))
  }

  return (
    <ModuleShell
      title={t('module.branches')}
      description="إدارة الفروع والشركات التابعة"
      icon={<Building2 className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن فرع..."
      onAdd={openAdd}
      addLabel="فرع جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي الفروع" value={String(totalBranches)} icon={<Store className="size-5" />} accent="emerald" />
        <KpiCard title="الفرع الرئيسي" value={String(mainBranch)} icon={<Star className="size-5" />} accent="amber" />
        <KpiCard title="الفروع النشطة" value={String(activeBranches)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
        <KpiCard title="إجمالي المستخدمين" value={String(totalUsers)} icon={<Users className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl border">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="hidden md:table-cell">العنوان</TableHead>
                <TableHead className="hidden md:table-cell">الهاتف</TableHead>
                <TableHead>الرئيسي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('loading')}</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell></TableRow>
              ) : list.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="font-semibold">{b.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{b.address ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{b.phone ?? '—'}</TableCell>
                  <TableCell>{b.isMain ? <Star className="size-4 text-amber-500 fill-amber-500" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell><StatusBadge status={b.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(b)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(b.id)} disabled={b.isMain}>
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
            <DialogTitle>{editing ? 'تعديل فرع' : 'فرع جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">اسم الفرع *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الفرع الرئيسي - الرياض" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxNumber">الرقم الضريبي</Label>
              <Input id="taxNumber" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
            </div>
            <div className="flex items-end gap-6 pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={form.isMain} onCheckedChange={(v) => setForm({ ...form, isMain: v })} id="isMain" />
                <Label htmlFor="isMain" className="cursor-pointer">فرع رئيسي</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="active" />
                <Label htmlFor="active" className="cursor-pointer">نشط</Label>
              </div>
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
