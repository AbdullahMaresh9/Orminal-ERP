'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { relativeTime, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { Bell, BellOff, CheckCheck, Trash2, Mail, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  info: { icon: <Info className="size-4" />, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  success: { icon: <CheckCircle className="size-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  warning: { icon: <AlertTriangle className="size-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  error: { icon: <XCircle className="size-4" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
}

const TYPE_LABELS: Record<string, string> = {
  info: 'معلومة', success: 'نجاح', warning: 'تحذير', error: 'خطأ',
}

const CATEGORY_LABELS: Record<string, string> = {
  system: 'نظام', inventory: 'مخزون', sales: 'مبيعات', purchases: 'مشتريات', finance: 'مالية', accounting: 'محاسبة',
}

export function NotificationsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['notifications', typeFilter],
    queryFn: async () => {
      const r = await fetch('/api/erp/notifications')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/erp/notifications/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const all = data?.data ?? []
      await Promise.all(all.filter((n) => !n.isRead).map((n) =>
        fetch(`/api/erp/notifications/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) })
      ))
    },
    onSuccess: () => {
      toast.success('تم تحديد الكل كمقروء')
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/erp/notifications/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error(t('error.delete')),
  })

  const all = data?.data ?? []
  const filtered = typeFilter === 'all' ? all : all.filter((n) => n.type === typeFilter)
  const total = all.length
  const unread = all.filter((n) => !n.isRead).length
  const byType = (type: string) => all.filter((n) => n.type === type).length

  return (
    <ModuleShell
      title={t('module.notifications')}
      description="إدارة الإشعارات والتنبيهات"
      icon={<Bell className="size-5" />}
      actions={
        <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={unread === 0 || markAllReadMutation.isPending} className="gap-1.5">
          <CheckCheck className="size-4" /> تحديد الكل كمقروء
        </Button>
      }
      filters={
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="info">معلومة</SelectItem>
            <SelectItem value="success">نجاح</SelectItem>
            <SelectItem value="warning">تحذير</SelectItem>
            <SelectItem value="error">خطأ</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي الإشعارات" value={String(total)} icon={<Bell className="size-5" />} accent="emerald" />
        <KpiCard title="غير مقروء" value={String(unread)} icon={<Mail className="size-5" />} accent="rose" />
        <KpiCard title="تحذيرات" value={String(byType('warning'))} icon={<AlertTriangle className="size-5" />} accent="amber" />
        <KpiCard title="أخطاء" value={String(byType('error'))} icon={<XCircle className="size-5" />} accent="rose" />
      </div>

      <Card className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[65vh] scrollbar-thin">
          <div className="divide-y">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
                <BellOff className="size-10 text-muted-foreground/50" />
                <p>{t('empty.noData')}</p>
              </div>
            ) : filtered.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.info
              return (
                <div key={n.id} className={cn('flex items-start gap-3 p-4 transition-colors', !n.isRead && 'bg-primary/[0.03]')}>
                  <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', meta.bg, meta.color)}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-semibold', !n.isRead && 'font-bold')}>{n.title}</p>
                      {!n.isRead && <span className="size-2 rounded-full bg-primary" />}
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[n.category] ?? n.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      <span className="num">{formatDateTime(n.createdAt)}</span> · {relativeTime(n.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <Button variant="ghost" size="icon" className="size-8" title="تحديد كمقروء" onClick={() => markReadMutation.mutate(n.id)}>
                        <CheckCheck className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => deleteMutation.mutate(n.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </Card>
    </ModuleShell>
  )
}
