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
  Plus, Trash2, Printer, Hash, Wallet, Coins, Receipt,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Product { id: string; sku: string; nameAr: string; costPrice: number }
interface PurchaseOrder { id: string; code: string; partnerId: string }
interface PurchaseInvoiceLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  unitCost: number
  discountAmount: number
  taxRate: number
  total: number
}
interface PurchaseInvoice {
  id: string
  code: string
  partnerId: string
  purchaseOrderId?: string | null
  billDate: string
  accountingDate?: string
  dueDate?: string
  vendorBillNo?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  paid: number
  notes?: string
  partner?: Partner
  lines: PurchaseInvoiceLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  unitCost: string
  discountAmount: string
  taxRate: string
}

export function PurchaseInvoicesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseInvoice[]; meta: any }>({
    queryKey: ['purchase-invoices', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-invoices?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: poData } = useQuery<{ data: PurchaseOrder[] }>({
    queryKey: ['pos-for-pinv'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-orders?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const invoices = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const products = productsData?.data ?? []
  const purchaseOrders = poData?.data ?? []

  const stats = useMemo(() => ({
    totalBilled: invoices.reduce((s, i) => s + i.total, 0),
    totalPaid: invoices.reduce((s, i) => s + i.paid, 0),
    outstanding: invoices.reduce((s, i) => s + (i.total - i.paid), 0),
    count: invoices.length,
  }), [invoices])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [vendorBillNo, setVendorBillNo] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountingDate, setAccountingDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' },
  ])

  const computed = useMemo(() => {
    let subtotal = 0, taxTotal = 0, discount = 0
    for (const l of lines) {
      const qty = Number(l.quantity) || 0
      const cost = Number(l.unitCost) || 0
      const disc = Number(l.discountAmount) || 0
      const taxRate = Number(l.taxRate) || 0
      const lineNet = qty * cost - disc
      const lineTax = lineNet * (taxRate / 100)
      subtotal += qty * cost
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
        if (p) next.unitCost = String(p.costPrice)
      }
      return next
    }))
  }

  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setPartnerId(''); setPurchaseOrderId(''); setVendorBillNo('')
    setBillDate(new Date().toISOString().slice(0, 10))
    setAccountingDate(new Date().toISOString().slice(0, 10))
    setDueDate(''); setNotes('')
    setLines([{ key: '1', productId: '', quantity: '1', unitCost: '0', discountAmount: '0', taxRate: '15' }])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر المورد')
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        partnerId,
        purchaseOrderId: purchaseOrderId || undefined,
        vendorBillNo,
        billDate,
        accountingDate,
        dueDate: dueDate || undefined,
        status: 'posted',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        })),
      }
      const r = await fetch('/api/erp/purchase-invoices', {
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
      toast.success('تم إنشاء فاتورة المشتريات وترحيلها')
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = invoices.map((i) => ({
      'الرمز': i.code,
      'المورد': i.partner?.nameAr ?? '',
      'أمر الشراء': purchaseOrders.find((p) => p.id === i.purchaseOrderId)?.code ?? '',
      'رقم فاتورة المورد': i.vendorBillNo ?? '',
      'تاريخ الفاتورة': formatDate(i.billDate),
      'تاريخ الاستحقاق': i.dueDate ? formatDate(i.dueDate) : '',
      'الإجمالي': i.total,
      'المدفوع': i.paid,
      'المتبقي': i.total - i.paid,
      'الحالة': i.status,
    }))
    exportToCSV('purchase-invoices', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (i: PurchaseInvoice) => {
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
          <div class="type">فاتورة مشتريات</div>
          <div class="code">${i.code}</div>
          <div class="date">${formatDate(i.billDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المورد</div>
        <div class="name">${i.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${i.partner?.code ?? ''}</div>
        ${i.vendorBillNo ? `<div class="sub">رقم فاتورة المورد: ${i.vendorBillNo}</div>` : ''}
        ${i.dueDate ? `<div class="sub">تاريخ الاستحقاق: ${formatDate(i.dueDate)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>التكلفة</th>
            <th>الخصم</th>
            <th>الضريبة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${i.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.quantity}</td>
              <td>${formatCurrency(l.unitCost)}</td>
              <td>${formatCurrency(l.discountAmount)}</td>
              <td>${l.taxRate}%</td>
              <td>${formatCurrency(l.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي:</span><span>${formatCurrency(i.subtotal)}</span></div>
        <div class="row"><span>الضريبة:</span><span>${formatCurrency(i.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(i.total)}</span></div>
        <div class="row"><span>المدفوع:</span><span>${formatCurrency(i.paid)}</span></div>
        <div class="row"><span>المتبقي:</span><span>${formatCurrency(i.total - i.paid)}</span></div>
      </div>
      ${i.notes ? `<div class="notes">${i.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">المورد</div></div>
      </div>
    `
    printHTML(html, `فاتورة مشتريات ${i.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-invoices')}
      description="فواتير المشتريات من الموردين مع الترحيل المحاسبي التلقائي"
      icon={<Receipt className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الفاتورة أو رقم المورد..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="فاتورة مشتريات جديدة"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="posted">مُرحّل</SelectItem>
            <SelectItem value="partially_paid">مدفوع جزئياً</SelectItem>
            <SelectItem value="paid">مدفوع</SelectItem>
            <SelectItem value="reversed">معكوس</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي الفواتير" value={formatCurrency(stats.totalBilled)} icon={<Receipt className="size-5" />} accent="blue" />
        <KpiCard title="إجمالي المدفوع" value={formatCurrency(stats.totalPaid)} icon={<Wallet className="size-5" />} accent="sky" />
        <KpiCard title="المستحق" value={formatCurrency(stats.outstanding)} icon={<Coins className="size-5" />} accent="amber" />
        <KpiCard title="عدد الفواتير" value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>أمر الشراء</TableHead>
                <TableHead>تاريخ الفاتورة</TableHead>
                <TableHead>الاستحقاق</TableHead>
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead className="text-end num-cell">المدفوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد فواتير مشتريات.</TableCell></TableRow>
              ) : invoices.map((i) => (
                <TableRow key={i.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{i.code}</TableCell>
                  <TableCell className="font-medium">{i.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{purchaseOrders.find((p) => p.id === i.purchaseOrderId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(i.billDate)}</TableCell>
                  <TableCell className="text-sm">{i.dueDate ? formatDate(i.dueDate) : '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(i.total)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(i.paid)}</span></TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  <TableCell className="text-end">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(i)}>
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
            <DialogTitle>فاتورة مشتريات جديدة</DialogTitle>

          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>المورد *</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
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
                <Label>أمر الشراء (اختياري)</Label>
                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    {purchaseOrders
                      .filter((p) => !partnerId || p.partnerId === partnerId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span dir="ltr" className="font-mono text-xs">{p.code}</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendorBillNo">رقم فاتورة المورد</Label>
                <Input id="vendorBillNo" value={vendorBillNo} onChange={(e) => setVendorBillNo(e.target.value)} placeholder="—" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="billDate">تاريخ الفاتورة</Label>
                <Input id="billDate" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountingDate">تاريخ القيد</Label>
                <Input id="accountingDate" type="date" value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} />
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
                    <TableHead className="text-end num-cell w-28">التكلفة</TableHead>
                    <TableHead className="text-end num-cell w-24">الخصم</TableHead>
                    <TableHead className="text-end num-cell w-20">الضريبة %</TableHead>
                    <TableHead className="text-end num-cell w-28">الإجمالي</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const qty = Number(l.quantity) || 0
                    const cost = Number(l.unitCost) || 0
                    const disc = Number(l.discountAmount) || 0
                    const taxRate = Number(l.taxRate) || 0
                    const lineTotal = (qty * cost - disc) * (1 + taxRate / 100)
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
                          <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.unitCost} onChange={(e) => updateLine(l.key, 'unitCost', e.target.value)} />
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
                {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء وترحيل'}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
