'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import {
  BookOpen, Plus, Pencil, Trash2, Lock, FileText, ChevronDown, ChevronLeft,
  Layers, ShieldCheck, TrendingUp, Scale, Wallet,
} from 'lucide-react'

interface Account {
  id: string
  code: string
  name: string
  nameAr: string | null
  type: string
  subtype: string | null
  parentId: string | null
  balance: number
  rawDebit: number
  rawCredit: number
  active: boolean
  isSystem: boolean
  parent?: { id: string; code: string; name: string } | null
}

const TYPE_META: Record<string, { ar: string; en: string; color: string; bg: string; text: string; ring: string; icon: any }> = {
  asset:     { ar: 'الأصول',           en: 'Assets',      color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-900', icon: TrendingUp },
  liability: { ar: 'الخصوم',           en: 'Liabilities', color: 'rose',    bg: 'bg-rose-50 dark:bg-rose-950/40',    text: 'text-rose-700 dark:text-rose-400',       ring: 'ring-rose-200 dark:ring-rose-900',       icon: Scale },
  equity:    { ar: 'حقوق الملكية',     en: 'Equity',      color: 'violet',  bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400',  ring: 'ring-violet-200 dark:ring-violet-900',  icon: Wallet },
  income:    { ar: 'الإيرادات',        en: 'Income',      color: 'sky',     bg: 'bg-sky-50 dark:bg-sky-950/40',     text: 'text-sky-700 dark:text-sky-400',         ring: 'ring-sky-200 dark:ring-sky-900',         icon: TrendingUp },
  expense:   { ar: 'المصروفات',        en: 'Expenses',    color: 'amber',   bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400',    ring: 'ring-amber-200 dark:ring-amber-900',    icon: TrendingUp },
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']

const SUBTYPES: Record<string, string[]> = {
  asset:     ['current_asset', 'fixed_asset', 'cash', 'receivable', 'inventory'],
  liability: ['current_liability', 'long_term_liability', 'payable', 'tax'],
  equity:    ['capital', 'retained_earnings', 'reserves'],
  income:    ['operating_revenue', 'other_revenue', 'sales'],
  expense:   ['operating_expense', 'cogs', 'admin_expense', 'salary_expense', 'marketing_expense'],
}

export function ChartOfAccountsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({
    code: '', name: '', nameAr: '', type: 'asset', subtype: '', parentId: '', active: true,
  })

  const { data, isLoading } = useQuery<{ data: Account[]; total: number }>({
    queryKey: ['accounts', typeFilter],
    queryFn: async () => {
      const url = new URL('/api/erp/accounts', window.location.origin)
      if (typeFilter !== 'all') url.searchParams.set('type', typeFilter)
      const r = await fetch(url.toString())
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 10 * 1000,
  })

  const accounts = data?.data ?? []

  // Group by type → tree within each
  const grouped = useMemo(() => {
    const filtered = accounts.filter((a) => {
      if (!search) return true
      const q = search.toLowerCase()
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || (a.nameAr ?? '').includes(q)
    })
    const out: Record<string, Account[]> = {}
    for (const type of TYPE_ORDER) {
      out[type] = filtered.filter((a) => a.type === type)
    }
    return out
  }, [accounts, search])

  // KPIs
  const kpis = useMemo(() => {
    const total = accounts.length
    const sysCount = accounts.filter((a) => a.isSystem).length
    const assetsTotal = accounts.filter((a) => a.type === 'asset').reduce((s, a) => s + (a.balance || 0), 0)
    const liabEqTotal =
      accounts.filter((a) => a.type === 'liability').reduce((s, a) => s + (a.balance || 0), 0) +
      accounts.filter((a) => a.type === 'equity').reduce((s, a) => s + (a.balance || 0), 0)
    return { total, sysCount, assetsTotal, liabEqTotal }
  }, [accounts])

  function openAdd() {
    setEditing(null)
    setForm({ code: '', name: '', nameAr: '', type: 'asset', subtype: '', parentId: '', active: true })
    setDialogOpen(true)
  }
  function openEdit(a: Account) {
    setEditing(a)
    setForm({ code: a.code, name: a.name, nameAr: a.nameAr ?? '', type: a.type, subtype: a.subtype ?? '', parentId: a.parentId ?? '', active: a.active })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        subtype: form.subtype || null,
        parentId: form.parentId || null,
        active: form.active,
      }
      if (editing) {
        const r = await fetch(`/api/erp/accounts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const e = await r.json()
          throw new Error(e.error || 'فشل الحفظ')
        }
        return r.json()
      } else {
        const r = await fetch('/api/erp/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const e = await r.json()
          throw new Error(e.error || 'فشل الإنشاء')
        }
        return r.json()
      }
    },
    onSuccess: () => {
      toast.success('تم الحفظ')
      setDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => toast.error(e.message || 'فشل الحفظ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/accounts/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'فشل الحذف')
      }
    },
    onSuccess: () => {
      toast.success('تم الحذف')
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handleExport() {
    const rows = accounts.map((a) => ({
      code: a.code,
      name: a.name,
      nameAr: a.nameAr ?? '',
      type: TYPE_META[a.type]?.ar ?? a.type,
      subtype: a.subtype ?? '',
      balance: a.balance,
      isSystem: a.isSystem ? 'نعم' : 'لا',
      active: a.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('دليل-الحسابات', rows, [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'nameAr', label: 'الاسم العربي' },
      { key: 'type', label: 'النوع' },
      { key: 'subtype', label: 'النوع الفرعي' },
      { key: 'balance', label: 'الرصيد' },
      { key: 'isSystem', label: 'حساب نظامي' },
      { key: 'active', label: 'الحالة' },
    ])
  }

  function handlePrint() {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">الأ</div>
          <div class="info">
            <h2>الأستاذ</h2>
            <p>نظام المحاسبة المالية</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">دليل الحسابات</div>
          <div class="code">${kpis.total} حساب · ${kpis.sysCount} حساب نظامي</div>
          <div class="date">${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الرمز</th>
            <th>الاسم</th>
            <th>النوع</th>
            <th>النوع الفرعي</th>
            <th>الرصيد</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${accounts.map((a) => `
            <tr>
              <td>${a.code}</td>
              <td>${a.nameAr ?? a.name}</td>
              <td>${TYPE_META[a.type]?.ar ?? a.type}</td>
              <td>${a.subtype ?? '—'}</td>
              <td>${formatCurrency(a.balance)}</td>
              <td>${a.isSystem ? '🔒 نظامي' : (a.active ? 'نشط' : 'غير نشط')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>إجمالي الأصول:</span><span>${formatCurrency(kpis.assetsTotal)}</span></div>
        <div class="row grand"><span>الخصوم + حقوق الملكية:</span><span>${formatCurrency(kpis.liabEqTotal)}</span></div>
      </div>
    `
    printHTML(html, 'دليل الحسابات')
  }

  const parentOptions = accounts.filter((a) =>
    a.type === form.type && a.id !== editing?.id
  )

  return (
    <ModuleShell
      title={t('module.chart-of-accounts')}
      description="شجرة الحسابات المحاسبية مجمّعة حسب النوع"
      icon={<BookOpen className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="بحث برمز أو اسم الحساب..."
      onAdd={openAdd}
      addLabel="حساب جديد"
      onExport={handleExport}
      onPrint={handlePrint}
      filters={
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {TYPE_ORDER.map((tp) => (
              <SelectItem key={tp} value={tp}>{TYPE_META[tp].ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الحسابات" value={String(kpis.total)} icon={<Layers className="size-5" />} accent="emerald" />
            <KpiCard title="الحسابات النظامية" value={String(kpis.sysCount)} icon={<ShieldCheck className="size-5" />} accent="violet" />
            <KpiCard title="إجمالي الأصول" value={formatCurrency(kpis.assetsTotal)} icon={<TrendingUp className="size-5" />} accent="teal" />
            <KpiCard title="الخصوم + حقوق الملكية" value={formatCurrency(kpis.liabEqTotal)} icon={<Scale className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      {/* Tree grouped by type */}
      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <FileText className="size-10 mx-auto mb-2 opacity-40" />
                لا توجد حسابات مطابقة
              </div>
            ) : (
              TYPE_ORDER.filter((tp) => (grouped[tp]?.length ?? 0) > 0).map((tp) => (
                <TypeGroup
                  key={tp}
                  type={tp}
                  accounts={grouped[tp]}
                  onEdit={openEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل حساب' : 'حساب جديد'}</DialogTitle>
            <DialogDescription>
              {editing?.isSystem
                ? 'حساب نظامي — الرمز والنوع محميان'
                : 'أدخل بيانات الحساب المحاسبي'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الرمز *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!!editing?.isSystem}
                placeholder="مثال: 1500"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v, subtype: '', parentId: '' })}
                disabled={!!editing?.isSystem}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((tp) => (
                    <SelectItem key={tp} value={tp}>{TYPE_META[tp].ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الاسم (إنجليزي)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Account Name"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الاسم (عربي)</Label>
              <Input
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                placeholder="اسم الحساب"
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع الفرعي</Label>
              <Select value={form.subtype || '__none__'} onValueChange={(v) => setForm({ ...form, subtype: v === '__none__' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون —</SelectItem>
                  {(SUBTYPES[form.type] ?? []).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحساب الأب</Label>
              <Select value={form.parentId || '__none__'} onValueChange={(v) => setForm({ ...form, parentId: v === '__none__' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— رئيسي —</SelectItem>
                  {parentOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} · {a.nameAr ?? a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="active" className="cursor-pointer">نشط</Label>
              </div>
              <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.code || !form.name}
              className="gap-1.5"
            >
              {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

function TypeGroup({
  type, accounts, onEdit, onDelete,
}: {
  type: string
  accounts: Account[]
  onEdit: (a: Account) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const meta = TYPE_META[type]
  const Icon = meta.icon
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg ${meta.bg} ${meta.text} ring-1 ${meta.ring} hover:opacity-90 transition-opacity`}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4 rtl:rotate-180" />}
          <Icon className="size-4" />
          <span className="font-bold">{meta.ar}</span>
          <span className="text-xs opacity-70">({accounts.length})</span>
          <span className="ms-auto text-xs font-semibold tabular-nums opacity-80">
            {formatCurrency(totalBalance)}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 border rounded-lg overflow-hidden bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-20">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="w-28">النوع الفرعي</TableHead>
                <TableHead className="text-end">الرصيد</TableHead>
                <TableHead className="w-24 text-center">الحالة</TableHead>
                <TableHead className="w-24 text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} className={a.isSystem ? 'bg-muted/30' : ''}>
                  <TableCell className="font-mono text-xs font-bold">{a.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.nameAr ?? a.name}</span>
                      {a.isSystem && (
                        <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    {a.nameAr && a.name && (
                      <p className="text-[10px] text-muted-foreground">{a.name}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.subtype ? a.subtype.replace(/_/g, ' ') : '—'}
                  </TableCell>
                  <TableCell className={`text-end font-mono text-xs font-semibold ${a.balance < 0 ? 'text-rose-600' : ''}`}>
                    {formatCurrency(a.balance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={a.active ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(a)} title="تعديل">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-rose-600 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => onDelete(a.id)}
                        disabled={a.isSystem}
                        title={a.isSystem ? 'حساب نظامي — لا يمكن حذفه' : 'حذف'}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
