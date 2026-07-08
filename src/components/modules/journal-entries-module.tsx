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
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText, Plus, Trash2, Eye, Printer, CheckCircle2, XCircle, Send,
  BookOpen, CalendarDays, Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Account { id: string; code: string; nameAr: string; type: string }
interface JournalLine {
  id?: string
  accountId?: string
  account?: Account
  debit: number
  credit: number
  description?: string
}
interface JournalEntry {
  id: string
  code: string
  postingDate: string
  description?: string
  refType?: string
  state: string
  totalDebit: number
  totalCredit: number
  lines: JournalLine[]
  createdAt: string
}

interface LineDraft {
  key: string
  accountCode: string
  debit: string
  credit: string
  description: string
}

const JOURNAL_TYPES = [
  { value: 'general', label: 'يومية عامة' },
  { value: 'sale', label: 'يومية المبيعات' },
  { value: 'purchase', label: 'يومية المشتريات' },
  { value: 'cash', label: 'يومية النقدية' },
  { value: 'bank', label: 'يومية البنك' },
  { value: 'opening', label: 'يومية افتتاحية' },
]

export function JournalEntriesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<JournalEntry | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: JournalEntry[]; meta: any }>({
    queryKey: ['journal-entries', search, filterState, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterState !== 'all') params.set('state', filterState)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/journal-entries?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: accountsData } = useQuery<{ data: Account[] }>({
    queryKey: ['accounts-for-je'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts?pageSize=500')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const entries = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const accounts = accountsData?.data ?? []

  const stats = {
    total,
    posted: entries.filter((e) => e.state === 'posted').length,
    drafts: entries.filter((e) => e.state === 'draft').length,
    totalDebit: entries.reduce((s, e) => s + e.totalDebit, 0),
  }

  // ===== Add dialog state =====
  const [description, setDescription] = useState('')
  const [journalType, setJournalType] = useState('general')
  const [refType, setRefType] = useState('manual')
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', accountCode: '', debit: '', credit: '', description: '' },
    { key: '2', accountCode: '', debit: '', credit: '', description: '' },
  ])

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff < 0.01 && totalDebit > 0
  const validLines = lines.filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [field]: value }
      // Entering debit clears credit and vice versa
      if (field === 'debit' && Number(value) > 0) next.credit = ''
      if (field === 'credit' && Number(value) > 0) next.debit = ''
      return next
    }))
  }

  const addLine = () => {
    setLines((prev) => [...prev, { key: String(Date.now()), accountCode: '', debit: '', credit: '', description: '' }])
  }

  const removeLine = (key: string) => {
    if (lines.length <= 2) {
      toast.error('يجب وجود بندين على الأقل')
      return
    }
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const resetForm = () => {
    setDescription('')
    setJournalType('general')
    setRefType('manual')
    setPostingDate(new Date().toISOString().slice(0, 10))
    setLines([
      { key: '1', accountCode: '', debit: '', credit: '', description: '' },
      { key: '2', accountCode: '', debit: '', credit: '', description: '' },
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (state: 'draft' | 'posted') => {
      if (!balanced) throw new Error('القيد غير متوازن')
      if (validLines.length < 2) throw new Error('يجب وجود بندين صحيحين على الأقل')
      const payload = {
        description,
        journalType,
        refType,
        postingDate,
        state,
        lines: validLines.map((l) => ({
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
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حفظ القيد بنجاح')
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      setAddOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/journal-entries/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post' }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الترحيل')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم ترحيل القيد بنجاح')
      qc.invalidateQueries({ queryKey: ['journal-entries'] })
      setViewOpen(false)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = entries.map((e) => ({
      'الرمز': e.code,
      'التاريخ': formatDate(e.postingDate),
      'الوصف': e.description ?? '',
      'نوع المرجع': e.refType ?? '',
      'مدين': e.totalDebit,
      'دائن': e.totalCredit,
      'الحالة': e.state,
    }))
    exportToCSV('journal-entries', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (entry: JournalEntry) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info">
            <h2>الأستاذ</h2>
            <p>نظام المحاسبة والإدارة المالية</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">قيد محاسبي</div>
          <div class="code">${entry.code}</div>
          <div class="date">${formatDate(entry.postingDate)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">البيان</div>
        <div class="name">${entry.description ?? 'قيد محاسبي'}</div>
        <div class="sub">نوع المرجع: ${entry.refType ?? 'يدوي'} · الحالة: ${entry.state}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الرمز</th>
            <th>اسم الحساب</th>
            <th>البيان</th>
            <th>مدين</th>
            <th>دائن</th>
          </tr>
        </thead>
        <tbody>
          ${entry.lines.map((l) => `
            <tr>
              <td>${l.account?.code ?? ''}</td>
              <td>${l.account?.nameAr ?? ''}</td>
              <td>${l.description ?? ''}</td>
              <td>${l.debit ? formatCurrency(l.debit) : '—'}</td>
              <td>${l.credit ? formatCurrency(l.credit) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">الإجمالي</td>
            <td>${formatCurrency(entry.totalDebit)}</td>
            <td>${formatCurrency(entry.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="totals">
        <div class="row grand">
          <span>الفرق:</span>
          <span>${formatCurrency(Math.abs(entry.totalDebit - entry.totalCredit))}</span>
        </div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
        <div class="sig"><div class="line"></div><div class="label">المراجع</div></div>
      </div>
    `
    printHTML(html, `قيد محاسبي ${entry.code}`)
  }

  return (
    <ModuleShell
      title={t('module.journal-entries')}
      description="قيود اليومية مع التحقق من التوازن والترحيل التلقائي"
      icon={<FileText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز القيد أو الوصف..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="قيد جديد"
      onExport={handleExport}
      filters={
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="posted">مُرحّل</SelectItem>
            <SelectItem value="reversed">معكوس</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي القيود" value={formatInt(total)} icon={<FileText className="size-5" />} accent="emerald" />
        <KpiCard title="قيود مرحّلة" value={formatInt(stats.posted)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
        <KpiCard title="قيود مسودة" value={formatInt(stats.drafts)} icon={<BookOpen className="size-5" />} accent="amber" />
        <KpiCard title="إجمالي المدين" value={formatCurrency(stats.totalDebit)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead>نوع المرجع</TableHead>
                <TableHead className="text-end num-cell">مدين</TableHead>
                <TableHead className="text-end num-cell">دائن</TableHead>
                <TableHead>التوازن</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد قيود. ابدأ بإنشاء أول قيد.</TableCell></TableRow>
              ) : entries.map((e) => {
                const isBalanced = Math.abs(e.totalDebit - e.totalCredit) < 0.01
                return (
                  <TableRow key={e.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => { setViewing(e); setViewOpen(true) }}>
                    <TableCell className="ps-4 font-mono text-xs" dir="ltr">{e.code}</TableCell>
                    <TableCell className="text-sm">{formatDate(e.postingDate)}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{e.description ?? '—'}</TableCell>
                    <TableCell>{e.refType ? <Badge variant="outline" className="text-[10px]">{e.refType}</Badge> : '—'}</TableCell>
                    <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(e.totalDebit)}</span></TableCell>
                    <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(e.totalCredit)}</span></TableCell>
                    <TableCell>
                      {isBalanced ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <XCircle className="size-4 text-rose-500" />
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={e.state} /></TableCell>
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => { setViewing(e); setViewOpen(true) }} title="عرض">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(e)} title="طباعة">
                          <Printer className="size-3.5" />
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

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {entries.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + entries.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      {/* Add Dialog with line editor */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>قيد محاسبي جديد</DialogTitle>
            <DialogDescription>أضف بنود القيد وتأكد من توازن المدين والدائن</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="description">البيان</Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="قيد محاسبي..." />
              </div>
              <div className="space-y-1.5">
                <Label>نوع اليومية</Label>
                <Select value={journalType} onValueChange={setJournalType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postingDate">تاريخ الترحيل</Label>
                <Input id="postingDate" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
              </div>
            </div>

            {/* Lines table */}
            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">الحساب</TableHead>
                    <TableHead>البيان</TableHead>
                    <TableHead className="text-end num-cell w-32">مدين</TableHead>
                    <TableHead className="text-end num-cell w-32">دائن</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="ps-3">
                        <Select value={l.accountCode} onValueChange={(v) => updateLine(l.key, 'accountCode', v)}>
                          <SelectTrigger className="h-9 min-w-[200px]"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.code}>
                                <span dir="ltr" className="font-mono text-xs">{a.code}</span> — {a.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9"
                          value={l.description}
                          onChange={(e) => updateLine(l.key, 'description', e.target.value)}
                          placeholder="وصف البند..."
                        />
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <Input
                          className="h-9 text-end tabular-nums"
                          type="number"
                          step="0.01"
                          dir="ltr"
                          value={l.debit}
                          onChange={(e) => updateLine(l.key, 'debit', e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <Input
                          className="h-9 text-end tabular-nums"
                          type="number"
                          step="0.01"
                          dir="ltr"
                          value={l.credit}
                          onChange={(e) => updateLine(l.key, 'credit', e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-500"
                          onClick={() => removeLine(l.key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                        <Plus className="size-3.5" /> إضافة بند
                      </Button>
                    </TableCell>
                    <TableCell className="text-end num-cell">
                      <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(totalDebit)}</span>
                    </TableCell>
                    <TableCell className="text-end num-cell">
                      <span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(totalCredit)}</span>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>

            {/* Balance indicator */}
            <div className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              balanced
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
                : 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900'
            )}>
              <div className="flex items-center gap-2">
                {balanced ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <XCircle className="size-5 text-rose-500" />
                )}
                <span className={cn('font-semibold text-sm', balanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                  {balanced ? 'القيد متوازن' : `القيد غير متوازن — الفرق: ${formatCurrency(diff)}`}
                </span>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                الفرق: {formatCurrency(diff)}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!balanced || saveMutation.isPending}
              onClick={() => saveMutation.mutate('draft')}
            >
              حفظ كمسودة
            </Button>
            <Button
              type="button"
              disabled={!balanced || saveMutation.isPending}
              onClick={() => saveMutation.mutate('posted')}
              className="gap-1.5"
            >
              <Send className="size-4" />
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ وترحيل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تفاصيل القيد {viewing?.code}</DialogTitle>
            <DialogDescription>{viewing?.description}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">التاريخ</p>
                  <p className="font-semibold">{formatDate(viewing.postingDate)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <StatusBadge status={viewing.state} />
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">نوع المرجع</p>
                  <p className="font-semibold">{viewing.refType ?? 'يدوي'}</p>
                </div>
              </div>
              <Card className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="ps-3">الرمز</TableHead>
                      <TableHead>الحساب</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead className="text-end num-cell">مدين</TableHead>
                      <TableHead className="text-end num-cell">دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.lines.map((l, i) => (
                      <TableRow key={l.id ?? i}>
                        <TableCell className="ps-3 font-mono text-xs" dir="ltr">{l.account?.code ?? '—'}</TableCell>
                        <TableCell className="font-medium">{l.account?.nameAr ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.description ?? '—'}</TableCell>
                        <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{l.debit ? formatCurrency(l.debit) : '—'}</span></TableCell>
                        <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{l.credit ? formatCurrency(l.credit) : '—'}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-semibold">الإجمالي</TableCell>
                      <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(viewing.totalDebit)}</span></TableCell>
                      <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(viewing.totalCredit)}</span></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </Card>
              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrint(viewing)} className="gap-1.5">
                  <Printer className="size-4" /> طباعة
                </Button>
                {viewing.state === 'draft' && (
                  <Button onClick={() => postMutation.mutate(viewing.id)} disabled={postMutation.isPending} className="gap-1.5">
                    <Send className="size-4" />
                    {postMutation.isPending ? 'جاري الترحيل...' : 'ترحيل القيد'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
