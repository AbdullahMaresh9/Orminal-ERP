'use client'

import { useState, useMemo } from 'react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  annual: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الطلبات" value={formatInt(stats.total)} icon={<FileClock className="size-5" />} accent="emerald" />
        <KpiCard title="قيد الانتظار" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="معتمدة" value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
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
                          <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="اعتماد" onClick={() => actionMutation.mutate({ id: l.id, action: 'approve' })}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>طلب إجازة جديد</DialogTitle>
            <DialogDescription>أدخل بيانات طلب الإجازة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>الموظف *</Label>
                <Select value={draft.employeeId} onValueChange={(v) => setDraft({ ...draft, employeeId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span dir="ltr" className="font-mono text-xs">{e.employeeNo}</span> — {e.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>نوع الإجازة</Label>
                <Select value={draft.leaveType} onValueChange={(v) => setDraft({ ...draft, leaveType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">سنوية</SelectItem>
                    <SelectItem value="sick">مرضية</SelectItem>
                    <SelectItem value="emergency">طارئة</SelectItem>
                    <SelectItem value="unpaid">بدون أجر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>عدد الأيام (تلقائي)</Label>
                <Input value={String(days)} disabled dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>من تاريخ *</Label>
                <Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>إلى تاريخ *</Label>
                <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>السبب</Label>
                <Textarea rows={3} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء الطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
