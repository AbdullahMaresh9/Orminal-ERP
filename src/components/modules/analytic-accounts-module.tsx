'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import {
  Network, Plus, Pencil, Trash2, ChevronDown, ChevronLeft,
  Layers, CheckCircle2, FolderTree, FileText,
} from 'lucide-react'

interface AnalyticAccount {
  id: string
  code: string
  name: string
  parentId: string | null
  active: boolean
  parent?: { id: string; code: string; name: string } | null
}

export function AnalyticAccountsModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AnalyticAccount | null>(null)
  const [form, setForm] = useState({ code: '', name: '', parentId: '', active: true })

  const { data, isLoading } = useQuery<{ data: AnalyticAccount[]; total: number }>({
    queryKey: ['analytic-accounts'],
    queryFn: async () => {
      const r = await fetch('/api/erp/analytic-accounts')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 10 * 1000,
  })

  const all = data?.data ?? []

  // Build tree: roots = no parent 
  const { roots, childrenMap, filteredList } = useMemo(() => {
    const filtered = all.filter((a) => {
      if (!search) return true
      const q = search.toLowerCase()
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    })
    const filteredIds = new Set(filtered.map((a) => a.id))
    // Also include parents of matches so tree makes sense
    const idsToShow = new Set<string>()
    for (const a of filtered) {
      idsToShow.add(a.id)
      let cur: AnalyticAccount | undefined = a
      while (cur?.parentId) {
        idsToShow.add(cur.parentId)
        cur = all.find((x) => x.id === cur!.parentId)
      }
    }
    const list = search ? all.filter((a) => idsToShow.has(a.id)) : all
    const roots = list.filter((a) => !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
    const cMap = new Map<string, AnalyticAccount[]>()
    for (const a of list) {
      if (a.parentId) {
        const arr = cMap.get(a.parentId) ?? []
        arr.push(a)
        cMap.set(a.parentId, arr)
      }
    }
    // sort children
    cMap.forEach((arr) => arr.sort((a, b) => a.code.localeCompare(b.code)))
    return { roots, childrenMap: cMap, filteredList: list }
  }, [all, search])

  const kpis = useMemo(() => {
    const total = all.length
    const active = all.filter((a) => a.active).length
    const parents = all.filter((a) => !a.parentId).length
    const children = all.length - parents
    return { total, active, parents, children }
  }, [all])

  function openAdd() {
    setEditing(null)
    setForm({ code: '', name: '', parentId: '', active: true })
    setDialogOpen(true)
  }
  function openEdit(a: AnalyticAccount) {
    setEditing(a)
    setForm({ code: a.code, name: a.name, parentId: a.parentId ?? '', active: a.active })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        parentId: form.parentId || null,
        active: form.active,
      }
      if (editing) {
        const r = await fetch(`/api/erp/analytic-accounts/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل الحفظ') }
        return r.json()
      } else {
        const r = await fetch('/api/erp/analytic-accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل الإنشاء') }
        return r.json()
      }
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
      setDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['analytic-accounts'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/analytic-accounts/${id}`, { method: 'DELETE' })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل الحذف') }
    },
    onSuccess: () => {
      toast.success('تم الحذف')
      qc.invalidateQueries({ queryKey: ['analytic-accounts'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handleExport() {
    const rows = all.map((a) => ({
      code: a.code,
      name: a.name,
      parent: a.parent?.name ?? '—',
      active: a.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('مراكز-التكلفة', rows, [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'parent', label: 'المركز الأب' },
      { key: 'active', label: 'الحالة' },
    ])
  }

  return (
    <ModuleShell
      title={t('module.analytic-accounts')}
      description="مراكز التكلفة والتحليل — شجرة هرمية"
      icon={<Network className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="بحث برمز أو اسم المركز..."
      onAdd={openAdd}
      addLabel="مركز جديد"
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المراكز" value={String(kpis.total)} icon={<Layers className="size-5" />} accent="blue" />
            <KpiCard title="المراكز النشطة" value={String(kpis.active)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title="مراكز رئيسية" value={String(kpis.parents)} icon={<FolderTree className="size-5" />} accent="violet" />
            <KpiCard title="مراكز فرعية" value={String(kpis.children)} icon={<Network className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <FileText className="size-10 mx-auto mb-2 opacity-40" />
                لا توجد مراكز تكلفة
              </div>
            ) : (
              <Table className="table-sticky">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">الرمز</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>المركز الأب</TableHead>
                    <TableHead className="w-24 text-center">الحالة</TableHead>
                    <TableHead className="w-24 text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roots.map((root) => (
                    <AnalyticRow
                      key={root.id}
                      account={root}
                      all={all}
                      childrenMap={childrenMap}
                      level={0}
                      onEdit={openEdit}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Network className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editing ? (isRTL ? 'تعديل مركز تكلفة' : 'Edit Cost Center') : (isRTL ? 'مركز تكلفة جديد' : 'New Cost Center')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="code" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الرمز *' : 'Code *'}</Label>
                  <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CC-001" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم *' : 'Name *'}</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isRTL ? 'إدارة المبيعات' : 'Sales Department'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
                </div>
              </div>

              <div className="space-y-1.5 text-start">
                <Label htmlFor="parent" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'المركز الأب' : 'Parent Center'}</Label>
                <Select value={form.parentId || '__none__'} onValueChange={(v) => setForm({ ...form, parentId: v === '__none__' ? '' : v })}>
                  <SelectTrigger id="parent" className="w-full h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{isRTL ? '— مركز رئيسي —' : '— Main Center —'}</SelectItem>
                    {all.filter((a) => a.id !== editing?.id).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-xl">
                <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} className="data-[state=checked]:bg-blue-600 shrink-0" />
                <div className="space-y-0.5 flex-1 text-start">
                  <Label htmlFor="active" className="text-sm font-bold text-blue-950 dark:text-blue-200 cursor-pointer">{isRTL ? 'نشط' : 'Active'}</Label>
                  <p className="text-xs text-blue-750/70 dark:text-blue-300/60 leading-normal">{isRTL ? 'تفعيل أو تعطيل مركز التكلفة للترحيل' : 'Enable or disable this analytical center for posting'}</p>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.code || !form.name}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none"
            >
              {saveMutation.isPending ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (editing ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء وحفـظ' : 'Create and Save'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

function AnalyticRow({
  account, all, childrenMap, level, onEdit, onDelete,
}: {
  account: AnalyticAccount
  all: AnalyticAccount[]
  childrenMap: Map<string, AnalyticAccount[]>
  level: number
  onEdit: (a: AnalyticAccount) => void
  onDelete: (id: string) => void
}) {
  const children = childrenMap.get(account.id) ?? []
  const [open, setOpen] = useState(true)
  const hasChildren = children.length > 0

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs font-bold">
          <span style={{ display: 'inline-block', width: `${level * 18}px` }} />
          {hasChildren ? (
            <button onClick={() => setOpen(!open)} className="inline-flex items-center me-1 text-muted-foreground hover:text-foreground">
              {open ? <ChevronDown className="size-3.5" /> : <ChevronLeft className="size-3.5 rtl:rotate-180" />}
            </button>
          ) : null}
          {account.code}
        </TableCell>
        <TableCell>
          <span className="font-medium" style={{ paddingInlineStart: hasChildren ? 0 : 22 }}>
            {account.name}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {account.parent?.name ?? '—'}
        </TableCell>
        <TableCell className="text-center">
          <StatusBadge status={account.active ? 'active' : 'inactive'} />
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-0.5">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(account)} title="تعديل">
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-rose-600 hover:text-rose-700"
              onClick={() => onDelete(account.id)}
              title="حذف"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {open && hasChildren && children.map((c) => (
        <AnalyticRow
          key={c.id}
          account={c}
          all={all}
          childrenMap={childrenMap}
          level={level + 1}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}
