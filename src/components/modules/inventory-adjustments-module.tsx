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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardCheck, Plus, Download, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export function InventoryAdjustmentsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<any>({ warehouseId: '', reason: '', notes: '' })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['inventory-adjustments', search],
    queryFn: async () => { const r = await fetch(`/api/erp/inventory-adjustments?q=${encodeURIComponent(search)}`); if (!r.ok) throw new Error(); return r.json() },
  })
  const rows = data?.data ?? []

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/inventory-adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم الإنشاء'); qc.invalidateQueries({ queryKey: ['inventory-adjustments'] }); setDialogOpen(false); setForm({ warehouseId: '', reason: '', notes: '' }) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const postMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/inventory-adjustments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'posted' }) }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم الترحيل'); qc.invalidateQueries({ queryKey: ['inventory-adjustments'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleExport = () => exportToCSV('inventory-adjustments', rows.map((r: any) => ({ code: r.code, warehouse: r.warehouse?.nameAr || '', date: r.adjustmentDate, reason: r.reason || '', status: r.status })))

  return (
    <ModuleShell title="تسويات المخزون" description="تسويات جرد المخزون" icon={<ClipboardCheck className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={() => setDialogOpen(true)} addLabel="تسوية جديدة" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي التسويات" value={String(rows.length)} icon={<ClipboardCheck className="size-5" />} accent="emerald" />
            <KpiCard title="مرحّلة" value={String(rows.filter((r:any)=>r.status==='posted').length)} icon={<CheckCircle className="size-5" />} accent="teal" />
            <KpiCard title="قيد المراجعة" value={String(rows.filter((r:any)=>['draft','counted','approved'].includes(r.status)).length)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title="ملغاة" value={String(rows.filter((r:any)=>r.status==='cancelled').length)} icon={<AlertTriangle className="size-5" />} accent="rose" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>المستودع</TableHead><TableHead>التاريخ</TableHead><TableHead>السبب</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:6}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
             !rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">لا توجد تسويات</TableCell></TableRow> :
             rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                <TableCell className="text-sm">{r.warehouse?.nameAr || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.adjustmentDate).toLocaleDateString('ar-SA')}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-48">{r.reason || r.notes || '—'}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell><div className="flex items-center justify-end gap-1">
                  {['draft','counted','approved'].includes(r.status) && <Button size="sm" variant="outline" onClick={() => postMut.mutate(r.id)}>ترحيل</Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>تسوية جديدة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div><Label className="text-xs mb-1.5 block">معرف المستودع *</Label><Input value={form.warehouseId} onChange={e => setForm({...form, warehouseId: e.target.value})} placeholder="معرف المستودع" /></div>
            <div><Label className="text-xs mb-1.5 block">السبب</Label><Input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} /></div>
            <div><Label className="text-xs mb-1.5 block">ملاحظات</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={() => createMut.mutate()} disabled={!form.warehouseId}>إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
