'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, formatInt } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TrendingUp, Plus, Printer, BarChart3, Coins, Banknote, Wallet, CircleDollarSign,
} from 'lucide-react'

const CATEGORIES = [
  'إيرادات تشغيلية', 'إيرادات استثمارية', 'أرباح بيع أصول', 'فوائد بنكية',
  'إيرادات إيجار', 'عمولات', 'مبيعات خدمات', 'إيرادات متنوعة',
]

interface BankAccount { id: string; name: string; bankName: string }
interface SafeItem { id: string; name: string; code: string }
interface Revenue {
  id: string
  code: string
  date: string
  amount: number
  payee?: string | null
  reference?: string | null
  note?: string | null
  status: string
  bankAccount?: { id: string; name: string; bankName: string } | null
  safe?: { id: string; name: string; code: string } | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = {
  date: todayISO(),
  amount: 0,
  source: '',
  category: CATEGORIES[0],
  destination: 'safe',
  bankAccountId: '',
  safeId: '',
  reference: '',
  note: '',
}

export function RevenuesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const queryString = new URLSearchParams()
  if (from) queryString.set('from', from)
  if (to) queryString.set('to', to)
  const qs = queryString.toString()

  const { data, isLoading } = useQuery<{ data: Revenue[]; total: number }>({
    queryKey: ['revenues', qs],
    queryFn: async () => {
      const r = await fetch(`/api/erp/revenues${qs ? `?${qs}` : ''}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: banksData } = useQuery<{ data: BankAccount[] }>({
    queryKey: ['bank-accounts-mini'],
    queryFn: async () => {
      const r = await fetch('/api/erp/bank-accounts')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const banks = (banksData?.data ?? []).filter((b) => b.active)

  const { data: safesData } = useQuery<{ data: SafeItem[] }>({
    queryKey: ['safes-mini'],
    queryFn: async () => {
      const r = await fetch('/api/erp/safes')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const safes = (safesData?.data ?? []).filter((s) => s.active)

  const list = data?.data ?? []
  const filtered = list.filter((e) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [e.code, e.payee, e.note, e.reference, e.bankAccount?.name, e.safe?.name].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  // KPIs (this month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthRevenues = list.filter((e) => new Date(e.date) >= monthStart)
  const totalMonth = monthRevenues.reduce((s, e) => s + e.amount, 0)
  const avgMonth = monthRevenues.length ? totalMonth / monthRevenues.length : 0
  const byCategory = new Map<string, number>()
  for (const e of monthRevenues) {
    const c = (e as any).category ?? 'متفرقات'
    byCategory.set(c, (byCategory.get(c) ?? 0) + e.amount)
  }

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'request failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم تسجيل الإيراد بنجاح')
      setOpen(false)
      setForm(emptyForm)
      qc.invalidateQueries({ queryKey: ['revenues'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['safes'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openAdd() {
    setForm({
      ...emptyForm,
      safeId: safes[0]?.id ?? '',
      bankAccountId: banks[0]?.id ?? '',
    })
    setOpen(true)
  }

  function submit() {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('أدخل مبلغاً صحيحاً')
      return
    }
    if (form.destination === 'bank' && !form.bankAccountId) {
      toast.error('اختر الحساب البنكي')
      return
    }
    if (form.destination === 'safe' && !form.safeId) {
      toast.error('اختر الخزينة')
      return
    }
    const payload: any = {
      date: form.date,
      amount: Number(form.amount),
      source: form.source,
      category: form.category,
      reference: form.reference,
      note: form.note,
    }
    if (form.destination === 'bank') payload.bankAccountId = form.bankAccountId
    else payload.safeId = form.safeId
    createMut.mutate(payload)
  }

  function handleExport() {
    exportToCSV(
      'revenues',
      filtered.map((e) => ({
        code: e.code,
        date: formatDate(e.date),
        source: e.payee ?? '',
        amount: e.amount,
        account: e.bankAccount?.name ?? e.safe?.name ?? '',
        reference: e.reference ?? '',
        note: e.note ?? '',
        status: e.status,
      })),
      [
        { key: 'code', label: 'الكود' },
        { key: 'date', label: 'التاريخ' },
        { key: 'source', label: 'المصدر' },
        { key: 'amount', label: 'المبلغ' },
        { key: 'account', label: 'الحساب' },
        { key: 'reference', label: 'المرجع' },
        { key: 'note', label: 'ملاحظات' },
        { key: 'status', label: 'الحالة' },
      ]
    )
  }

  function handlePrint(e: Revenue) {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال — نظام إدارة موارد المؤسسات ERP</h2>
            <p>سند قبض</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">سند قبض</div>
          <div class="code">${e.code}</div>
          <div class="date">${formatDate(e.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المصدر</div>
        <div class="name">${e.payee ?? '—'}</div>
        <div class="sub">الإيداع إلى: ${e.bankAccount?.name ?? e.safe?.name ?? '—'}</div>
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th>المرجع</th><th style="text-align:left">المبلغ</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${e.note ?? 'إيراد نقدي'}</td>
            <td>${e.reference ?? '—'}</td>
            <td style="text-align:left">${formatCurrency(e.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:right">الإجمالي</td>
            <td style="text-align:left">${formatCurrency(e.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="notes">تم الإيداع إلى ${e.bankAccount ? 'بنك' : 'خزينة'}: ${e.bankAccount?.name ?? e.safe?.name ?? ''}</div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المستلم</div></div>
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `سند قبض ${e.code}`)
  }

  return (
    <ModuleShell
      title={t('module.revenues')}
      description="تسجيل الإيرادات المتنوعة وإصدار سندات القبض تلقائياً"
      icon={<TrendingUp className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو المصدر أو المرجع..."
      onAdd={openAdd}
      addLabel="تسجيل إيراد"
      onExport={handleExport}
      filters={
        <>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          {(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo('') }}>مسح</Button>}
        </>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إيرادات الشهر" value={formatCurrency(totalMonth)} icon={<TrendingUp className="size-5" />} accent="emerald" />
            <KpiCard title="عدد الإيرادات" value={formatInt(monthRevenues.length)} icon={<CircleDollarSign className="size-5" />} accent="teal" />
            <KpiCard title="متوسط الإيراد" value={formatCurrency(avgMonth)} icon={<BarChart3 className="size-5" />} accent="violet" />
            <KpiCard
              title="أعلى فئة إيراد"
              value={Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}
              icon={<Coins className="size-5" />}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Category breakdown */}
      {byCategory.size > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">توزيع إيرادات الشهر حسب الفئة:</span>
            {Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([name, v]) => (
              <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold">
                {name}: <span className="num">{formatCurrency(v)}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead className="num-cell">المبلغ</TableHead>
                <TableHead>الحساب</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد إيرادات مسجلة. ابدأ بتسجيل أول إيراد.
                  </TableCell>
                </TableRow>
              ) : filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><span className="font-mono text-xs font-semibold text-primary">{e.code}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell className="font-medium text-sm cell-truncate">{e.payee || '—'}</TableCell>
                  <TableCell className="num-cell font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="num">{formatCurrency(e.amount)}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.bankAccount ? (
                      <span className="inline-flex items-center gap-1"><Banknote className="size-3" /> {e.bankAccount.name}</span>
                    ) : e.safe ? (
                      <span className="inline-flex items-center gap-1"><Wallet className="size-3" /> {e.safe.name}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">{e.reference || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground cell-truncate" title={e.note ?? ''}>{e.note || '—'}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(e)} title="طباعة السند">
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>تسجيل إيراد جديد</DialogTitle>
            <DialogDescription>سيتم إنشاء قيد محاسبي تلقائي (مدين: نقدية/بنك، دائن: إيرادات أخرى) وتحديث رصيد الحساب.</DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>المصدر / الجهة الدافعة</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="اسم الجهة أو الشخص" />
            </div>
            <div className="space-y-1.5">
              <Label>الفئة</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المرجع</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم الإيصال أو المرجع" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>وجهة الإيداع</Label>
              <Select value={form.destination} onValueChange={(v) => setForm({ ...form, destination: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">إيداع في خزينة (نقدية)</SelectItem>
                  <SelectItem value="bank">إيداع في حساب بنكي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.destination === 'bank' ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>الحساب البنكي</Label>
                <Select value={form.bankAccountId} onValueChange={(v) => setForm({ ...form, bankAccountId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر البنك" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.bankName} — {b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>الخزينة</Label>
                <Select value={form.safeId} onValueChange={(v) => setForm({ ...form, safeId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                  <SelectContent>
                    {safes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="وصف الإيراد..." />
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending ? 'جاري الحفظ...' : 'تسجيل الإيراد'}
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
