'use client'

import { useState, useEffect } from 'react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Users, Plus, Pencil, Trash2, Printer, UserCheck, Building2, CalendarOff, Coins, Wallet, History, CalendarClock, DollarSign, ChevronsUpDown, Check,
} from 'lucide-react'

interface Department { id: string; code: string; nameAr: string }
interface JobPosition { id: string; code: string; nameAr: string; nameEn?: string }
interface Branch { id: string; code: string; nameAr: string; nameEn?: string }

interface Employee {
  id: string
  employeeNo: string
  nameAr: string
  nameEn?: string
  branchId?: string
  departmentId?: string
  jobPositionId?: string
  hireDate?: string
  phone?: string
  email?: string
  nationalId?: string
  gender?: string
  status: string
  branch?: Branch
  department?: Department
  jobPosition?: JobPosition
}

interface Draft {
  nameAr: string
  nameEn: string
  branchId: string
  departmentId: string
  jobPositionId: string
  hireDate: string
  phone: string
  email: string
  nationalId: string
  gender: string
}

const emptyDraft: Draft = {
  nameAr: '', nameEn: '', branchId: '', departmentId: '', jobPositionId: '',
  hireDate: new Date().toISOString().slice(0, 10),
  phone: '', email: '', nationalId: '', gender: 'male',
}

function JobPositionCombobox({
  value,
  onChange,
  positions,
  isRTL,
}: {
  value: string
  onChange: (val: string) => void
  positions: JobPosition[]
  isRTL: boolean
}) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const trimmedSearch = searchValue.trim()
  const hasExactMatch = positions.some(
    (p) =>
      p.nameAr.toLowerCase() === trimmedSearch.toLowerCase() ||
      (p.nameEn && p.nameEn.toLowerCase() === trimmedSearch.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-start font-normal focus-visible:ring-blue-500 hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <span className={cn('truncate text-xs md:text-sm', !value && 'text-muted-foreground')}>
            {value || (isRTL ? 'اختر أو اكتب وظيفة...' : 'Select or type position...')}
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dark:bg-slate-900 dark:border-slate-800 dark:text-white shadow-xl" align="start">
        <Command className="dark:bg-slate-900">
          <CommandInput
            placeholder={isRTL ? 'ابحث أو اكتب اسم وظيفة جديدة...' : 'Search or type new job title...'}
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-52 overflow-y-auto">
            <CommandEmpty className="py-3 px-3 text-xs text-muted-foreground text-start">
              {trimmedSearch ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 w-full text-start text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer py-1"
                  onClick={() => {
                    onChange(trimmedSearch)
                    setOpen(false)
                    setSearchValue('')
                  }}
                >
                  <Plus className="size-3.5" />
                  <span>{isRTL ? `إضافة "${trimmedSearch}" كوظيفة جديدة` : `Add "${trimmedSearch}" as new position`}</span>
                </button>
              ) : (
                isRTL ? 'لا توجد مسميات مسبقة' : 'No existing titles'
              )}
            </CommandEmpty>
            <CommandGroup>
              {positions.map((p) => {
                const isSelected = value === p.nameAr || value === p.id
                return (
                  <CommandItem
                    key={p.id}
                    value={p.nameAr}
                    onSelect={() => {
                      onChange(p.nameAr)
                      setOpen(false)
                      setSearchValue('')
                    }}
                    className="text-xs cursor-pointer flex items-center justify-between py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span>{p.nameAr}</span>
                    {isSelected && <Check className="size-3.5 text-blue-600 dark:text-blue-400" />}
                  </CommandItem>
                )
              })}
              {trimmedSearch && !hasExactMatch && positions.length > 0 && (
                <CommandItem
                  value={`add_${trimmedSearch}`}
                  onSelect={() => {
                    onChange(trimmedSearch)
                    setOpen(false)
                    setSearchValue('')
                  }}
                  className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-semibold border-t border-slate-100 dark:border-slate-800 mt-1 py-2 px-3"
                >
                  <Plus className="size-3.5 me-1.5 inline-block" />
                  <span>{isRTL ? `إضافة "${trimmedSearch}"` : `Add "${trimmedSearch}"`}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function EmployeesModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
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

  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false)
  const [salaryEmployee, setSalaryEmployee] = useState<Employee | null>(null)
  const [showContractForm, setShowContractForm] = useState(false)
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [contractDraft, setContractDraft] = useState({
    baseSalary: '',
    allowances: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    status: 'active',
  })

  const { data: contractsData, isLoading: isLoadingContracts } = useQuery<{ data: any[] }>({
    queryKey: ['employee-contracts', salaryEmployee?.id],
    queryFn: async () => {
      if (!salaryEmployee?.id) return { data: [] }
      const r = await fetch(`/api/erp/contracts?employeeId=${salaryEmployee.id}`)
      if (!r.ok) return { data: [] }
      return r.json()
    },
    enabled: !!salaryEmployee?.id,
  })

  const saveContractMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingContractId ? `/api/erp/contracts/${editingContractId}` : '/api/erp/contracts'
      const method = editingContractId ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل حفظ العقد')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حفظ العقد بنجاح')
      qc.invalidateQueries({ queryKey: ['employee-contracts', salaryEmployee?.id] })
      setShowContractForm(false)
      setEditingContractId(null)
      setContractDraft({
        baseSalary: '',
        allowances: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        status: 'active',
      })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/contracts/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('تم حذف العقد')
      qc.invalidateQueries({ queryKey: ['employee-contracts', salaryEmployee?.id] })
    },
    onError: () => toast.error('حدث خطأ أثناء الحذف'),
  })

  const openSalaryDialog = (e: Employee) => {
    setSalaryEmployee(e)
    setSalaryDialogOpen(true)
    setShowContractForm(false)
    setEditingContractId(null)
    setContractDraft({
      baseSalary: '',
      allowances: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'active',
    })
  }


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

  const { data: branchesData } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches-for-emp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/branches?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: jobPositionsData } = useQuery<{ data: JobPosition[] }>({
    queryKey: ['job-positions-for-emp'],
    queryFn: async () => {
      const r = await fetch('/api/erp/job-positions?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const departments = deptsData?.data ?? []
  const branches = branchesData?.data ?? []
  const jobPositions = jobPositionsData?.data ?? []

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
      branchId: e.branchId ?? '',
      departmentId: e.departmentId ?? '',
      jobPositionId: e.jobPosition?.nameAr ?? e.jobPositionId ?? '',
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
        branchId: draft.branchId || undefined,
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
      qc.invalidateQueries({ queryKey: ['job-positions-for-emp'] })
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
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال</h2><p>نظام الموارد البشرية</p></div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2">
        <KpiCard title="إجمالي الموظفين" value={formatInt(stats.total)} icon={<Users className="size-5" />} accent="blue" />
        <KpiCard title="نشطون" value={formatInt(stats.active)} icon={<UserCheck className="size-5" />} accent="sky" />
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
                <TableHead>الفرع</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>تاريخ التعيين</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا يوجد موظفون. ابدأ بإضافة أول موظف.</TableCell></TableRow>
              ) : items.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{e.employeeNo}</TableCell>
                  <TableCell className="font-medium">{e.nameAr}</TableCell>
                  <TableCell>
                    {e.branchId ? (
                      <Badge variant="outline" className="text-[11px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        {branches.find((b) => b.id === e.branchId)?.nameAr ?? e.branchId}
                      </Badge>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {e.department ? (
                      <Badge variant="outline" className="text-[11px]">{e.department.nameAr}</Badge>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {e.jobPosition ? (
                      <span className="text-sm">{e.jobPosition.nameAr}</span>
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
                      <Button size="icon" variant="ghost" className="size-8 text-emerald-600 hover:text-emerald-700" title={isRTL ? 'الراتب والعقد' : 'Salary & Contract'} onClick={() => openSalaryDialog(e)}>
                        <Coins className="size-3.5" />
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
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Users className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editing ? (isRTL ? 'تعديل بيانات الموظف' : 'Edit Employee Details') : (isRTL ? 'إضافة موظف جديد' : 'Add New Employee')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</Label>
                <Input id="nameAr" value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} required placeholder={isRTL ? 'مثال: محمد أحمد...' : 'e.g. Mohammad Ahmad...'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                <Input id="nameEn" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="e.g. Mohammad Ahmad..." className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-start" dir="ltr" />
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="branch" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الفرع *' : 'Branch *'}</Label>
                <Select value={draft.branchId} onValueChange={(v) => setDraft({ ...draft, branchId: v })}>
                  <SelectTrigger id="branch" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500">
                    <SelectValue placeholder={isRTL ? 'اختر الفرع' : 'Select Branch'} />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span dir="ltr" className="font-mono text-xs me-1">{b.code}</span> — {b.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="department" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الإدارة' : 'Department'}</Label>
                <Select value={draft.departmentId} onValueChange={(v) => setDraft({ ...draft, departmentId: v })}>
                  <SelectTrigger id="department" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500">
                    <SelectValue placeholder={isRTL ? 'اختر الإدارة' : 'Select Department'} />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span dir="ltr" className="font-mono text-xs">{d.code}</span> — {d.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="jobPosition" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الوظيفة' : 'Job Position'}</Label>
                <JobPositionCombobox
                  value={draft.jobPositionId}
                  onChange={(val) => setDraft({ ...draft, jobPositionId: val })}
                  positions={jobPositions}
                  isRTL={isRTL}
                />
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="hireDate" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'تاريخ التعيين' : 'Hire Date'}</Label>
                <DatePicker id="hireDate" value={draft.hireDate} onChange={(val) => setDraft({ ...draft, hireDate: val })} />
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="gender" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الجنس' : 'Gender'}</Label>
                <Select value={draft.gender} onValueChange={(v) => setDraft({ ...draft, gender: v })}>
                  <SelectTrigger id="gender" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                    <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                    <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الهاتف' : 'Phone'}</Label>
                <Input id="phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+966 500000000" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono text-end" dir="ltr" />
              </div>
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'البريد الإلكتروني' : 'Email Address'}</Label>
                <Input id="email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="employee@company.com" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono text-end" dir="ltr" />
              </div>
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label htmlFor="nationalId" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الرقم القومي / الهوية' : 'National ID / Iqama'}</Label>
                <Input id="nationalId" value={draft.nationalId} onChange={(e) => setDraft({ ...draft, nationalId: e.target.value })} placeholder="1000000000" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono text-end" dir="ltr" />
              </div>
            </div>

            <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
                {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Salary & Contract Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-2xl" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-slate-900/80 border border-blue-100 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Coins className="size-6 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-white">
                  {isRTL ? `تفاصيل الراتب والعقد - ${salaryEmployee?.nameAr}` : `Salary & Contract Details - ${salaryEmployee?.nameEn || salaryEmployee?.nameAr}`}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 overflow-y-auto max-h-[70vh] bg-white dark:bg-slate-950">
            {showContractForm ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 text-start border-b border-slate-100 dark:border-slate-800 pb-2">
                  {editingContractId ? (isRTL ? 'تعديل عقد راتب' : 'Edit Salary Contract') : (isRTL ? 'إسناد راتب جديد (عقد عمل)' : 'Assign New Salary (Employment Contract)')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-start">
                    <Label htmlFor="baseSalary" className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                      {isRTL ? 'الراتب الأساسي *' : 'Base Salary *'}
                    </Label>
                    <Input
                      id="baseSalary"
                      type="number"
                      value={contractDraft.baseSalary}
                      onChange={(e) => setContractDraft({ ...contractDraft, baseSalary: e.target.value })}
                      placeholder="5000"
                      className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <Label htmlFor="allowances" className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                      {isRTL ? 'البدلات' : 'Allowances'}
                    </Label>
                    <Input
                      id="allowances"
                      type="number"
                      value={contractDraft.allowances}
                      onChange={(e) => setContractDraft({ ...contractDraft, allowances: e.target.value })}
                      placeholder="1000"
                      className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <Label htmlFor="contractStartDate" className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                      {isRTL ? 'تاريخ البدء *' : 'Start Date *'}
                    </Label>
                    <DatePicker
                      id="contractStartDate"
                      value={contractDraft.startDate}
                      onChange={(val) => setContractDraft({ ...contractDraft, startDate: val })}
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <Label htmlFor="contractEndDate" className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                      {isRTL ? 'تاريخ الانتهاء' : 'End Date'}
                    </Label>
                    <DatePicker
                      id="contractEndDate"
                      value={contractDraft.endDate}
                      onChange={(val) => setContractDraft({ ...contractDraft, endDate: val })}
                    />
                  </div>
                  <div className="space-y-1.5 text-start md:col-span-2">
                    <Label htmlFor="contractStatus" className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                      {isRTL ? 'الحالة' : 'Status'}
                    </Label>
                    <Select
                      value={contractDraft.status}
                      onValueChange={(val) => setContractDraft({ ...contractDraft, status: val })}
                    >
                      <SelectTrigger className="h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500">
                        <SelectValue placeholder={isRTL ? 'اختر الحالة' : 'Select status'} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                        <SelectItem value="active">{isRTL ? 'نشط' : 'Active'}</SelectItem>
                        <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
                        <SelectItem value="terminated">{isRTL ? 'ملغي / مفسوخ' : 'Terminated'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowContractForm(false)
                      setEditingContractId(null)
                    }}
                    className="h-10 px-5 border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    type="button"
                    disabled={saveContractMutation.isPending}
                    onClick={() => {
                      saveContractMutation.mutate({
                        employeeId: salaryEmployee?.id,
                        baseSalary: contractDraft.baseSalary,
                        allowances: contractDraft.allowances,
                        startDate: contractDraft.startDate,
                        endDate: contractDraft.endDate || null,
                        status: contractDraft.status,
                      })
                    }}
                    className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 dark:shadow-none"
                  >
                    {saveContractMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Salary Summary Card */}
                {(() => {
                  const activeContract = contractsData?.data?.find(c => c.status === 'active')
                  return (
                    <Card className="p-4 bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between mb-3 text-start">
                        <div>
                          <span className="text-xs font-semibold text-slate-550 dark:text-slate-400">
                            {isRTL ? 'الراتب النشط حالياً' : 'Current Active Salary'}
                          </span>
                          <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                            {activeContract
                              ? `${(activeContract.baseSalary + activeContract.allowances).toLocaleString('ar-SA')} ر.س`
                              : (isRTL ? 'لا يوجد راتب نشط' : 'No Active Salary')}
                          </h4>
                        </div>
                        <Badge className={activeContract ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'}>
                          {activeContract ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'بدون عقد' : 'No Contract')}
                        </Badge>
                      </div>

                      {activeContract && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-850 text-start">
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isRTL ? 'الراتب الأساسي' : 'Base Salary'}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{activeContract.baseSalary.toLocaleString('ar-SA')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isRTL ? 'البدلات' : 'Allowances'}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{activeContract.allowances.toLocaleString('ar-SA')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isRTL ? 'تاريخ البدء' : 'Start Date'}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDate(activeContract.startDate)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{activeContract.endDate ? formatDate(activeContract.endDate) : (isRTL ? 'مستمر' : 'Ongoing')}</span>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })()}

                {/* History Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                      <History className="size-4 text-slate-550" />
                      {isRTL ? 'سجل الرواتب والعقود' : 'Salary & Contract History'}
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingContractId(null)
                        setContractDraft({
                          baseSalary: '',
                          allowances: '',
                          startDate: new Date().toISOString().slice(0, 10),
                          endDate: '',
                          status: 'active',
                        })
                        setShowContractForm(true)
                      }}
                      className="h-8 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white gap-1 text-xs shadow-sm shadow-blue-500/10 dark:shadow-none"
                    >
                      <Plus className="size-3.5" />
                      {isRTL ? 'إسناد جديد' : 'New Assignment'}
                    </Button>
                  </div>

                  <Card className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow>
                          <TableHead className="ps-3 text-xs">{isRTL ? 'الأساسي' : 'Base'}</TableHead>
                          <TableHead className="text-xs">{isRTL ? 'البدلات' : 'Allowances'}</TableHead>
                          <TableHead className="text-xs">{isRTL ? 'البدء' : 'Start'}</TableHead>
                          <TableHead className="text-xs">{isRTL ? 'الانتهاء' : 'End'}</TableHead>
                          <TableHead className="text-xs">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                          <TableHead className="text-end pe-3 text-xs">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody dir={dir}>
                        {isLoadingContracts ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-4 text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
                        ) : !contractsData?.data || contractsData.data.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">{isRTL ? 'لا يوجد سجل عقود لهذا الموظف.' : 'No contract history for this employee.'}</TableCell></TableRow>
                        ) : contractsData.data.map((c) => (
                          <TableRow key={c.id} className="text-xs hover:bg-slate-50 dark:hover:bg-slate-900/40 border-b border-slate-100 dark:border-slate-850">
                            <TableCell className="ps-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{c.baseSalary.toLocaleString('ar-SA')}</TableCell>
                            <TableCell className="font-mono text-slate-600 dark:text-slate-300">{c.allowances.toLocaleString('ar-SA')}</TableCell>
                            <TableCell className="text-slate-600 dark:text-slate-300">{formatDate(c.startDate)}</TableCell>
                            <TableCell className="text-slate-650 dark:text-slate-350">{c.endDate ? formatDate(c.endDate) : (isRTL ? 'مستمر' : 'Ongoing')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                c.status === 'active'
                                  ? 'border-emerald-250 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : c.status === 'expired'
                                    ? 'border-amber-250 bg-amber-50/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                    : 'border-slate-250 bg-slate-50/50 text-slate-700 dark:bg-slate-850 dark:text-slate-400'
                              }>
                                {c.status === 'active' ? (isRTL ? 'نشط' : 'Active') : c.status === 'expired' ? (isRTL ? 'منتهي' : 'Expired') : (isRTL ? 'ملغي' : 'Terminated')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-end pe-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 hover:bg-slate-100 dark:hover:bg-slate-900"
                                  onClick={() => {
                                    setEditingContractId(c.id)
                                    setContractDraft({
                                      baseSalary: c.baseSalary.toString(),
                                      allowances: c.allowances.toString(),
                                      startDate: new Date(c.startDate).toISOString().slice(0, 10),
                                      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '',
                                      status: c.status,
                                    })
                                    setShowContractForm(true)
                                  }}
                                >
                                  <Pencil className="size-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-rose-550 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  onClick={() => {
                                    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذا العقد؟' : 'Are you sure you want to delete this contract?')) {
                                      deleteContractMutation.mutate(c.id)
                                    }
                                  }}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSalaryDialogOpen(false)}
                    className="h-10 px-5 border-slate-350 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    {isRTL ? 'إغلاق' : 'Close'}
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>

  )
}
