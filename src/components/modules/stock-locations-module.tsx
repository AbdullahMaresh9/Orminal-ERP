'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { MapPin, Plus, Pencil, Trash2, Download, CheckCircle, Layers, Building2 } from 'lucide-react'

export function StockLocationsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ code: '', nameAr: '', nameEn: '', warehouseId: '', type: 'internal', active: true })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['stock-locations', search],
    queryFn: async () => { const r = await fetch(`/api/erp/stock-locations?q=${encodeURIComponent(search)}`); if (!r.ok) throw new Error(); return r.json() },
  })

  const rows = data?.data ?? []

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/erp/stock-locations/${editId}` : '/api/erp/stock-locations'
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم الحفظ'); qc.invalidateQueries({ queryKey: ['stock-locations'] }); setDialogOpen(false); setEditId(null) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/stock-locations/${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['stock-locations'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleAdd = () => { setForm({ code: '', nameAr: '', nameEn: '', warehouseId: '', type: 'internal', active: true }); setEditId(null); setDialogOpen(true) }
  const handleEdit = (r: any) => { setForm({ code: r.code, nameAr: r.nameAr, nameEn: r.nameEn || '', warehouseId: r.warehouseId || '', type: r.type || 'internal', active: r.active }); setEditId(r.id); setDialogOpen(true) }
  const handleExport = () => exportToCSV('stock-locations', rows.map((r: any) => ({ code: r.code, nameAr: r.nameAr, warehouse: r.warehouse?.nameAr || '', type: r.type, active: r.active ? 'نشط' : 'غير نشط' })))

  const typeLabels: Record<string, string> = { internal: 'داخلي', supplier: 'مورد', customer: 'عميل', transit: 'عبور', loss: 'خسائر', production: 'إنتاج' }

  return (
    <ModuleShell title="مواقع التخزين" description="مواقع التخزين داخل المستودعات" icon={<MapPin className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={handleAdd} addLabel="موقع جديد" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2 mb-2">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي المواقع" value={String(rows.length)} icon={<MapPin className="size-5" />} accent="blue" />
            <KpiCard title="داخلية" value={String(rows.filter((r: any) => r.type === 'internal').length)} icon={<Layers className="size-5" />} accent="sky" />
            <KpiCard title="نشطة" value={String(rows.filter((r: any) => r.active).length)} icon={<CheckCircle className="size-5" />} accent="violet" />
            <KpiCard title="بالمستودعات" value={String(new Set(rows.map((r: any) => r.warehouseId).filter(Boolean)).size)} icon={<Building2 className="size-5" />} accent="amber" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>الاسم</TableHead><TableHead>المستودع</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
              !rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">لا توجد مواقع</TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                    <TableCell className="font-medium text-sm">{r.nameAr}</TableCell>
                    <TableCell className="text-sm">{r.warehouse?.nameAr || '—'}</TableCell>
                    <TableCell className="text-sm">{typeLabels[r.type] || r.type}</TableCell>
                    <TableCell><StatusBadge status={r.active ? 'active' : 'inactive'} /></TableCell>
                    <TableCell><div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(r)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => delMut.mutate(r.id)}><Trash2 className="size-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editId ? 'تعديل موقع' : 'موقع جديد'}</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-4 py-2 text-start">
              <div><Label className="text-xs mb-1.5 block">الرمز *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="STOCK" /></div>
              <div><Label className="text-xs mb-1.5 block">الاسم (عربي) *</Label><Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} /></div>
              <div><Label className="text-xs mb-1.5 block">الاسم (إنجليزي)</Label><Input value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></div>
              <div><Label className="text-xs mb-1.5 block">النوع</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="internal">داخلي</SelectItem><SelectItem value="supplier">مورد</SelectItem><SelectItem value="customer">عميل</SelectItem>
                  <SelectItem value="transit">عبور</SelectItem><SelectItem value="loss">خسائر</SelectItem><SelectItem value="production">إنتاج</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="col-span-2 flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label className="text-sm">نشط</Label></div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.code || !form.nameAr}>{editId ? 'حفظ' : 'إنشاء'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
