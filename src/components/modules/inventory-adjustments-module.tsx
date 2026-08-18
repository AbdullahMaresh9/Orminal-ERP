'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportRows, ExportColumn, ExportMeta, ExportFormat } from '@/lib/export'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ClipboardCheck, CheckCircle, Clock, AlertTriangle, Boxes, FileText,
  Download, FileSpreadsheet, FileCheck, ChevronDown
} from 'lucide-react'

//  أبعاد الجدول وحساب الارتفاع الثابت لخمسة صفوف تماشياً مع نمط مرتجعات المشتريات
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 6
const ROW_HEIGHT = 52
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function InventoryAdjustmentsModule() {
  const { isRTL, dir } = useT()
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

  const statusLabel = (status: string) => {
    switch (status) {
      case 'posted':
        return isRTL ? 'مرحّلة' : 'Posted'
      case 'draft':
        return isRTL ? 'مسودة' : 'Draft'
      case 'counted':
        return isRTL ? 'قيد العد' : 'Counted'
      case 'approved':
        return isRTL ? 'معتمدة' : 'Approved'
      case 'cancelled':
        return isRTL ? 'ملغاة' : 'Cancelled'
      default:
        return status
    }
  }

  // إعدادات التصدير الموحدة عالية الجودة مع محاذاة الخلايا في الوسط لتطابق عناوين الأعمدة
  const exportColumns: ExportColumn<any>[] = [
    {
      key: 'code',
      header: isRTL ? 'الرمز' : 'Code',
      width: 18,
      align: 'center',
      type: 'text',
      value: (r) => r.code,
    },
    {
      key: 'warehouse',
      header: isRTL ? 'المستودع' : 'Warehouse',
      width: 25,
      align: 'center',
      type: 'text',
      value: (r) => r.warehouse?.nameAr || r.warehouse?.name || r.warehouse?.code || '—',
    },
    {
      key: 'date',
      header: isRTL ? 'التاريخ' : 'Date',
      width: 18,
      align: 'center',
      type: 'date',
      value: (r) => (r.adjustmentDate ? new Date(r.adjustmentDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—'),
      dateValue: (r) => r.adjustmentDate,
    },
    {
      key: 'reason',
      header: isRTL ? 'السبب' : 'Reason',
      width: 25,
      align: 'center',
      type: 'text',
      value: (r) => r.reason || r.notes || '—',
    },
    {
      key: 'status',
      header: isRTL ? 'الحالة' : 'Status',
      width: 14,
      align: 'center',
      type: 'text',
      value: (r) => statusLabel(r.status),
    },
  ]

  const exportMeta: ExportMeta = {
    fileName: isRTL ? 'تسويات-المخزون' : 'inventory-adjustments',
    title: isRTL ? 'تقرير تسويات المخزون' : 'Stock Adjustments Report',
    subtitle: isRTL ? 'أورمنال' : 'Orminal ERP',
    isRTL,
    summary: [
      { label: isRTL ? 'إجمالي التسويات' : 'Total Adjustments', value: String(rows.length) },
      { label: isRTL ? 'مرحّلة' : 'Posted', value: String(rows.filter((r: any) => r.status === 'posted').length) },
      { label: isRTL ? 'قيد المراجعة' : 'Pending Review', value: String(rows.filter((r: any) => ['draft', 'counted', 'approved'].includes(r.status)).length) },
      { label: isRTL ? 'ملغاة' : 'Cancelled', value: String(rows.filter((r: any) => r.status === 'cancelled').length) },
    ],
    labels: {
      generatedAt: isRTL ? 'تاريخ الإنشاء' : 'Generated',
      totalRecords: isRTL ? 'عدد السجلات' : 'Records',
      grandTotal: isRTL ? 'الإجمالي' : 'Total',
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!rows.length) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }
    try {
      await exportRows(format, rows, exportColumns, exportMeta)
      toast.success(isRTL ? 'تم التصدير بنجاح' : 'Export completed successfully')
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed'))
    }
  }

  return (
    <ModuleShell
      title={isRTL ? 'تسويات المخزون' : 'Stock Adjustments'}
      description={isRTL ? 'إجراء تسويات مخزنية وتصحيح الفروقات' : 'Manage inventory adjustments and reconcile stock differences'}
      icon={<ClipboardCheck className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      onAdd={() => setDialogOpen(true)}
      addLabel={isRTL ? 'تسوية جديدة' : 'New Adjustment'}
      actions={
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 font-medium border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isRTL ? 'التصدير' : 'Export'}</span>
              <ChevronDown className="size-4 text-slate-400 ms-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} className="w-30 z-50">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>{isRTL ? 'تصدير إكسل' : 'Export Excel'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileText className="size-4 text-sky-600" />
              <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer text-xs font-medium">
              <FileCheck className="size-4 text-rose-600" />
              <span>{isRTL ? 'تصدير PDF' : 'Export PDF'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
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

      {/* جدول تسويات المخزون — رأس ثابت + تمرير للصفوف فقط + محاذاة دقيقة بالأعمدة تماشياً مع جدول مرتجعات المشتريات */}
      <Card className="rounded-xl overflow-hidden border border-border">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[850px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[15%]" />{/* الرمز */}
              <col className="w-[25%]" />{/* المستودع */}
              <col className="w-[15%]" />{/* التاريخ */}
              <col className="w-[23%]" />{/* السبب */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[10%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{isRTL ? 'الرمز' : 'Code'}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? 'المستودع' : 'Warehouse'}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground border-b">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground border-b">
                    {isRTL ? 'لا توجد تسويات مخزنية مسجلة' : 'No stock adjustments recorded'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 align-middle">
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 border-b truncate" title={r.code}>
                      {r.code}
                    </TableCell>
                    <TableCell className="text-sm font-medium border-b truncate" title={r.warehouse?.name || r.warehouse?.nameAr || '—'}>
                      {r.warehouse?.name || r.warehouse?.nameAr || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-center whitespace-nowrap border-b">
                      {isRTL ? new Date(r.adjustmentDate).toLocaleDateString('ar-SA') : new Date(r.adjustmentDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground border-b truncate" title={r.reason || r.notes || '—'}>
                      {r.reason || r.notes || '—'}
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="pe-4 text-end border-b">
                      <div className="flex items-center justify-end gap-1">
                        {['draft', 'counted', 'approved'].includes(r.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={() => postMut.mutate(r.id)}
                          >
                            {isRTL ? 'ترحيل' : 'Post'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </Card>

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
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                      className={cn("h-10 ps-9 border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
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
                      className={cn("h-10 ps-9 border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-blue-500/30/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-250 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
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
