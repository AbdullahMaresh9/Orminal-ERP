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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeftRight, Plus, Printer, Banknote, Wallet, BarChart3, Repeat } from 'lucide-react'

interface BankAccount { id: string; name: string; bankName: string; currency: string }
interface SafeItem { id: string; name: string; code: string; currency: string }
interface Transfer {
  id: string
  code: string
  date: string
  amount: number
  fromAccountId: string
  toAccountId: string
  note?: string | null
  status: string
  fromAccount?: { name?: string; bankName?: string; code?: string } | null
  toAccount?: { name?: string; bankName?: string; code?: string } | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = {
  date: todayISO(),
  amount: 0,
  fromAccountId: '',
  toAccountId: '',
  note: '',
}

function refFor(kind: 'bank' | 'safe', id: string) {
  return `${kind}:${id}`
}

function describeRef(ref: string, banks: BankAccount[], safes: SafeItem[]): { label: string; kind: 'bank' | 'safe' } {
  if (!ref) return { label: '—', kind: 'safe' }
  const [kind, id] = ref.split(':')
  if (kind === 'bank') {
    const b = banks.find((x) => x.id === id)
    return { label: b ? `${b.bankName} — ${b.name}` : 'بنك محذوف', kind: 'bank' }
  }
  const s = safes.find((x) => x.id === id)
  return { label: s ? `${s.name} (${s.code})` : 'خزينة محذوفة', kind: 'safe' }
}

export function FinanceTransfersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const { data, isLoading } = useQuery<{ data: Transfer[]; total: number }>({
    queryKey: ['finance-transfers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/finance-transfers')
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
    return [e.code, e.note, e.fromAccountId, e.toAccountId].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  // KPIs (this month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthTransfers = list.filter((e) => new Date(e.date) >= monthStart)
  const totalMonth = monthTransfers.reduce((s, e) => s + e.amount, 0)
  const avgMonth = monthTransfers.length ? totalMonth / monthTransfers.length : 0

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/finance-transfers', {
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
      toast.success('تم تسجيل التحويل بنجاح')
      setOpen(false)
      setForm(emptyForm)
      qc.invalidateQueries({ queryKey: ['finance-transfers'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['safes'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openAdd() {
    setForm({
      ...emptyForm,
      fromAccountId: safes[0] ? refFor('safe', safes[0].id) : '',
      toAccountId: banks[0] ? refFor('bank', banks[0].id) : '',
    })
    setOpen(true)
  }

  function submit() {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('أدخل مبلغاً صحيحاً')
      return
    }
    if (!form.fromAccountId || !form.toAccountId) {
      toast.error('اختر حساب المصدر والوجهة')
      return
    }
    if (form.fromAccountId === form.toAccountId) {
      toast.error('لا يمكن التحويل بين نفس الحساب')
      return
    }
    createMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'finance-transfers',
      filtered.map((e) => {
        const f = describeRef(e.fromAccountId, banks, safes)
        const to = describeRef(e.toAccountId, banks, safes)
        return {
          code: e.code,
          date: formatDate(e.date),
          amount: e.amount,
          from: f.label,
          to: to.label,
          note: e.note ?? '',
          status: e.status,
        }
      }),
      [
        { key: 'code', label: 'الكود' },
        { key: 'date', label: 'التاريخ' },
        { key: 'amount', label: 'المبلغ' },
        { key: 'from', label: 'من حساب' },
        { key: 'to', label: 'إلى حساب' },
        { key: 'note', label: 'ملاحظات' },
        { key: 'status', label: 'الحالة' },
      ]
    )
  }

  function handlePrint(e: Transfer) {
    const f = describeRef(e.fromAccountId, banks, safes)
    const to = describeRef(e.toAccountId, banks, safes)
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال — نظام محاسبي</h2>
            <p>سند تحويل نقدي</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">سند تحويل</div>
          <div class="code">${e.code}</div>
          <div class="date">${formatDate(e.date)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">التحويل</div>
        <div class="name">من ${f.label} إلى ${to.label}</div>
        <div class="sub">المبلغ: ${formatCurrency(e.amount)}</div>
      </div>
      <table>
        <thead>
          <tr><th>البيان</th><th style="text-align:left">المبلغ</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${e.note ?? 'تحويل نقدي بين الحسابات'}</td>
            <td style="text-align:left">${formatCurrency(e.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="text-align:right">الإجمالي</td>
            <td style="text-align:left">${formatCurrency(e.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="notes">من ${f.kind === 'bank' ? 'بنك' : 'خزينة'}: ${f.label}<br/>إلى ${to.kind === 'bank' ? 'بنك' : 'خزينة'}: ${to.label}</div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">أمين الخزينة</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `سند تحويل ${e.code}`)
  }

  return (
    <ModuleShell
      title={t('module.finance-transfers')}
      description="تحويل الأموال بين الخزائن والحسابات البنكية"
      icon={<ArrowLeftRight className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالكود أو الملاحظات..."
      onAdd={openAdd}
      addLabel="تحويل جديد"
      onExport={handleExport}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="تحويلات الشهر" value={formatCurrency(totalMonth)} icon={<Repeat className="size-5" />} accent="emerald" />
            <KpiCard title="عدد التحويلات" value={formatInt(monthTransfers.length)} icon={<ArrowLeftRight className="size-5" />} accent="teal" />
            <KpiCard title="متوسط التحويل" value={formatCurrency(avgMonth)} icon={<BarChart3 className="size-5" />} accent="violet" />
            <KpiCard title="إجمالي التحويلات" value={formatCurrency(list.reduce((s, e) => s + e.amount, 0))} icon={<ArrowLeftRight className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="num-cell">المبلغ</TableHead>
                <TableHead>من حساب</TableHead>
                <TableHead>إلى حساب</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد تحويلات مسجلة. ابدأ بتسجيل أول تحويل.
                  </TableCell>
                </TableRow>
              ) : filtered.map((e) => {
                const f = describeRef(e.fromAccountId, banks, safes)
                const to = describeRef(e.toAccountId, banks, safes)
                return (
                  <TableRow key={e.id}>
                    <TableCell><span className="font-mono text-xs font-semibold text-primary">{e.code}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                    <TableCell className="num-cell font-semibold">
                      <span className="num">{formatCurrency(e.amount)}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        {f.kind === 'bank' ? <Banknote className="size-3" /> : <Wallet className="size-3" />}
                        {f.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        {to.kind === 'bank' ? <Banknote className="size-3" /> : <Wallet className="size-3" />}
                        {to.label}
                      </span>
                    </TableCell>
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
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>تحويل نقدي جديد</DialogTitle>
            <DialogDescription>سيتم إنشاء قيد محاسبي (مدين: الحساب الوجهة، دائن: الحساب المصدر) وتحديث رصيدي الحسابين.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>من حساب *</Label>
              <Select value={form.fromAccountId} onValueChange={(v) => setForm({ ...form, fromAccountId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المصدر" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>الخزائن</SelectLabel>
                    {safes.map((s) => <SelectItem key={s.id} value={refFor('safe', s.id)}>{s.name} ({s.code})</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>الحسابات البنكية</SelectLabel>
                    {banks.map((b) => <SelectItem key={b.id} value={refFor('bank', b.id)}>{b.bankName} — {b.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>إلى حساب *</Label>
              <Select value={form.toAccountId} onValueChange={(v) => setForm({ ...form, toAccountId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر الوجهة" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>الخزائن</SelectLabel>
                    {safes.map((s) => <SelectItem key={s.id} value={refFor('safe', s.id)}>{s.name} ({s.code})</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>الحسابات البنكية</SelectLabel>
                    {banks.map((b) => <SelectItem key={b.id} value={refFor('bank', b.id)}>{b.bankName} — {b.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="سبب التحويل..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending ? 'جاري الحفظ...' : 'تسجيل التحويل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
