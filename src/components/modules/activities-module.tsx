'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Activity, Building2, Layers, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface ActivityRow {
  id: string; name: string; code?: string | null; branchId: string; createdAt: string
  branch?: { name: string; code: string }
}

export function ActivitiesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ActivityRow | null>(null)
  const [form, setForm] = useState<any>({ name: '', code: '', branchId: '' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: ActivityRow[]; total: number }>({
    queryKey: ['activities'],
    queryFn: async () => {
      const r = await fetch('/api/erp/activities')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  const { data: branchesData } = useQuery<{ data: any[] }>({
    queryKey: ['branches-mini'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })
  const branches = branchesData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/activities/${editing.id}` : '/api/erp/activities'
      const r = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.saved'))
      qc.invalidateQueries({ queryKey: ['activities'] })
      setDialogOpen(false)
    },
    onError: () => toast.error(t('error.save')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/activities/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['activities'] })
      setDeleteId(null)
    },
    onError: () => toast.error(t('error.delete')),
  })

  const list = (data?.data ?? []).filter((a) =>
    !search || a.name.includes(search) || (a.code ?? '').includes(search) || (a.branch?.name ?? '').includes(search)
  )

  const total = data?.total ?? 0
  const branchesCount = new Set((data?.data ?? []).map((a) => a.branchId)).size

  function openAdd() {
    setEditing(null)
    setForm({ name: '', code: '', branchId: branches[0]?.id ?? '' })
    setDialogOpen(true)
  }
  function openEdit(a: ActivityRow) {
    setEditing(a)
    setForm({ name: a.name, code: a.code ?? '', branchId: a.branchId })
    setDialogOpen(true)
  }
  function handleSave() {
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    if (!form.branchId) return toast.error('الفرع مطلوب')
    saveMutation.mutate(form)
  }
  function handleExport() {
    exportToCSV('activities', list.map((a) => ({
      name: a.name, code: a.code ?? '', branch: a.branch?.name ?? '',
    })))
  }

  return (
    <ModuleShell
      title={t('module.activities')}
      description="الأنشطة التجارية لكل فرع"
      icon={<Activity className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن نشاط..."
      onAdd={openAdd}
      addLabel="نشاط جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي الأنشطة" value={String(total)} icon={<Activity className="size-5" />} accent="emerald" />
        <KpiCard title="عدد الفروع" value={String(branchesCount)} icon={<Building2 className="size-5" />} accent="amber" />
        <KpiCard title="متوسط لكل فرع" value={branchesCount ? (total / branchesCount).toFixed(1) : '0'} icon={<Layers className="size-5" />} accent="teal" />
        <KpiCard title="إجمالي مع رمز" value={String((data?.data ?? []).filter((a) => a.code).length)} icon={<Layers className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh] scrollbar-thin">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الرمز</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead className="text-end w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('loading')}</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell></TableRow>
              ) : list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold">{a.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.code ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{a.branch?.name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(a)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(a.id)}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل نشاط' : 'نشاط جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">اسم النشاط *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="تجارة التجزئة" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">الرمز (اختياري)</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ACT-0001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">الفرع *</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger id="branch"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
