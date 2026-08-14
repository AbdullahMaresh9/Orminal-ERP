'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { DatePicker } from '@/components/ui/date-picker'
import {
  ScrollText, CalendarClock, Activity, FileEdit, Eye,
} from 'lucide-react'

interface AuditLog {
  id: string
  userId?: string
  moduleCode: string
  documentType: string
  documentId?: string
  action: string
  oldValue?: string
  newValue?: string
  reason?: string
  ipAddress?: string
  deviceInfo?: string
  correlationId?: string
  createdAt: string
  user?: { id: string; nameAr: string; nameEn?: string; username?: string; email?: string }
}

interface AuditResponse {
  data: AuditLog[]
  meta: {
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
    extras?: {
      today: number
      byAction: { create: number; update: number; delete: number; post: number }
      byModule: Record<string, number>
    }
  }
}

const ACTIONS = [
  { value: 'all', label: 'كل الإجراءات' },
  { value: 'create', label: 'إنشاء' },
  { value: 'update', label: 'تحديث' },
  { value: 'delete', label: 'حذف' },
  { value: 'post', label: 'ترحيل' },
  { value: 'reverse', label: 'عكس' },
  { value: 'cancel', label: 'إلغاء' },
  { value: 'approve', label: 'اعتماد' },
  { value: 'login', label: 'دخول' },
  { value: 'logout', label: 'خروج' },
  { value: 'export', label: 'تصدير' },
]

const MODULES = [
  { value: 'all', label: 'كل الوحدات' },
  { value: 'FIN', label: 'مالية' },
  { value: 'SAL', label: 'مبيعات' },
  { value: 'PUR', label: 'مشتريات' },
  { value: 'INV', label: 'مخزون' },
  { value: 'MFG', label: 'تصنيع' },
  { value: 'HR', label: 'موارد بشرية' },
  { value: 'SYS', label: 'نظام' },
]

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400',
  update: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400',
  delete: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
  post: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400',
  reverse: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
  cancel: 'bg-muted text-muted-foreground',
  approve: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400',
  login: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400',
  logout: 'bg-muted text-muted-foreground',
  export: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400',
}

function truncate(s?: string, n = 60): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function prettyJson(s?: string): string {
  if (!s) return '—'
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

export function AuditLogsModule() {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<AuditLog | null>(null)
  const [page, setPage] = useState(1)
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

  const pageSize = 25

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', filterAction, filterModule, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterAction !== 'all') params.set('action', filterAction)
      if (filterModule !== 'all') params.set('module', filterModule)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/audit-logs?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const logs = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const extras = data?.meta?.extras

  const filteredLogs = search
    ? logs.filter((l) => {
      const u = l.user?.nameAr || l.user?.username || ''
      return (
        u.includes(search) ||
        l.documentType.includes(search) ||
        (l.documentId ?? '').includes(search) ||
        (l.reason ?? '').includes(search)
      )
    })
    : logs

  // Use global stats from API; fallback to filtered counts
  const totalLogs = extras ? total : filteredLogs.length
  const todayCount = extras?.today ?? 0
  const byAction = extras?.byAction ?? { create: 0, update: 0, delete: 0, post: 0 }
  const byModule = extras?.byModule ?? {}

  // Pick the largest action count for "by action " KPI
  const topActionEntry = Object.entries(byAction).sort((a, b) => b[1] - a[1])[0]
  const topActionLabel = topActionEntry && topActionEntry[1] > 0
    ? `${ACTIONS.find((a) => a.value === topActionEntry[0])?.label ?? topActionEntry[0]} (${topActionEntry[1]})`
    : '—'

  const topModuleEntry = Object.entries(byModule).sort((a, b) => b[1] - a[1])[0]
  const topModuleLabel = topModuleEntry && topModuleEntry[1] > 0
    ? `${MODULES.find((m) => m.value === topModuleEntry[0])?.label ?? topModuleEntry[0]} (${topModuleEntry[1]})`
    : '—'

  const handleExport = () => {
    const rows = filteredLogs.map((l) => ({
      'التاريخ': formatDateTime(l.createdAt),
      'المستخدم': l.user?.nameAr ?? l.user?.username ?? '—',
      'الوحدة': l.moduleCode,
      'نوع المستند': l.documentType,
      'معرف المستند': l.documentId ?? '',
      'الإجراء': l.action,
      'القيمة القديمة': l.oldValue ?? '',
      'القيمة الجديدة': l.newValue ?? '',
      'IP': l.ipAddress ?? '',
    }))
    exportToCSV('audit-logs', rows)
    toast.success('تم تصدير الملف')
  }

  const openView = (log: AuditLog) => {
    setViewing(log)
    setViewOpen(true)
  }

  return (
    <ModuleShell
      title={t('module.audit-logs')}
      description="سجل التدقيق الكامل لكل الإجراءات على النظام (للقراءة فقط — ADR-014)"
      icon={<ScrollText className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث في المستخدم أو نوع المستند..."
      onExport={handleExport}
      filters={
        <>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1) }}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(1) }}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker
            value={dateFrom}
            onChange={(val) => { setDateFrom(val); setPage(1) }}
            placeholder="من تاريخ"
            className="w-36"
          />
          <DatePicker
            value={dateTo}
            onChange={(val) => { setDateTo(val); setPage(1) }}
            placeholder="إلى تاريخ"
            className="w-36"
          />
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي السجلات" value={formatInt(totalLogs)} icon={<ScrollText className="size-5" />} accent="blue" />
        <KpiCard title="سجلات اليوم" value={formatInt(todayCount)} icon={<CalendarClock className="size-5" />} accent="sky" />
        <KpiCard title="الأكثر إجراءً" value={topActionLabel} icon={<Activity className="size-5" />} accent="amber" />
        <KpiCard title="الأكثر وحدةً" value={topModuleLabel} icon={<FileEdit className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">التاريخ</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>نوع المستند</TableHead>
                <TableHead>معرف المستند</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>القيمة القديمة</TableHead>
                <TableHead>القيمة الجديدة</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="text-end">عرض</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد سجلات مطابقة للفلاتر المحددة.</TableCell></TableRow>
              ) : filteredLogs.map((l) => (
                <TableRow
                  key={l.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => openView(l)}
                >
                  <TableCell className="ps-4 text-xs whitespace-nowrap">
                    <span className="num" dir="ltr">{formatDateTime(l.createdAt)}</span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {l.user?.nameAr ?? l.user?.username ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="font-mono text-[10px]">{l.moduleCode}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono" dir="ltr">{l.documentType}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">{l.documentId ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${ACTION_BADGE[l.action] ?? ''}`}>
                      {ACTIONS.find((a) => a.value === l.action)?.label ?? l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-32 truncate" title={l.oldValue ?? ''}>
                    {truncate(l.oldValue, 40)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-32 truncate" title={l.newValue ?? ''}>
                    {truncate(l.newValue, 40)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">{l.ipAddress ?? '—'}</TableCell>
                  <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => openView(l)}>
                      <Eye className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {filteredLogs.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + filteredLogs.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة <span className="num" dir="ltr">{page}</span> من <span className="num" dir="ltr">{totalPages}</span></span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      {/* Read-only detail dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ScrollText className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {isRTL ? 'تفاصيل سجل التدقيق' : 'Audit Log Details'}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-700/70 dark:text-blue-200/60 leading-normal">
                  {viewing && (
                    <span>
                      {isRTL ? 'سجل بتاريخ ' : 'Log date: '}
                      <span className="num font-mono" dir="ltr">{formatDateTime(viewing.createdAt)}</span>
                      {isRTL ? ' — للقراءة فقط' : ' — Read-only'}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 overflow-y-auto max-h-[70vh]">
            {viewing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-start">
                  <DetailField label={isRTL ? 'المستخدم' : 'User'} value={viewing.user?.nameAr ?? viewing.user?.username ?? '—'} />
                  <DetailField label={isRTL ? 'البريد' : 'Email'} value={viewing.user?.email ?? '—'} dir="ltr" />
                  <DetailField label={isRTL ? 'الوحدة' : 'Module'} value={viewing.moduleCode} mono />
                  <DetailField label={isRTL ? 'نوع المستند' : 'Document Type'} value={viewing.documentType} mono />
                  <DetailField label={isRTL ? 'معرف المستند' : 'Document ID'} value={viewing.documentId ?? '—'} mono />
                  <DetailField label={isRTL ? 'الإجراء' : 'Action'} value={ACTIONS.find((a) => a.value === viewing.action)?.label ?? viewing.action} />
                  <DetailField label={isRTL ? 'عنوان IP' : 'IP Address'} value={viewing.ipAddress ?? '—'} mono />
                  <DetailField label={isRTL ? 'معرف الارتباط' : 'Correlation ID'} value={viewing.correlationId ?? '—'} mono />
                </div>
                {viewing.reason && (
                  <DetailField label={isRTL ? 'السبب' : 'Reason'} value={viewing.reason} />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-start">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'القيمة القديمة ( oldValue )' : 'Old Value'}</Label>
                    <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 max-h-60 overflow-auto whitespace-pre-wrap break-all" dir="ltr">
                      {prettyJson(viewing.oldValue)}
                    </pre>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'القيمة الجديدة ( newValue )' : 'New Value'}</Label>
                    <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 max-h-60 overflow-auto whitespace-pre-wrap break-all" dir="ltr">
                      {prettyJson(viewing.newValue)}
                    </pre>
                  </div>
                </div>

                <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                  <Button type="button" variant="outline" onClick={() => setViewOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'إغلاق' : 'Close'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}


function DetailField({ label, value, mono, dir }: { label: string; value: string; mono?: boolean; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={`text-sm bg-muted/30 rounded-md p-2 ${mono ? 'font-mono' : ''}`} dir={dir}>{value}</div>
    </div>
  )
}
