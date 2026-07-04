'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { ScrollText, Calendar, Plus, Pencil, Trash2, FileEdit, Eye, Download, Activity } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  update: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  delete: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  login: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
  logout: 'bg-muted text-muted-foreground',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تحديث',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
}

export function AuditLogsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [detailsOpen, setDetailsOpen] = useState<any | null>(null)

  const { data, isLoading } = useQuery<any>({
    queryKey: ['audit-logs', actionFilter, entityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (entityFilter !== 'all') params.set('entity', entityFilter)
      const r = await fetch(`/api/erp/audit-logs?${params}`)
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  const logs = data?.data ?? []
  const total = data?.total ?? 0
  const today = data?.today ?? 0
  const byAction = data?.byAction ?? {}

  function handleExport() {
    exportToCSV('audit-logs', logs.map((l: any) => ({
      date: formatDateTime(l.createdAt),
      user: l.user?.name ?? '—',
      action: ACTION_LABELS[l.action] ?? l.action,
      entity: l.entity,
      entityId: l.entityId ?? '',
      details: l.details ?? '',
      ip: l.ipAddress ?? '',
    })))
  }

  return (
    <ModuleShell
      title={t('module.audit-logs')}
      description="سجل التدقيق وعمليات النظام"
      icon={<ScrollText className="size-5" />}
      onExport={handleExport}
      filters={
        <>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="الإجراء" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الإجراءات</SelectItem>
              <SelectItem value="create">إنشاء</SelectItem>
              <SelectItem value="update">تحديث</SelectItem>
              <SelectItem value="delete">حذف</SelectItem>
              <SelectItem value="login">تسجيل دخول</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="الكيان" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الكيانات</SelectItem>
              <SelectItem value="user">مستخدم</SelectItem>
              <SelectItem value="branch">فرع</SelectItem>
              <SelectItem value="product">منتج</SelectItem>
              <SelectItem value="sales_order">أمر بيع</SelectItem>
              <SelectItem value="purchase_order">أمر شراء</SelectItem>
              <SelectItem value="journal_entry">قيد محاسبي</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي العمليات" value={String(total)} icon={<Activity className="size-5" />} accent="emerald" />
        <KpiCard title="اليوم" value={String(today)} icon={<Calendar className="size-5" />} accent="teal" />
        <KpiCard title="إنشاء" value={String(byAction.create ?? 0)} icon={<Plus className="size-5" />} accent="violet" />
        <KpiCard title="حذف" value={String(byAction.delete ?? 0)} icon={<Trash2 className="size-5" />} accent="rose" />
      </div>

      <Card className="rounded-xl border">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>الكيان</TableHead>
                <TableHead className="hidden md:table-cell">المعرّف</TableHead>
                <TableHead className="hidden lg:table-cell">IP</TableHead>
                <TableHead className="text-end">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('loading')}</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell></TableRow>
              ) : logs.map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setDetailsOpen(l)}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.createdAt)}</TableCell>
                  <TableCell className="font-medium text-sm">{l.user?.name ?? 'النظام'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${ACTION_COLORS[l.action] ?? ''}`}>
                      {ACTION_LABELS[l.action] ?? l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.entity}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-[10px] text-muted-foreground">{l.entityId ?? '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-[10px] text-muted-foreground">{l.ipAddress ?? '—'}</TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); setDetailsOpen(l) }}>
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Dialog open={!!detailsOpen} onOpenChange={(o) => !o && setDetailsOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل العملية</DialogTitle>
          </DialogHeader>
          {detailsOpen && (
            <div className="space-y-3 py-2">
              <Row label="التاريخ" value={formatDateTime(detailsOpen.createdAt)} />
              <Row label="المستخدم" value={detailsOpen.user?.name ?? 'النظام'} />
              <Row label="الإجراء" value={ACTION_LABELS[detailsOpen.action] ?? detailsOpen.action} />
              <Row label="الكيان" value={detailsOpen.entity} />
              <Row label="المعرّف" value={detailsOpen.entityId ?? '—'} mono />
              <Row label="IP" value={detailsOpen.ipAddress ?? '—'} mono />
              {detailsOpen.details && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">التفاصيل</p>
                  <div className="p-3 rounded-lg bg-muted/40 text-sm">{detailsOpen.details}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
