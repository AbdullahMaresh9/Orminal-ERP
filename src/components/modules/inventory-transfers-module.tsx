'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatDate } from '@/lib/format'
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
import { cn } from '@/lib/utils'
import { ArrowLeftRight, Plus, Trash2, CheckCircle2, XCircle, MoreVertical, Package, Truck } from 'lucide-react'

interface Transfer {
  id: string
  code: string
  fromStorehouseId: string
  toStorehouseId: string
  status: string
  itemsJson: string
  note: string | null
  createdAt: string
  updatedAt: string
  fromStorehouse: { id: string; name: string; code: string }
  toStorehouse: { id: string; name: string; code: string }
}

export function InventoryTransfersModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null)
  const [form, setForm] = useState({
    fromStorehouseId: '',
    toStorehouseId: '',
    note: '',
    status: 'draft' as 'draft' | 'in_transit',
  })
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([])

  const { data: transfersData, isLoading } = useQuery<{ data: Transfer[]; total: number }>({
    queryKey: ['inventory-transfers', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/inventory-transfers?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-transfers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-transfers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const transfers = transfersData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-transfers', {
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
      toast.success('تم إنشاء التحويل بنجاح')
      qc.invalidateQueries({ queryKey: ['inventory-transfers'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const r = await fetch(`/api/erp/inventory-transfers/${id}`, {
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
      qc.invalidateQueries({ queryKey: ['inventory-transfers'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDetailTransfer(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function resetForm() {
    setForm({ fromStorehouseId: '', toStorehouseId: '', note: '', status: 'draft' })
    setItems([])
  }
  function addItem() {
    setItems([...items, { productId: '', quantity: 1 }])
  }
  function updateItem(idx: number, field: 'productId' | 'quantity', value: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: value }
    setItems(next)
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fromStorehouseId || !form.toStorehouseId) return toast.error('المستودع المصدر والوجهة مطلوبان')
    if (form.fromStorehouseId === form.toStorehouseId) return toast.error('لا يمكن التحويل لنفس المستودع')
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) return toast.error('أضف عنصراً واحداً على الأقل')
    saveMutation.mutate({ ...form, items: validItems })
  }
  function handleExport() {
    exportToCSV('inventory-transfers', transfers.map(tr => {
      const parsed = JSON.parse(tr.itemsJson || '[]')
      return {
        code: tr.code,
        date: formatDate(tr.createdAt),
        from: tr.fromStorehouse.name,
        to: tr.toStorehouse.name,
        itemsCount: parsed.length,
        totalQty: parsed.reduce((s: number, x: any) => s + Number(x.quantity ?? 0), 0),
        status: tr.status,
      }
    }), [
      { key: 'code', label: 'الرمز' },
      { key: 'date', label: 'التاريخ' },
      { key: 'from', label: 'من' },
      { key: 'to', label: 'إلى' },
      { key: 'itemsCount', label: 'عدد العناصر' },
      { key: 'totalQty', label: 'إجمالي الكمية' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  const kpis = useMemo(() => {
    const total = transfers.length
    const inTransit = transfers.filter(t => t.status === 'in_transit').length
    const received = transfers.filter(t => t.status === 'received').length
    const draft = transfers.filter(t => t.status === 'draft').length
    return { total, inTransit, received, draft }
  }, [transfers])

  return (
    <ModuleShell
      title={t('module.inventory-transfers')}
      description="تحويلات المخزون بين المستودعات"
      icon={<ArrowLeftRight className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel="تحويل جديد"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="in_transit">قيد النقل</SelectItem>
            <SelectItem value="received">مستلم</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي التحويلات" value={String(kpis.total)} icon={<ArrowLeftRight className="size-5" />} accent="blue" />
            <KpiCard title="مسودة" value={String(kpis.draft)} icon={<Package className="size-5" />} accent="amber" />
            <KpiCard title="قيد النقل" value={String(kpis.inTransit)} icon={<Truck className="size-5" />} accent="violet" />
            <KpiCard title="مستلمة" value={String(kpis.received)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
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
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead className="num-cell">عدد العناصر</TableHead>
                <TableHead className="num-cell">إجمالي الكمية</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <ArrowLeftRight className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد تحويلات. ابدأ بإنشاء تحويل جديد.
                  </TableCell>
                </TableRow>
              ) : transfers.map(tr => {
                const parsed: any[] = JSON.parse(tr.itemsJson || '[]')
                const totalQty = parsed.reduce((s, x) => s + Number(x.quantity ?? 0), 0)
                return (
                  <TableRow key={tr.id} className="cursor-pointer" onClick={() => setDetailTransfer(tr)}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{tr.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(tr.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Truck className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{tr.fromStorehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{tr.toStorehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="num-cell text-xs"><span className="num">{parsed.length}</span></TableCell>
                    <TableCell className="num-cell text-sm font-medium"><span className="num">{totalQty}</span></TableCell>
                    <TableCell className="text-end"><StatusBadge status={tr.status} /></TableCell>
                    <TableCell className="text-end" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tr.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: tr.id, body: { status: 'in_transit' } })}>
                              <Truck className="size-4 ms-2" /> تحويل للنقل
                            </DropdownMenuItem>
                          )}
                          {tr.status === 'in_transit' && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: tr.id, body: { status: 'received' } })}>
                              <CheckCircle2 className="size-4 ms-2" /> استلام
                            </DropdownMenuItem>
                          )}
                          {(tr.status === 'draft' || tr.status === 'in_transit') && (
                            <DropdownMenuItem className="text-rose-600" onClick={() => updateMutation.mutate({ id: tr.id, body: { status: 'cancelled' } })}>
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ArrowLeftRight className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تحويل مخزني جديد' : 'New Stock Transfer'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                {/* Warehouses configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Truck className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'تحديد المستودعات' : 'Storehouses Configuration'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'من مستودع (المصدر) *' : 'From Warehouse (Source) *'}
                      </Label>
                      <Select value={form.fromStorehouseId} onValueChange={v => setForm({ ...form, fromStorehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع المصدر' : 'Select source warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'إلى مستودع (الوجهة) *' : 'To Warehouse (Destination) *'}
                      </Label>
                      <Select value={form.toStorehouseId} onValueChange={v => setForm({ ...form, toStorehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع الوجهة' : 'Select destination warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.filter(s => s.id !== form.fromStorehouseId).map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Status Options */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'حالة تحويل المخزون عند الحفظ' : 'Transfer Status'}
                  </Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      <SelectItem value="draft">{isRTL ? 'مسودة (حفظ بدون نقل مخزني)' : 'Draft (Save without moving stock)'}</SelectItem>
                      <SelectItem value="in_transit">{isRTL ? 'قيد النقل مباشرة (تخفيض المخزون للمصدر)' : 'In Transit (Reduce source stock)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Grid */}
                <div className="space-y-4">
                  <div className={cn("flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60", isRTL ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المراد تحويلها' : 'Items to Transfer'}
                      </h3>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1.5 text-xs">
                      <Plus className="size-3.5" /> {isRTL ? 'إضافة صنف' : 'Add Item'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <Table className="table-sticky">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead className={cn("num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                              {isRTL ? 'اضغط "إضافة صنف" لإدخال عناصر التحويل' : 'Click "Add Item" to start adding transfer items'}
                            </TableCell>
                          </TableRow>
                        ) : items.map((it, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <TableCell className="p-2">
                              <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                                <SelectTrigger dir={dir} className={cn("h-9 border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                                  <SelectValue placeholder={isRTL ? 'اختر منتج' : 'Select product'} />
                                </SelectTrigger>
                                <SelectContent dir={dir}>
                                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-200 dark:border-slate-800 text-xs", isRTL ? "text-right" : "text-left")} />
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg" onClick={() => removeItem(idx)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Additional notes */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات إضافية' : 'Notes / Remarks'}</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي تفاصيل أو ملاحظات عن الشحن أو السائق...' : 'Any shipping notes or carrier information...'} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {saveMutation.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء وتأكيد التحويل' : 'Create & Save Transfer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTransfer} onOpenChange={(o) => !o && setDetailTransfer(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Package className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                    {isRTL ? `تفاصيل التحويل المخزني ${detailTransfer?.code}` : `Transfer Details ${detailTransfer?.code}`}
                  </DialogTitle>
                  {detailTransfer && <StatusBadge status={detailTransfer.status} />}
                </div>
                <DialogDescription className="text-sm text-blue-800/80 dark:text-blue-100/90 font-normal leading-normal">
                  {detailTransfer?.fromStorehouse.name} &rarr; {detailTransfer?.toStorehouse.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailTransfer && (
            <div className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                <div className="space-y-6">
                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl shadow-sm">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'تاريخ الإنشاء' : 'Date Created'}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(detailTransfer.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isRTL ? 'تاريخ التحديث' : 'Last Updated'}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(detailTransfer.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Transfer Items */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المحوّلة' : 'Transferred Items'}
                      </h3>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                      <Table className="table-sticky">
                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                          <TableRow>
                            <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'المنتج' : 'Product'}</TableHead>
                            <TableHead className="num-cell w-36 text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'الكمية المحولة' : 'Transferred Qty'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {JSON.parse(detailTransfer.itemsJson || '[]').map((it: any, idx: number) => {
                            const p = products.find(x => x.id === it.productId)
                            return (
                              <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                                <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p?.name ?? it.productId}</TableCell>
                                <TableCell className="num-cell text-sm font-semibold text-slate-900 dark:text-white"><span className="num">{it.quantity}</span></TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Notes Section */}
                  {detailTransfer.note && (
                    <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-xl">
                      <span className="text-xs text-amber-800 dark:text-amber-300 font-bold block mb-1">{isRTL ? 'ملاحظات التحويل' : 'Transfer Notes'}</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{detailTransfer.note}</p>
                    </div>
                  )}
                </div>
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                {detailTransfer.status === 'draft' && (
                  <Button variant="outline" className="h-10 px-4 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold flex items-center gap-1.5" onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'in_transit' } })}>
                    <Truck className="size-4" /> {isRTL ? 'تحويل للنقل' : 'Send to Transit'}
                  </Button>
                )}
                {detailTransfer.status === 'in_transit' && (
                  <Button className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5" onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'received' } })}>
                    <CheckCircle2 className="size-4" /> {isRTL ? 'استلام التحويل' : 'Confirm Receipt'}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailTransfer(null)} className="h-10 px-5 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                  {isRTL ? 'إغلاق' : 'Close'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
