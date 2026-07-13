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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarClock, Plus, Download, Lock, Unlock, CheckCircle, AlertCircle } from 'lucide-react'

export function FiscalPeriodsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<any>({ name: '', startDate: '', endDate: '' })

  const { data: yearsData, isLoading } = useQuery<any>({
    queryKey: ['fiscal-years'],
    queryFn: async () => { const r = await fetch('/api/erp/fiscal-years'); if (!r.ok) throw new Error(); return r.json() },
  })
  const years = yearsData?.data ?? []
  const periods = years.flatMap((y: any) => (y.periods || []).map((p: any) => ({ ...p, fiscalYearName: y.name })))

  const createYearMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/fiscal-years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, startDate: form.startDate, endDate: form.endDate }) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم إنشاء السنة المالية'); qc.invalidateQueries({ queryKey: ['fiscal-years'] }); setDialogOpen(false); setForm({ name: '', startDate: '', endDate: '' }) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const updatePeriodMut = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const r = await fetch(`/api/erp/fiscal-periods/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) })
      if (!r.ok) throw new Error(); return r.json()
    },
    onSuccess: () => { toast.success('تم التحديث'); qc.invalidateQueries({ queryKey: ['fiscal-years'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleExport = () => exportToCSV('fiscal-periods', periods.map((p: any) => ({ year: p.fiscalYearName, period: p.name, start: new Date(p.startDate).toLocaleDateString('en-CA'), end: new Date(p.endDate).toLocaleDateString('en-CA'), quarter: p.quarter || '', state: p.state })))

  return (
    <ModuleShell title="الفترات المالية" description="إدارة السنوات والفترات المالية" icon={<CalendarClock className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={() => setDialogOpen(true)} addLabel="سنة مالية" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="السنوات المالية" value={String(years.length)} icon={<CalendarClock className="size-5" />} accent="blue" />
            <KpiCard title="فترات مفتوحة" value={String(periods.filter((p:any)=>p.state==='open').length)} icon={<Unlock className="size-5" />} accent="sky" />
            <KpiCard title="فترات مغلقة" value={String(periods.filter((p:any)=>p.state==='closed').length)} icon={<Lock className="size-5" />} accent="amber" />
            <KpiCard title="فترات مقفلة" value={String(periods.filter((p:any)=>p.state==='locked').length)} icon={<AlertCircle className="size-5" />} accent="rose" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>السنة</TableHead><TableHead>الفترة</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الربع</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:7}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
             !periods.length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">لا توجد فترات</TableCell></TableRow> :
             periods.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-semibold">{p.fiscalYearName}</TableCell>
                <TableCell className="text-sm">{p.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(p.startDate).toLocaleDateString('en-CA')}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(p.endDate).toLocaleDateString('en-CA')}</TableCell>
                <TableCell className="text-xs">Q{p.quarter || '—'}</TableCell>
                <TableCell><StatusBadge status={p.state} /></TableCell>
                <TableCell><div className="flex items-center justify-end gap-1">
                  {p.state === 'open' && <Button size="sm" variant="outline" onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'closed' })}>إغلاق</Button>}
                  {p.state === 'closed' && <Button size="sm" variant="outline" onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'locked' })}>قفل</Button>}
                  {(p.state === 'closed' || p.state === 'locked') && <Button size="sm" variant="outline" onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'open' })}>فتح</Button>}
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>سنة مالية جديدة</DialogTitle></DialogHeader>
          <DialogBody>          <DialogBody>          <div className="grid grid-cols-1 gap-4 py-2">
            <div><Label className="text-xs mb-1.5 block">اسم السنة *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="2026" /></div>
            <div><Label className="text-xs mb-1.5 block">تاريخ البداية *</Label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
            <div><Label className="text-xs mb-1.5 block">تاريخ النهاية *</Label><Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
          </div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={() => createYearMut.mutate()} disabled={!form.name || !form.startDate || !form.endDate}>إنشاء</Button></DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
