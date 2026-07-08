'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatDate } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Warehouse, Building2, MapPin, Boxes, MoreVertical, Pencil, Trash2, Plus } from 'lucide-react'

interface Storehouse {
  id: string
  name: string
  code: string
  branchId: string | null
  address: string | null
  active: boolean
  createdAt: string
  branch?: { id: string; name: string } | null
  _count?: { stockItems: number }
}

const EMPTY_FORM = { name: '', code: '', branchId: '', address: '', active: true }

export function StorehousesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ data: Storehouse[]; total: number }>({
    queryKey: ['storehouses', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      const r = await fetch(`/api/erp/storehouses?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const storehouses = data?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingId
      const url = isEdit ? `/api/erp/storehouses/${editingId}` : '/api/erp/storehouses'
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'save failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['storehouses'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/storehouses/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'delete failed')
      }
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['storehouses'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDialogOpen(true)
  }
  function openEdit(s: Storehouse) {
    setForm({
      name: s.name,
      code: s.code,
      branchId: s.branchId ?? '',
      address: s.address ?? '',
      active: s.active,
    })
    setEditingId(s.id)
    setDialogOpen(true)
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    saveMutation.mutate(form)
  }
  function handleExport() {
    exportToCSV('storehouses', storehouses.map(s => ({
      code: s.code,
      name: s.name,
      branch: s.branch?.name ?? '',
      address: s.address ?? '',
      items: s._count?.stockItems ?? 0,
      active: s.active ? 'نعم' : 'لا',
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'branch', label: 'الفرع' },
      { key: 'address', label: 'العنوان' },
      { key: 'items', label: 'عدد الأصناف' },
      { key: 'active', label: 'نشط' },
    ])
  }

  const total = storehouses.length
  const active = storehouses.filter(s => s.active).length
  const totalItems = storehouses.reduce((s, x) => s + (x._count?.stockItems ?? 0), 0)
  const withBranch = storehouses.filter(s => s.branchId).length

  return (
    <ModuleShell
      title={t('module.storehouses')}
      description="إدارة المستودعات والمراكز التخزينية"
      icon={<Warehouse className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث عن مستودع..."
      onAdd={openAdd}
      addLabel="مستودع جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المستودعات" value={String(total)} icon={<Warehouse className="size-5" />} accent="emerald" />
            <KpiCard title="مستودعات نشطة" value={String(active)} icon={<Warehouse className="size-5" />} accent="teal" />
            <KpiCard title="إجمالي الأصناف" value={String(totalItems)} icon={<Boxes className="size-5" />} accent="violet" />
            <KpiCard title="مرتبطة بفرع" value={String(withBranch)} icon={<Building2 className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead className="text-end">عدد الأصناف</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">تاريخ الإنشاء</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : storehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Warehouse className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد مستودعات. ابدأ بإضافة مستودع جديد.
                  </TableCell>
                </TableRow>
              ) : storehouses.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Warehouse className="size-4 text-primary" />
                      {s.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.branch?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.address ? <span className="flex items-center gap-1"><MapPin className="size-3" />{s.address}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{s._count?.stockItems ?? 0}</TableCell>
                  <TableCell className="text-end"><StatusBadge status={s.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="size-4 ms-2" /> تعديل</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600" onClick={() => {
                          if (confirm(`حذف المستودع "${s.name}"؟`)) deleteMutation.mutate(s.id)
                        }}><Trash2 className="size-4 ms-2" /> حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل مستودع' : 'مستودع جديد'}</DialogTitle>
            <DialogDescription>{editingId ? 'تحديث بيانات المستودع' : 'إضافة مستودع جديد'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="تلقائي إن تُرك فارغاً" />
            </div>
            <div className="space-y-1.5">
              <Label>الفرع</Label>
              <BranchSelect value={form.branchId} onChange={v => setForm({ ...form, branchId: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={c => setForm({ ...form, active: c })} id="wh-active" />
              <Label htmlFor="wh-active">المستودع نشط</Label>
            </div>
            <DialogFooter>
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

function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery<{ data: any[] }>({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const branches = data?.data ?? []
  return (
    <Select value={value || 'none'} onValueChange={v => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder="بدون فرع" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">بدون فرع</SelectItem>
        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
