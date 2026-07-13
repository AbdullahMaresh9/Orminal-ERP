'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDateTime, relativeTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell, BellOff, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, XCircle,
  Mail, MailOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string // info|success|warning|error
  category: string // system|finance|sales|purchase|inventory|hr|workflow
  isRead: boolean
  link?: string
  createdAt: string
  user?: { id: string; nameAr: string; username?: string }
}

interface NotificationResponse {
  data: Notification[]
  meta: {
    timestamp: string
    total: number
    unread: number
    byType: Record<string, number>
    byCategory: Record<string, number>
  }
}

const TYPES = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'info', label: 'معلومات' },
  { value: 'success', label: 'نجاح' },
  { value: 'warning', label: 'تحذير' },
  { value: 'error', label: 'خطأ' },
]

const CATEGORIES = [
  { value: 'all', label: 'كل التصنيفات' },
  { value: 'system', label: 'نظام' },
  { value: 'finance', label: 'مالية' },
  { value: 'sales', label: 'مبيعات' },
  { value: 'purchase', label: 'مشتريات' },
  { value: 'inventory', label: 'مخزون' },
  { value: 'hr', label: 'موارد بشرية' },
  { value: 'workflow', label: 'تدفقات عمل' },
]

const READ_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'unread', label: 'غير مقروء' },
  { value: 'read', label: 'مقروء' },
]

const TYPE_META: Record<string, { icon: React.ReactNode; badge: string }> = {
  info: { icon: <Info className="size-4" />, badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400' },
  success: { icon: <CheckCircle2 className="size-4" />, badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400' },
  warning: { icon: <AlertTriangle className="size-4" />, badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' },
  error: { icon: <XCircle className="size-4" />, badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' },
}

export function NotificationsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterRead, setFilterRead] = useState('all')

  const { data, isLoading } = useQuery<NotificationResponse>({
    queryKey: ['notifications', filterType, filterCategory, filterRead],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterCategory !== 'all') params.set('category', filterCategory)
      if (filterRead !== 'all') params.set('isRead', filterRead === 'read' ? 'true' : 'false')
      const r = await fetch(`/api/erp/notifications?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const notifications = (data?.data ?? []).filter((n) =>
    !search || n.title.includes(search) || n.message.includes(search)
  )

  const meta = data?.meta
  const stats = {
    total: meta?.total ?? notifications.length,
    unread: meta?.unread ?? notifications.filter((n) => !n.isRead).length,
    byType: meta?.byType ?? {},
    byCategory: meta?.byCategory ?? {},
  }

  const topTypeEntry = Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0]
  const topTypeLabel = topTypeEntry && topTypeEntry[1] > 0
    ? `${TYPES.find((x) => x.value === topTypeEntry[0])?.label ?? topTypeEntry[0]} (${topTypeEntry[1]})`
    : '—'

  const topCategoryEntry = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]
  const topCategoryLabel = topCategoryEntry && topCategoryEntry[1] > 0
    ? `${CATEGORIES.find((x) => x.value === topCategoryEntry[0])?.label ?? topCategoryEntry[0]} (${topCategoryEntry[1]})`
    : '—'

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('حدث خطأ'),
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/notifications', { method: 'PATCH' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: (res: any) => {
      toast.success(`تم تعليم ${res?.data?.updated ?? 'الكل'} كمقروء`)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/notifications/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حذف الإشعار')
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleExport = () => {
    const rows = notifications.map((n) => ({
      'العنوان': n.title,
      'الرسالة': n.message,
      'النوع': n.type,
      'التصنيف': n.category,
      'مقروء': n.isRead ? 'نعم' : 'لا',
      'التاريخ': formatDateTime(n.createdAt),
    }))
    exportToCSV('notifications', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.notifications')}
      description="إدارة الإشعارات والمطالعات عبر النظام"
      icon={<Bell className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث في عنوان أو نص الإشعار..."
      onExport={handleExport}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={markAllReadMutation.isPending || stats.unread === 0}
          onClick={() => markAllReadMutation.mutate()}
        >
          <CheckCheck className="size-4" />
          <span className="hidden sm:inline">تعليم الكل كمقروء</span>
        </Button>
      }
      filters={
        <>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {READ_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filterRead === f.value ? 'default' : 'outline'}
              onClick={() => setFilterRead(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الإشعارات" value={formatInt(stats.total)} icon={<Bell className="size-5" />} accent="blue" />
        <KpiCard title="غير مقروءة" value={formatInt(stats.unread)} icon={<BellOff className="size-5" />} accent="rose" />
        <KpiCard title="الأكثر نوعاً" value={topTypeLabel} icon={<Info className="size-5" />} accent="amber" />
        <KpiCard title="الأكثر تصنيفاً" value={topCategoryLabel} icon={<Mail className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4 w-8"></TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الرسالة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : notifications.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد إشعارات مطابقة.</TableCell></TableRow>
              ) : notifications.map((n) => {
                const tm = TYPE_META[n.type] ?? TYPE_META.info
                return (
                  <TableRow
                    key={n.id}
                    className={cn('hover:bg-muted/40', !n.isRead && 'bg-blue-50/40 dark:bg-blue-950/10')}
                  >
                    <TableCell className="ps-4">
                      <div className={cn('size-8 rounded-lg flex items-center justify-center', tm.badge, 'border')}>
                        {tm.icon}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {!n.isRead && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
                        <span className={cn(!n.isRead && 'font-bold')}>{n.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={n.message}>
                      {n.message || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', tm.badge)}>{n.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {n.isRead ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MailOpen className="size-3.5" /> مقروء
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Mail className="size-3.5" /> غير مقروء
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={formatDateTime(n.createdAt)}>
                      <span className="num" dir="ltr">{relativeTime(n.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        {!n.isRead && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-blue-600 hover:text-blue-700"
                            onClick={() => markReadMutation.mutate(n.id)}
                            title="تعليم كمقروء"
                          >
                            <CheckCheck className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-rose-500 hover:text-rose-600"
                          onClick={() => deleteMutation.mutate(n.id)}
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </ModuleShell>
  )
}
