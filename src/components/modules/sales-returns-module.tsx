'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Undo2, Plus, Trash2, Printer, CheckCircle2, Clock, Coins, PackageCheck,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface SalesReturnLine {
  id?: string
  productId?: string
  product?: { id: string; sku: string; nameAr: string }
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
}
interface SalesReturn {
  id: string
  code: string
  partnerId: string
  originalInvoiceId?: string | null
  date: string
  reason?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  notes?: string
  partner?: Partner
  lines: SalesReturnLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'approved', 'received', 'credited', 'closed', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  approved: 'معتمد',
  received: 'مستلم',
  credited: 'مُصدَر إشعار دائن',
  closed: 'مغلق',
  cancelled: 'ملغي',
}

export function SalesReturnsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesReturn[]; meta: any }>({
    queryKey: ['sales-returns', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-returns?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-sr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['sales-invoices-for-sr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/sales-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: { id: string; sku: string; nameAr: string; salePrice: number }[] }>({
    queryKey: ['products-for-sr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const returns = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const products = productsData?.data ?? []

  const stats = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'received').length,
    approved: returns.filter((r) => r.status === 'credited' || r.status === 'closed').length,
    totalValue: returns.reduce((s, r) => s + r.total, 0),
  }), [returns])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [originalInvoiceId, setOriginalInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitPrice: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0
    for (const l of lines) {
      const sub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
      const tax = sub * ((Number(l.taxRate) || 0) / 100)
      subtotal += sub; taxTotal += tax
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal }
  }, [lines])

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [field]: value }
      if (field === 'productId') {
        const p = products.find((p) => p.id === value)
        if (p) next.unitPrice = String(p.salePrice)
      }
      return next
    }))
  }

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitPrice: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId(''); setOriginalInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason(''); setNotes(''); setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر العميل')
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        partnerId,
        originalInvoiceId: originalInvoiceId || undefined,
        date,
        reason,
        status: 'draft',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/sales-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء مرتجع المبيعات')
      qc.invalidateQueries({ queryKey: ['sales-returns'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ ret, action }: { ret: SalesReturn; action: string }) => {
      const r = await fetch(`/api/erp/sales-returns/${ret.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الإجراء')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم تنفيذ الإجراء')
      qc.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = returns.map((r) => ({
      'الرمز': r.code,
      'العميل': r.partner?.nameAr ?? '',
      'الفاتورة الأصلية': invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '',
      'التاريخ': formatDate(r.date),
      'الإجمالي': r.total,
      'الحالة': STATUS_LABELS[r.status] ?? r.status,
    }))
    exportToCSV('sales-returns', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (r: SalesReturn) => {
    const origInv = invoices.find((i) => i.id === r.originalInvoiceId)
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال</h2>
            <p>نظام إدارة موارد المؤسسات ERP</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">مرتجع مبيعات</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">العميل</div>
        <div class="name">${r.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${r.partner?.code ?? ''}</div>
        ${origInv ? `<div class="sub">فاتورة أصلية: ${origInv.code}</div>` : ''}
        ${r.reason ? `<div class="sub">السبب: ${r.reason}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الضريبة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${r.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.quantity}</td>
              <td>${formatCurrency(l.unitPrice)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي:</span><span>${formatCurrency(r.subtotal)}</span></div>
        <div class="row"><span>الضريبة:</span><span>${formatCurrency(r.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(r.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
      </div>
    `
    printHTML(html, `مرتجع مبيعات ${r.code}`)
  }

  return (
    <ModuleShell
      title={t('module.sales-returns')}
      description="إدارة مرتجعات المبيعات مع عكس القيود تلقائياً عند الإصدار"
      icon={<Undo2 className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز المرتجع أو السبب..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="مرتجع جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي المرتجعات" value={formatInt(stats.total)} icon={<Undo2 className="size-5" />} accent="blue" />
        <KpiCard title="قيد المعالجة" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="مُرحّلة" value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title="إجمالي القيمة" value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الفاتورة الأصلية</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : returns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد مرتجعات.</TableCell></TableRow>
              ) : returns.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{invoices.find((i) => i.id === r.originalInvoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(r.total)}</span></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-sky-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'approve' })}>
                          <CheckCircle2 className="size-3.5" /> اعتماد
                        </Button>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'receive' })}>
                          <PackageCheck className="size-3.5" /> استلام
                        </Button>
                      )}
                      {r.status === 'received' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'credit' })}>
                          <Coins className="size-3.5" /> إصدار إشعار دائن
                        </Button>
                      )}
                      {r.status === 'credited' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-blue-700" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ ret: r, action: 'close' })}>
                          إغلاق
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)}>
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {returns.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + returns.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>مرتجع مبيعات جديد</DialogTitle>

          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>العميل *</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span dir="ltr" className="font-mono text-xs">{p.code}</span> — {p.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الفاتورة الأصلية</Label>
                  <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
                    <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter((i) => !partnerId || i.partnerId === partnerId)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            <span dir="ltr" className="font-mono text-xs">{i.code}</span> — {formatCurrency(i.total)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">التاريخ</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">سبب الإرجاع</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تالف، خطأ في الشحن..." />
              </div>

              <Card className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="ps-3">المنتج</TableHead>
                      <TableHead className="text-end num-cell w-22">الكمية</TableHead>
                      <TableHead className="text-end num-cell w-38">السعر</TableHead>
                      <TableHead className="text-end num-cell w-20">الضريبة %</TableHead>
                      <TableHead className="text-end num-cell w-28">الإجمالي</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const qty = Number(l.quantity) || 0
                      const price = Number(l.unitPrice) || 0
                      const taxRate = Number(l.taxRate) || 0
                      const lineTotal = qty * price * (1 + taxRate / 100)
                      return (
                        <TableRow key={l.key}>
                          <TableCell className="ps-3">
                            <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                              <SelectTrigger className="h-9 min-w-[220px]"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="1" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.taxRate} onChange={(e) => updateLine(l.key, 'taxRate', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-end num-cell">
                            <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(lineTotal)}</span>
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                          <Plus className="size-3.5" /> إضافة بند
                        </Button>
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(computed.total)}</span>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </Card>

              <div className="space-y-1.5">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
