'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardCheck, Plus, CheckCircle, Clock, AlertTriangle, Boxes, FileText } from 'lucide-react'

export function InventoryAdjustmentsModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<any>({ warehouseId: '', reason: '', notes: '' })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['inventory-adjustments', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/inventory-adjustments?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error()
      return r.json()
    },
  })
  const rows = data?.data ?? []

  // Fetch storehouses for dropdown select
  const { data: storehousesRes } = useQuery<any>({
    queryKey: ['storehouses'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })
  const storehouses = storehousesRes?.data ?? []

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/inventory-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'error')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم إنشاء التسوية بنجاح' : 'Adjustment created successfully')
      qc.invalidateQueries({ queryKey: ['inventory-adjustments'] })
      setDialogOpen(false)
      setForm({ warehouseId: '', reason: '', notes: '' })
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ أثناء الإنشاء' : 'Error creating adjustment')),
  })

  const postMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/inventory-adjustments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'posted' }),
      })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الترحيل وتحديث المخزون' : 'Adjustment posted and stock updated')
      qc.invalidateQueries({ queryKey: ['inventory-adjustments'] })
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ أثناء الترحيل' : 'Error posting adjustment'),
  })

  const handleExport = () =>
    exportToCSV(
      'inventory-adjustments',
      rows.map((r: any) => ({
        code: r.code,
        warehouse: r.warehouse?.nameAr || r.warehouse?.name || '',
        date: r.adjustmentDate,
        reason: r.reason || '',
        status: r.status,
      }))
    )

  return (
    <ModuleShell
      title={isRTL ? 'تسويات المخزون' : 'Stock Adjustments'}
      description={isRTL ? 'إجراء تسويات مخزنية وتصحيح الفروقات' : 'Manage inventory adjustments and reconcile stock differences'}
      icon={<ClipboardCheck className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      onAdd={() => setDialogOpen(true)}
      addLabel={isRTL ? 'تسوية جديدة' : 'New Adjustment'}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={isRTL ? 'إجمالي التسويات' : 'Total Adjustments'} value={String(rows.length)} icon={<ClipboardCheck className="size-5" />} accent="blue" />
            <KpiCard title={isRTL ? 'مرحّلة' : 'Posted'} value={String(rows.filter((r: any) => r.status === 'posted').length)} icon={<CheckCircle className="size-5" />} accent="sky" />
            <KpiCard title={isRTL ? 'قيد المراجعة' : 'Pending Review'} value={String(rows.filter((r: any) => ['draft', 'counted', 'approved'].includes(r.status)).length)} icon={<Clock className="size-5" />} accent="amber" />
            <KpiCard title={isRTL ? 'ملغاة' : 'Cancelled'} value={String(rows.filter((r: any) => r.status === 'cancelled').length)} icon={<AlertTriangle className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'الرمز' : 'Code'}</TableHead>
                <TableHead>{isRTL ? 'المستودع' : 'Warehouse'}</TableHead>
                <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-6" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    {isRTL ? 'لا توجد تسويات مخزنية مسجلة' : 'No stock adjustments recorded'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                    <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{r.code}</TableCell>
                    <TableCell className="text-sm">{r.warehouse?.name || r.warehouse?.nameAr || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {isRTL ? new Date(r.adjustmentDate).toLocaleDateString('ar-SA') : new Date(r.adjustmentDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-48">{r.reason || r.notes || '—'}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {['draft', 'counted', 'approved'].includes(r.status) && (
                          <Button size="sm" variant="outline" className="h-8 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => postMut.mutate(r.id)}>
                            {isRTL ? 'ترحيل' : 'Post'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-blue-500/30" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ClipboardCheck className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'إنشاء تسوية مخزنية جديدة' : 'New Stock Adjustment'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate() }} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200 dark:border-slate-800/60">
                  <Boxes className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'تفاصيل المستودع والسبب' : 'Warehouse & Reason Details'}
                  </h3>
                </div>

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'المستودع المستهدف *' : 'Target Warehouse *'}
                  </Label>
                  <Select value={form.warehouseId} onValueChange={v => setForm({ ...form, warehouseId: v })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue placeholder={isRTL ? 'اختر المستودع' : 'Select warehouse'} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      {storehouses.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'السبب الرئيسي للتسوية' : 'Reason for Adjustment'}
                  </Label>
                  <div className="relative">
                    <AlertTriangle className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                    <Input
                      value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })}
                      placeholder={isRTL ? 'مثال: جرد سنوي، بضاعة تالفة، الخ...' : 'e.g. Annual stocktake, damaged items, etc.'}
                      dir={dir}
                      className={cn("h-10 ps-9border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>
                </div>

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'ملاحظات وتفاصيل إضافية' : 'Additional Notes / Remarks'}
                  </Label>
                  <div className="relative">
                    <FileText className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                    <Input
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder={isRTL ? 'تفاصيل إضافية حول التعديل...' : 'Any further details...'}
                      dir={dir}
                      className={cn("h-10 ps-9border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-blue-500/30/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5border-slate-250 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={createMut.isPending || !form.warehouseId} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {createMut.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء التسوية' : 'Create Adjustment')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
