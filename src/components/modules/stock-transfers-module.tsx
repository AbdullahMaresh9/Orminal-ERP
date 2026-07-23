'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeftRight, Plus, Pencil, Trash2, Download, CheckCircle, Clock, Package } from 'lucide-react'

export function StockTransfersModule() {
  const { t, isRTL, dir } = useT()
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
    <ModuleShell title={isRTL ? "تحويلات المخزون" : "Stock Transfers"} description={isRTL ? "تحويلات المخزون بين المستودعات" : "Transfer stock between storehouses"} icon={<ArrowLeftRight className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={() => setDialogOpen(true)} addLabel={isRTL ? "تحويل جديد" : "New Transfer"} onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title={isRTL ? "إجمالي التحويلات" : "Total Transfers"} value={String(rows.length)} icon={<ArrowLeftRight className="size-5" />} accent="blue" />
            <KpiCard title={isRTL ? "قيد النقل" : "In Transit"} value={String(rows.filter((r: any) => r.status === 'in_transit').length)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title={isRTL ? "مستلمة" : "Received"} value={String(rows.filter((r: any) => r.status === 'received' || r.status === 'done').length)} icon={<CheckCircle className="size-5" />} accent="sky" />
            <KpiCard title={isRTL ? "مسودات" : "Drafts"} value={String(rows.filter((r: any) => r.status === 'draft').length)} icon={<Package className="size-5" />} accent="violet" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>{isRTL ? "الرمز" : "Code"}</TableHead><TableHead>{isRTL ? "من مستودع" : "From Warehouse"}</TableHead><TableHead>{isRTL ? "إلى مستودع" : "To Warehouse"}</TableHead><TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead><TableHead>{isRTL ? "الحالة" : "Status"}</TableHead><TableHead className="text-end">{isRTL ? "إجراءات" : "Actions"}</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
              !rows.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">{isRTL ? "لا توجد تحويلات" : "No transfers found"}</TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                    <TableCell className="text-sm">{r.fromWarehouse?.nameAr || '—'}</TableCell>
                    <TableCell className="text-sm">{r.toWarehouse?.nameAr || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.transferDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell><div className="flex items-center justify-end gap-1">
                      {(r.status === 'in_transit' || r.status === 'approved') && <Button size="sm" variant="outline" onClick={() => receiveMut.mutate(r.id)}>{isRTL ? "استلام" : "Receive"}</Button>}
                    </div></TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table></ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-500/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ArrowLeftRight className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تحويل مخزني جديد' : 'New Stock Transfer'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid grid-cols-2 gap-4">
              <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'من مستودع (المصدر) *' : 'From Warehouse (Source) *'}</Label>
                <Input
                  value={form.fromWarehouseId}
                  onChange={e => setForm({ ...form, fromWarehouseId: e.target.value })}
                  placeholder={isRTL ? 'معرف المستودع' : 'Warehouse ID'}
                  dir={dir}
                  className={cn("h-10 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus-visible:ring-blue-500", isRTL ? "text-right" : "text-left")}
                />
              </div>
              <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'إلى مستودع (الوجهة) *' : 'To Warehouse (Destination) *'}</Label>
                <Input
                  value={form.toWarehouseId}
                  onChange={e => setForm({ ...form, toWarehouseId: e.target.value })}
                  placeholder={isRTL ? 'معرف المستودع' : 'Warehouse ID'}
                  dir={dir}
                  className={cn("h-10 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus-visible:ring-blue-500", isRTL ? "text-right" : "text-left")}
                />
              </div>
              <div className={cn("col-span-2 space-y-1.5", isRTL ? "text-right" : "text-left")}>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات التحويل' : 'Transfer Notes'}</Label>
                <Input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                  dir={dir}
                  className={cn("h-10 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950 focus-visible:ring-blue-500", isRTL ? "text-right" : "text-left")}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.fromWarehouseId || !form.toWarehouseId}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
            >
              {createMut.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء تحويل' : 'Create Transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
