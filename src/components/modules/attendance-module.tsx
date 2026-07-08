'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDate, formatTime } from '@/lib/format'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CalendarClock, Plus, Pencil, Trash2, UserCheck, UserX, Clock, CalendarOff,
} from 'lucide-react'

interface Employee { id: string; employeeNo: string; nameAr: string; department?: { nameAr: string } }
interface Attendance {
  id: string
  employeeId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: string
  notes?: string
  employee?: Employee
}

interface Draft {
  employeeId: string
  date: string
  checkIn: string
  checkOut: string
  status: string
  notes: string
}

const emptyDraft: Draft = {
  employeeId: '',
  date: new Date().toISOString().slice(0, 10),
  checkIn: '',
  checkOut: '',
  status: 'present',
  notes: '',
}

const STATUS_LABELS: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخر', leave: 'إجازة', holiday: 'عطلة',
}

export function AttendanceModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Attendance | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const { data, isLoading } = useQuery<{ data: Attendance[]; meta: any }>({
    queryKey: ['attendance', search, filterStatus, filterDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterDate) params.set('date', filterDate)
      params.set('pageSize', '300')
      const r = await fetch(`/api/erp/attendance?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: employeesData } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees-for-att'],
    queryFn: async () => {
      const r = await fetch('/api/erp/employees?status=active&pageSize=300')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const employees = employeesData?.data ?? []

  // Today's stats from all records (regardless of date filter for KPI context)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayItems = items.filter((a) => a.date && a.date.slice(0, 10) === todayStr)
  const stats = useMemo(() => ({
    total: items.length,
    present: todayItems.filter((a) => a.status === 'present').length,
    absent: todayItems.filter((a) => a.status === 'absent').length,
    late: todayItems.filter((a) => a.status === 'late').length,
    onLeave: todayItems.filter((a) => a.status === 'leave').length,
  }), [items, todayItems])

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setDialogOpen(true)
  }

  const openEdit = (a: Attendance) => {
    setEditing(a)
    setDraft({
      employeeId: a.employeeId,
      date: a.date ? a.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      checkIn: a.checkIn ? a.checkIn.slice(11, 16) : '',
      checkOut: a.checkOut ? a.checkOut.slice(11, 16) : '',
      status: a.status,
      notes: a.notes ?? '',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.employeeId) throw new Error('اختر الموظف')
      const dateStr = draft.date
      const payload: any = {
        employeeId: draft.employeeId,
        date: dateStr,
        checkIn: draft.checkIn ? new Date(`${dateStr}T${draft.checkIn}:00`).toISOString() : null,
        checkOut: draft.checkOut ? new Date(`${dateStr}T${draft.checkOut}:00`).toISOString() : null,
        status: draft.status,
        notes: draft.notes || undefined,
      }
      const url = editing ? `/api/erp/attendance/${editing.id}` : '/api/erp/attendance'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/attendance/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((a) => ({
      'الموظف': a.employee?.nameAr ?? '',
      'الرقم الوظيفي': a.employee?.employeeNo ?? '',
      'التاريخ': formatDate(a.date),
      'الحضور': a.checkIn ? formatTime(a.checkIn) : '',
      'الانصراف': a.checkOut ? formatTime(a.checkOut) : '',
      'الحالة': STATUS_LABELS[a.status] ?? a.status,
      'ملاحظات': a.notes ?? '',
    }))
    exportToCSV('attendance', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.attendance')}
      description="إدارة سجلات الحضور والانصراف اليومية"
      icon={<CalendarClock className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث باسم الموظف..."
      onAdd={openCreate}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-40"
            dir="ltr"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="present">حاضر</SelectItem>
              <SelectItem value="absent">غائب</SelectItem>
              <SelectItem value="late">متأخر</SelectItem>
              <SelectItem value="leave">إجازة</SelectItem>
              <SelectItem value="holiday">عطلة</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="حاضرون اليوم" value={formatInt(stats.present)} icon={<UserCheck className="size-5" />} accent="emerald" />
        <KpiCard title="غائبون اليوم" value={formatInt(stats.absent)} icon={<UserX className="size-5" />} accent="rose" />
        <KpiCard title="متأخرون" value={formatInt(stats.late)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="في إجازة" value={formatInt(stats.onLeave)} icon={<CalendarOff className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الموظف</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="num-cell">الحضور</TableHead>
                <TableHead className="num-cell">الانصراف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد سجلات حضور. ابدأ بإضافة أول سجل.</TableCell></TableRow>
              ) : items.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{a.employee?.nameAr ?? '—'}</span>
                      <span className="text-xs text-muted-foreground font-mono" dir="ltr">{a.employee?.employeeNo ?? ''}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.employee?.department?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(a.date)}</TableCell>
                  <TableCell className="num-cell"><span className="num font-mono tabular-nums" dir="ltr">{a.checkIn ? formatTime(a.checkIn) : '—'}</span></TableCell>
                  <TableCell className="num-cell"><span className="num font-mono tabular-nums" dir="ltr">{a.checkOut ? formatTime(a.checkOut) : '—'}</span></TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(a)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(a.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
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
            <DialogTitle>{editing ? 'تعديل سجل حضور' : 'إضافة سجل حضور'}</DialogTitle>
            <DialogDescription>أدخل بيانات الحضور والانصراف</DialogDescription>
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
                <Label>التاريخ *</Label>
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">حاضر</SelectItem>
                    <SelectItem value="absent">غائب</SelectItem>
                    <SelectItem value="late">متأخر</SelectItem>
                    <SelectItem value="leave">إجازة</SelectItem>
                    <SelectItem value="holiday">عطلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>وقت الحضور</Label>
                <Input type="time" value={draft.checkIn} onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>وقت الانصراف</Label>
                <Input type="time" value={draft.checkOut} onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
