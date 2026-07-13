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
  FileText, Plus, Trash2, Printer, FileSignature, CheckCircle2, Clock, Percent,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Product { id: string; sku: string; nameAr: string; salePrice: number }
interface SalesQuotationLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitPrice: number
  discountAmount: number
  discountPercent: number
  taxRate: number
  total: number
}
interface SalesQuotation {
  id: string
  code: string
  quotationDate: string
  validUntil?: string
  status: string
  subtotal: number
  taxTotal: number
  discount: number
  total: number
  notes?: string
  convertedSalesOrderId?: string
  partner?: Partner
  lines: SalesQuotationLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
}

const STATUS_FLOW = ['draft', 'sent', 'accepted', 'expired', 'cancelled', 'converted']
const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  sent: 'مُرسل',
  accepted: 'مقبول',
  expired: 'منتهي',
  cancelled: 'ملغي',
  converted: 'تم تحويله',
}

export function SalesQuotationsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesQuotation[]; meta: any }>({
    queryKey: ['sales-quotations', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-quotations?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-sq'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-sq'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const quotations = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  const stats = useMemo(() => {
    const accepted = quotations.filter((q) => q.status === 'accepted' || q.status === 'converted').length
    const pending = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length
    const converted = quotations.filter((q) => q.status === 'converted').length
    const conversionRate = quotations.length > 0 ? (converted / quotations.length) * 100 : 0
    return { total: quotations.length, accepted, pending, conversionRate }
  }, [quotations])

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0, discount = 0
    for (const l of lines) {
      const qty = Number(l.quantity) || 0
      const price = Number(l.unitPrice) || 0
      const disc = Number(l.discountAmount) || 0
      const taxRate = Number(l.taxRate) || 0
      const lineNet = qty * price - disc
      const lineTax = lineNet * (taxRate / 100)
      subtotal += qty * price
      discount += disc
      taxTotal += lineTax
    }
    return { subtotal, taxTotal, discount, total: subtotal - discount + taxTotal }
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

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId('')
    setQuotationDate(new Date().toISOString().slice(0, 10))
    setValidUntil('')
    setNotes('')
    setStatus('draft')
    setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر العميل')
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        partnerId,
        quotationDate,
        validUntil: validUntil || undefined,
        status,
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/sales-quotations', {
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
      toast.success('تم إنشاء عرض السعر بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const convertMutation = useMutation({
    mutationFn: async (q: SalesQuotation) => {
      // Convert: creates a sales order from the quotation
      const payload = {
        partnerId: q.partnerId,
        quotationId: q.id,
        orderDate: new Date().toISOString().slice(0, 10),
        status: 'draft',
        lines: q.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          taxRate: l.taxRate,
        })),
      }
      const r = await fetch('/api/erp/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل التحويل')
      }
      // Update quotation status to "converted"
      const so = await r.json()
      await fetch(`/api/erp/sales-quotations/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted', convertedSalesOrderId: so.data.id }),
      })
      return so
    },
    onSuccess: () => {
      toast.success('تم التحويل إلى أمر بيع')
      qc.invalidateQueries({ queryKey: ['sales-quotations'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = quotations.map((q) => ({
      'الرمز': q.code,
      'العميل': q.partner?.nameAr ?? '',
      'التاريخ': formatDate(q.quotationDate),
      'صالح حتى': q.validUntil ? formatDate(q.validUntil) : '',
      'الإجمالي': q.total,
      'الحالة': STATUS_LABELS[q.status] ?? q.status,
    }))
    exportToCSV('sales-quotations', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (q: SalesQuotation) => {
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
          <div class="type">عرض سعر</div>
          <div class="code">${q.code}</div>
          <div class="date">${formatDate(q.quotationDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">العميل</div>
        <div class="name">${q.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${q.partner?.code ?? ''}</div>
        ${q.validUntil ? `<div class="sub">صالح حتى: ${formatDate(q.validUntil)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الخصم</th>
            <th>الضريبة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${q.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.quantity}</td>
              <td>${formatCurrency(l.unitPrice)}</td>
              <td>${formatCurrency(l.discountAmount)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي:</span><span>${formatCurrency(q.subtotal)}</span></div>
        <div class="row"><span>الخصم:</span><span>${formatCurrency(q.discount)}</span></div>
        <div class="row"><span>الضريبة:</span><span>${formatCurrency(q.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(q.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المندوب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
      </div>
    `
    printHTML(html, `عرض سعر ${q.code}`)
  }

  return (
    <ModuleShell
      title={t('module.sales-quotations')}
      description="إدارة عروض أسعار العملاء وتحويلها إلى أوامر بيع"
      icon={<FileSignature className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز العرض أو العميل..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="عرض سعر جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي العروض" value={formatInt(stats.total)} icon={<FileSignature className="size-5" />} accent="blue" />
        <KpiCard title="المقبولة" value={formatInt(stats.accepted)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title="قيد الانتظار" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="معدل التحويل" value={`${stats.conversionRate.toFixed(1)}%`} icon={<Percent className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>صالح حتى</TableHead>
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : quotations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد عروض أسعار. ابدأ بإنشاء أول عرض.</TableCell></TableRow>
              ) : quotations.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{q.code}</TableCell>
                  <TableCell className="font-medium">{q.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(q.quotationDate)}</TableCell>
                  <TableCell className="text-sm">{q.validUntil ? formatDate(q.validUntil) : '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(q.total)}</span></TableCell>
                  <TableCell><StatusBadge status={q.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {q.status === 'accepted' && !q.convertedSalesOrderId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-blue-600"
                          disabled={convertMutation.isPending}
                          onClick={() => convertMutation.mutate(q)}
                        >
                          <FileText className="size-3.5" />
                          <span className="text-xs">تحويل لأمر بيع</span>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(q)}>
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
          عرض {quotations.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + quotations.length} من {total}
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
            <DialogTitle>عرض سعر جديد</DialogTitle>
            <DialogDescription>اختر العميل وأضف بنود عرض السعر</DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-1">
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
                <Label htmlFor="quotationDate">تاريخ العرض</Label>
                <Input id="quotationDate" type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">صالح حتى</Label>
                <Input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>

            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">المنتج</TableHead>
                    <TableHead className="text-end num-cell w-20">الكمية</TableHead>
                    <TableHead className="text-end num-cell w-28">السعر</TableHead>
                    <TableHead className="text-end num-cell w-24">الخصم</TableHead>
                    <TableHead className="text-end num-cell w-20">الضريبة %</TableHead>
                    <TableHead className="text-end num-cell w-28">الإجمالي</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const qty = Number(l.quantity) || 0
                    const price = Number(l.unitPrice) || 0
                    const disc = Number(l.discountAmount) || 0
                    const taxRate = Number(l.taxRate) || 0
                    const lineTotal = (qty * price - disc) * (1 + taxRate / 100)
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
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitPrice} onChange={(e) => updateLine(l.key, 'unitPrice', e.target.value)} />
                        </TableCell>
                        <TableCell className="text-end num-cell">
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.discountAmount} onChange={(e) => updateLine(l.key, 'discountAmount', e.target.value)} />
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
                    <TableCell colSpan={5}>
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

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">المجموع الفرعي</p>
                <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.subtotal)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">الضريبة</p>
                <p className="font-bold tabular-nums" dir="ltr">{formatCurrency(computed.taxTotal)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-700 dark:text-blue-400">الإجمالي</p>
                <p className="font-bold tabular-nums text-blue-700 dark:text-blue-400" dir="ltr">{formatCurrency(computed.total)}</p>
              </div>
            </div>

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
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
