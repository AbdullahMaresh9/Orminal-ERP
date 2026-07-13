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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
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
  const { t } = useT()
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
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المستودعات</SelectItem>
            {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                <TableHead>التاريخ</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead className="num-cell">الكمية</TableHead>
                <TableHead className="num-cell">السعر</TableHead>
                <TableHead className="num-cell">الإجمالي</TableHead>
                <TableHead>ملاحظات</TableHead>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تسجيل صرف جديد</DialogTitle>
            <DialogDescription>صرف كمية من مخزون مستودع</DialogDescription>
          </DialogHeader>
                              <form onSubmit={handleSubmit} className="grid gap-4 max-h-[70vh] overflow-y-auto p-1">
            <div className="grid grid-cols-2 gap-4">
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
                <Label>العميل (اختياري)</Label>
                <Select value={form.clientId || 'none'} onValueChange={v => setForm({ ...form, clientId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="بدون عميل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون عميل</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>عناصر الصرف</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5">
                  <Plus className="size-4" /> إضافة صف
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-sticky">
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="num-cell w-32">الكمية</TableHead>
                      <TableHead className="num-cell w-32">السعر</TableHead>
                      <TableHead className="num-cell w-32">الإجمالي</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                          اضغط "إضافة صف" لإضافة عناصر الصرف
                        </TableCell>
                      </TableRow>
                    ) : items.map((it, idx) => {
                      const p = products.find(x => x.id === it.productId)
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={it.productId} onValueChange={v => updateItem(idx, 'productId', v)}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                              <SelectContent>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="text-end" />
                          </TableCell>
                          <TableCell className="num-cell text-sm">{p ? <span className="num">{formatNumber(p.salePrice)}</span> : '—'}</TableCell>
                          <TableCell className="num-cell text-sm font-medium">{p ? <span className="num">{formatCurrency(Number(it.quantity) * p.salePrice)}</span> : '—'}</TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => removeItem(idx)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end gap-4 text-sm">
                <span className="text-muted-foreground">إجمالي الصرف:</span>
                <span className="text-lg font-bold"><span className="num">{formatCurrency(formTotal)}</span></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>

            
          <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'تسجيل الصرف'}
              </Button>
            </DialogFooter>
          </form>
        
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
