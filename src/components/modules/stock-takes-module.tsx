'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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
  const { t } = useT()
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي عمليات الجرد" value={String(kpis.total)} icon={<ClipboardList className="size-5" />} accent="emerald" />
            <KpiCard title="جلسات نشطة" value={String(kpis.draft)} icon={<ClipboardCheck className="size-5" />} accent="amber" />
            <KpiCard title="مكتملة" value={String(kpis.completed)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
            <KpiCard title="ملغية" value={String(kpis.cancelled)} icon={<XCircle className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead className="text-end">عدد العناصر</TableHead>
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
                    لا توجد جلسات جرد. ابدأ بإنشاء جلسة جديدة.
                  </TableCell>
                </TableRow>
              ) : takes.map(take => {
                const parsed = JSON.parse(take.itemsJson || '[]')
                return (
                  <TableRow key={take.id} className="cursor-pointer" onClick={() => openDetail(take)}>
                    <TableCell className="font-mono text-xs">{take.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(take.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{take.storehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{parsed.length}</TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>جرد مخزون جديد</DialogTitle>
            <DialogDescription>سيتم تحميل الأصناف الحالية تلقائياً عند الإنشاء</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="space-y-1.5">
              <Label>المستودع *</Label>
              <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                <SelectContent>
                  {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الجرد'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / Counting Dialog */}
      <Dialog open={!!detailTake} onOpenChange={(o) => !o && setDetailTake(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>جرد {detailTake?.code}</DialogTitle>
            <DialogDescription>
              {detailTake?.storehouse.name} · {detailTake?.status === 'draft' ? 'أدخل الكميات الفعلية' : 'عرض الجرد'}
            </DialogDescription>
          </DialogHeader>
          {detailTake && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">عدد الأصناف</p>
                  <p className="text-xl font-bold tabular-nums">{totalItems}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">اختلافات</p>
                  <p className={`text-xl font-bold tabular-nums ${mismatched > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{mismatched}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">صافي الفرق</p>
                  <p className={`text-xl font-bold tabular-nums ${totalDiff !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {totalDiff > 0 ? '+' : ''}{formatNumber(totalDiff, 0)}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="text-end">كمية النظام</TableHead>
                      <TableHead className="text-end">الكمية الفعلية</TableHead>
                      <TableHead className="text-end">الفرق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countItems.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{it.productName}</TableCell>
                        <TableCell className="text-end tabular-nums text-muted-foreground">{formatNumber(it.systemQty, 0)}</TableCell>
                        <TableCell className="text-end">
                          <Input
                            type="number"
                            step="1"
                            value={it.countedQty}
                            onChange={e => updateCountItem(idx, Number(e.target.value))}
                            disabled={detailTake.status !== 'draft'}
                            className="w-24 ms-auto text-end"
                          />
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          <span className={it.diff > 0 ? 'text-emerald-600 font-bold' : it.diff < 0 ? 'text-rose-600 font-bold' : 'text-muted-foreground'}>
                            {it.diff > 0 ? '+' : ''}{formatNumber(it.diff, 0)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailTake(null)}>إغلاق</Button>
                {detailTake.status === 'draft' && (
                  <Button onClick={completeTake} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'جاري الإكمال...' : 'إكمال الجرد وتسوية المخزون'}
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
