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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
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
  const { t } = useT()
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي التحويلات" value={String(kpis.total)} icon={<ArrowLeftRight className="size-5" />} accent="emerald" />
            <KpiCard title="مسودة" value={String(kpis.draft)} icon={<Package className="size-5" />} accent="amber" />
            <KpiCard title="قيد النقل" value={String(kpis.inTransit)} icon={<Truck className="size-5" />} accent="violet" />
            <KpiCard title="مستلمة" value={String(kpis.received)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
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
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead className="text-end">عدد العناصر</TableHead>
                <TableHead className="text-end">إجمالي الكمية</TableHead>
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
                    <TableCell className="font-mono text-xs">{tr.code}</TableCell>
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
                    <TableCell className="text-end tabular-nums">{parsed.length}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{totalQty}</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تحويل مخزون جديد</DialogTitle>
            <DialogDescription>إنشاء تحويل بين مستودعين</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 max-h-[70vh] overflow-y-auto p-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>من مستودع *</Label>
                <Select value={form.fromStorehouseId} onValueChange={v => setForm({ ...form, fromStorehouseId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="المستودع المصدر" /></SelectTrigger>
                  <SelectContent>
                    {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>إلى مستودع *</Label>
                <Select value={form.toStorehouseId} onValueChange={v => setForm({ ...form, toStorehouseId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="المستودع الوجهة" /></SelectTrigger>
                  <SelectContent>
                    {storehouses.filter(s => s.id !== form.fromStorehouseId).map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="in_transit">قيد النقل مباشرة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>عناصر التحويل</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5">
                  <Plus className="size-4" /> إضافة صف
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="w-32">الكمية</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">
                          اضغط "إضافة صف" لإضافة عناصر التحويل
                        </TableCell>
                      </TableRow>
                    ) : items.map((it, idx) => (
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
                          <Input type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => removeItem(idx)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء التحويل'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTransfer} onOpenChange={(o) => !o && setDetailTransfer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل التحويل {detailTransfer?.code}</DialogTitle>
            <DialogDescription>
              {detailTransfer?.fromStorehouse.name} ← {detailTransfer?.toStorehouse.name}
            </DialogDescription>
          </DialogHeader>
          {detailTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">التاريخ:</span> {formatDate(detailTransfer.createdAt)}</div>
                <div><span className="text-muted-foreground">الحالة:</span> <StatusBadge status={detailTransfer.status} /></div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="text-end">الكمية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {JSON.parse(detailTransfer.itemsJson || '[]').map((it: any, idx: number) => {
                      const p = products.find(x => x.id === it.productId)
                      return (
                        <TableRow key={idx}>
                          <TableCell>{p?.name ?? it.productId}</TableCell>
                          <TableCell className="text-end tabular-nums font-medium">{it.quantity}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {detailTransfer.note && (
                <div className="text-sm">
                  <span className="text-muted-foreground">ملاحظات:</span> {detailTransfer.note}
                </div>
              )}
              <DialogFooter>
                {detailTransfer.status === 'draft' && (
                  <Button variant="outline" onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'in_transit' } })}>
                    <Truck className="size-4 ms-2" /> تحويل للنقل
                  </Button>
                )}
                {detailTransfer.status === 'in_transit' && (
                  <Button onClick={() => updateMutation.mutate({ id: detailTransfer.id, body: { status: 'received' } })}>
                    <CheckCircle2 className="size-4 ms-2" /> استلام التحويل
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailTransfer(null)}>إغلاق</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
