'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Factory, Plus, Pencil, Trash2, Printer, PlayCircle, CheckCircle2, XCircle, Package, ClipboardList, Coins,
} from 'lucide-react'

interface Product { id: string; sku: string; nameAr: string }
interface Bom { id: string; code: string; nameAr: string; productId: string }
interface ProductionOrder {
  id: string
  code: string
  bomId: string
  productId: string
  quantity: number
  producedQty: number
  scrapQty: number
  plannedStart?: string
  plannedEnd?: string
  status: string
  totalCost: number
  notes?: string
  bom?: Bom
  product?: Product
}

export function ProductionOrdersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bomId, setBomId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedEnd, setPlannedEnd] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery<{ data: ProductionOrder[]; meta: any }>({
    queryKey: ['production-orders', search, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('pageSize', '200')
      const r = await fetch(`/api/erp/production-orders?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: bomsData } = useQuery<{ data: Bom[] }>({
    queryKey: ['boms-for-po'],
    queryFn: async () => {
      const r = await fetch('/api/erp/boms?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const boms = bomsData?.data ?? []

  const stats = {
    total: items.length,
    inProgress: items.filter((i) => ['released', 'in_progress'].includes(i.status)).length,
    produced: items.filter((i) => ['produced', 'costed', 'closed'].includes(i.status)).length,
    totalCost: items.reduce((s, i) => s + (i.totalCost || 0), 0),
  }

  const resetForm = () => {
    setBomId(''); setQuantity('1'); setPlannedStart(''); setPlannedEnd(''); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!bomId) throw new Error('اختر قائمة التركيب')
      const bom = boms.find((b) => b.id === bomId)
      if (!bom) throw new Error('قائمة التركيب غير موجودة')
      const payload: any = {
        bomId,
        productId: bom.productId,
        quantity: Number(quantity) || 1,
        plannedStart: plannedStart || undefined,
        plannedEnd: plannedEnd || undefined,
        notes,
      }
      const r = await fetch('/api/erp/production-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء أمر الإنتاج بنجاح')
      qc.invalidateQueries({ queryKey: ['production-orders'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await fetch(`/api/erp/production-orders/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم تنفيذ الإجراء')
      qc.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/production-orders/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((o) => ({
      'الرمز': o.code,
      'المنتج': o.product?.nameAr ?? '',
      'قائمة التركيب': o.bom?.code ?? '',
      'الكمية': o.quantity,
      'المنتج': o.producedQty,
      'الحالة': o.status,
      'التكلفة': o.totalCost,
    }))
    exportToCSV('production-orders', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (o: ProductionOrder) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info"><h2>الأستاذ</h2><p>نظام المحاسبة والإدارة المالية</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">أمر إنتاج</div>
          <div class="code">${o.code}</div>
          <div class="date">${formatDate(o.plannedStart)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المنتج النهائي</div>
        <div class="name">${o.product?.nameAr ?? ''}</div>
        <div class="sub">SKU: ${o.product?.sku ?? ''} · قائمة التركيب: ${o.bom?.code ?? ''}</div>
      </div>
      <table>
        <thead><tr><th>الكمية المخططة</th><th>الكمية المنتجة</th><th>الهدر</th><th>الحالة</th><th>التكلفة</th></tr></thead>
        <tbody>
          <tr>
            <td>${o.quantity}</td>
            <td>${o.producedQty}</td>
            <td>${o.scrapQty}</td>
            <td>${o.status}</td>
            <td>${formatCurrency(o.totalCost)}</td>
          </tr>
        </tbody>
      </table>
      ${o.notes ? `<div class="notes">${o.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">مدير الإنتاج</div></div>
        <div class="sig"><div class="line"></div><div class="label">مشرف الورشة</div></div>
        <div class="sig"><div class="line"></div><div class="label">الجودة</div></div>
      </div>
    `
    printHTML(html, `أمر إنتاج ${o.code}`)
  }

  return (
    <ModuleShell
      title={t('module.production-orders')}
      description="إدارة أوامر الإنتاج: من التحرير إلى الإنتاج إلى الإغلاق"
      icon={<Factory className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الأمر..."
      onAdd={() => { resetForm(); setDialogOpen(true) }}
      addLabel="أمر إنتاج جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="released">مُحرّر</SelectItem>
            <SelectItem value="produced">مُنتَج</SelectItem>
            <SelectItem value="closed">مُقفل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الأوامر" value={formatInt(stats.total)} icon={<Factory className="size-5" />} accent="emerald" />
        <KpiCard title="قيد التنفيذ" value={formatInt(stats.inProgress)} icon={<PlayCircle className="size-5" />} accent="amber" />
        <KpiCard title="مُنتَجة" value={formatInt(stats.produced)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
        <KpiCard title="إجمالي التكلفة" value={formatCurrency(stats.totalCost)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>قائمة التركيب</TableHead>
                <TableHead className="text-end num-cell">الكمية</TableHead>
                <TableHead className="text-end num-cell">المُنتَج</TableHead>
                <TableHead className="text-end num-cell">التكلفة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد أوامر إنتاج. ابدأ بإنشاء أول أمر.</TableCell></TableRow>
              ) : items.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{o.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">{o.product?.sku ?? '—'}</Badge>
                      <span className="text-sm">{o.product?.nameAr ?? '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono" dir="ltr">{o.bom?.code ?? '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatNumber(o.quantity, 2)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-emerald-600" dir="ltr">{formatNumber(o.producedQty, 2)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(o.totalCost)}</span></TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {['draft', 'planned'].includes(o.status) && (
                        <Button size="icon" variant="ghost" className="size-8 text-sky-600" title="تحرير" onClick={() => actionMutation.mutate({ id: o.id, action: 'release' })}>
                          <PlayCircle className="size-3.5" />
                        </Button>
                      )}
                      {['released', 'in_progress'].includes(o.status) && (
                        <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="إكمال" onClick={() => actionMutation.mutate({ id: o.id, action: 'complete' })}>
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}
                      {['produced', 'costed'].includes(o.status) && (
                        <Button size="icon" variant="ghost" className="size-8 text-amber-600" title="إغلاق" onClick={() => actionMutation.mutate({ id: o.id, action: 'close' })}>
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" title="طباعة" onClick={() => handlePrint(o)}>
                        <Printer className="size-3.5" />
                      </Button>
                      {o.status === 'draft' && (
                        <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(o.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>أمر إنتاج جديد</DialogTitle>
            <DialogDescription>اختر قائمة التركيب والكمية المطلوب إنتاجها</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>قائمة التركيب *</Label>
                <Select value={bomId} onValueChange={setBomId}>
                  <SelectTrigger><SelectValue placeholder="اختر القائمة" /></SelectTrigger>
                  <SelectContent>
                    {boms.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span dir="ltr" className="font-mono text-xs">{b.code}</span> — {b.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">الكمية *</Label>
                <Input id="quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plannedStart">تاريخ البدء المخطط</Label>
                <Input id="plannedStart" type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plannedEnd">تاريخ الانتهاء المخطط</Label>
                <Input id="plannedEnd" type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
