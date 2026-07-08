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
import { PiggyBank, Plus, Pencil, Trash2, Printer, Wallet, CheckCircle2, Building2 } from 'lucide-react'

const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD']

interface Branch { id: string; name: string; code: string }
interface SafeItem {
  id: string
  name: string
  code: string
  branchId?: string | null
  branch?: { id: string; name: string; code: string } | null
  currency: string
  balance: number
  active: boolean
  createdAt: string
  transactions?: any[]
}

const empty = {
  name: '',
  code: '',
  branchId: '',
  currency: 'SAR',
  openingBalance: 0,
  active: true,
}

export function SafesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery<{ data: SafeItem[]; total: number }>({
    queryKey: ['safes'],
    queryFn: async () => {
      const r = await fetch('/api/erp/safes')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: branchesData } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })
  const branches = branchesData?.data ?? []

  const list = data?.data ?? []
  const filtered = list.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [s.name, s.code, s.branch?.name].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  const totalCash = list.reduce((s, x) => s + (x.balance ?? 0), 0)
  const activeCount = list.filter((s) => s.active).length
  const byBranch = new Map<string, number>()
  for (const s of list) {
    const key = s.branch?.name ?? 'بدون فرع'
    byBranch.set(key, (byBranch.get(key) ?? 0) + (s.balance ?? 0))
  }

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/safes/${editId}` : '/api/erp/safes'
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
      qc.invalidateQueries({ queryKey: ['safes'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/safes/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['safes'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(s: SafeItem) {
    setEditId(s.id)
    setForm({
      name: s.name,
      code: s.code,
      branchId: s.branchId ?? '',
      currency: s.currency,
      openingBalance: s.balance,
      active: s.active,
    })
    setOpen(true)
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error('الاسم مطلوب')
      return
    }
    saveMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'safes',
      filtered.map((s) => ({
        code: s.code,
        name: s.name,
        branch: s.branch?.name ?? 'بدون فرع',
        currency: s.currency,
        balance: s.balance,
        active: s.active ? 'نشط' : 'غير نشط',
      })),
      [
        { key: 'code', label: 'الرمز' },
        { key: 'name', label: 'الاسم' },
        { key: 'branch', label: 'الفرع' },
        { key: 'currency', label: 'العملة' },
        { key: 'balance', label: 'الرصيد' },
        { key: 'active', label: 'الحالة' },
      ]
    )
  }

  async function handlePrint(s: SafeItem) {
    let detail = s as any
    try {
      const r = await fetch(`/api/erp/safes/${s.id}`)
      if (r.ok) detail = await r.json()
    } catch {}
    const txs: any[] = detail.transactions ?? []
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ — نظام محاسبي</h2>
            <p>كشف خزينة</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">كشف حساب خزينة</div>
          <div class="code">${s.code}</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات الخزينة</div>
        <div class="name">${s.name}</div>
        <div class="sub">الرمز: ${s.code} | الفرع: ${s.branch?.name ?? 'بدون فرع'} | العملة: ${s.currency}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>التاريخ</th><th>الكود</th><th>النوع</th><th>البيان</th><th>صرف</th><th>إيداع</th>
          </tr>
        </thead>
        <tbody>
          ${txs.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:#777">لا توجد حركات</td></tr>' : txs.map((tx, i) => {
            const isOut = tx.type === 'expense' || tx.type === 'transfer'
            return `<tr>
              <td>${i + 1}</td>
              <td>${formatDate(tx.date)}</td>
              <td>${tx.code}</td>
              <td>${tx.type}</td>
              <td>${tx.payee ?? tx.note ?? '—'}</td>
              <td>${isOut ? tx.amount.toFixed(2) : '—'}</td>
              <td>${!isOut ? tx.amount.toFixed(2) : '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align:right">الرصيد الحالي</td>
            <td style="text-align:left">${formatCurrency(s.balance, s.currency)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">أمين الخزينة</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير</div></div>
      </div>
    `
    printHTML(html, `كشف خزينة — ${s.name}`)
  }

  return (
    <ModuleShell
      title={t('module.safes')}
      description="إدارة الخزائن النقدية وأرصدتها وكشوف الحركات"
      icon={<PiggyBank className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث باسم الخزينة أو الرمز أو الفرع..."
      onAdd={openAdd}
      addLabel="خزينة"
      onExport={handleExport}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي النقدية" value={formatCurrency(totalCash)} icon={<Wallet className="size-5" />} accent="emerald" />
            <KpiCard title="عدد الخزائن" value={formatInt(list.length)} icon={<PiggyBank className="size-5" />} accent="teal" />
            <KpiCard title="الخزائن النشطة" value={formatInt(activeCount)} icon={<CheckCircle2 className="size-5" />} accent="violet" />
            <KpiCard title="عدد الفروع" value={formatInt(byBranch.size)} icon={<Building2 className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Branch breakdown */}
      {byBranch.size > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">النقدية حسب الفرع:</span>
            {Array.from(byBranch.entries()).map(([name, v]) => (
              <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
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
                <TableHead>الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead className="num-cell">الرصيد</TableHead>
                <TableHead>العملة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                    لا توجد خزائن. ابدأ بإضافة أول خزينة.
                  </TableCell>
                </TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><span className="font-mono text-xs font-semibold text-primary">{s.code}</span></TableCell>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.branch?.name ?? <span className="text-muted-foreground text-xs">بدون فرع</span>}</TableCell>
                  <TableCell className="num-cell font-semibold">
                    <span className="num">{formatCurrency(s.balance, s.currency)}</span>
                  </TableCell>
                  <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted">{s.currency}</span></TableCell>
                  <TableCell><StatusBadge status={s.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => handlePrint(s)} title="كشف خزينة">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(s)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذه الخزينة؟')) delMut.mutate(s.id)
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
            <DialogTitle>{editId ? 'تعديل خزينة' : 'إضافة خزينة'}</DialogTitle>
            <DialogDescription>أدخل بيانات الخزينة النقدية. الرصيد الافتتاحي يُسجّل كرصيد مبدئي.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اسم الخزينة *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الخزينة الرئيسية" />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAFE-0001 (تلقائي)" />
            </div>
            <div className="space-y-1.5">
              <Label>الفرع</Label>
              <Select value={form.branchId || '__none__'} onValueChange={(v) => setForm({ ...form, branchId: v === '__none__' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون فرع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون فرع</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{editId ? 'الرصيد الحالي' : 'الرصيد الافتتاحي'}</Label>
              <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">الخزينة نشطة</p>
                <p className="text-xs text-muted-foreground">الخزائن غير النشطة لا تظهر في القوائم المالية</p>
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
