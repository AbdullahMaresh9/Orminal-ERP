'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatDate, formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  CalendarRange, Plus, Trash2, MoreVertical, Lock, Unlock, FileCheck, FileText,
  CalendarDays, CalendarClock, AlertTriangle, ShieldAlert,
} from 'lucide-react'

interface ClosedPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  closedBy: string | null
  closedAt: string | null
}

export function ClosedPeriodsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' })
  const [confirmAction, setConfirmAction] = useState<{ period: ClosedPeriod; action: 'close' | 'lock' | 'reopen' } | null>(null)

  const { data, isLoading } = useQuery<{ data: ClosedPeriod[]; total: number }>({
    queryKey: ['closed-periods', statusFilter],
    queryFn: async () => {
      const url = new URL('/api/erp/closed-periods', window.location.origin)
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter)
      const r = await fetch(url.toString())
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 10 * 1000,
  })

  const periods = data?.data ?? []

  const filtered = useMemo(() => {
    if (!search) return periods
    const q = search.toLowerCase()
    return periods.filter((p) => p.name.toLowerCase().includes(q))
  }, [periods, search])

  const kpis = useMemo(() => {
    const total = periods.length
    const open = periods.filter((p) => p.status === 'open').length
    const closed = periods.filter((p) => p.status === 'closed').length
    const locked = periods.filter((p) => p.status === 'locked').length
    return { total, open, closed, locked }
  }, [periods])

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/closed-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'open' }),
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل الإنشاء') }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء الفترة')
      setDialogOpen(false)
      setForm({ name: '', startDate: '', endDate: '' })
      qc.invalidateQueries({ queryKey: ['closed-periods'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ period, action }: { period: ClosedPeriod; action: 'close' | 'lock' | 'reopen' }) => {
      const status = action === 'close' ? 'closed' : action === 'lock' ? 'locked' : 'open'
      const r = await fetch(`/api/erp/closed-periods/${period.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, closedBy: 'admin' }),
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل التحديث') }
      return r.json()
    },
    onSuccess: (_data, vars) => {
      const msg = vars.action === 'close' ? 'تم إقفال الفترة — لا يمكن ترحيل قيود بعدها'
        : vars.action === 'lock' ? 'تم قفل الفترة نهائياً'
        : 'تمت إعادة فتح الفترة'
      toast.success(msg)
      setConfirmAction(null)
      qc.invalidateQueries({ queryKey: ['closed-periods'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/closed-periods/${id}`, { method: 'DELETE' })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'فشل الحذف') }
    },
    onSuccess: () => {
      toast.success('تم الحذف')
      qc.invalidateQueries({ queryKey: ['closed-periods'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handleExport() {
    const rows = periods.map((p) => ({
      name: p.name,
      startDate: formatDate(p.startDate),
      endDate: formatDate(p.endDate),
      status: p.status,
      closedBy: p.closedBy ?? '',
      closedAt: p.closedAt ? formatDateTime(p.closedAt) : '',
    }))
    exportToCSV('الفترات-المالية', rows, [
      { key: 'name', label: 'الاسم' },
      { key: 'startDate', label: 'من' },
      { key: 'endDate', label: 'إلى' },
      { key: 'status', label: 'الحالة' },
      { key: 'closedBy', label: 'أُقفلت بواسطة' },
      { key: 'closedAt', label: 'تاريخ الإقفال' },
    ])
  }

  return (
    <ModuleShell
      title={t('module.closed-periods')}
      description="الفترات المالية — إقفال وقفل الفترات المحاسبية"
      icon={<CalendarRange className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder="بحث باسم الفترة..."
      onAdd={() => setDialogOpen(true)}
      addLabel="فترة جديدة"
      onExport={handleExport}
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="open">مفتوحة</SelectItem>
            <SelectItem value="closed">مُقفلة</SelectItem>
            <SelectItem value="locked">مقفولة</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الفترات" value={String(kpis.total)} icon={<CalendarRange className="size-5" />} accent="emerald" />
            <KpiCard title="فترات مفتوحة" value={String(kpis.open)} icon={<CalendarDays className="size-5" />} accent="teal" />
            <KpiCard title="مُقفلة" value={String(kpis.closed)} icon={<FileCheck className="size-5" />} accent="amber" />
            <KpiCard title="مقفولة نهائياً" value={String(kpis.locked)} icon={<Lock className="size-5" />} accent="rose" />
          </>
        )}
      </div>

      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh] scrollbar-thin">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>اسم الفترة</TableHead>
                <TableHead className="w-32">من</TableHead>
                <TableHead className="w-32">إلى</TableHead>
                <TableHead className="text-center w-28">الحالة</TableHead>
                <TableHead>أُقفلت بواسطة</TableHead>
                <TableHead className="w-40">تاريخ الإقفال</TableHead>
                <TableHead className="w-20 text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10" /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-sm text-muted-foreground">
                    <FileText className="size-10 mx-auto mb-2 opacity-40" />
                    لا توجد فترات مالية
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-muted-foreground" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground"><span className="num">{formatDate(p.startDate)}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground"><span className="num">{formatDate(p.endDate)}</span></TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.closedBy ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="num">{p.closedAt ? formatDateTime(p.closedAt) : '—'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {p.status === 'open' && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ period: p, action: 'close' })}>
                                <FileCheck className="size-3.5 me-2 text-amber-600" />
                                إقفال الفترة
                              </DropdownMenuItem>
                            )}
                            {(p.status === 'open' || p.status === 'closed') && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ period: p, action: 'lock' })}>
                                <Lock className="size-3.5 me-2 text-rose-600" />
                                قفل نهائي
                              </DropdownMenuItem>
                            )}
                            {(p.status === 'closed' || p.status === 'locked') && (
                              <DropdownMenuItem onClick={() => setConfirmAction({ period: p, action: 'reopen' })}>
                                <Unlock className="size-3.5 me-2 text-emerald-600" />
                                إعادة فتح
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600"
                              onClick={() => deleteMutation.mutate(p.id)}
                              disabled={p.status === 'locked'}
                            >
                              <Trash2 className="size-3.5 me-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>فترة مالية جديدة</DialogTitle>
            <DialogDescription>تعريف فترة مالية جديدة (تبدأ كمفتوحة)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>اسم الفترة *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: السنة المالية 2026 أو يناير 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>من تاريخ *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>إلى تاريخ *</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name || !form.startDate || !form.endDate}
            >
              {createMutation.isPending ? 'جارٍ الحفظ...' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm action dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {confirmAction.action === 'close' && <FileCheck className="size-5 text-amber-600" />}
                  {confirmAction.action === 'lock' && <ShieldAlert className="size-5 text-rose-600" />}
                  {confirmAction.action === 'reopen' && <Unlock className="size-5 text-emerald-600" />}
                  {confirmAction.action === 'close' && 'تأكيد إقفال الفترة'}
                  {confirmAction.action === 'lock' && 'تأكيد القفل النهائي'}
                  {confirmAction.action === 'reopen' && 'تأكيد إعادة الفتح'}
                </DialogTitle>
                <DialogDescription>
                  الفترة: <span className="font-semibold">{confirmAction.period.name}</span>
                </DialogDescription>
              </DialogHeader>

              {(confirmAction.action === 'close' || confirmAction.action === 'lock') && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold mb-0.5">تحذير</p>
                    <p>
                      {confirmAction.action === 'close'
                        ? 'بعد إقفال الفترة، لا يمكن ترحيل قيود يومية ضمنها. ستحتاج لإعادة فتحها لتعديلها.'
                        : 'القفل النهائي يمنع أي تعديلات على القيود ضمن هذه الفترة، بما فيها إعادة الفتح.'}
                    </p>
                  </div>
                </div>
              )}

              {confirmAction.action === 'reopen' && (
                <p className="text-sm text-muted-foreground">
                  سيتم إعادة الفترة إلى حالة "مفتوحة" وسيتم مسح بيانات الإقفال.
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)}>إلغاء</Button>
                <Button
                  variant={confirmAction.action === 'reopen' ? 'default' : 'destructive'}
                  onClick={() => statusMutation.mutate(confirmAction)}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending ? 'جارٍ التنفيذ...' : 'تأكيد'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
