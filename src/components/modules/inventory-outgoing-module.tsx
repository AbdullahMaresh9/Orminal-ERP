'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ArrowUpFromLine, Plus, Trash2, Package, Boxes } from 'lucide-react'

interface Movement {
  id: string
  productId: string
  storehouseId: string
  type: string
  quantity: number
  refType: string | null
  note: string | null
  createdAt: string
  product: { id: string; name: string; sku: string; salePrice: number }
  storehouse: { id: string; name: string; code: string }
}

export function InventoryOutgoingModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [storehouseFilter, setStorehouseFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    storehouseId: '',
    clientId: '',
    note: '',
  })
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([])

  const { data: movementsData, isLoading } = useQuery<{ data: Movement[]; total: number }>({
    queryKey: ['inventory-outgoing', storehouseFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (storehouseFilter !== 'all') params.set('storehouseId', storehouseFilter)
      const r = await fetch(`/api/erp/inventory-outgoing?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: clientsData } = useQuery<{ data: any[] }>({
    queryKey: ['clients-for-outgoing'],
    queryFn: async () => {
      const r = await fetch('/api/erp/clients')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const movements = movementsData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []
  const clients = clientsData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-outgoing', {
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
      toast.success('تم تسجيل الصرف بنجاح')
      qc.invalidateQueries({ queryKey: ['inventory-outgoing'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function resetForm() {
    setForm({ storehouseId: '', clientId: '', note: '' })
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
    if (!form.storehouseId) return toast.error('المستودع مطلوب')
    const validItems = items.filter(i => i.productId && i.quantity > 0)
    if (!validItems.length) return toast.error('أضف عنصراً واحداً على الأقل')
    saveMutation.mutate({ ...form, items: validItems })
  }
  function handleExport() {
    exportToCSV('inventory-outgoing', movements.map(m => ({
      date: formatDateTime(m.createdAt),
      product: m.product.name,
      sku: m.product.sku,
      storehouse: m.storehouse.name,
      quantity: m.quantity,
      price: m.product.salePrice,
      total: m.quantity * m.product.salePrice,
      note: m.note ?? '',
    })), [
      { key: 'date', label: 'التاريخ' },
      { key: 'product', label: 'المنتج' },
      { key: 'sku', label: 'SKU' },
      { key: 'storehouse', label: 'المستودع' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'price', label: 'السعر' },
      { key: 'total', label: 'الإجمالي' },
      { key: 'note', label: 'ملاحظات' },
    ])
  }

  const kpis = useMemo(() => {
    const total = movements.length
    const totalQty = movements.reduce((s, m) => s + m.quantity, 0)
    const totalValue = movements.reduce((s, m) => s + m.quantity * m.product.salePrice, 0)
    const uniqueProducts = new Set(movements.map(m => m.productId)).size
    return { total, totalQty, totalValue, uniqueProducts }
  }, [movements])

  const formTotal = items.reduce((s, it) => {
    const p = products.find(x => x.id === it.productId)
    return s + (p ? Number(it.quantity) * p.salePrice : 0)
  }, 0)

  return (
    <ModuleShell
      title={t('module.inventory-outgoing')}
      description="تسجيل عمليات صرف (صادر) المخزون"
      icon={<ArrowUpFromLine className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel="صرف جديد"
      onExport={handleExport}
      filters={
        <Select value={storehouseFilter} onValueChange={setStorehouseFilter}>
          <SelectTrigger dir={dir} className={cn("w-44", isRTL ? "text-right" : "text-left")}><SelectValue /></SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all">{isRTL ? "كل المستودعات" : "All Storehouses"}</SelectItem>
            {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي عمليات الصرف" value={String(kpis.total)} icon={<ArrowUpFromLine className="size-5" />} accent="rose" />
            <KpiCard title="الكمية المصروفة" value={formatNumber(kpis.totalQty, 0)} icon={<Boxes className="size-5" />} accent="amber" />
            <KpiCard title="قيمة المصروف" value={formatCurrency(kpis.totalValue)} icon={<Package className="size-5" />} accent="violet" />
            <KpiCard title="منتجات متنوعة" value={String(kpis.uniqueProducts)} icon={<Package className="size-5" />} accent="sky" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "التاريخ" : "Date"}</TableHead>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "المنتج" : "Product"}</TableHead>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>SKU</TableHead>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "المستودع" : "Storehouse"}</TableHead>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "المرجع" : "Reference"}</TableHead>
                <TableHead className={cn("num-cell text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "الكمية" : "Qty"}</TableHead>
                <TableHead className={cn("num-cell text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "السعر" : "Price"}</TableHead>
                <TableHead className={cn("num-cell text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "ملاحظات" : "Notes"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                    <ArrowUpFromLine className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد عمليات صرف مسجلة. ابدأ بتسجيل أول صرف.
                  </TableCell>
                </TableRow>
              ) : movements.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell className="text-sm font-medium">{m.product.name}</TableCell>
                  <TableCell className="font-mono text-xs">{m.product.sku}</TableCell>
                  <TableCell className="text-sm">{m.storehouse.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.refType ?? '—'}</TableCell>
                  <TableCell className="num-cell text-sm font-medium text-rose-600 dark:text-rose-400">
                    <span className="num">-{formatNumber(m.quantity, 0)}</span>
                  </TableCell>
                  <TableCell className="num-cell text-xs">
                    <span className="num">{formatNumber(m.product.salePrice)}</span>
                  </TableCell>
                  <TableCell className="num-cell text-sm font-medium">
                    <span className="num">{formatCurrency(m.quantity * m.product.salePrice)}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-32 cell-truncate">{m.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-250 dark:border-blue-500/30" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm shadow-rose-100/40 dark:shadow-none shrink-0">
                <ArrowUpFromLine className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تسجيل صرف مخزني جديد' : 'New Stock Issue'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                {/* General Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Boxes className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'بيانات الصرف والمستودع' : 'Issue & Warehouse Info'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'المستودع المصدر *' : 'Source Warehouse *'}
                      </Label>
                      <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع' : 'Select warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'العميل (اختياري)' : 'Client (Optional)'}
                      </Label>
                      <Select value={form.clientId || 'none'} onValueChange={v => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'بدون عميل' : 'No client'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          <SelectItem value="none">{isRTL ? 'بدون عميل' : 'No client'}</SelectItem>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="space-y-4">
                  <div className={cn("flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60", isRTL ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'الأصناف المراد صرفها' : 'Items to Issue'}
                      </h3>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1.5 text-xs">
                      <Plus className="size-3.5" /> {isRTL ? 'إضافة صنف' : 'Add Item'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-250 dark:border-blue-500/30 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <Table className="table-sticky">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                          <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'السعر' : 'Price'}</TableHead>
                          <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                              {isRTL ? 'اضغط "إضافة صنف" لإدخال عناصر الصرف' : 'Click "Add Item" to start adding issue items'}
                            </TableCell>
                          </TableRow>
                        ) : items.map((it, idx) => {
                          const p = products.find(x => x.id === it.productId)
                          return (
                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                              <TableCell className="p-2">
                                <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                                  <SelectTrigger dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                                    <SelectValue placeholder={isRTL ? 'اختر منتج' : 'Select product'} />
                                  </SelectTrigger>
                                  <SelectContent dir={dir}>
                                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2">
                                <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs", isRTL ? "text-right" : "text-left")} />
                              </TableCell>
                              <TableCell className={cn("p-2 num-cell text-xs text-slate-650 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>
                                {p ? <span className="num">{formatNumber(p.salePrice)}</span> : '—'}
                              </TableCell>
                              <TableCell className={cn("p-2 num-cell text-xs font-semibold text-slate-900 dark:text-white", isRTL ? "text-right" : "text-left")}>
                                {p ? <span className="num">{formatCurrency(Number(it.quantity) * p.salePrice)}</span> : '—'}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg" onClick={() => removeItem(idx)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className={cn("flex items-center gap-3 px-1", isRTL ? "flex-row-reverse" : "justify-end")}>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي قيمة الصرف:' : 'Total Value:'}</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white"><span className="num">{formatCurrency(formTotal)}</span></span>
                  </div>
                </div>

                {/* Additional notes */}
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات إضافية' : 'Notes / Remarks'}</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي ملاحظات تخص عملية صرف المخزون...' : 'Any remarks or comments regarding the stock issue...'} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-blue-700/30/ 80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-250 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white text-xs font-semibold shadow-sm">
                {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'تسجيل وصرف المخزون' : 'Save & Issue Stock')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
