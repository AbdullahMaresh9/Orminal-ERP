'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatInt } from '@/lib/format'
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Factory, Plus, Pencil, Trash2, Cog, Gauge, Coins } from 'lucide-react'

interface WorkCenter {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  capacityPerHour: number
  costPerHour: number
  active: boolean
}

export function WorkCentersModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkCenter | null>(null)

  const { data, isLoading } = useQuery<{ data: WorkCenter[]; meta: any }>({
    queryKey: ['work-centers', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '200')
      const r = await fetch(`/api/erp/work-centers?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const items = data?.data ?? []

  const stats = {
    total: items.length,
    active: items.filter((i) => i.active).length,
    totalCapacity: items.reduce((s, i) => s + (i.capacityPerHour || 0), 0),
    avgCost: items.length ? items.reduce((s, i) => s + (i.costPerHour || 0), 0) / items.length : 0,
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/work-centers/${editing.id}` : '/api/erp/work-centers'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
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
      qc.invalidateQueries({ queryKey: ['work-centers'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/work-centers/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['work-centers'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleSave = (formData: FormData) => {
    const payload: any = {
      code: formData.get('code'),
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      capacityPerHour: Number(formData.get('capacityPerHour')) || 0,
      costPerHour: Number(formData.get('costPerHour')) || 0,
      active: formData.get('active') === 'on',
    }
    saveMutation.mutate(payload)
  }

  const handleExport = () => {
    const rows = items.map((w) => ({
      'الرمز': w.code,
      'الاسم': w.nameAr,
      'الاسم (إنجليزي)': w.nameEn ?? '',
      'الساعة/سعة': w.capacityPerHour,
      'التكلفة/ساعة': w.costPerHour,
      'الحالة': w.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('work-centers', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.work-centers')}
      description="إدارة مراكز العمل والإنتاج: السعة والتكلفة لكل ساعة"
      icon={<Factory className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز المركز أو الاسم..."
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={t('action.add')}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي المراكز" value={formatInt(stats.total)} icon={<Factory className="size-5" />} accent="blue" />
        <KpiCard title="المراكز النشطة" value={formatInt(stats.active)} icon={<Cog className="size-5" />} accent="sky" />
        <KpiCard title="إجمالي السعة/ساعة" value={formatNumber(stats.totalCapacity, 0)} icon={<Gauge className="size-5" />} accent="amber" />
        <KpiCard title="متوسط التكلفة/ساعة" value={formatCurrency(stats.avgCost)} icon={<Coins className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الاسم (إنجليزي)</TableHead>
                <TableHead className="text-end num-cell">السعة/ساعة</TableHead>
                <TableHead className="text-end num-cell">التكلفة/ساعة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد مراكز عمل. ابدأ بإضافة أول مركز.</TableCell></TableRow>
              ) : items.map((w) => (
                <TableRow key={w.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{w.code}</TableCell>
                  <TableCell className="font-medium">{w.nameAr}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{w.nameEn ?? '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatNumber(w.capacityPerHour, 0)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(w.costPerHour)}</span></TableCell>
                  <TableCell><StatusBadge status={w.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(w); setDialogOpen(true) }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(w.id)}>
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
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <Factory className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editing ? (isRTL ? 'تعديل مركز عمل' : 'Edit Work Center') : (isRTL ? 'إضافة مركز عمل جديد' : 'Add New Work Center')}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)) }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-1">
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="code" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الرمز *' : 'Code *'}</Label>
                  <Input id="code" name="code" defaultValue={editing?.code} placeholder="WC-001" required className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</Label>
                  <Input id="nameAr" name="nameAr" defaultValue={editing?.nameAr} required placeholder={isRTL ? 'مركز عمل...' : 'e.g. Work Center...'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
                </div>
                <div className="space-y-1.5 text-start col-span-2">
                  <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input id="nameEn" name="nameEn" defaultValue={editing?.nameEn} placeholder="e.g. Work Center..." className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="capacityPerHour" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'السعة لكل ساعة' : 'Capacity Per Hour'}</Label>
                  <Input id="capacityPerHour" name="capacityPerHour" type="number" step="0.01" defaultValue={editing?.capacityPerHour ?? 0} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="costPerHour" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'التكلفة لكل ساعة' : 'Cost Per Hour'}</Label>
                  <Input id="costPerHour" name="costPerHour" type="number" step="0.01" defaultValue={editing?.costPerHour ?? 0} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
                <div className="col-span-2 flex items-center gap-3 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-xl mt-2">
                  <Switch id="active" name="active" defaultChecked={editing?.active ?? true} className="data-[state=checked]:bg-blue-600 shrink-0" />
                  <div className="space-y-0.5 flex-1 text-start">
                    <Label htmlFor="active" className="text-sm font-bold text-blue-955 dark:text-blue-200 cursor-pointer">{isRTL ? 'نشط' : 'Active'}</Label>
                    <p className="text-xs text-blue-750/70 dark:text-blue-300/60 leading-normal">{isRTL ? 'تفعيل أو تعطيل مركز العمل للتصنيع والتشغيل' : 'Enable or disable this work center for manufacturing routing steps.'}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-0 pt-4 bg-transparent border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" disabled={saveMutation.isPending} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
                  {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
