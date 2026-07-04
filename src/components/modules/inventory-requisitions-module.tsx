'use client'

import { useState, useMemo } from 'react'
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
import { FileText, Plus, Trash2, CheckCircle2, XCircle, MoreVertical, Package, ClipboardCheck } from 'lucide-react'

interface Requisition {
  id: string
  code: string
  storehouseId: string
  status: string
  itemsJson: string
  note: string | null
  requesterId: string | null
  createdAt: string
  updatedAt: string
  storehouse: { id: string; name: string; code: string }
}

export function InventoryRequisitionsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailReq, setDetailReq] = useState<Requisition | null>(null)
  const [form, setForm] = useState({ storehouseId: '', note: '' })
  const [items, setItems] = useState<{ productId: string; quantity: number; note: string }[]>([])

  const { data: reqsData, isLoading } = useQuery<{ data: Requisition[]; total: number }>({
    queryKey: ['inventory-requisitions', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`/api/erp/inventory-requisitions?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-reqs'],
    queryFn: async () => {
      const r = await fetch('/api/erp/storehouses')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-reqs'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?type=product')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const reqs = reqsData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const products = productsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/inventory-requisitions', {
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
      toast.success('تم إنشاء طلب الصرف بنجاح')
      qc.invalidateQueries({ queryKey: ['inventory-requisitions'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const r = await fetch(`/api/erp/inventory-requisitions/${id}`, {
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
      qc.invalidateQueries({ queryKey: ['inventory-requisitions'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setDetailReq(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function resetForm() {
    setForm({ storehouseId: '', note: '' })
    setItems([])
  }
  function addItem() {
    setItems([...items, { productId: '', quantity: 1, note: '' }])
  }
  function updateItem(idx: number, field: 'productId' | 'quantity' | 'note', value: any) {
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
    createMutation.mutate({ ...form, items: validItems })
  }
  function handleExport() {
    exportToCSV('inventory-requisitions', reqs.map(r => {
      const parsed: any[] = JSON.parse(r.itemsJson || '[]')
      return {
        code: r.code,
        date: formatDate(r.createdAt),
        storehouse: r.storehouse.name,
        items: parsed.length,
        totalQty: parsed.reduce((s: number, x: any) => s + Number(x.quantity ?? 0), 0),
        status: r.status,
      }
    }), [
      { key: 'code', label: 'الرمز' },
      { key: 'date', label: 'التاريخ' },
      { key: 'storehouse', label: 'المستودع' },
      { key: 'items', label: 'عدد العناصر' },
      { key: 'totalQty', label: 'إجمالي الكمية' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  const kpis = useMemo(() => {
    const total = reqs.length
    const draft = reqs.filter(r => r.status === 'draft').length
    const approved = reqs.filter(r => r.status === 'approved').length
    const fulfilled = reqs.filter(r => r.status === 'fulfilled').length
    return { total, draft, approved, fulfilled }
  }, [reqs])

  return (
    <ModuleShell
      title={t('module.inventory-requisitions')}
      description="طلبات صرف المخزون واعتمادها"
      icon={<FileText className="size-5" />}
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel="طلب صرف جديد"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="approved">معتمد</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
            <SelectItem value="fulfilled">مُنفّذ</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الطلبات" value={String(kpis.total)} icon={<FileText className="size-5" />} accent="emerald" />
            <KpiCard title="بانتظار الاعتماد" value={String(kpis.draft)} icon={<ClipboardCheck className="size-5" />} accent="amber" />
            <KpiCard title="معتمدة" value={String(kpis.approved)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
            <KpiCard title="مُنفّذة" value={String(kpis.fulfilled)} icon={<Package className="size-5" />} accent="violet" />
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
                <TableHead className="text-end">إجمالي الكمية</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : reqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <FileText className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد طلبات صرف. ابدأ بإنشاء طلب جديد.
                  </TableCell>
                </TableRow>
              ) : reqs.map(r => {
                const parsed: any[] = JSON.parse(r.itemsJson || '[]')
                const totalQty = parsed.reduce((s, x) => s + Number(x.quantity ?? 0), 0)
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailReq(r)}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{r.storehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{parsed.length}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{totalQty}</TableCell>
                    <TableCell className="text-end"><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-end" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {r.status === 'draft' && (
                            <>
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: r.id, body: { status: 'approved' } })}>
                                <CheckCircle2 className="size-4 ms-2" /> اعتماد
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-rose-600" onClick={() => updateMutation.mutate({ id: r.id, body: { status: 'rejected' } })}>
                                <XCircle className="size-4 ms-2" /> رفض
                              </DropdownMenuItem>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: r.id, body: { status: 'fulfilled' } })}>
                              <Package className="size-4 ms-2" /> تنفيذ (صرف)
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
            <DialogTitle>طلب صرف جديد</DialogTitle>
            <DialogDescription>إنشاء طلب صرف من مخزون مستودع</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 max-h-[70vh] overflow-y-auto p-1">
            <div className="space-y-1.5">
              <Label>المستودع *</Label>
              <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                <SelectContent>
                  {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>عناصر الطلب</Label>
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
                      <TableHead>ملاحظات</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                          اضغط "إضافة صف" لإضافة عناصر الطلب
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
                          <Input value={it.note} onChange={e => updateItem(idx, 'note', e.target.value)} placeholder="—" />
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'جاري الحفظ...' : 'إنشاء الطلب'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل طلب الصرف {detailReq?.code}</DialogTitle>
            <DialogDescription>{detailReq?.storehouse.name}</DialogDescription>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">التاريخ:</span> {formatDate(detailReq.createdAt)}</div>
                <div><span className="text-muted-foreground">الحالة:</span> <StatusBadge status={detailReq.status} /></div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="text-end">الكمية</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {JSON.parse(detailReq.itemsJson || '[]').map((it: any, idx: number) => {
                      const p = products.find(x => x.id === it.productId)
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{p?.name ?? it.productId}</TableCell>
                          <TableCell className="text-end tabular-nums">{it.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{it.note ?? '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {detailReq.note && (
                <div className="text-sm">
                  <span className="text-muted-foreground">ملاحظات:</span> {detailReq.note}
                </div>
              )}
              <DialogFooter>
                {detailReq.status === 'draft' && (
                  <>
                    <Button variant="outline" onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'approved' } })}>
                      <CheckCircle2 className="size-4 ms-2" /> اعتماد
                    </Button>
                    <Button variant="outline" className="text-rose-600" onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'rejected' } })}>
                      <XCircle className="size-4 ms-2" /> رفض
                    </Button>
                  </>
                )}
                {detailReq.status === 'approved' && (
                  <Button onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'fulfilled' } })}>
                    <Package className="size-4 ms-2" /> تنفيذ الصرف
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailReq(null)}>إغلاق</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
