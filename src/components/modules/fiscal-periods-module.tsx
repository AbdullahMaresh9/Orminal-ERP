'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { CalendarClock, Plus, Download, Lock, Unlock, AlertCircle, Pencil } from 'lucide-react'

export function FiscalPeriodsModule() {
  const { t, isRTL, dir: rawDir } = useT()
  const dir = rawDir as 'ltr' | 'rtl'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const [yearDialogOpen, setYearDialogOpen] = useState(false)
  const [yearForm, setYearForm] = useState<any>({
    name: '',
    startDate: '',
    endDate: '',
    periodType: 'monthly',
    autoPeriods: true,
  })

  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [editPeriodId, setEditPeriodId] = useState<string | null>(null)
  const [periodForm, setPeriodForm] = useState<any>({
    fiscalYearId: '',
    name: '',
    startDate: '',
    endDate: '',
    quarter: 1,
    state: 'open',
  })

  // Helper for bilingual translations
  const txt = (ar: string, en: string) => (isRTL ? ar : en)

  const formatDateForInput = (dStr: string) => {
    if (!dStr) return ''
    try {
      const d = new Date(dStr)
      return d.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  const { data: yearsData, isLoading } = useQuery<any>({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const r = await fetch('/api/erp/fiscal-years')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })
  const years = yearsData?.data ?? []
  const periods = years.flatMap((y: any) =>
    (y.periods || []).map((p: any) => ({ ...p, fiscalYearName: y.name }))
  )

  // Filtering client-side for rapid search/filtering experience
  const filteredPeriods = periods.filter((p: any) => {
    const matchesSearch = search
      ? p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.fiscalYearName.toLowerCase().includes(search.toLowerCase())
      : true
    const matchesStatus = statusFilter === 'all' ? true : p.state === statusFilter
    const matchesYear = yearFilter === 'all' ? true : p.fiscalYearId === yearFilter
    return matchesSearch && matchesStatus && matchesYear
  })

  const createYearMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/fiscal-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: yearForm.name,
          startDate: yearForm.startDate,
          endDate: yearForm.endDate,
          periodType: yearForm.periodType,
          autoPeriods: yearForm.autoPeriods,
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'error')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(txt('تم إنشاء السنة المالية بنجاح', 'Fiscal year created successfully'))
      qc.invalidateQueries({ queryKey: ['fiscal-years'] })
      setYearDialogOpen(false)
      setYearForm({ name: '', startDate: '', endDate: '', periodType: 'monthly', autoPeriods: true })
    },
    onError: (e: any) => toast.error(e.message || txt('حدث خطأ', 'An error occurred')),
  })

  const savePeriodMut = useMutation({
    mutationFn: async () => {
      const url = editPeriodId ? `/api/erp/fiscal-periods/${editPeriodId}` : '/api/erp/fiscal-periods'
      const method = editPeriodId ? 'PUT' : 'POST'
      const payload: any = {
        name: periodForm.name,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
        quarter: periodForm.quarter ? parseInt(periodForm.quarter) : null,
        state: periodForm.state,
      }
      if (!editPeriodId) {
        payload.fiscalYearId = periodForm.fiscalYearId
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'error')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(
        editPeriodId
          ? txt('تم تحديث الفترة بنجاح', 'Period updated successfully')
          : txt('تم إنشاء الفترة بنجاح', 'Period created successfully')
      )
      qc.invalidateQueries({ queryKey: ['fiscal-years'] })
      setPeriodDialogOpen(false)
      setEditPeriodId(null)
      setPeriodForm({ fiscalYearId: '', name: '', startDate: '', endDate: '', quarter: 1, state: 'open' })
    },
    onError: (e: any) => toast.error(e.message || txt('حدث خطأ', 'An error occurred')),
  })

  const updatePeriodMut = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      const r = await fetch(`/api/erp/fiscal-periods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => {
      toast.success(txt('تم تحديث حالة الفترة بنجاح', 'Period state updated successfully'))
      qc.invalidateQueries({ queryKey: ['fiscal-years'] })
    },
    onError: () => toast.error(txt('حدث خطأ', 'An error occurred')),
  })

  const handleAddYear = () => {
    setYearForm({
      name: '',
      startDate: '',
      endDate: '',
      periodType: 'monthly',
      autoPeriods: true,
    })
    setYearDialogOpen(true)
  }

  const handleAddPeriod = () => {
    setEditPeriodId(null)
    setPeriodForm({
      fiscalYearId: years[0]?.id || '',
      name: '',
      startDate: '',
      endDate: '',
      quarter: 1,
      state: 'open',
    })
    setPeriodDialogOpen(true)
  }

  const handleEditPeriod = (p: any) => {
    setEditPeriodId(p.id)
    setPeriodForm({
      fiscalYearId: p.fiscalYearId,
      name: p.name,
      startDate: formatDateForInput(p.startDate),
      endDate: formatDateForInput(p.endDate),
      quarter: p.quarter || 1,
      state: p.state,
    })
    setPeriodDialogOpen(true)
  }

  const handleExport = () =>
    exportToCSV(
      'fiscal-periods',
      filteredPeriods.map((p: any) => ({
        year: p.fiscalYearName,
        period: p.name,
        start: new Date(p.startDate).toLocaleDateString('en-CA'),
        end: new Date(p.endDate).toLocaleDateString('en-CA'),
        quarter: p.quarter || '',
        state: p.state,
      }))
    )

  return (
    <ModuleShell
      title={txt('الفترات المالية', 'Financial Periods')}
      description={txt('إدارة السنوات والفترات المالية ', 'Manage fiscal years, periods ')}
      icon={<CalendarClock className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={txt('بحث عن الفترات...', 'Search periods...')}
      onExport={handleExport}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddYear}
            className="gap-1.5 border-slate-250 dark:border-blue-400/30 text-slate-700 dark:text-slate-300 h-9"
          >
            <Plus className="size-4" />
            <span>{txt('إضافة سنة مالية', 'Add Fiscal Year')}</span>
          </Button>
          <Button
            size="sm"
            onClick={handleAddPeriod}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9"
          >
            <Plus className="size-4" />
            <span>{txt('إضافة فترة مالية', 'Add Financial Period')}</span>
          </Button>
        </div>
      }
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {txt('الحالة:', 'Status:')}
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter} dir={dir}>
              <SelectTrigger className="h-9 w-[120px]" dir={dir}>
                <SelectValue placeholder={txt('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent dir={dir}>
                <SelectItem value="all">{txt('الكل', 'All')}</SelectItem>
                <SelectItem value="draft">{txt('مسودة', 'Draft')}</SelectItem>
                <SelectItem value="open">{txt('مفتوح', 'Open')}</SelectItem>
                <SelectItem value="closed">{txt('مغلق', 'Closed')}</SelectItem>
                <SelectItem value="locked">{txt('مقفل', 'Locked')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {txt('السنة:', 'Year:')}
            </Label>
            <Select value={yearFilter} onValueChange={setYearFilter} dir={dir}>
              <SelectTrigger className="h-9 w-[140px]" dir={dir}>
                <SelectValue placeholder={txt('السنة المالية', 'Fiscal Year')} />
              </SelectTrigger>
              <SelectContent dir={dir}>
                <SelectItem value="all">{txt('الكل', 'All')}</SelectItem>
                {years.map((y: any) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {/* KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title={txt('السنوات المالية', 'Fiscal Years')}
              value={String(years.length)}
              icon={<CalendarClock className="size-5" />}
              accent="blue"
            />
            <KpiCard
              title={txt('فترات مفتوحة', 'Open Periods')}
              value={String(periods.filter((p: any) => p.state === 'open').length)}
              icon={<Unlock className="size-5" />}
              accent="sky"
            />
            <KpiCard
              title={txt('فترات مغلقة', 'Closed Periods')}
              value={String(periods.filter((p: any) => p.state === 'closed').length)}
              icon={<Lock className="size-5" />}
              accent="amber"
            />
            <KpiCard
              title={txt('فترات مقفلة', 'Locked Periods')}
              value={String(periods.filter((p: any) => p.state === 'locked').length)}
              icon={<AlertCircle className="size-5" />}
              accent="rose"
            />
          </>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-card overflow-hidden ">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>{txt('السنة', 'Year')}</TableHead>
                <TableHead>{txt('الفترة', 'Period')}</TableHead>
                <TableHead>{txt('من', 'From')}</TableHead>
                <TableHead>{txt('إلى', 'To')}</TableHead>
                <TableHead>{txt('الربع', 'Quarter')}</TableHead>
                <TableHead>{txt('الحالة', 'Status')}</TableHead>
                <TableHead className={isRTL ? 'text-left' : 'text-right'}>{txt('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !filteredPeriods.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {txt('لا توجد فترات مالية مطابقة', 'No matching financial periods found')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPeriods.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-semibold">{p.fiscalYearName}</TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.startDate).toLocaleDateString('en-CA')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.endDate).toLocaleDateString('en-CA')}
                    </TableCell>
                    <TableCell className="text-xs">Q{p.quarter || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.state} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          onClick={() => handleEditPeriod(p)}
                          title={txt('تعديل الفترة', 'Edit Period')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {p.state === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'closed' })}
                          >
                            {txt('إغلاق', 'Close')}
                          </Button>
                        )}
                        {p.state === 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'locked' })}
                          >
                            {txt('قفل', 'Lock')}
                          </Button>
                        )}
                        {(p.state === 'closed' || p.state === 'locked') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePeriodMut.mutate({ id: p.id, state: 'open' })}
                          >
                            {txt('فتح', 'Open')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Dialog: Add Fiscal Year */}
      <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
        <DialogContent
          className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
          dir={dir}
        >
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shrink-0">
                <CalendarClock className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {txt('إضافة سنة مالية جديدة', 'Add New Fiscal Year')}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-5 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1">
              {/* Year Name */}
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label htmlFor="yearName" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('اسم السنة *', 'Year Name *')}
                </Label>
                <Input
                  id="yearName"
                  value={yearForm.name}
                  onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                  placeholder="2026"
                  className="h-10 border-slate-250 dark:border-blue-400/30 focus-visible:ring-blue-500"
                  dir={dir}
                />
              </div>

              {/* Start Date */}
              <div className="space-y-1.5 text-start">
                <Label htmlFor="yearStartDate" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('تاريخ البداية *', 'Start Date *')}
                </Label>
                <DatePicker
                  id="yearStartDate"
                  value={yearForm.startDate}
                  onChange={(val) => setYearForm({ ...yearForm, startDate: val })}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5 text-start">
                <Label htmlFor="yearEndDate" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('تاريخ النهاية *', 'End Date *')}
                </Label>
                <DatePicker
                  id="yearEndDate"
                  value={yearForm.endDate}
                  onChange={(val) => setYearForm({ ...yearForm, endDate: val })}
                />
              </div>

              {/* Period Type */}
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('نوع الفترة', 'Period Type')}
                </Label>
                <Select
                  value={yearForm.periodType}
                  onValueChange={(val) => setYearForm({ ...yearForm, periodType: val })}
                  dir={dir}
                >
                  <SelectTrigger className="h-10 border-slate-250 dark:border-blue-400/30" dir={dir}>
                    <SelectValue placeholder={txt('اختر نوع الفترة', 'Select period type')} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    <SelectItem value="monthly">{txt('شهري', 'Monthly')}</SelectItem>
                    <SelectItem value="quarterly">{txt('ربع سنوي', 'Quarterly')}</SelectItem>
                    <SelectItem value="semi-annual">{txt('نصف سنوي', 'Semi-Annual')}</SelectItem>
                    <SelectItem value="annual">{txt('سنوي', 'Annual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto Generate Periods */}
              <div className="md:col-span-2 flex items-center gap-3 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-300/50 dark:border-blue-400/30 rounded-xl">
                <Switch
                  checked={yearForm.autoPeriods}
                  onCheckedChange={(val) => setYearForm({ ...yearForm, autoPeriods: val })}
                  id="auto-gen-periods"
                  className="data-[state=checked]:bg-blue-600 shrink-0"
                />
                <div className="space-y-0.5 flex-1 text-start">
                  <Label
                    htmlFor="auto-gen-periods"
                    className="text-sm font-bold text-blue-955 dark:text-blue-200 cursor-pointer"
                  >
                    {txt('توليد الفترات تلقائياً', 'Auto Generate Periods')}
                  </Label>
                  <p className="text-xs text-blue-800/70 dark:text-blue-300/60 leading-normal">
                    {txt(
                      'توليد جميع الفترات المالية تلقائياً داخل هذه السنة بناء على النوع المحدد',
                      'Automatically generate all related financial periods based on the selected type'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setYearDialogOpen(false)}
              className="h-10 px-5 border-slate-250 dark:border-blue-400/30 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {txt('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => createYearMut.mutate()}
              disabled={!yearForm.name || !yearForm.startDate || !yearForm.endDate || createYearMut.isPending}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
            >
              {createYearMut.isPending ? txt('جاري الإضافة...', 'Adding...') : txt('اضافة وحفـظ', 'Add and Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit Fiscal Period */}
      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent
          className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          dir={dir}
        >
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shrink-0">
                <CalendarClock className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editPeriodId
                    ? txt('تعديل الفترة المالية', 'Edit Financial Period')
                    : txt('إضافة فترة مالية جديدة', 'Add New Financial Period')}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-5 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1">
              {/* Fiscal Year (Selected) */}
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('السنة المالية *', 'Fiscal Year *')}
                </Label>
                <Select
                  value={periodForm.fiscalYearId}
                  onValueChange={(val) => setPeriodForm({ ...periodForm, fiscalYearId: val })}
                  disabled={!!editPeriodId}
                  dir={dir}
                >
                  <SelectTrigger className="h-10 border-slate-250 dark:border-blue-400/30" dir={dir}>
                    <SelectValue placeholder={txt('اختر السنة المالية', 'Select Fiscal Year')} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    {years.map((y: any) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period Name */}
              <div className="space-y-1.5 text-start md:col-span-2">
                <Label htmlFor="periodName" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('اسم الفترة *', 'Period Name *')}
                </Label>
                <Input
                  id="periodName"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  placeholder={txt('يناير 2026', 'January 2026')}
                  className="h-10 border-slate-250 dark:border-blue-400/30 focus-visible:ring-blue-500"
                  dir={dir}
                />
              </div>

              {/* Start Date */}
              <div className="space-y-1.5 text-start">
                <Label htmlFor="periodStartDate" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('تاريخ البداية *', 'Start Date *')}
                </Label>
                <DatePicker
                  id="periodStartDate"
                  value={periodForm.startDate}
                  onChange={(val) => setPeriodForm({ ...periodForm, startDate: val })}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5 text-start">
                <Label htmlFor="periodEndDate" className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('تاريخ النهاية *', 'End Date *')}
                </Label>
                <DatePicker
                  id="periodEndDate"
                  value={periodForm.endDate}
                  onChange={(val) => setPeriodForm({ ...periodForm, endDate: val })}
                />
              </div>

              {/* Quarter Select */}
              <div className="space-y-1.5 text-start">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('الربع', 'Quarter')}
                </Label>
                <Select
                  value={String(periodForm.quarter)}
                  onValueChange={(val) => setPeriodForm({ ...periodForm, quarter: parseInt(val) })}
                  dir={dir}
                >
                  <SelectTrigger className="h-10 border-slate-250 dark:border-blue-400/30" dir={dir}>
                    <SelectValue placeholder={txt('الربع', 'Quarter')} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    <SelectItem value="1">{txt('الربع الأول (Q1)', 'Q1')}</SelectItem>
                    <SelectItem value="2">{txt('الربع الثاني (Q2)', 'Q2')}</SelectItem>
                    <SelectItem value="3">{txt('الربع الثالث (Q3)', 'Q3')}</SelectItem>
                    <SelectItem value="4">{txt('الربع الرابع (Q4)', 'Q4')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5 text-start">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  {txt('الحالة', 'Status')}
                </Label>
                <Select
                  value={periodForm.state}
                  onValueChange={(val) => setPeriodForm({ ...periodForm, state: val })}
                  dir={dir}
                >
                  <SelectTrigger className="h-10 border-slate-250 dark:border-blue-400/30" dir={dir}>
                    <SelectValue placeholder={txt('الحالة', 'Status')} />
                  </SelectTrigger>
                  <SelectContent dir={dir}>
                    <SelectItem value="draft">{txt('مسودة', 'Draft')}</SelectItem>
                    <SelectItem value="open">{txt('مفتوح', 'Open')}</SelectItem>
                    <SelectItem value="closed">{txt('مغلق', 'Closed')}</SelectItem>
                    <SelectItem value="locked">{txt('مقفل', 'Locked')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setPeriodDialogOpen(false)}
              className="h-10 px-5 border-slate-250 ddark:border-blue-400/30 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {txt('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => savePeriodMut.mutate()}
              disabled={
                !periodForm.name ||
                !periodForm.startDate ||
                !periodForm.endDate ||
                !periodForm.fiscalYearId ||
                savePeriodMut.isPending
              }
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
            >
              {savePeriodMut.isPending ? txt('جاري الحفظ...', 'Saving...') : txt('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
