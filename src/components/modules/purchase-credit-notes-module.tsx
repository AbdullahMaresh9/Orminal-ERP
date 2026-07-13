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
  FileMinus, Plus, Printer, Hash, CalendarDays, Coins,
} from 'lucide-react'

interface Partner { id: string; code: string; nameAr: string }
interface Invoice { id: string; code: string; total: number; partnerId: string }
interface PurchaseCreditNote {
  id: string
  code: string
  partnerId: string
  invoiceId?: string | null
  date: string
  reason?: string
  status: string
  subtotal: number
  taxTotal: number
  total: number
  notes?: string
  partner?: Partner
}

const REASON_OPTIONS = [
  { value: 'returned', label: 'مرتجع بضاعة للمورد' },
  { value: 'discount', label: 'خصم بعد الفوترة' },
  { value: 'correction', label: 'تصحيح خطأ' },
  { value: 'cancellation', label: 'إلغاء فاتورة' },
  { value: 'other', label: 'أخرى' },
]
const REASON_LABELS: Record<string, string> = Object.fromEntries(REASON_OPTIONS.map((r) => [r.value, r.label]))

export function PurchaseCreditNotesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseCreditNote[]; meta: any }>({
    queryKey: ['purchase-credit-notes', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-credit-notes?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: partnersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['purchase-invoices-for-pcn'],
    queryFn: async () => {
      const r = await fetch('/api/erp/purchase-invoices?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const notes = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const partners = partnersData?.data ?? []
  const invoices = invoicesData?.data ?? []

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = notes.filter((n) => {
      const d = new Date(n.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      total: notes.reduce((s, n) => s + n.total, 0),
      count: notes.length,
      thisMonthTotal: thisMonth.reduce((s, n) => s + n.total, 0),
      thisMonthCount: thisMonth.length,
    }
  }, [notes])

  // Form
  const [partnerId, setPartnerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('returned')
  const [amount, setAmount] = useState('0')
  const [notes_, setNotes] = useState('')

  const resetForm = () => {
    setPartnerId(''); setInvoiceId(''); setDate(new Date().toISOString().slice(0, 10))
    setReason('returned'); setAmount('0'); setNotes('')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error('اختر المورد')
      const amt = Number(amount) || 0
      if (amt <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر')
      const payload = {
        partnerId,
        invoiceId: invoiceId || null,
        date,
        reason: REASON_LABELS[reason] ?? reason,
        subtotal: amt,
        taxTotal: 0,
        total: amt,
        notes: notes_,
      }
      const r = await fetch('/api/erp/purchase-credit-notes', {
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
      toast.success('تم إنشاء الإشعار الدائن للمشتريات')
      qc.invalidateQueries({ queryKey: ['purchase-credit-notes'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = notes.map((n) => ({
      'الرمز': n.code,
      'المورد': n.partner?.nameAr ?? '',
      'الفاتورة': invoices.find((i) => i.id === n.invoiceId)?.code ?? '',
      'التاريخ': formatDate(n.date),
      'الإجمالي': n.total,
      'الحالة': n.status,
      'السبب': n.reason ?? '',
    }))
    exportToCSV('purchase-credit-notes', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (n: PurchaseCreditNote) => {
    const inv = invoices.find((i) => i.id === n.invoiceId)
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
          <div class="type">إشعار دائن مشتريات</div>
          <div class="code">${n.code}</div>
          <div class="date">${formatDate(n.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المورد</div>
        <div class="name">${n.partner?.nameAr ?? ''}</div>
        <div class="sub">رمز: ${n.partner?.code ?? ''}</div>
        ${inv ? `<div class="sub">فاتورة مرتبطة: ${inv.code}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>البيان</th>
            <th>القيمة</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>المبلغ</td><td>${formatCurrency(n.total)}</td></tr>
          <tr><td>السبب</td><td>${n.reason ?? ''}</td></tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="row grand"><span>الإجمالي:</span><span>${formatCurrency(n.total)}</span></div>
      </div>
      ${n.notes ? `<div class="notes">${n.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
        <div class="sig"><div class="line"></div><div class="label">المورد</div></div>
      </div>
    `
    printHTML(html, `إشعار دائن مشتريات ${n.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-credit-notes')}
      description="إشعارات دائنة للمشتريات مع تقليل رصيد المورد"
      icon={<FileMinus className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الإشعار أو السبب..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="إشعار دائن جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="posted">مُرحّل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الإشعارات" value={formatCurrency(stats.total)} icon={<Coins className="size-5" />} accent="blue" />
        <KpiCard title="عدد الإشعارات" value={formatInt(stats.count)} icon={<Hash className="size-5" />} accent="sky" />
        <KpiCard title="هذا الشهر" value={formatCurrency(stats.thisMonthTotal)} icon={<CalendarDays className="size-5" />} accent="amber" />
        <KpiCard title="عدد هذا الشهر" value={formatInt(stats.thisMonthCount)} icon={<FileMinus className="size-5" />} accent="violet" />
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
                <TableHead className="text-end num-cell">الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : notes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد إشعارات دائنة.</TableCell></TableRow>
              ) : notes.map((n) => (
                <TableRow key={n.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{n.code}</TableCell>
                  <TableCell className="font-medium">{n.partner?.nameAr ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{invoices.find((i) => i.id === n.invoiceId)?.code ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(n.total)}</span></TableCell>
                  <TableCell><StatusBadge status={n.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{n.reason ?? '—'}</TableCell>
                  <TableCell className="text-end">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(n)}>
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
          عرض {notes.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + notes.length} من {total}
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
            <DialogTitle>إشعار دائن مشتريات جديد</DialogTitle>
            <DialogDescription>إنشاء إشعار دائن لمورد — سيتم تقليل رصيد المورد تلقائياً</DialogDescription>
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
                <Label>الفاتورة المرتبطة (اختياري)</Label>
                <Select value={invoiceId} onValueChange={(v) => {
                  setInvoiceId(v)
                  const inv = invoices.find((i) => i.id === v)
                  if (inv) setAmount(String(inv.total))
                }}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
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
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">التاريخ</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">المبلغ *</Label>
                <Input id="amount" type="number" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>السبب</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes_">ملاحظات</Label>
              <Textarea id="notes_" value={notes_} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
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
