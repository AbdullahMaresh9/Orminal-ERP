'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { exportToCSV } from '@/lib/export'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { FolderTree, Plus, Pencil, Trash2, Download, Boxes, GitBranch, CheckCircle } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

export function CategoriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', nameAr: '', nameEn: '', parentId: '', type: 'product', active: true })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['categories', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/categories?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error('fetch')
      return r.json()
    },
  })
  const categories = data?.data ?? []

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/erp/categories/${editId}` : '/api/erp/categories'
      const method = editId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, parentId: form.parentId || null }) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم الحفظ بنجاح'); qc.invalidateQueries({ queryKey: ['categories'] }); setDialogOpen(false); setEditId(null) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/categories/${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['categories'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleAdd = () => { setForm({ code: '', nameAr: '', nameEn: '', parentId: '', type: 'product', active: true }); setEditId(null); setDialogOpen(true) }
  const handleEdit = (c: any) => { setForm({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn || '', parentId: c.parentId || '', type: c.type || 'product', active: c.active }); setEditId(c.id); setDialogOpen(true) }
  const handleExport = () => exportToCSV('categories', categories.map((c: any) => ({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn || '', type: c.type, active: c.active ? 'نشط' : 'غير نشط' })))

  const rootCount = categories.filter((c: any) => !c.parentId).length
  const activeCount = categories.filter((c: any) => c.active).length

  return (
    <ModuleShell title="الفئات" description="إدارة فئات المنتجات والشركاء" icon={<FolderTree className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={handleAdd} addLabel="فئة جديدة" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي الفئات" value={String(categories.length)} icon={<Boxes className="size-5" />} accent="blue" />
            <KpiCard title="الفئات الجذرية" value={String(rootCount)} icon={<GitBranch className="size-5" />} accent="sky" />
            <KpiCard title="النشطة" value={String(activeCount)} icon={<CheckCircle className="size-5" />} accent="violet" />
            <KpiCard title="بالمنتجات" value={String(categories.filter((c:any)=>c._count?.products>0).length)} icon={<FolderTree className="size-5" />} accent="amber" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead><TableHead>الاسم (عربي)</TableHead><TableHead>الاسم (إنجليزي)</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:6}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
               !categories.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">لا توجد فئات</TableCell></TableRow> :
               categories.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{c.code}</TableCell>
                  <TableCell className="font-medium text-sm">{c.nameAr}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.nameEn || '—'}</TableCell>
                  <TableCell className="text-sm">{c.type === 'product' ? 'منتج' : c.type === 'partner' ? 'شريك' : c.type === 'expense' ? 'مصروف' : 'إيراد'}</TableCell>
                  <TableCell><StatusBadge status={c.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell><div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(c)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => delMut.mutate(c.id)}><Trash2 className="size-4" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editId ? 'تعديل فئة' : 'فئة جديدة'}</DialogTitle><DialogDescription>أدخل بيانات الفئة</DialogDescription></DialogHeader>
          <DialogBody>          <DialogBody>          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs mb-1.5 block">الرمز *</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="CAT-001" /></div>
            <div><Label className="text-xs mb-1.5 block">النوع</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="product">منتج</SelectItem><SelectItem value="partner">شريك</SelectItem><SelectItem value="expense">مصروف</SelectItem><SelectItem value="revenue">إيراد</SelectItem>
              </SelectContent></Select>
            </div>
            <div><Label className="text-xs mb-1.5 block">الاسم (عربي) *</Label><Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} /></div>
            <div><Label className="text-xs mb-1.5 block">الاسم (إنجليزي)</Label><Input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} /></div>
            <div className="col-span-2"><Label className="text-xs mb-1.5 block">الفئة الأم</Label>
              <Select value={form.parentId} onValueChange={v => setForm({...form, parentId: v})}><SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger><SelectContent>
                {categories.filter((c:any)=>c.id!==editId).map((c:any)=><SelectItem key={c.id} value={c.id}>{c.code} — {c.nameAr}</SelectItem>)}
              </SelectContent></Select>
            </div>
            <div className="col-span-2 flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({...form, active: v})} /><Label className="text-sm">نشط</Label></div>
          </div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={() => saveMut.mutate()} disabled={!form.code || !form.nameAr}>{editId ? 'حفظ' : 'إنشاء'}</Button></DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
