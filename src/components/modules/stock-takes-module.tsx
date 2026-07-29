'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatNumber, formatDate } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ClipboardList, Plus, CheckCircle2, XCircle, MoreVertical, Package, ClipboardCheck, AlertTriangle } from 'lucide-react'

interface StockTake {
  id: string
  code: string
  storehouseId: string
  status: string
  note: string | null
  itemsJson: string
  createdAt: string
  updatedAt: string
  storehouse: { id: string; name: string; nameAr?: string; nameEn?: string; code: string }
}

interface CountItem {
  productId: string
  productName?: string
  systemQty: number
  countedQty: number
  diff: number
}

// ثوابت حساب ارتفاع الجدول لعرض حوالي 6 صفوف مع جعل الرأس ثابتاً
const ROW_HEIGHT = 56
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 6
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

export function StockTakesModule() {
  const { t, isRTL, dir, locale } = useT()
  const lang = locale ?? (isRTL ? 'ar' : 'en')
  const L = (ar: string, en: string) => (lang === 'en' ? en : ar)

  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailTake, setDetailTake] = useState<StockTake | null>(null)
  const [form, setForm] = useState({ storehouseId: '', note: '' })
  const [countItems, setCountItems] = useState<CountItem[]>([])

  const { data: takesData, isLoading } = useQuery<{ data: StockTake[]; total: number }>({
    queryKey: ['stock-takes', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/stock-takes?${params}`)
      if (!r.ok) throw new Error(L('فشل تحميل بيانات الجرد المخزني', 'Failed to load stock takes data'))
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-takes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error(L('فشل تحميل المستودعات', 'Failed to load storehouses'))
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-takes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error(L('فشل تحميل المنتجات', 'Failed to load products'))
      return r.json()
    },
  })

  const takes = takesData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []

  const storehouseName = (s?: any) => {
    if (!s) return '—'
    return lang === 'en' ? (s.nameEn || s.nameAr || s.name) : (s.nameAr || s.nameEn || s.name)
  }

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/stock-takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل الحفظ', 'Save failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إنشاء جلسة الجرد بنجاح', 'Stocktake session created successfully'))
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      setDialogOpen(false)
      setForm({ storehouseId: '', note: '' })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const r = await fetch(`/api/erp/stock-takes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل التحديث', 'Update failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم التحديث بنجاح', 'Updated successfully'))
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDetailTake(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  function openDetail(take: StockTake) {
    const parsed: any[] = JSON.parse(take.itemsJson || '[]')
    // Enrich with localized product name
    const enriched = parsed.map(it => {
      const p = products.find(p => p.id === it.productId)
      const pName = p ? (lang === 'en' ? (p.nameEn || p.nameAr || p.name) : (p.nameAr || p.nameEn || p.name)) : it.productId
      return {
        ...it,
        productName: pName,
      }
    })
    setCountItems(enriched)
    setDetailTake(take)
  }

  function updateCountItem(idx: number, countedQty: number) {
    const next = [...countItems]
    next[idx] = { ...next[idx], countedQty, diff: countedQty - next[idx].systemQty }
    setCountItems(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.storehouseId) return toast.error(L('المستودع مطلوب', 'Storehouse is required'))
    createMutation.mutate(form)
  }

  function completeTake() {
    if (!detailTake) return
    updateMutation.mutate({ id: detailTake.id, body: { status: 'completed', items: countItems } })
  }

  function handleExport() {
    exportToCSV('stock-takes', takes.map(t => {
      const parsed: any[] = JSON.parse(t.itemsJson || '[]')
      return {
        code: t.code,
        date: formatDate(t.createdAt),
        storehouse: storehouseName(t.storehouse),
        items: parsed.length,
        totalDiff: parsed.reduce((s, x) => s + Number(x.diff ?? 0), 0),
        status: t.status,
      }
    }), [
      { key: 'code', label: L('الرمز', 'Code') },
      { key: 'date', label: L('التاريخ', 'Date') },
      { key: 'storehouse', label: L('المستودع', 'Storehouse') },
      { key: 'items', label: L('عدد العناصر', 'Items Count') },
      { key: 'totalDiff', label: L('إجمالي الفرق', 'Total Diff') },
      { key: 'status', label: L('الحالة', 'Status') },
    ])
  }

  const kpis = useMemo(() => {
    const total = takes.length
    const draft = takes.filter(t => t.status === 'draft').length
    const completed = takes.filter(t => t.status === 'completed').length
    const cancelled = takes.filter(t => t.status === 'cancelled').length
    return { total, draft, completed, cancelled }
  }, [takes])

  const totalDiff = countItems.reduce((s, it) => s + it.diff, 0)
  const totalItems = countItems.length
  const mismatched = countItems.filter(i => i.diff !== 0).length

  return (
    <ModuleShell
      title={t('module.stock-takes')}
      description={L('جرد المخزون ومطابقة الكميات', 'Inventory counting and stock reconciliation')}
      icon={<ClipboardList className="size-5" />}
      onAdd={() => { setForm({ storehouseId: '', note: '' }); setDialogOpen(true) }}
      addLabel={L('جرد جديد', 'New Stocktake')}
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={L('كل الحالات', 'All Statuses')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('كل الحالات', 'All Statuses')}</SelectItem>
            <SelectItem value="draft">{L('مسودة', 'Draft')}</SelectItem>
            <SelectItem value="completed">{L('مكتمل', 'Completed')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={L('إجمالي عمليات الجرد', 'Total Stocktakes')} value={String(kpis.total)} icon={<ClipboardList className="size-5" />} accent="blue" />
            <KpiCard title={L('جلسات نشطة', 'Active Sessions')} value={String(kpis.draft)} icon={<ClipboardCheck className="size-5" />} accent="amber" />
            <KpiCard title={L('مكتملة', 'Completed')} value={String(kpis.completed)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title={L('ملغية', 'Cancelled')} value={String(kpis.cancelled)} icon={<XCircle className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      {/* جدول الجرد المخزني — رأس ثابت + تمرير للصفوف فقط + أعمدة بعرض ثابت محاذية بدقة */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[14%]" />{/* الرمز */}
              <col className="w-[16%]" />{/* التاريخ */}
              <col className="w-[28%]" />{/* المستودع */}
              <col className="w-[14%]" />{/* عدد العناصر */}
              <col className="w-[14%]" />{/* الحالة */}
              <col className="w-[14%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المستودع', 'Storehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('عدد العناصر', 'Items')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="ps-4"><Skeleton className="h-6 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                    <TableCell className="pe-4"><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : takes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground border-b">
                    <ClipboardList className="size-10 mx-auto mb-2 opacity-50" />
                    {L('لا يوجد جرد مخزون. ابدأ بإنشاء جرد جديد.', 'No stock takes found. Start by creating a new stock take.')}
                  </TableCell>
                </TableRow>
              ) : takes.map(take => {
                const parsed = JSON.parse(take.itemsJson || '[]')
                return (
                  <TableRow key={take.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openDetail(take)}>
                    <TableCell className="ps-4 font-mono text-xs font-semibold text-primary truncate" dir="ltr">{take.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{formatDate(take.createdAt)}</TableCell>
                    <TableCell className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <Package className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{storehouseName(take.storehouse)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="num-cell text-center text-xs"><span className="num font-semibold" dir="ltr">{parsed.length}</span></TableCell>
                    <TableCell className="text-center"><StatusBadge status={take.status} /></TableCell>
                    <TableCell className="text-end pe-4" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          {take.status === 'draft' && (
                            <DropdownMenuItem onClick={() => openDetail(take)}>
                              <ClipboardCheck className="size-4 ms-2" /> {L('فتح للجرد', 'Open for Count')}
                            </DropdownMenuItem>
                          )}
                          {take.status === 'draft' && (
                            <DropdownMenuItem className="text-rose-600" onClick={() => updateMutation.mutate({ id: take.id, body: { status: 'cancelled' } })}>
                              <XCircle className="size-4 ms-2" /> {L('إلغاء', 'Cancel')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ClipboardList className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {L('جرد مخزني جديد', 'New Stocktake')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-4">
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {L('المستودع المراد جرده *', 'Storehouse to Count *')}
                  </Label>
                  <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue placeholder={L('اختر المستودع المستهدف', 'Select target storehouse')} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{storehouseName(s)} ({s.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('ملاحظات الجلسة', 'Session Notes')}</Label>
                  <Textarea
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
                    rows={3}
                    dir={dir}
                    className={cn("border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    placeholder={L('مثال: جرد نهاية العام، جرد ربع سنوي لقسم الإلكترونيات...', 'e.g. End of year count, quarterly electronics audit...')}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-855 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !form.storehouseId} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {createMutation.isPending ? L('جاري البدء...', 'Starting...') : L('بدء جلسة الجرد', 'Start Stocktake')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / Counting Dialog */}
      <Dialog open={!!detailTake} onOpenChange={(o) => !o && setDetailTake(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ClipboardCheck className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                    {L(`جلسة جرد ${detailTake?.code ?? ''}`, `Stocktake Session ${detailTake?.code ?? ''}`)}
                  </DialogTitle>
                  {detailTake && <StatusBadge status={detailTake.status} />}
                </div>
                <DialogDescription className="text-sm text-blue-800/80 dark:text-blue-100/90 font-normal leading-normal">
                  {storehouseName(detailTake?.storehouse)} &middot; {detailTake?.status === 'draft' ? L('يرجى إدخال وتعديل الكميات الفعلية المطابقة للواقع', 'Please input counted quantities matching physical stock') : L('عرض الكميات والفروقات للجلسة المكتملة', 'View session details and quantity differences')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailTake && (
            <div className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                {/* Stats indicators */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{L('إجمالي الأصناف', 'Total Items')}</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white"><span className="num">{totalItems}</span></p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{L('أصناف غير مطابقة', 'Discrepancies')}</p>
                    <p className={`text-xl font-bold ${mismatched > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}><span className="num">{mismatched}</span></p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{L('صافي فرق الكميات', 'Net Difference')}</p>
                    <p className={`text-xl font-bold ${totalDiff !== 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      <span className="num">{totalDiff > 0 ? '+' : ''}{formatNumber(totalDiff, 0)}</span>
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Package className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {L('كميات الأصناف والمطابقة', 'Items & Quantities')}
                    </h3>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm max-h-[300px] overflow-y-auto">
                    <Table className="table-fixed border-separate border-spacing-0 w-full">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300 ps-4", isRTL ? "text-right" : "text-left")}>{L('المنتج', 'Product')}</TableHead>
                          <TableHead className={cn("num-cell w-28 text-xs font-semibold text-slate-700 dark:text-slate-300 text-center")}>{L('كمية النظام', 'System Qty')}</TableHead>
                          <TableHead className={cn("num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300 text-center")}>{L('الكمية الفعلية', 'Counted Qty')}</TableHead>
                          <TableHead className={cn("num-cell w-24 text-xs font-semibold text-slate-700 dark:text-slate-300 pe-4 text-end")}>{L('الفرق', 'Difference')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countItems.map((it, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100 ps-4">{it.productName}</TableCell>
                            <TableCell className="num-cell text-xs font-medium text-slate-500 text-center"><span className="num">{formatNumber(it.systemQty, 0)}</span></TableCell>
                            <TableCell className="num-cell p-2 text-center">
                              <Input
                                type="number"
                                step="1"
                                value={it.countedQty}
                                onChange={e => updateCountItem(idx, Number(e.target.value))}
                                disabled={detailTake?.status !== 'draft'}
                                dir={dir}
                                className={cn("h-9 w-28 mx-auto border-slate-200 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-950 text-center")}
                              />
                            </TableCell>
                            <TableCell className="num-cell text-sm pe-4 text-end">
                              <span className={`num font-semibold ${it.diff > 0 ? 'text-blue-600 dark:text-blue-400' : it.diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                {it.diff > 0 ? '+' : ''}{formatNumber(it.diff, 0)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Note displays */}
                {detailTake?.note && (
                  <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-xl">
                    <span className="text-xs text-amber-800 dark:text-amber-300 font-bold block mb-1">{L('ملاحظات الجلسة', 'Session Notes')}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{detailTake.note}</p>
                  </div>
                )}
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDetailTake(null)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                  {L('إغلاق', 'Close')}
                </Button>
                {detailTake?.status === 'draft' && (
                  <Button type="button" onClick={completeTake} disabled={updateMutation.isPending} className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm">
                    {updateMutation.isPending ? L('جاري الإكمال...', 'Completing...') : L('إكمال الجرد وتسوية الكميات', 'Complete & Reconcile')}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
