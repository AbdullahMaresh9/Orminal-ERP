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
import { ArrowLeftRight, Plus, Pencil, Trash2, Download, CheckCircle, Clock, Package } from 'lucide-react'

export function StockTransfersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<any>({ fromWarehouseId: '', toWarehouseId: '', notes: '' })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['stock-transfers', search],
    queryFn: async () => { const r = await fetch(`/api/erp/stock-transfers?q=${encodeURIComponent(search)}`); if (!r.ok) throw new Error(); return r.json() },
  })
  const rows = data?.data ?? []

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/stock-transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم الإنشاء'); qc.invalidateQueries({ queryKey: ['stock-transfers'] }); setDialogOpen(false); setForm({ fromWarehouseId: '', toWarehouseId: '', notes: '' }) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const receiveMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/stock-transfers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'received' }) }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم الاستلام'); qc.invalidateQueries({ queryKey: ['stock-transfers'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleExport = () => exportToCSV('stock-transfers', rows.map((r: any) => ({ code: r.code, from: r.fromWarehouse?.nameAr || '', to: r.toWarehouse?.nameAr || '', date: r.transferDate, status: r.status })))

  return (
    <ModuleShell title="تحويلات المخزون" description="تحويلات المخزون بين المستودعات" icon={<ArrowLeftRight className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={() => setDialogOpen(true)} addLabel="تحويل جديد" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي التحويلات" value={String(rows.length)} icon={<ArrowLeftRight className="size-5" />} accent="emerald" />
            <KpiCard title="قيد النقل" value={String(rows.filter((r:any)=>r.status==='in_transit').length)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title="مستلمة" value={String(rows.filter((r:any)=>r.status==='received'||r.status==='done').length)} icon={<CheckCircle className="size-5" />} accent="teal" />
            <KpiCard title="مسودات" value={String(rows.filter((r:any)=>r.status==='draft').length)} icon={<Package className="size-5" />} accent="violet" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>من مستودع</TableHead><TableHead>إلى مستودع</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:6}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
             !rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">لا توجد تحويلات</TableCell></TableRow> :
             rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                <TableCell className="text-sm">{r.fromWarehouse?.nameAr || '—'}</TableCell>
                <TableCell className="text-sm">{r.toWarehouse?.nameAr || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.transferDate).toLocaleDateString('ar-SA')}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell><div className="flex items-center justify-end gap-1">
                  {(r.status === 'in_transit' || r.status === 'approved') && <Button size="sm" variant="outline" onClick={() => receiveMut.mutate(r.id)}>استلام</Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>تحويل جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs mb-1.5 block">من مستودع *</Label><Input value={form.fromWarehouseId} onChange={e => setForm({...form, fromWarehouseId: e.target.value})} placeholder="معرف المستودع" /></div>
            <div><Label className="text-xs mb-1.5 block">إلى مستودع *</Label><Input value={form.toWarehouseId} onChange={e => setForm({...form, toWarehouseId: e.target.value})} placeholder="معرف المستودع" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1.5 block">ملاحظات</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={() => createMut.mutate()} disabled={!form.fromWarehouseId || !form.toWarehouseId}>إنشاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
