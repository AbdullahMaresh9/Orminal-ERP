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
import { Truck, Plus, Download, CheckCircle, Clock, Package } from 'lucide-react'

export function DeliveriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<any>({
    queryKey: ['deliveries', search],
    queryFn: async () => { const r = await fetch(`/api/erp/deliveries?q=${encodeURIComponent(search)}`); if (!r.ok) throw new Error(); return r.json() },
  })
  const rows = data?.data ?? []

  const validateMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/deliveries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم التسليم'); qc.invalidateQueries({ queryKey: ['deliveries'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleExport = () => exportToCSV('deliveries', rows.map((r: any) => ({ code: r.code, partner: r.partner?.nameAr || '', date: r.deliveryDate, status: r.status })))

  return (
    <ModuleShell title="التسليمات" description="تسليمات المبيعات للعملاء" icon={<Truck className="size-5" />} onSearch={setSearch} searchValue={search} onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي التسليمات" value={String(rows.length)} icon={<Truck className="size-5" />} accent="blue" />
            <KpiCard title="مكتملة" value={String(rows.filter((r:any)=>r.status==='done').length)} icon={<CheckCircle className="size-5" />} accent="sky" />
            <KpiCard title="قيد التنفيذ" value={String(rows.filter((r:any)=>['draft','waiting','picked','packed'].includes(r.status)).length)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title="ملغاة" value={String(rows.filter((r:any)=>r.status==='cancelled').length)} icon={<Package className="size-5" />} accent="rose" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>العميل</TableHead><TableHead>المستودع</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:6}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
             !rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">لا توجد تسليمات</TableCell></TableRow> :
             rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                <TableCell className="text-sm">{r.partner?.nameAr || '—'}</TableCell>
                <TableCell className="text-sm">{r.warehouse?.nameAr || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.deliveryDate).toLocaleDateString('ar-SA')}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell><div className="flex items-center justify-end gap-1">
                  {['draft','waiting','picked','packed'].includes(r.status) && <Button size="sm" variant="outline" onClick={() => validateMut.mutate(r.id)}>تسليم</Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
    </ModuleShell>
  )
}
