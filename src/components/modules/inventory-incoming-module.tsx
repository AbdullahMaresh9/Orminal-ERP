'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
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
import { ArrowDownToLine, Plus, Trash2, Package, Truck, Boxes } from 'lucide-react'

interface Movement {
  id: string
  productId: string
  storehouseId: string
  type: string
  quantity: number
  refType: string | null
  note: string | null
  createdAt: string
  product: { id: string; name: string; sku: string; costPrice: number }
  storehouse: { id: string; name: string; code: string }
}

interface LineItem {
  productId: string
  quantity: number
  batch: string
  expiry: string
  cost: number
}

export function InventoryIncomingModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [storehouseFilter, setStorehouseFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    storehouseId: '',
    supplierId: '',
    note: '',
    createInvoice: false,
  })
  const [items, setItems] = useState<LineItem[]>([])

  const { data: movementsData, isLoading } = useQuery<{ data: Movement[]; total: number }>({
    queryKey: ['inventory-incoming', storehouseFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (storehouseFilter !== 'all') params.set('storehouseId', storehouseFilter)
      const r = await fetch(`/api/erp/inventory-incoming?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-incoming'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-incoming', form.storehouseId],
    queryFn: async () => {
      const url = form.storehouseId
        ? `/api/erp/products?type=product&warehouseId=${form.storehouseId}`
        : '/api/erp/products?type=product'
      const r = await fetch(url)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: suppliersData } = useQuery<{ data: any[] }>({
    queryKey: ['suppliers-for-incoming'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=100')
      if (!r.ok) return { data: [] }
      const json = await r.json()
      if (!json.data || json.data.length === 0) {
        const rAll = await fetch('/api/erp/partners?pageSize=100')
        if (rAll.ok) return rAll.json()
      }
      return json
    },
  })

  const movements = movementsData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []
  const suppliers = suppliersData?.data ?? []

  useEffect(() => {
    if (storehouses.length > 0 && !form.storehouseId) {
      setForm(prev => ({ ...prev, storehouseId: storehouses[0].id }))
    }
  }, [storehouses, form.storehouseId])

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-incoming', {
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
      toast.success('تم تسجيل التوريد بنجاح')
      qc.invalidateQueries({ queryKey: ['inventory-incoming'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function resetForm() {
    setForm({ storehouseId: '', supplierId: '', note: '', createInvoice: false })
    setItems([])
  }
  function addItem() {
    setItems([...items, { productId: '', quantity: 1, batch: '', expiry: '', cost: 0 }])
  }
  function updateItem(idx: number, field: keyof LineItem, value: any) {
    const next = [...items]
    const cur = next[idx]
    if (field === 'productId') {
      const selectedProd = products.find((p: any) => p.id === value)
      const defaultCost = selectedProd?.costPrice ?? selectedProd?.purchasePrice ?? 0
      next[idx] = {
        ...cur,
        productId: value,
        cost: cur.cost > 0 ? cur.cost : defaultCost,
      }
    } else {
      next[idx] = { ...cur, [field]: value }
    }
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
    exportToCSV('inventory-incoming', movements.map(m => {
      const cost = m.product?.costPrice ?? 0
      const name = m.product?.name ?? '—'
      const sku = m.product?.sku ?? '—'
      const storehouseName = m.storehouse?.name ?? '—'
      return {
        date: formatDateTime(m.createdAt),
        product: name,
        sku: sku,
        storehouse: storehouseName,
        quantity: m.quantity ?? 0,
        cost: cost,
        total: (m.quantity ?? 0) * cost,
        note: m.note ?? '',
      }
    }), [
      { key: 'date', label: 'التاريخ' },
      { key: 'product', label: 'المنتج' },
      { key: 'sku', label: 'SKU' },
      { key: 'storehouse', label: 'المستودع' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'cost', label: 'التكلفة' },
      { key: 'total', label: 'الإجمالي' },
      { key: 'note', label: 'ملاحظات' },
    ])
  }

  const kpis = useMemo(() => {
    const total = movements.length
    const totalQty = movements.reduce((s, m) => s + (m.quantity ?? 0), 0)
    const totalValue = movements.reduce((s, m) => s + (m.quantity ?? 0) * (m.product?.costPrice ?? 0), 0)
    const uniqueProducts = new Set(movements.map(m => m.productId)).size
    return { total, totalQty, totalValue, uniqueProducts }
  }, [movements])

  const formTotal = items.reduce((s, it) => s + (Number(it.cost) * Number(it.quantity)), 0)

  return (
    <ModuleShell
      title={t('module.inventory-incoming')}
      description="تسجيل عمليات توريد (وارد) المخزون"
      icon={<ArrowDownToLine className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel="توريد جديد"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4  mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي عمليات التوريد" value={String(kpis.total)} icon={<ArrowDownToLine className="size-5" />} accent="blue" />
            <KpiCard title="الكمية الواردة" value={formatNumber(kpis.totalQty, 0)} icon={<Boxes className="size-5" />} accent="sky" />
            <KpiCard title="قيمة الوارد" value={formatCurrency(kpis.totalValue)} icon={<Package className="size-5" />} accent="violet" />
            <KpiCard title="منتجات متنوعة" value={String(kpis.uniqueProducts)} icon={<Package className="size-5" />} accent="amber" />
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
                <TableHead className={cn("num-cell text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? "التكلفة" : "Cost"}</TableHead>
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
                    <ArrowDownToLine className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد عمليات توريد مسجلة. ابدأ بتسجيل أول توريد.
                  </TableCell>
                </TableRow>
              ) : movements.map(m => {
                const cost = m.product?.costPrice ?? 0
                const name = m.product?.name ?? '—'
                const sku = m.product?.sku ?? '—'
                const storehouseName = m.storehouse?.name ?? '—'
                const qty = m.quantity ?? 0
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell className="text-sm font-medium">{name}</TableCell>
                    <TableCell className="font-mono text-xs">{sku}</TableCell>
                    <TableCell className="text-sm">{storehouseName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.refType ?? '—'}</TableCell>
                    <TableCell className="num-cell text-sm font-medium text-blue-600 dark:text-blue-400">
                      <span className="num">+{formatNumber(qty, 0)}</span>
                    </TableCell>
                    <TableCell className="num-cell text-xs">
                      <span className="num">{formatNumber(cost)}</span>
                    </TableCell>
                    <TableCell className="num-cell text-sm font-medium">
                      <span className="num">{formatCurrency(qty * cost)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-32 cell-truncate">{m.note ?? '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-250 dark:border-blue-500/30" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ArrowDownToLine className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-white">
                  {isRTL ? 'توريد مخزني جديد' : 'New Stock Receipt'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                {/* General Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-600/60">
                    <Boxes className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'بيانات التوريد والمستودع' : 'Receipt & Warehouse Info'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'المستودع المستلم *' : 'Receiving Warehouse *'}
                      </Label>
                      <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'اختر المستودع' : 'Select warehouse'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'المورد (اختياري)' : 'Supplier (Optional)'}
                      </Label>
                      <Select value={form.supplierId || 'none'} onValueChange={v => setForm({ ...form, supplierId: v === 'none' ? '' : v })}>
                        <SelectTrigger dir={dir} className={cn("h-10 border-slate-250 dark:border-blue-500/30 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                          <SelectValue placeholder={isRTL ? 'بدون مورد' : 'No supplier'} />
                        </SelectTrigger>
                        <SelectContent dir={dir}>
                          <SelectItem value="none">{isRTL ? 'بدون مورد (مورد افتراضي / داخلي)' : 'No supplier (Default / Internal)'}</SelectItem>
                          {suppliers.map(s => {
                            const supplierName = s.nameAr || s.nameEn || s.name || s.code || 'مورد'
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                {supplierName} {s.code ? `(${s.code})` : ''}
                              </SelectItem>
                            )
                          })}
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
                        {isRTL ? 'أصناف التوريد' : 'Receipt Items'}
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
                          <TableHead className={cn("num-cell w-24 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                          <TableHead className={cn("w-28 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'التشغيلة' : 'Batch'}</TableHead>
                          <TableHead className={cn("w-36 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الانتهاء' : 'Expiry'}</TableHead>
                          <TableHead className={cn("num-cell w-28 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'التكلفة' : 'Cost'}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                              {isRTL ? 'اضغط "إضافة صنف" لإدخال عناصر التوريد' : 'Click "Add Item" to start adding receipt items'}
                            </TableCell>
                          </TableRow>
                        ) : items.map((it, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                            <TableCell className="p-2">
                              <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                                <SelectTrigger dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                                  <SelectValue placeholder={isRTL ? 'اختر منتج' : 'Select product'} />
                                </SelectTrigger>
                                <SelectContent dir={dir}>
                                  {products.map(p => {
                                    const productName = p.nameAr || p.nameEn || p.name || 'منتج'
                                    const stockCount = p.warehouseStock ?? p.stock ?? 0
                                    return (
                                      <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center justify-between gap-3 w-full">
                                          <span>{productName}</span>

                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs", isRTL ? "text-right" : "text-left")} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input value={it.batch} onChange={e => updateItem(idx, 'batch', e.target.value)} placeholder="—" dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs", isRTL ? "text-right" : "text-left")} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="date" value={it.expiry} onChange={e => updateItem(idx, 'expiry', e.target.value)} dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs text-center", isRTL ? "text-right" : "text-left")} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input type="number" step="0.01" value={it.cost} onChange={e => updateItem(idx, 'cost', Number(e.target.value))} dir={dir} className={cn("h-9 border-slate-250 dark:border-blue-500/30 text-xs", isRTL ? "text-right" : "text-left")} />
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

                  <div className={cn("flex items-center gap-3 px-1", isRTL ? "flex-row-reverse" : "justify-end")}>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي قيمة التوريد:' : 'Total Value:'}</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white"><span className="num">{formatCurrency(formTotal)}</span></span>
                  </div>
                </div>

                {/* Additional notes & Purchase Invoice creation */}
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات إضافية' : 'Notes / Remarks'}</Label>
                    <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-250 dark:border-blue-500/30 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي ملاحظات تخص الشحنة أو التوريد...' : 'Any remarks or comments regarding the receipt...'} />
                  </div>

                  <div className={cn("flex items-center gap-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-xl", isRTL ? "flex-row-reverse text-right" : "text-left")}>
                    <Switch checked={form.createInvoice} onCheckedChange={c => setForm({ ...form, createInvoice: c })} id="create-inv" className="data-[state=checked]:bg-blue-600 shrink-0" />
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="create-inv" className="text-sm font-bold text-blue-950 dark:text-blue-200 cursor-pointer">{isRTL ? 'إنشاء فاتورة شراء مرتبطة تلقائياً' : 'Automatically Create Linked Purchase Invoice'}</Label>
                      <p className="text-xs text-blue-750/70 dark:text-blue-300/60 leading-normal">{isRTL ? 'سيقوم النظام بإنشاء فاتورة مشتريات مسودة بنفس القيمة وتفاصيل المورد.' : 'A draft purchase invoice will be created with the same items and supplier.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-blue-500/30/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-250 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
                {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ وتوريد المخزون' : 'Save & Receipt Stock')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
