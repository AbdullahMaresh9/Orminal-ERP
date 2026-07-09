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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Receipt, Plus, Trash2, Printer, Coins, Wallet,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Product { id: string; sku: string; nameAr: string; salePrice: number }
interface SalesInvoiceLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  total: number
}
interface SalesInvoice {
  id: string
  code: string
  invoiceDate: string
  dueDate?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  paid: number
  notes?: string
  partner?: Partner
  lines: SalesInvoiceLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
}

export function SalesInvoicesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: SalesInvoice[]; meta: any }>({
    queryKey: ['sales-invoices', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/sales-invoices?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['partners-for-si'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-si'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const invoices = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []

  const stats = {
    total: invoices.length,
    totalInvoiced: invoices.reduce((s, o) => s + o.total, 0),
    totalPaid: invoices.reduce((s, o) => s + o.paid, 0),
    outstanding: invoices.reduce((s, o) => s + (o.total - o.paid), 0),
  }

  const [partnerId, setPartnerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
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
      subtotal += qty * price
      discount += disc
      taxTotal += (qty * price - disc) * (taxRate / 100)
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
    if (lines.length <= 1) {
      toast.error('يجب وجود بند واحد على الأقل')
      return
    }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId('')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setDueDate('')
    setNotes('')
    setLines([{ key: '1', productId: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر العميل')
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        partnerId,
        invoiceDate,
        dueDate: dueDate || undefined,
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/sales-invoices', {
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
      toast.success('تم إنشاء الفاتورة وترحيل القيد بنجاح')
      qc.invalidateQueries({ queryKey: ['sales-invoices'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = invoices.map((o) => ({
      'الرمز': o.code,
      'العميل': o.partner?.nameAr ?? '',
      'التاريخ': formatDate(o.invoiceDate),
      'الإجمالي': o.total,
      'المدفوع': o.paid,
      'المتبقي': o.total - o.paid,
      'الحالة': o.status,
    }))
    exportToCSV('sales-invoices', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (inv: SalesInvoice) => {
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
          <div class="type">فاتورة ضريبية</div>
          <div class="code">${inv.code}</div>
          <div class="date">${formatDate(inv.invoiceDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">العميل</div>
        <div class="name">${inv.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${inv.partner?.code ?? ''}</div>
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
          ${inv.lines.map((l) => `
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
        <div class="row"><span>المجموع الفرعي:</span><span>${formatCurrency(inv.subtotal)}</span></div>
        <div class="row"><span>الضريبة (15%):</span><span>${formatCurrency(inv.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(inv.total)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العميل</div></div>
      </div>
    `
    printHTML(html, `فاتورة ضريبية ${inv.code}`)
  }

  return (
    <ModuleShell
      title={t('module.sales-invoices')}
      description="فواتير البيع الضريبية مع الترحيل المحاسبي التلقائي"
      icon={<Receipt className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الفاتورة أو العميل..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="فاتورة جديدة"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="posted">مُرحّل</SelectItem>
            <SelectItem value="paid">مدفوع</SelectItem>
            <SelectItem value="overdue">متأخر</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الفواتير" value={formatInt(total)} icon={<Receipt className="size-5" />} accent="emerald" />
        <KpiCard title="إجمالي الفوترة" value={formatCurrency(stats.totalInvoiced)} icon={<Coins className="size-5" />} accent="teal" />
        <KpiCard title="المحصّل" value={formatCurrency(stats.totalPaid)} icon={<Wallet className="size-5" />} accent="violet" />
        <KpiCard title="المتبقي" value={formatCurrency(stats.outstanding)} icon={<Wallet className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead className="text-end num-cell">المدفوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد فواتير. ابدأ بإنشاء أول فاتورة.</TableCell></TableRow>
              ) : invoices.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{o.code}</TableCell>
                  <TableCell className="font-medium">{o.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(o.invoiceDate)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(o.total)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(o.paid)}</span></TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-end">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(o)}>
                      <Printer className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {invoices.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + invoices.length} من {total}
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
            <DialogTitle>فاتورة ضريبية جديدة</DialogTitle>
            <DialogDescription>سيتم ترحيل القيد المحاسبي تلقائياً عند الحفظ (مدين الذمم / دائن المبيعات + الضريبة)</DialogDescription>
          </DialogHeader>
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
                <Label htmlFor="invoiceDate">تاريخ الفاتورة</Label>
                <Input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">الإجمالي</p>
                <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">{formatCurrency(computed.total)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء وترحيل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
