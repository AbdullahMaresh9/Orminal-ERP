'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  BookCopy, Plus, Trash2, Printer, Download, Eye, Check, X,
  FileText, ListChecks, CalendarDays, Scale, AlertTriangle,
} from 'lucide-react'

interface Account {
  id: string
  code: string
  name: string
  nameAr: string | null
  type: string
}

interface JournalLine {
  id?: string
  accountId: string
  account?: Account
  accountCode?: string
  debit: number
  credit: number
  description?: string | null
}

interface JournalEntry {
  id: string
  code: string
  date: string
  description: string | null
  refType: string | null
  refId: string | null
  status: string
  totalDebit: number
  totalCredit: number
  createdAt: string
  lines: JournalLine[]
}

const REF_TYPES = [
  { value: 'manual', label: 'يدوي' },
  { value: 'sales_order', label: 'بيع' },
  { value: 'purchase_order', label: 'شراء' },
  { value: 'payment', label: 'سند' },
  { value: 'production', label: 'إنتاج' },
  { value: 'expense', label: 'مصروف' },
  { value: 'revenue', label: 'إيراد' },
  { value: 'opening', label: 'افتتاحي' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'posted', label: 'مُرحّل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'reversed', label: 'معكوس' },
]

export function JournalEntriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null)

  const { data: accountsData } = useQuery<{ data: Account[] }>({
    queryKey: ['accounts-all-compact'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 60 * 1000,
  })
  const accounts = accountsData?.data ?? []

  const { data, isLoading } = useQuery<{ data: JournalEntry[]; total: number }>({
    queryKey: ['journal-entries', statusFilter],
    queryFn: async () => {
      const url = new URL('/api/erp/journal-entries', window.location.origin)
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter)
      const r = await fetch(url.toString())
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 10 * 1000,
  })

  const entries = data?.data ?? []

  // Filtered list (search)
  const filtered = useMemo(() => {
    if (!search) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.code.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q))
  }, [entries, search])

  // KPIs
  const kpis = useMemo(() => {
    const total = entries.length
    const posted = entries.filter((e) => e.status === 'posted').length
    const now = new Date()
    const thisMonth = entries.filter((e) => {
      const d = new Date(e.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const totalDebit = entries.filter((e) => e.status === 'posted').reduce((s, e) => s + (e.totalDebit || 0), 0)
    return { total, posted, thisMonth, totalDebit }
  }, [entries])

  function handleExport() {
    const rows = entries.map((e) => ({
      code: e.code,
      date: formatDate(e.date),
      description: e.description ?? '',
      refType: e.refType ?? '',
      totalDebit: e.totalDebit,
      totalCredit: e.totalCredit,
      status: e.status,
    }))
    exportToCSV('قيود-اليومية', rows, [
      { key: 'code', label: 'رقم القيد' },
      { key: 'date', label: 'التاريخ' },
      { key: 'description', label: 'البيان' },
      { key: 'refType', label: 'نوع المرجع' },
      { key: 'totalDebit', label: 'إجمالي مدين' },
      { key: 'totalCredit', label: 'إجمالي دائن' },
      { key: 'status', label: 'الحالة' },
    ])
  }

  function printVoucher(e: JournalEntry) {
    const linesHtml = e.lines.map((l) => `
      <tr>
        <td>${l.account?.code ?? '—'}</td>
        <td>${l.account?.nameAr ?? l.account?.name ?? '—'}</td>
        <td style="text-align:left">${l.debit ? formatCurrency(l.debit) : ''}</td>
        <td style="text-align:left">${l.credit ? formatCurrency(l.credit) : ''}</td>
      </tr>
    `).join('')

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
          <div class="type">قيد محاسبي</div>
          <div class="code">${e.code}</div>
          <div class="date">${formatDate(e.date)}</div>
        </div>
      </div>

      <div class="party">
        <div class="label">البيان</div>
        <div class="name">${e.description ?? 'قيد محاسبي'}</div>
        <div class="sub">نوع المرجع: ${e.refType ?? 'يدوي'} · الحالة: ${e.status === 'posted' ? 'مُرحّل' : e.status === 'draft' ? 'مسودة' : 'معكوس'}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:80px">الرمز</th>
            <th>الحساب</th>
            <th style="width:120px">مدين</th>
            <th style="width:120px">دائن</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:left">الإجمالي</td>
            <td style="text-align:left">${formatCurrency(e.totalDebit)}</td>
            <td style="text-align:left">${formatCurrency(e.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="notes">
        ${e.totalDebit === e.totalCredit
          ? '✓ القيد متوازن — مجموع المدين يساوي مجموع الدائن'
          : '⚠ القيد غير متوازن'}
      </div>

      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">المراجع</div></div>
      </div>
    `
    printHTML(html, 'قيد محاسبي')
  }

  return (
    <ModuleShell
      title={t('module.journal-entries')}
      description="قيود اليومية المحاسبية — قيد مزدوج متوازن"
      icon={<BookCopy className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="بحث برقم القيد أو البيان..."
      onAdd={() => setAddOpen(true)}
      addLabel="قيد جديد"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
            <KpiCard title="إجمالي القيود" value={String(kpis.total)} icon={<ListChecks className="size-5" />} accent="emerald" />
            <KpiCard title="قيود مرحّلة" value={String(kpis.posted)} icon={<Check className="size-5" />} accent="teal" />
            <KpiCard title="قيود هذا الشهر" value={String(kpis.thisMonth)} icon={<CalendarDays className="size-5" />} accent="violet" />
            <KpiCard title="إجمالي الحركة (مدين=دائن)" value={formatCurrency(kpis.totalDebit)} icon={<Scale className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-28">رقم القيد</TableHead>
                <TableHead className="w-28">التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead className="w-28">المرجع</TableHead>
                <TableHead className="text-end w-32">مدين</TableHead>
                <TableHead className="text-end w-32">دائن</TableHead>
                <TableHead className="w-24 text-center">الحالة</TableHead>
                <TableHead className="w-24 text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-sm text-muted-foreground">
                    <FileText className="size-10 mx-auto mb-2 opacity-40" />
                    لا توجد قيود
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const balanced = Math.abs(e.totalDebit - e.totalCredit) < 0.01
                  return (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setViewEntry(e)}
                    >
                      <TableCell className="font-mono text-xs font-bold">{e.code}</TableCell>
                      <TableCell className="text-xs">{formatDate(e.date)}</TableCell>
                      <TableCell className="max-w-xs truncate">{e.description ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {REF_TYPES.find((r) => r.value === e.refType)?.label ?? e.refType ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs font-semibold">
                        {formatCurrency(e.totalDebit)}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs font-semibold">
                        {formatCurrency(e.totalCredit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <StatusBadge status={e.status} />
                          {balanced ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <X className="size-3 text-rose-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={(ev) => { ev.stopPropagation(); setViewEntry(e) }}
                            title="عرض"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={(ev) => { ev.stopPropagation(); printVoucher(e) }}
                            title="طباعة السند"
                          >
                            <Printer className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add dialog */}
      <AddJournalDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        accounts={accounts}
      />

      {/* View dialog */}
      <Dialog open={!!viewEntry} onOpenChange={(o) => !o && setViewEntry(null)}>
        <DialogContent className="sm:max-w-2xl">
          {viewEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>قيد {viewEntry.code}</span>
                  <StatusBadge status={viewEntry.status} />
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(viewEntry.date)} · {viewEntry.refType ?? 'يدوي'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {viewEntry.description && (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">البيان</p>
                    <p>{viewEntry.description}</p>
                  </div>
                )}
                <ScrollArea className="max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">الرمز</TableHead>
                        <TableHead>الحساب</TableHead>
                        <TableHead>البيان</TableHead>
                        <TableHead className="text-end">مدين</TableHead>
                        <TableHead className="text-end">دائن</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewEntry.lines.map((l, i) => (
                        <TableRow key={l.id ?? i}>
                          <TableCell className="font-mono text-xs">{l.account?.code ?? '—'}</TableCell>
                          <TableCell className="text-xs">{l.account?.nameAr ?? l.account?.name ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.description ?? '—'}</TableCell>
                          <TableCell className="text-end font-mono text-xs">{l.debit ? formatCurrency(l.debit) : '—'}</TableCell>
                          <TableCell className="text-end font-mono text-xs">{l.credit ? formatCurrency(l.credit) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="text-start font-bold">الإجمالي</TableCell>
                        <TableCell className="text-end font-mono font-bold">{formatCurrency(viewEntry.totalDebit)}</TableCell>
                        <TableCell className="text-end font-mono font-bold">{formatCurrency(viewEntry.totalCredit)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </ScrollArea>
                <div className={`flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-semibold ${
                  Math.abs(viewEntry.totalDebit - viewEntry.totalCredit) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                }`}>
                  {Math.abs(viewEntry.totalDebit - viewEntry.totalCredit) < 0.01 ? (
                    <><Check className="size-4" /> القيد متوازن</>
                  ) : (
                    <><X className="size-4" /> القيد غير متوازن</>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => printVoucher(viewEntry)} className="gap-1.5">
                  <Printer className="size-4" /> طباعة السند
                </Button>
                <Button variant="outline" onClick={() => setViewEntry(null)}>إغلاق</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

// ====================================================================
// Add Journal Dialog — with dynamic line editor + balance validation
// ====================================================================
function AddJournalDialog({
  open, onOpenChange, accounts,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  accounts: Account[]
}) {
  const qc = useQueryClient()
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [refType, setRefType] = useState('manual')
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountCode: '', debit: 0, credit: 0, description: '' },
    { accountId: '', accountCode: '', debit: 0, credit: 0, description: '' },
  ])

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit }
  }, [lines])

  const balanced = Math.abs(totals.debit - totals.credit) < 0.01
  const hasZeroRows = lines.some((l) => !l.accountCode)
  const hasEmptyAmounts = lines.some((l) => l.debit === 0 && l.credit === 0)

  function updateLine(idx: number, patch: Partial<JournalLine>) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }
  function updateAccount(idx: number, code: string) {
    const acc = accounts.find((a) => a.code === code)
    setLines((prev) => prev.map((l, i) => i === idx ? {
      ...l,
      accountCode: code,
      accountId: acc?.id ?? '',
      account: acc,
    } : l))
  }
  // Enter debit → clear credit, vice versa
  function setDebit(idx: number, val: string) {
    const n = Number(val) || 0
    updateLine(idx, { debit: n, credit: 0 })
  }
  function setCredit(idx: number, val: string) {
    const n = Number(val) || 0
    updateLine(idx, { credit: n, debit: 0 })
  }
  function addRow() {
    setLines((prev) => [...prev, { accountId: '', accountCode: '', debit: 0, credit: 0, description: '' }])
  }
  function removeRow(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        description,
        refType,
        status: 'posted',
        lines: lines.map((l) => ({
          accountCode: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description,
        })),
      }
      const r = await fetch('/api/erp/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'فشل الإنشاء')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حفظ القيد')
      onOpenChange(false)
      // reset
      setDescription('')
      setLines([
        { accountId: '', accountCode: '', debit: 0, credit: 0, description: '' },
        { accountId: '', accountCode: '', debit: 0, credit: 0, description: '' },
      ])
      setDate(new Date().toISOString().slice(0, 10))
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>قيد محاسبي جديد</DialogTitle>
          <DialogDescription>قيد مزدوج — يجب أن يتوازن مجموع المدين مع الدائن</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>نوع المرجع</Label>
            <Select value={refType} onValueChange={setRefType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REF_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>البيان</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="وصف القيد المحاسبي..."
              dir="rtl"
            />
          </div>
        </div>

        {/* Lines editor */}
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <h4 className="text-sm font-semibold">بنود القيد</h4>
            <Button variant="outline" size="sm" className="h-7 gap-1" onClick={addRow}>
              <Plus className="size-3.5" /> بند
            </Button>
          </div>
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">الحساب</TableHead>
                  <TableHead className="w-28">مدين</TableHead>
                  <TableHead className="w-28">دائن</TableHead>
                  <TableHead className="min-w-[160px]">البيان</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.accountCode || '__none__'} onValueChange={(v) => v !== '__none__' && updateAccount(i, v)}>
                        <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— اختر —</SelectItem>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.code}>
                              <span className="font-mono">{a.code}</span> · {a.nameAr ?? a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.debit || ''}
                        onChange={(e) => setDebit(i, e.target.value)}
                        className="h-8 text-xs font-mono text-end"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.credit || ''}
                        onChange={(e) => setCredit(i, e.target.value)}
                        className="h-8 text-xs font-mono text-end"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={l.description ?? ''}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="بيان البند..."
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon"
                        className="size-7 text-rose-600 hover:text-rose-700"
                        onClick={() => removeRow(i)}
                        disabled={lines.length <= 2}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/40 font-bold">
                  <TableCell className="text-start">الإجمالي</TableCell>
                  <TableCell className="text-end font-mono text-xs">{formatCurrency(totals.debit)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{formatCurrency(totals.credit)}</TableCell>
                  <TableCell colSpan={2}>
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      {balanced ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Check className="size-4" /> متوازن
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                          <X className="size-4" /> غير متوازن (فرق: {formatCurrency(Math.abs(totals.debit - totals.credit))})
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </div>

        {/* Validation warning */}
        {!balanced && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle className="size-4" />
            <span>القيد غير متوازن — يجب أن يكون مجموع المدين = مجموع الدائن قبل الحفظ.</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              !balanced ||
              hasZeroRows ||
              hasEmptyAmounts ||
              lines.length < 2
            }
            className="gap-1.5"
          >
            {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ القيد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
