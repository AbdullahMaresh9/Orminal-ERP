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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
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
  const { t, isRTL, dir } = useT()
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
      'الكمية المنتجة': o.producedQty,
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
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال</h2><p>نظام إدارة موارد المؤسسات ERP</p></div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي الأوامر" value={formatInt(stats.total)} icon={<Factory className="size-5" />} accent="blue" />
        <KpiCard title="قيد التنفيذ" value={formatInt(stats.inProgress)} icon={<PlayCircle className="size-5" />} accent="amber" />
        <KpiCard title="مُنتَجة" value={formatInt(stats.produced)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
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
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-blue-600" dir="ltr">{formatNumber(o.producedQty, 2)}</span></TableCell>
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
                        <Button size="icon" variant="ghost" className="size-8 text-blue-600" title="إكمال" onClick={() => actionMutation.mutate({ id: o.id, action: 'complete' })}>
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
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Factory className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'أمر إنتاج جديد' : 'New Production Order'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-start">
                  <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'قائمة التركيب *' : 'Bill of Materials *'}</Label>
                  <Select value={bomId} onValueChange={setBomId}>
                    <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500"><SelectValue placeholder={isRTL ? 'اختر القائمة' : 'Select BOM'} /></SelectTrigger>
                    <SelectContent>
                      {boms.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span dir="ltr" className="font-mono text-xs">{b.code}</span> — {b.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="quantity" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الكمية المطلوبة *' : 'Planned Quantity *'}</Label>
                  <Input id="quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="plannedStart" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'تاريخ البدء المخطط' : 'Planned Start Date'}</Label>
                  <Input id="plannedStart" type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="plannedEnd" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'تاريخ الانتهاء المخطط' : 'Planned End Date'}</Label>
                  <Input id="plannedEnd" type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="notes" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isRTL ? 'أي تفاصيل أو ملاحظات إضافية...' : 'Any additional details...'} rows={3} className="border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
              {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إنشاء وحفظ' : 'Create & Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
