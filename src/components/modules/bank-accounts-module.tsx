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
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Landmark, Plus, Pencil, Trash2, Printer, Wallet, CheckCircle2, Coins,
} from 'lucide-react'

const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD']

interface BankAccount {
  id: string
  name: string
  bankName: string
  iban?: string | null
  accountNo?: string | null
  currency: string
  balance: number
  active: boolean
  createdAt: string
  transactions?: any[]
}

const empty = {
  name: '',
  bankName: '',
  iban: '',
  accountNo: '',
  currency: 'SAR',
  openingBalance: 0,
  active: true,
}

export function BankAccountsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery<{ data: BankAccount[]; total: number }>({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const r = await fetch('/api/erp/bank-accounts')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const list = data?.data ?? []
  const filtered = list.filter((b) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [b.name, b.bankName, b.iban, b.accountNo, b.currency].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  // KPIs
  const totalBalance = list.reduce((s, b) => s + (b.balance ?? 0), 0)
  const activeCount = list.filter((b) => b.active).length
  const byCurrency = new Map<string, number>()
  for (const b of list) byCurrency.set(b.currency, (byCurrency.get(b.currency) ?? 0) + (b.balance ?? 0))

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/bank-accounts/${editId}` : '/api/erp/bank-accounts'
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
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
      toast.success('تم الحفظ بنجاح')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/bank-accounts/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(b: BankAccount) {
    setEditId(b.id)
    setForm({
      name: b.name,
      bankName: b.bankName,
      iban: b.iban ?? '',
      accountNo: b.accountNo ?? '',
      currency: b.currency,
      openingBalance: b.balance,
      active: b.active,
    })
    setOpen(true)
  }

  function submit() {
    if (!form.name.trim() || !form.bankName.trim()) {
      toast.error('الاسم واسم البنك مطلوبان')
      return
    }
    saveMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'bank-accounts',
      filtered.map((b) => ({
        name: b.name,
        bankName: b.bankName,
        iban: b.iban ?? '',
        accountNo: b.accountNo ?? '',
        currency: b.currency,
        balance: b.balance,
        active: b.active ? 'نشط' : 'غير نشط',
      })),
      [
        { key: 'name', label: 'الاسم' },
        { key: 'bankName', label: 'البنك' },
        { key: 'iban', label: 'IBAN' },
        { key: 'accountNo', label: 'رقم الحساب' },
        { key: 'currency', label: 'العملة' },
        { key: 'balance', label: 'الرصيد' },
        { key: 'active', label: 'الحالة' },
      ]
    )
  }

  async function handlePrint(b: BankAccount) {
    let detail = b as any
    try {
      const r = await fetch(`/api/erp/bank-accounts/${b.id}`)
      if (r.ok) detail = await r.json()
    } catch {}
    const txs: any[] = detail.transactions ?? []
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ — نظام محاسبي</h2>
            <p>كشف حساب بنكي</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">كشف حساب بنكي</div>
          <div class="code">${b.name}</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات الحساب</div>
        <div class="name">${b.bankName} — ${b.name}</div>
        <div class="sub">IBAN: ${b.iban ?? '—'} | رقم الحساب: ${b.accountNo ?? '—'} | العملة: ${b.currency}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>التاريخ</th><th>الكود</th><th>النوع</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          ${txs.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:24px;color:#777">لا توجد حركات</td></tr>' : txs.map((tx, i) => {
            const isExpense = tx.type === 'expense' || tx.type === 'transfer'
            const debit = isExpense ? tx.amount : 0
            const credit = !isExpense ? tx.amount : 0
            return `<tr>
              <td>${i + 1}</td>
              <td>${formatDate(tx.date)}</td>
              <td>${tx.code}</td>
              <td>${tx.type}</td>
              <td>${tx.payee ?? tx.note ?? '—'}</td>
              <td>${debit ? debit.toFixed(2) : '—'}</td>
              <td>${credit ? credit.toFixed(2) : '—'}</td>
              <td>—</td>
            </tr>`
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align:right">الرصيد الحالي</td>
            <td colspan="3" style="text-align:left">${formatCurrency(b.balance, b.currency)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">الجهة المعتمدة</div></div>
      </div>
    `
    printHTML(html, `كشف حساب — ${b.name}`)
  }

  return (
    <ModuleShell
      title={t('module.bank-accounts')}
      description="إدارة الحسابات البنكية وأرصدتها وكشوف الحساب"
      icon={<Landmark className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث باسم الحساب أو البنك أو IBAN..."
      onAdd={openAdd}
      addLabel="حساب بنكي"
      onExport={handleExport}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الأرصدة" value={formatCurrency(totalBalance)} icon={<Wallet className="size-5" />} accent="emerald" />
            <KpiCard title="عدد الحسابات" value={formatInt(list.length)} icon={<Landmark className="size-5" />} accent="teal" />
            <KpiCard title="الحسابات النشطة" value={formatInt(activeCount)} icon={<CheckCircle2 className="size-5" />} accent="violet" />
            <KpiCard
              title="حسب العملة"
              value={Array.from(byCurrency.entries()).map(([c, v]) => `${c}: ${formatCurrency(v, c)}`).slice(0, 1).join(' • ') || '—'}
              icon={<Coins className="size-5" />}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Currency breakdown */}
      {byCurrency.size > 1 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">توزيع الأرصدة حسب العملة:</span>
            {Array.from(byCurrency.entries()).map(([c, v]) => (
              <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                {c}: <span className="num">{formatCurrency(v, c)}</span>
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
                <TableHead>الاسم</TableHead>
                <TableHead>البنك</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>رقم الحساب</TableHead>
                <TableHead>العملة</TableHead>
                <TableHead className="num-cell">الرصيد</TableHead>
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
                    لا توجد حسابات بنكية. ابدأ بإضافة أول حساب.
                  </TableCell>
                </TableRow>
              ) : filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-sm">{b.name}</TableCell>
                  <TableCell className="text-sm">{b.bankName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">{b.iban || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">{b.accountNo || '—'}</TableCell>
                  <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted">{b.currency}</span></TableCell>
                  <TableCell className="num-cell font-semibold">
                    <span className="num">{formatCurrency(b.balance, b.currency)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={b.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(b)} title="كشف حساب">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(b)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) delMut.mutate(b.id)
                      }} title="حذف">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل حساب بنكي' : 'إضافة حساب بنكي'}</DialogTitle>
            <DialogDescription>أدخل بيانات الحساب البنكي. الرصيد الافتتاحي يُسجّل كرصيد مبدئي.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اسم الحساب *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="حساب التشغيل" />
            </div>
            <div className="space-y-1.5">
              <Label>اسم البنك *</Label>
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="البنك الأهلي" />
            </div>
            <div className="space-y-1.5">
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="SA00 0000 0000..." />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الحساب</Label>
              <Input value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editId ? 'الرصيد الحالي' : 'الرصيد الافتتاحي'}</Label>
              <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">الحساب نشط</p>
                <p className="text-xs text-muted-foreground">الحسابات غير النشطة لا تظهر في القوائم المالية</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
