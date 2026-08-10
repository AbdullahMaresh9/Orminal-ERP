'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDate, formatNumber } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DatePicker } from '@/components/ui/date-picker'
import {
  CalendarOff, Plus, Trash2, CheckCircle2, XCircle, Clock, FileClock, Send,
} from 'lucide-react'

interface Employee { id: string; employeeNo: string; nameAr: string; department?: { nameAr: string } }
interface LeaveRequest {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason?: string
  employee?: Employee
}

interface Draft {
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  reason: string
}

const emptyDraft: Draft = {
  employeeId: '',
  leaveType: 'annual',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  reason: '',
}

const LEAVE_LABELS: Record<string, string> = {
  annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون أجر',
}

const LEAVE_COLORS: Record<string, string> = {
  annual: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  sick: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  emergency: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  unpaid: 'bg-muted text-muted-foreground',
}

export function LeaveRequestsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDir = () => {
        const docDir = document.documentElement.dir || 'rtl'
        setDir(docDir as 'rtl' | 'ltr')
      }
      updateDir()
      const observer = new MutationObserver(updateDir)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dir'],
      })
      return () => observer.disconnect()
    }
  }, [])

  const isRTL = dir === 'rtl'


  const { data, isLoading } = useQuery<{ data: LeaveRequest[]; meta: any }>({
    queryKey: ['leave-requests', search, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('pageSize', '300')
      const r = await fetch(`/api/erp/leave-requests?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: employeesData } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees-for-leave'],
    queryFn: async () => {
      const r = await fetch('/api/erp/employees?status=active&pageSize=300')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const employees = employeesData?.data ?? []

  const stats = {
    total: items.length,
    pending: items.filter((i) => ['draft', 'submitted'].includes(i.status)).length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
  }

  // Auto-calc days
  const days = useMemo(() => {
    if (!draft.startDate || !draft.endDate) return 0
    const s = new Date(draft.startDate).getTime()
    const e = new Date(draft.endDate).getTime()
    if (e < s) return 0
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
  }, [draft.startDate, draft.endDate])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.employeeId) throw new Error('اختر الموظف')
      if (!draft.startDate || !draft.endDate) throw new Error('التواريخ مطلوبة')
      const payload: any = {
        employeeId: draft.employeeId,
        leaveType: draft.leaveType,
        startDate: draft.startDate,
        endDate: draft.endDate,
        days,
        reason: draft.reason || undefined,
        status: 'submitted',
      }
      const r = await fetch('/api/erp/leave-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب الإجازة')
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
      setDialogOpen(false)
      setDraft(emptyDraft)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await fetch(`/api/erp/leave-requests/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم تنفيذ الإجراء')
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/leave-requests/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((l) => ({
      'الموظف': l.employee?.nameAr ?? '',
      'نوع الإجازة': LEAVE_LABELS[l.leaveType] ?? l.leaveType,
      'من': formatDate(l.startDate),
      'إلى': formatDate(l.endDate),
      'الأيام': l.days,
      'الحالة': l.status,
      'السبب': l.reason ?? '',
    }))
    exportToCSV('leave-requests', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.leave-requests')}
      description="إدارة طلبات إجازات الموظفين والاعتمادات"
      icon={<CalendarOff className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث باسم الموظف أو السبب..."
      onAdd={() => { setDraft(emptyDraft); setDialogOpen(true) }}
      addLabel="طلب جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="submitted">مُرسل</SelectItem>
            <SelectItem value="approved">معتمد</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي الطلبات" value={formatInt(stats.total)} icon={<FileClock className="size-5" />} accent="blue" />
        <KpiCard title="قيد الانتظار" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="معتمدة" value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
        <KpiCard title="مرفوضة" value={formatInt(stats.rejected)} icon={<XCircle className="size-5" />} accent="rose" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الموظف</TableHead>
                <TableHead>نوع الإجازة</TableHead>
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead className="text-end num-cell">الأيام</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد طلبات إجازة. ابدأ بإنشاء أول طلب.</TableCell></TableRow>
              ) : items.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{l.employee?.nameAr ?? '—'}</span>
                      <span className="text-xs text-muted-foreground font-mono" dir="ltr">{l.employee?.employeeNo ?? ''}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] ${LEAVE_COLORS[l.leaveType] ?? ''}`}>
                      {LEAVE_LABELS[l.leaveType] ?? l.leaveType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(l.startDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(l.endDate)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatNumber(l.days, 1)}</span></TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {l.status === 'submitted' && (
                        <>
                          <Button size="icon" variant="ghost" className="size-8 text-blue-600" title="اعتماد" onClick={() => actionMutation.mutate({ id: l.id, action: 'approve' })}>
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-rose-500" title="رفض" onClick={() => actionMutation.mutate({ id: l.id, action: 'reject' })}>
                            <XCircle className="size-3.5" />
                          </Button>
                        </>
                      )}
                      {l.status === 'draft' && (
                        <Button size="icon" variant="ghost" className="size-8 text-sky-600" title="إرسال" onClick={() => actionMutation.mutate({ id: l.id, action: 'submit' })}>
                          <Send className="size-3.5" />
                        </Button>
                      )}
                      {l.status !== 'approved' && (
                        <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => deleteMutation.mutate(l.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>

        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-2xl" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <CalendarOff className="size-6 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-white">
                  {isRTL ? 'طلب إجازة جديد' : 'New Leave Request'}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 overflow-y-auto max-h-[70vh] bg-white dark:bg-slate-950">
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-start md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'الموظف *' : 'Employee *'}</Label>
                  <Select value={draft.employeeId} onValueChange={(v) => setDraft({ ...draft, employeeId: v })}>
                    <SelectTrigger className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder={isRTL ? 'اختر الموظف' : 'Select Employee'} />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span dir="ltr" className="font-mono text-xs text-blue-650 dark:text-blue-400 font-semibold">{e.employeeNo}</span> — {e.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-start">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'نوع الإجازة *' : 'Leave Type *'}</Label>
                  <Select value={draft.leaveType} onValueChange={(v) => setDraft({ ...draft, leaveType: v })}>
                    <SelectTrigger className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select Type'} />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                      <SelectItem value="annual">{isRTL ? 'سنوية' : 'Annual'}</SelectItem>
                      <SelectItem value="sick">{isRTL ? 'مرضية' : 'Sick'}</SelectItem>
                      <SelectItem value="emergency">{isRTL ? 'طارئة' : 'Emergency'}</SelectItem>
                      <SelectItem value="unpaid">{isRTL ? 'بدون أجر' : 'Unpaid'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-start">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'عدد الأيام (تلقائي)' : 'Days (Auto)'}</Label>
                  <Input value={String(days)} disabled className="h-10 bg-slate-100 dark:bg-slate-900/90 border-slate-300 dark:border-slate-850 font-mono text-center font-bold text-slate-700 dark:text-slate-300 animate-fade-in" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'من تاريخ *' : 'Start Date *'}</Label>
                  <DatePicker value={draft.startDate} onChange={(val) => setDraft({ ...draft, startDate: val })} />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'إلى تاريخ *' : 'End Date *'}</Label>
                  <DatePicker value={draft.endDate} onChange={(val) => setDraft({ ...draft, endDate: val })} />
                </div>
                <div className="space-y-1.5 text-start md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isRTL ? 'السبب' : 'Reason'}</Label>
                  <Textarea rows={3} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder={isRTL ? 'اكتب سبب الإجازة هنا...' : 'Write the reason for leave here...'} className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500" />
                </div>
              </div>

              <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 dark:shadow-none">
                  {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إنشاء الطلب' : 'Create Request')}
                </Button>
              </DialogFooter>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>

  )
}
