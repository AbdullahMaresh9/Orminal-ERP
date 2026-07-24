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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
  Banknote, Plus, Printer, Hash, TrendingUp, CreditCard,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Invoice { id: string; code: string; total: number; paid: number; partnerId: string }
interface PurchasePayment {
  id: string
  code: string
  partnerId: string
  invoiceId?: string | null
  amount: number
  paymentDate: string
  method: string
  reference?: string
  status: string
  notes?: string
  partner?: Partner
}

const METHOD_OPTIONS = [
  { value: 'cash', label: 'نقد' },
  { value: 'card', label: 'بطاقة' },
  { value: 'transfer', label: 'تحويل' },
  { value: 'check', label: 'شيك' },
]
const METHOD_LABELS: Record<string, string> = Object.fromEntries(METHOD_OPTIONS.map((m) => [m.value, m.label]))

export function PurchasePaymentsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchasePayment[]; meta: any }>({
    queryKey: ['purchase-payments', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-payments?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['purchase-invoices-for-pp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const payments = (data?.data ?? []).filter((p) => filterMethod === 'all' || p.method === filterMethod)
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = payments.filter((p) => {
      const d = new Date(p.paymentDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const byMethod: Record<string, number> = {}
    for (const p of thisMonth) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount
    const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]
    return {
      monthTotal: thisMonth.reduce((s, p) => s + p.amount, 0),
      count: thisMonth.length,
      avg: thisMonth.length > 0 ? thisMonth.reduce((s, p) => s + p.amount, 0) / thisMonth.length : 0,
      topMethod: topMethod ? METHOD_LABELS[topMethod[0]] ?? topMethod[0] : '—',
    }
  }, [payments])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('0')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setPartnerId(''); setInvoiceId(''); setAmount('0')
    setPaymentDate(new Date().toISOString().slice(0, 10)); setMethod('cash')
    setReference(''); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر المورد')
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر')
      const payload = {
        partnerId,
        invoiceId: invoiceId || undefined,
        amount: amt,
        paymentDate,
        method,
        reference,
        notes,
        status: 'posted',
      }
      const r = await fetch('/api/erp/purchase-payments', {
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
      toast.success('تم إنشاء سند الصرف بنجاح')
      qc.invalidateQueries({ queryKey: ['purchase-payments'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = payments.map((p) => ({
      'الرمز': p.code,
      'المورد': p.partner?.nameAr ?? '',
      'الفاتورة': invoices.find((i) => i.id === p.invoiceId)?.code ?? '',
      'التاريخ': formatDate(p.paymentDate),
      'المبلغ': p.amount,
      'الطريقة': METHOD_LABELS[p.method] ?? p.method,
      'المرجع': p.reference ?? '',
      'الحالة': p.status,
    }))
    exportToCSV('purchase-payments', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (p: PurchasePayment) => {
    const inv = invoices.find((i) => i.id === p.invoiceId)
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
          <div class="type">سند صرف</div>
          <div class="code">${p.code}</div>
          <div class="date">${formatDate(p.paymentDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">صرفنا إلى</div>
        <div class="name">${p.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${p.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">فاتورة: ${inv.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>البيان</th>
            <th>القيمة</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>المبلغ المصروف</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>طريقة الدفع</td><td>${METHOD_LABELS[p.method] ?? p.method}</td></tr>
          ${p.reference ? `<tr><td>المرجع</td><td>${p.reference}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(p.amount)}</span></div>
      </div>
      ${p.notes ? `<div class="notes">${p.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">العامل</div></div>
        <div class="sig"><div class="line"></div><div class="label">المستلم</div></div>
      </div>
    `
    printHTML(html, `سند صرف ${p.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-payments')}
      description="سندات صرف الموردين وإيصالات الدفع"
      icon={<Banknote className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز السند أو المرجع..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="سند صرف جديد"
      onExport={handleExport}
      filters={
        <>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-36"><SelectValue placeholder="الطريقة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الطرق</SelectItem>
              {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="posted">مُرحّل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="صرف هذا الشهر" value={formatCurrency(stats.monthTotal)} icon={<Banknote className="size-5" />} accent="blue" />
        <KpiCard title="عدد السندات" value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title="متوسط السند" value={formatCurrency(stats.avg)} icon={<TrendingUp className="size-5" />} accent="violet" />
        <KpiCard title="أعلى طريقة" value={stats.topMethod} icon={<CreditCard className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>الفاتورة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-end num-cell">المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد سندات صرف.</TableCell></TableRow>
              ) : payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{invoices.find((i) => i.id === p.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(p.amount)}</span></TableCell>
                  <TableCell><span className="text-xs">{METHOD_LABELS[p.method] ?? p.method}</span></TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-end">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(p)}>
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
          عرض {payments.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + payments.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>سند صرف جديد</DialogTitle>

          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <Label>الفاتورة (اختياري)</Label>
                <Select value={invoiceId} onValueChange={(v) => {
                  setInvoiceId(v)
                  const inv = invoices.find((i) => i.id === v)
                  if (inv) setAmount(String(Math.max(0, inv.total - inv.paid)))
                }}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    {invoices
                      .filter((i) => !partnerId || i.partnerId === partnerId)
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          <span dir="ltr" className="font-mono text-xs">{i.code}</span> — متبقي {formatCurrency(i.total - i.paid)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">المبلغ *</Label>
                <Input id="amount" type="number" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentDate">التاريخ</Label>
                <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">المرجع</Label>
                <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم شيك / مرجع تحويل" />
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
