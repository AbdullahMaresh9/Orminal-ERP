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
  const { t, isRTL, dir } = useT()
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الطلبات" value={String(kpis.total)} icon={<FileText className="size-5" />} accent="blue" />
            <KpiCard title="بانتظار الاعتماد" value={String(kpis.draft)} icon={<ClipboardCheck className="size-5" />} accent="amber" />
            <KpiCard title="معتمدة" value={String(kpis.approved)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title="مُنفّذة" value={String(kpis.fulfilled)} icon={<Package className="size-5" />} accent="violet" />
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
                <TableHead className="num-cell">إجمالي الكمية</TableHead>
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
                    <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{r.storehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="num-cell text-xs"><span className="num">{parsed.length}</span></TableCell>
                    <TableCell className="num-cell text-sm font-medium"><span className="num">{totalQty}</span></TableCell>
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'طلب صرف مخزني جديد' : 'New Stock Requisition'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-6">
                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'المستودع المطلوب منه *' : 'Target Storehouse *'}
                  </Label>
                  <Select value={form.storehouseId} onValueChange={v => setForm({ ...form, storehouseId: v })}>
                    <SelectTrigger dir={dir} className={cn("h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950", isRTL ? "text-right" : "text-left")}>
                      <SelectValue placeholder={isRTL ? 'اختر المستودع' : 'Select warehouse'} />
                    </SelectTrigger>
                    <SelectContent dir={dir}>
                      {storehouses.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className={cn("flex items-center justify-between border-b pb-2 border-slate-200/60 dark:border-slate-800/60", isRTL ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                      <Package className="size-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {isRTL ? 'عناصر الطلب' : 'Requisition Items'}
                      </h3>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 gap-1.5 text-xs">
                      <Plus className="size-3.5" /> {isRTL ? 'إضافة صف' : 'Add Item'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <Table className="table-sticky">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead className={cn("num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'الكمية المطلوبة' : 'Requested Qty'}</TableHead>
                          <TableHead className={cn("text-xs font-semibold text-slate-700 dark:text-slate-300", isRTL ? "text-right" : "text-left")}>{isRTL ? 'ملاحظات الصنف' : 'Item Notes'}</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                              {isRTL ? 'اضغط "إضافة صف" لإدخال المنتجات المطلوبة' : 'Click "Add Item" to add products to the request'}
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
                            <TableCell className="p-2">
                              <Input value={it.note} onChange={e => updateItem(idx, 'note', e.target.value)} placeholder={isRTL ? 'ملاحظة اختيارية' : 'Optional note'} dir={dir} className={cn("h-9 border-slate-200 dark:border-slate-800 text-xs", isRTL ? "text-right" : "text-left")} />
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

                <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات وتوجيهات' : 'General Notes'}</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} dir={dir} className={cn("border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")} placeholder={isRTL ? 'أي ملاحظات أو توجيهات تخص الطلب...' : 'Any comments or remarks regarding the requisition...'} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm">
                {createMutation.isPending ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء طلب صرف' : 'Create Requisition')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ClipboardCheck className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                    {isRTL ? `تفاصيل طلب الصرف ${detailReq?.code}` : `Requisition Details ${detailReq?.code}`}
                  </DialogTitle>
                  {detailReq && <StatusBadge status={detailReq.status} />}
                </div>
                <DialogDescription className="text-sm text-blue-800/80 dark:text-blue-100/90 font-normal leading-normal">
                  {detailReq?.storehouse.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailReq && (
            <div className="flex-1 flex flex-col min-h-0">
              <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                <div className="grid grid-cols-2 gap-4 text-sm bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-4 rounded-xl shadow-sm">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">{isRTL ? 'تاريخ الطلب' : 'Request Date'}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(detailReq.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">{isRTL ? 'حالة الطلب' : 'Requisition Status'}</span>
                    <span className="inline-block mt-0.5"><StatusBadge status={detailReq.status} /></span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                    <Package className="size-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {isRTL ? 'الأصناف المطلوبة' : 'Requested Items'}
                    </h3>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                    <Table className="table-sticky">
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead className="num-cell w-32 text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'الكمية المطلوبة' : 'Requested Qty'}</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {JSON.parse(detailReq.itemsJson || '[]').map((it: any, idx: number) => {
                          const p = products.find(x => x.id === it.productId)
                          return (
                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                              <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p?.name ?? it.productId}</TableCell>
                              <TableCell className="num-cell text-sm font-bold text-slate-800 dark:text-slate-250"><span className="num">{it.quantity}</span></TableCell>
                              <TableCell className="text-xs text-slate-500 dark:text-slate-400">{it.note ?? '—'}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {detailReq.note && (
                  <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-xl">
                    <span className="text-xs text-amber-800 dark:text-amber-300 font-bold block mb-1">{isRTL ? 'ملاحظات الطلب' : 'Requisition Notes'}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{detailReq.note}</p>
                  </div>
                )}
              </DialogBody>

              <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                {detailReq.status === 'draft' && (
                  <>
                    <Button type="button" variant="outline" className="h-10 px-4 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'approved' } })}>
                      <CheckCircle2 className="size-4 ms-2" /> {isRTL ? 'اعتماد الطلب' : 'Approve Request'}
                    </Button>
                    <Button type="button" variant="outline" className="h-10 px-4 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'rejected' } })}>
                      <XCircle className="size-4 ms-2" /> {isRTL ? 'رفض الطلب' : 'Reject Request'}
                    </Button>
                  </>
                )}
                {detailReq.status === 'approved' && (
                  <Button type="button" onClick={() => updateMutation.mutate({ id: detailReq.id, body: { status: 'fulfilled' } })} className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm">
                    <Package className="size-4 ms-2" /> {isRTL ? 'تنفيذ الصرف وتحديث المخزون' : 'Fulfill & Dispatch Stock'}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setDetailReq(null)} className="h-10 px-5 border-slate-200 dark:border-slate-855 hover:bg-slate-100/80 dark:hover:bg-slate-900 text-xs font-semibold">
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
