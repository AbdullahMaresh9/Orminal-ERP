'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  BookOpen, Lock, Plus, Pencil, Trash2, ChevronDown, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  type: string
  subtype?: string
  parentId?: string
  isSystem: boolean
  balance: number
  computedBalance?: number
  active: boolean
}

const TYPE_META: Record<string, { label: string; color: string; ring: string }> = {
  asset: { label: 'أصول', color: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-900 bg-emerald-50 dark:bg-emerald-950/40' },
  liability: { label: 'التزامات', color: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200 dark:ring-rose-900 bg-rose-50 dark:bg-rose-950/40' },
  equity: { label: 'حقوق ملكية', color: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200 dark:ring-violet-900 bg-violet-50 dark:bg-violet-950/40' },
  income: { label: 'إيرادات', color: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-200 dark:ring-teal-900 bg-teal-50 dark:bg-teal-950/40' },
  expense: { label: 'مصروفات', color: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-900 bg-amber-50 dark:bg-amber-950/40' },
}

export function ChartOfAccountsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<{ data: Account[]; meta: any }>({
    queryKey: ['accounts', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '500')
      const r = await fetch(`/api/erp/accounts?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const accounts = data?.data ?? []
  const groups = (['asset', 'liability', 'equity', 'income', 'expense'] as const)
    .map((type) => ({
      type,
      items: accounts.filter((a) => a.type === type).sort((a, b) => a.code.localeCompare(b.code)),
    }))

  const stats = {
    total: accounts.length,
    system: accounts.filter((a) => a.isSystem).length,
    assets: accounts.filter((a) => a.type === 'asset').reduce((s, a) => s + (a.computedBalance ?? a.balance), 0),
    liabilitiesEquity: accounts.filter((a) => a.type === 'liability' || a.type === 'equity').reduce((s, a) => s + (a.computedBalance ?? a.balance), 0),
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/accounts/${editing.id}` : '/api/erp/accounts'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/accounts/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleSave = (formData: FormData) => {
    const payload: any = {
      code: formData.get('code'),
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      type: formData.get('type'),
      subtype: formData.get('subtype') || undefined,
      parentId: formData.get('parentId') || undefined,
      active: formData.get('active') === 'on',
    }
    saveMutation.mutate(payload)
  }

  const handleExport = () => {
    const rows = accounts.map((a) => ({
      'الرمز': a.code,
      'الاسم': a.nameAr,
      'النوع': TYPE_META[a.type]?.label ?? a.type,
      'النوع الفرعي': a.subtype ?? '',
      'الرصيد': a.computedBalance ?? a.balance,
      'حساب نظامي': a.isSystem ? 'نعم' : 'لا',
      'الحالة': a.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('chart-of-accounts', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.chart-of-accounts')}
      description="دليل الحسابات الشامل حسب النوع"
      icon={<BookOpen className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الحساب أو الاسم..."
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={t('action.add')}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الحسابات" value={formatInt(stats.total)} icon={<BookOpen className="size-5" />} accent="emerald" />
        <KpiCard title="حسابات نظامية" value={formatInt(stats.system)} icon={<Lock className="size-5" />} accent="amber" />
        <KpiCard title="إجمالي الأصول" value={formatCurrency(stats.assets)} icon={<Layers className="size-5" />} accent="teal" />
        <KpiCard title="الالتزامات + حقوق الملكية" value={formatCurrency(stats.liabilitiesEquity)} icon={<Layers className="size-5" />} accent="violet" />
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const meta = TYPE_META[g.type]
          if (g.items.length === 0) return null
          const groupBalance = g.items.reduce((s, a) => s + (a.computedBalance ?? a.balance), 0)
          const isCollapsed = collapsed[g.type]
          return (
            <Card key={g.type} className="rounded-xl overflow-hidden">
              <Collapsible open={!isCollapsed} onOpenChange={(o) => setCollapsed({ ...collapsed, [g.type]: !o })}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn('size-9 rounded-lg flex items-center justify-center ring-1', meta.ring, meta.color)}>
                      <Layers className="size-4" />
                    </div>
                    <div className="text-start">
                      <p className="font-semibold text-sm">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{g.items.length} حساب</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums" dir="ltr">{formatCurrency(groupBalance)}</span>
                    <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', isCollapsed ? '' : 'rotate-180')} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="ps-4">الرمز</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>النوع الفرعي</TableHead>
                        <TableHead className="text-end num-cell">الرصيد</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead className="text-end">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((a) => (
                        <TableRow key={a.id} className="hover:bg-muted/40">
                          <TableCell className="ps-4 font-mono text-xs" dir="ltr">{a.code}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {a.nameAr}
                              {a.isSystem && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] gap-1">
                                  <Lock className="size-2.5" />
                                  نظامي
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.subtype ?? '—'}</TableCell>
                          <TableCell className="text-end num-cell">
                            <span className={cn('num tabular-nums font-semibold', meta.color)} dir="ltr">
                              {formatCurrency(a.computedBalance ?? a.balance)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px]', meta.ring, meta.color)}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(a); setDialogOpen(true) }}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-rose-500 hover:text-rose-600 disabled:opacity-40"
                                disabled={a.isSystem}
                                onClick={() => deleteMutation.mutate(a.id)}
                                title={a.isSystem ? 'لا يمكن حذف حساب نظامي' : 'حذف'}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
        {isLoading && (
          <Card className="p-10 text-center text-muted-foreground">جاري التحميل...</Card>
        )}
        {!isLoading && accounts.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">لا توجد حسابات</Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل حساب' : 'إضافة حساب جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات الحساب</DialogDescription>
          </DialogHeader>
          <DialogBody>          <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)) }}>
            <ScrollArea className="max-h-[60vh] pe-2">
              <div className="grid grid-cols-2 gap-4 p-1">
                <div className="space-y-1.5">
                  <Label htmlFor="code">الرمز *</Label>
                  <Input id="code" name="code" defaultValue={editing?.code} required disabled={editing?.isSystem} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                  <Input id="nameAr" name="nameAr" defaultValue={editing?.nameAr} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                  <Input id="nameEn" name="nameEn" defaultValue={editing?.nameEn} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">النوع *</Label>
                  <Select name="type" defaultValue={editing?.type ?? 'asset'} disabled={editing?.isSystem}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">أصول</SelectItem>
                      <SelectItem value="liability">التزامات</SelectItem>
                      <SelectItem value="equity">حقوق ملكية</SelectItem>
                      <SelectItem value="income">إيرادات</SelectItem>
                      <SelectItem value="expense">مصروفات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subtype">النوع الفرعي</Label>
                  <Input id="subtype" name="subtype" defaultValue={editing?.subtype} placeholder="current_asset" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentId">الحساب الأب</Label>
                  <Select name="parentId" defaultValue={editing?.parentId}>
                    <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => !editing || a.id !== editing.id).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.nameAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6 col-span-2">
                  <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                  <Label htmlFor="active">نشط</Label>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </DialogFooter>
          </form>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
