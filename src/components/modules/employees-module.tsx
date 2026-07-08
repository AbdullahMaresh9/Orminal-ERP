'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users, Plus, Pencil, Trash2, Printer, UserCheck, Building2, CalendarOff,
} from 'lucide-react'

interface Department { id: string; code: string; nameAr: string }
interface JobPosition { id: string; code: string; nameAr: string }
interface Employee {
  id: string
  employeeNo: string
  nameAr: string
  nameEn?: string
  departmentId?: string
  jobPositionId?: string
  hireDate?: string
  phone?: string
  email?: string
  nationalId?: string
  gender?: string
  status: string
  department?: Department
  jobPosition?: JobPosition
}

interface Draft {
  nameAr: string
  nameEn: string
  departmentId: string
  jobPositionId: string
  hireDate: string
  phone: string
  email: string
  nationalId: string
  gender: string
}

const emptyDraft: Draft = {
  nameAr: '', nameEn: '', departmentId: '', jobPositionId: '',
  hireDate: new Date().toISOString().slice(0, 10),
  phone: '', email: '', nationalId: '', gender: 'male',
}

export function EmployeesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const { data, isLoading } = useQuery<{ data: Employee[]; meta: any }>({
    queryKey: ['employees', search, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('pageSize', '300')
      const r = await fetch(`/api/erp/employees?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: deptsData } = useQuery<{ data: Department[] }>({
    queryKey: ['departments-for-emp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/departments?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const departments = deptsData?.data ?? []

  // Group by department for KPIs
  const deptCounts = new Map<string, number>()
  items.forEach((e) => {
    if (e.departmentId) deptCounts.set(e.departmentId, (deptCounts.get(e.departmentId) ?? 0) + 1)
  })
  const topDeptEntry = [...deptCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const topDeptName = topDeptEntry ? departments.find((d) => d.id === topDeptEntry[0])?.nameAr ?? '—' : '—'

  const stats = {
    total: items.length,
    active: items.filter((e) => e.status === 'active').length,
    onLeave: items.filter((e) => e.status === 'suspended').length,
    topDept: topDeptName,
  }

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setDialogOpen(true)
  }

  const openEdit = (e: Employee) => {
    setEditing(e)
    setDraft({
      nameAr: e.nameAr,
      nameEn: e.nameEn ?? '',
      departmentId: e.departmentId ?? '',
      jobPositionId: e.jobPositionId ?? '',
      hireDate: e.hireDate ? new Date(e.hireDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      phone: e.phone ?? '',
      email: e.email ?? '',
      nationalId: e.nationalId ?? '',
      gender: e.gender ?? 'male',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.nameAr) throw new Error('الاسم مطلوب')
      const payload: any = {
        nameAr: draft.nameAr,
        nameEn: draft.nameEn || undefined,
        departmentId: draft.departmentId || undefined,
        jobPositionId: draft.jobPositionId || undefined,
        hireDate: draft.hireDate,
        phone: draft.phone || undefined,
        email: draft.email || undefined,
        nationalId: draft.nationalId || undefined,
        gender: draft.gender || undefined,
      }
      const url = editing ? `/api/erp/employees/${editing.id}` : '/api/erp/employees'
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
      qc.invalidateQueries({ queryKey: ['employees'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/employees/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = items.map((e) => ({
      'الرقم الوظيفي': e.employeeNo,
      'الاسم': e.nameAr,
      'الاسم (إنجليزي)': e.nameEn ?? '',
      'الإدارة': e.department?.nameAr ?? '',
      'الوظيفة': e.jobPosition?.nameAr ?? '',
      'تاريخ التعيين': e.hireDate ? formatDate(e.hireDate) : '',
      'الهاتف': e.phone ?? '',
      'البريد': e.email ?? '',
      'الحالة': e.status,
    }))
    exportToCSV('employees', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (e: Employee) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info"><h2>الأستاذ</h2><p>نظام الموارد البشرية</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">بطاقة موظف</div>
          <div class="code">${e.employeeNo}</div>
          <div class="date">${e.hireDate ? formatDate(e.hireDate) : ''}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات الموظف</div>
        <div class="name">${e.nameAr}</div>
        <div class="sub">${e.nameEn ?? ''}</div>
      </div>
      <table>
        <tbody>
          <tr><td>الرقم الوظيفي</td><td>${e.employeeNo}</td></tr>
          <tr><td>الإدارة</td><td>${e.department?.nameAr ?? '—'}</td></tr>
          <tr><td>الوظيفة</td><td>${e.jobPosition?.nameAr ?? '—'}</td></tr>
          <tr><td>الهاتف</td><td>${e.phone ?? '—'}</td></tr>
          <tr><td>البريد</td><td>${e.email ?? '—'}</td></tr>
          <tr><td>الرقم القومي</td><td>${e.nationalId ?? '—'}</td></tr>
          <tr><td>تاريخ التعيين</td><td>${e.hireDate ? formatDate(e.hireDate) : '—'}</td></tr>
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">الموظف</div></div>
        <div class="sig"><div class="line"></div><div class="label">مدير الموارد البشرية</div></div>
      </div>
    `
    printHTML(html, `بطاقة موظف ${e.employeeNo}`)
  }

  return (
    <ModuleShell
      title={t('module.employees')}
      description="إدارة بيانات الموظفين والوظائف والإدارات"
      icon={<Users className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برقم الموظف أو الاسم أو الهاتف..."
      onAdd={openCreate}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
            <SelectItem value="terminated">منتهي</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الموظفين" value={formatInt(stats.total)} icon={<Users className="size-5" />} accent="emerald" />
        <KpiCard title="نشطون" value={formatInt(stats.active)} icon={<UserCheck className="size-5" />} accent="teal" />
        <KpiCard title="أعلى إدارة" value={stats.topDept} icon={<Building2 className="size-5" />} accent="amber" />
        <KpiCard title="موقوفون" value={formatInt(stats.onLeave)} icon={<CalendarOff className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرقم الوظيفي</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>تاريخ التعيين</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا يوجد موظفون. ابدأ بإضافة أول موظف.</TableCell></TableRow>
              ) : items.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{e.employeeNo}</TableCell>
                  <TableCell className="font-medium">{e.nameAr}</TableCell>
                  <TableCell>
                    {e.department ? (
                      <Badge variant="outline" className="text-[11px]">{e.department.nameAr}</Badge>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-mono" dir="ltr">{e.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm">{e.hireDate ? formatDate(e.hireDate) : '—'}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" title="بطاقة" onClick={() => handlePrint(e)}>
                        <Printer className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(e)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(e.id)}>
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
            <DialogTitle>{editing ? 'تعديل موظف' : 'إضافة موظف جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات الموظف الوظيفية والشخصية</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الاسم (عربي) *</Label>
                <Input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم (إنجليزي)</Label>
                <Input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>الإدارة</Label>
                <Select value={draft.departmentId} onValueChange={(v) => setDraft({ ...draft, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span dir="ltr" className="font-mono text-xs">{d.code}</span> — {d.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الوظيفة (نص حر)</Label>
                <Input value={draft.jobPositionId} onChange={(e) => setDraft({ ...draft, jobPositionId: e.target.value })} placeholder="محاسب، مهندس، الخ" />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ التعيين</Label>
                <Input type="date" value={draft.hireDate} onChange={(e) => setDraft({ ...draft, hireDate: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>الجنس</Label>
                <Select value={draft.gender} onValueChange={(v) => setDraft({ ...draft, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الهاتف</Label>
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>الرقم القومي / الهوية</Label>
                <Input value={draft.nationalId} onChange={(e) => setDraft({ ...draft, nationalId: e.target.value })} dir="ltr" />
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
