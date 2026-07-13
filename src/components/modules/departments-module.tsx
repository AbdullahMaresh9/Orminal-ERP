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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Building2, Plus, Pencil, Trash2, Network, Layers, Users, CheckCircle2 } from 'lucide-react'

interface Department {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  parentId?: string | null
  active: boolean
  _count?: { employees: number }
  parent?: { id: string; code: string; nameAr: string } | null
}

interface Draft {
  code: string
  nameAr: string
  nameEn: string
  parentId: string
  active: boolean
}

export function DepartmentsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [draft, setDraft] = useState<Draft>({ code: '', nameAr: '', nameEn: '', parentId: '', active: true })

  const { data, isLoading } = useQuery<{ data: Department[]; meta: any }>({
    queryKey: ['departments', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '300')
      const r = await fetch(`/api/erp/departments?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const items = data?.data ?? []

  const rootDepts = items.filter((d) => !d.parentId)
  const stats = {
    total: items.length,
    root: rootDepts.length,
    active: items.filter((d) => d.active).length,
    employees: items.reduce((s, d) => s + (d._count?.employees ?? 0), 0),
  }

  const openCreate = () => {
    setEditing(null)
    setDraft({ code: '', nameAr: '', nameEn: '', parentId: '', active: true })
    setDialogOpen(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setDraft({
      code: d.code,
      nameAr: d.nameAr,
      nameEn: d.nameEn ?? '',
      parentId: d.parentId ?? '',
      active: d.active,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.code || !draft.nameAr) throw new Error('الكود والاسم مطلوبان')
      const payload: any = {
        code: draft.code,
        nameAr: draft.nameAr,
        nameEn: draft.nameEn || draft.nameAr,
        parentId: draft.parentId || null,
        active: draft.active,
      }
      const url = editing ? `/api/erp/departments/${editing.id}` : '/api/erp/departments'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['departments'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/departments/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((d) => ({
      'الرمز': d.code,
      'الاسم': d.nameAr,
      'الاسم (إنجليزي)': d.nameEn ?? '',
      'القسم الأب': d.parent?.nameAr ?? '',
      'الموظفون': d._count?.employees ?? 0,
      'الحالة': d.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('departments', rows)
    toast.success('تم تصدير الملف')
  }

  // Build a tree view by indenting children
  const buildTree = (list: Department[]): Array<Department & { depth: number }> => {
    const result: Array<Department & { depth: number }> = []
    const childrenMap = new Map<string, Department[]>()
    list.forEach((d) => {
      if (d.parentId) {
        if (!childrenMap.has(d.parentId)) childrenMap.set(d.parentId, [])
        childrenMap.get(d.parentId)!.push(d)
      }
    })
    const walk = (node: Department, depth: number) => {
      result.push({ ...node, depth })
      const kids = childrenMap.get(node.id) ?? []
      kids.forEach((k) => walk(k, depth + 1))
    }
    list.filter((d) => !d.parentId).forEach((root) => walk(root, 0))
    // Add orphans (parentId points to non-existing) at depth 0
    list.filter((d) => d.parentId && !list.find((p) => p.id === d.parentId)).forEach((o) => {
      if (!result.find((r) => r.id === o.id)) result.push({ ...o, depth: 0 })
    })
    return result
  }
  const tree = buildTree(items)

  return (
    <ModuleShell
      title={t('module.departments')}
      description="إدارة شجرة الإدارات والأقسام التنظيمية"
      icon={<Building2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز القسم أو الاسم..."
      onAdd={openCreate}
      addLabel={t('action.add')}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الأقسام" value={formatInt(stats.total)} icon={<Building2 className="size-5" />} accent="blue" />
        <KpiCard title="أقسام رئيسية" value={formatInt(stats.root)} icon={<Network className="size-5" />} accent="sky" />
        <KpiCard title="نشطة" value={formatInt(stats.active)} icon={<CheckCircle2 className="size-5" />} accent="amber" />
        <KpiCard title="إجمالي الموظفين" value={formatInt(stats.employees)} icon={<Users className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الاسم (إنجليزي)</TableHead>
                <TableHead>القسم الأب</TableHead>
                <TableHead className="text-end num-cell">الموظفون</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : tree.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد إدارات. ابدأ بإضافة أول قسم.</TableCell></TableRow>
              ) : tree.map((d) => (
                <TableRow key={d.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">
                    <span style={{ display: 'inline-block', width: `${d.depth * 16}px` }} />
                    {d.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span style={{ display: 'inline-block', width: `${d.depth * 8}px` }} />
                    {d.depth > 0 && <Layers className="inline-block size-3 ms-1 me-1 text-muted-foreground" />}
                    {d.nameAr}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{d.nameEn ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {d.parent ? d.parent.nameAr : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{d._count?.employees ?? 0}</span></TableCell>
                  <TableCell><StatusBadge status={d.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(d)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(d.id)}>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل قسم' : 'إضافة قسم جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات القسم</DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">الرمز *</Label>
                <Input id="code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} dir="ltr" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                <Input id="nameAr" value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                <Input id="nameEn" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>القسم الأب</Label>
                <Select value={draft.parentId} onValueChange={(v) => setDraft({ ...draft, parentId: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="— قسم رئيسي —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— قسم رئيسي —</SelectItem>
                    {items
                      .filter((d) => d.id !== editing?.id)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span dir="ltr" className="font-mono text-xs">{d.code}</span> — {d.nameAr}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-4 col-span-2">
                <Switch id="active" checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                <Label htmlFor="active">نشط</Label>
              </div>
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
