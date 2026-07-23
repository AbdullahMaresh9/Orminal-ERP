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
import { ScrollArea } from '@/components/ui/scroll-area'
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
  storehouse: { id: string; name: string; code: string }
}

interface CountItem {
  productId: string
  productName?: string
  systemQty: number
  countedQty: number
  diff: number
}

export function StockTakesModule() {
  const { t, isRTL, dir } = useT()
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
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-takes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-takes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const takes = takesData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/stock-takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'save failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء جلسة الجرد بنجاح')
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      setDialogOpen(false)
      setForm({ storehouseId: '', note: '' })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
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
        throw new Error(err.error || 'update failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم التحديث بنجاح')
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDetailTake(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openDetail(take: StockTake) {
    const parsed: any[] = JSON.parse(take.itemsJson || '[]')
    // Enrich with product name
    const enriched = parsed.map(it => ({
      ...it,
      productName: products.find(p => p.id === it.productId)?.name ?? it.productId,
    }))
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
    if (!form.storehouseId) return toast.error('المستودع مطلوب')
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
        storehouse: t.storehouse.name,
        items: parsed.length,
        totalDiff: parsed.reduce((s, x) => s + Number(x.diff ?? 0), 0),
        status: t.status,
      }
    }), [
      { key: 'code', label: 'الرمز' },
      { key: 'date', label: 'التاريخ' },
      { key: 'storehouse', label: 'المستودع' },
      { key: 'items', label: 'عدد العناصر' },
      { key: 'totalDiff', label: 'إجمالي الفرق' },
      { key: 'status', label: 'الحالة' },
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
      description="جرد المخزون ومطابقة الكميات"
      icon={<ClipboardList className="size-5" />}
      onAdd={() => { setForm({ storehouseId: '', note: '' }); setDialogOpen(true) }}
      addLabel="جرد جديد"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4  mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي عمليات الجرد" value={String(kpis.total)} icon={<ClipboardList className="size-5" />} accent="blue" />
            <KpiCard title="جلسات نشطة" value={String(kpis.draft)} icon={<ClipboardCheck className="size-5" />} accent="amber" />
            <KpiCard title="مكتملة" value={String(kpis.completed)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title="ملغية" value={String(kpis.cancelled)} icon={<XCircle className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead className="num-cell">عدد العناصر</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : takes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="size-10 mx-auto mb-2 opacity-50" />
                    لا يوجد جرد مخزون. ابدأ بإنشاء جرد جديد.
                  </TableCell>
                </TableRow>
              ) : takes.map(take => {
                const parsed = JSON.parse(take.itemsJson || '[]')
                return (
                  <TableRow key={take.id} className="cursor-pointer" onClick={() => openDetail(take)}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{take.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(take.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{take.storehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="num-cell text-xs"><span className="num">{parsed.length}</span></TableCell>
                    <TableCell className="text-end"><StatusBadge status={take.status} /></TableCell>
                    <TableCell className="text-end" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {take.status === 'draft' && (
                            <DropdownMenuItem onClick={() => openDetail(take)}>
                              <ClipboardCheck className="size-4 ms-2" /> فتح للجرد
                            </DropdownMenuItem>
                          )}
                          {take.status === 'draft' && (
                            <DropdownMenuItem className="text-rose-600" onClick={() => updateMutation.mutate({ id: take.id, body: { status: 'cancelled' } })}>
                              <XCircle className="size-4 ms-2" /> إلغاء
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

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
                  {isRTL ? 'جرد مخزني جديد' : 'New Stocktake'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-4">
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'المستودع المراد جرده *' : 'Storehouse to Count *'}
                  </Label>
                  <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue placeholder={isRTL ? 'اختر المستودع المستهدف' : 'Select target warehouse'} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات الجلسة' : 'Session Notes'}</Label>
                  <Textarea
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
                    rows={3}
                    dir={dir}
                    className={cn("border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    placeholder={isRTL ? 'مثال: جرد نهاية العام، جرد ربع سنوي لقسم الإلكترونيات...' : 'e.g. End of year count, quarterly electronics audit...'}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-855 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !form.storehouseId} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {createMutation.isPending ? (isRTL ? 'جاري البدء...' : 'Starting...') : (isRTL ? 'بدء جلسة الجرد' : 'Start Stocktake')}
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
                    {isRTL ? `جلسة جرد ${detailTake?.code}` : `Stocktake Session ${detailTake?.code}`}
                  </DialogTitle>
                  {detailTake && <StatusBadge status={detailTake.status} />}
                </div>
                <DialogDescription className="text-sm text-blue-800/80 dark:text-blue-100/90 font-normal leading-normal">
                  {detailTake?.storehouse.name} &middot; {detailTake?.status === 'draft' ? (isRTL ? 'يرجى إدخال وتعديل الكميات الفعلية المطابقة للواقع' : 'Please input counted quantities') : (isRTL ? 'عرض الكميات والفروقات للجلسة المكتملة' : 'View session details')}
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{isRTL ? 'إجمالي الأصناف' : 'Total Items'}</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white"><span className="num">{totalItems}</span></p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{isRTL ? 'أصناف غير مطابقة' : 'Discrepancies'}</p>
                    <p className={`text-xl font-bold ${mismatched > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}><span className="num">{mismatched}</span></p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 text-center shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">{isRTL ? 'صافي فرق الكميات' : 'Net Difference'}</p>
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
                      {isRTL ? 'كميات الأصناف والمطابقة' : 'Items & Quantities'}
                    </h3>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <Table className="table-sticky">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead className={cn("num-cell w-28 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'كمية النظام' : 'System Qty'}</TableHead>
                          <TableHead className={cn("num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية الفعلية' : 'Counted Qty'}</TableHead>
                          <TableHead className={cn("num-cell w-24 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الفرق' : 'Difference'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countItems.map((it, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100">{it.productName}</TableCell>
                            <TableCell className="num-cell text-xs font-medium text-slate-500"><span className="num">{formatNumber(it.systemQty, 0)}</span></TableCell>
                            <TableCell className="num-cell p-2">
                              <Input
                                type="number"
                                step="1"
                                value={it.countedQty}
                                onChange={e => updateCountItem(idx, Number(e.target.value))}
                                disabled={detailTake?.status !== 'draft'}
                                dir={dir}
                                className={cn("h-9 w-28 ms-auto border-slate-200 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}
                              />
                            </TableCell>
                            <TableCell className="num-cell text-sm">
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
                    <span className="text-xs text-amber-800 text-amber-350 font-bold block mb-1">{isRTL ? 'ملاحظات الجلسة' : 'Session Notes'}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{detailTake.note}</p>
                  </div>
                )}
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDetailTake(null)} className="h-10 px-5 border-slate-200 dark:border-slate-855 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                  {isRTL ? 'إغلاق' : 'Close'}
                </Button>
                {detailTake?.status === 'draft' && (
                  <Button type="button" onClick={completeTake} disabled={updateMutation.isPending} className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm">
                    {updateMutation.isPending ? (isRTL ? 'جاري الإكمال...' : 'Completing...') : (isRTL ? 'إكمال الجرد وتسوية الكميات' : 'Complete & Reconcile')}
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
