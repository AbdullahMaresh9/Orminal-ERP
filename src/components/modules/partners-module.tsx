'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatPercent } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Users, Percent, Building2, PieChart, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'

interface Partner {
  id: string; name: string; share: number; branchId: string; createdAt: string
  branch?: { name: string; code: string }
}

export function PartnersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [form, setForm] = useState<any>({ name: '', share: 0, branchId: '' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: Partner[]; total: number }>({
    queryKey: ['partners'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners')
      if (!r.ok) throw new Error('fetch failed')
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
      const url = editing ? `/api/erp/partners/${editing.id}` : '/api/erp/partners'
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
      qc.invalidateQueries({ queryKey: ['partners'] })
      setDialogOpen(false)
    },
    onError: () => toast.error(t('error.save')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/partners/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['partners'] })
      setDeleteId(null)
    },
    onError: () => toast.error(t('error.delete')),
  })

  const list = (data?.data ?? []).filter((p) =>
    !search || p.name.includes(search) || (p.branch?.name ?? '').includes(search)
  )

  const totalPartners = data?.total ?? 0
  const totalShare = (data?.data ?? []).reduce((s, p) => s + (p.share ?? 0), 0)
  const branchesCount = new Set((data?.data ?? []).map((p) => p.branchId)).size

  function openAdd() {
    setEditing(null)
    setForm({ name: '', share: 0, branchId: branches[0]?.id ?? '' })
    setDialogOpen(true)
  }

  function openEdit(p: Partner) {
    setEditing(p)
    setForm({ name: p.name, share: p.share, branchId: p.branchId })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    if (!form.branchId) return toast.error('الفرع مطلوب')
    saveMutation.mutate(form)
  }

  function handleExport() {
    exportToCSV('partners', list.map((p) => ({
      name: p.name, branch: p.branch?.name ?? '', share: p.share,
    })))
  }

  return (
    <ModuleShell
      title={t('module.partners')}
      description="قوائم الشركاء وحصصهم في كل فرع"
      icon={<Users className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="ابحث عن شريك..."
      onAdd={openAdd}
      addLabel="شريك جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي الشركاء" value={String(totalPartners)} icon={<Users className="size-5" />} accent="emerald" />
        <KpiCard title="إجمالي الحصص" value={formatPercent(totalShare, 1)} icon={<Percent className="size-5" />} accent="amber" />
        <KpiCard title="عدد الفروع" value={String(branchesCount)} icon={<Building2 className="size-5" />} accent="teal" />
        <KpiCard title="متوسط الحصة" value={totalPartners ? formatPercent(totalShare / totalPartners, 1) : '0%'} icon={<PieChart className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl border">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead className="w-[280px]">الحصة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('loading')}</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell></TableRow>
              ) : list.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.branch?.name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold tabular-nums">{p.share.toFixed(1)}%</span>
                        {p.share > 50 && <span className="text-amber-600 text-[10px] font-semibold">شريك أغلبية</span>}
                      </div>
                      <Progress value={p.share} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(p.id)}>
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
            <DialogTitle>{editing ? 'تعديل شريك' : 'شريك جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">اسم الشريك *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مؤسسة الأستاذ التجارية" />
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
            <div className="space-y-1.5">
              <Label htmlFor="share">الحصة (%) — بين 0 و 100</Label>
              <Input id="share" type="number" min={0} max={100} step={0.1} value={form.share} onChange={(e) => setForm({ ...form, share: Number(e.target.value) })} />
              <Progress value={form.share} className="h-2" />
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
