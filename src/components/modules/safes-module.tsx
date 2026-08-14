'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { PiggyBank, Plus, Pencil, Trash2, Download, CheckCircle, Wallet } from 'lucide-react'

export function SafesModule() {
  const { t, isRTL, dir } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ code: '', nameAr: '', nameEn: '', active: true })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['safes', search],
    queryFn: async () => { const r = await fetch(`/api/erp/safes?q=${encodeURIComponent(search)}`); if (!r.ok) throw new Error(); return r.json() },
  })
  const rows = data?.data ?? []

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/erp/safes/${editId}` : '/api/erp/safes'
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'error') }
      return r.json()
    },
    onSuccess: () => { toast.success('تم الحفظ'); qc.invalidateQueries({ queryKey: ['safes'] }); setDialogOpen(false); setEditId(null) },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/erp/safes/${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); return r.json() },
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['safes'] }) },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleAdd = () => { setForm({ code: '', nameAr: '', nameEn: '', active: true }); setEditId(null); setDialogOpen(true) }
  const handleEdit = (r: any) => { setForm({ code: r.code, nameAr: r.nameAr, nameEn: r.nameEn || '', active: r.active }); setEditId(r.id); setDialogOpen(true) }
  const handleExport = () => exportToCSV('safes', rows.map((r: any) => ({ code: r.code, nameAr: r.nameAr, balance: r.balance, active: r.active ? 'نشط' : 'غير نشط' })))
  const totalBalance = rows.reduce((s: number, r: any) => s + (r.balance || 0), 0)

  return (
    <ModuleShell title="الخزائن" description="إدارة الخزائن النقدية" icon={<PiggyBank className="size-5" />} onSearch={setSearch} searchValue={search} onAdd={handleAdd} addLabel="خزنة جديدة" onExport={handleExport}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي النقدية" value={formatCurrency(totalBalance)} icon={<Wallet className="size-5" />} accent="blue" />
            <KpiCard title="عدد الخزائن" value={String(rows.length)} icon={<PiggyBank className="size-5" />} accent="sky" />
            <KpiCard title="نشطة" value={String(rows.filter((r: any) => r.active).length)} icon={<CheckCircle className="size-5" />} accent="violet" />
            <KpiCard title="متوسط الرصيد" value={formatCurrency(rows.length ? totalBalance / rows.length : 0)} icon={<Wallet className="size-5" />} accent="amber" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow><TableHead>الرمز</TableHead><TableHead>الاسم</TableHead><TableHead className="num-cell">الرصيد</TableHead><TableHead>الحالة</TableHead><TableHead className="text-end">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
              !rows.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">لا توجد خزائن</TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{r.code}</TableCell>
                    <TableCell className="font-medium text-sm">{r.nameAr}</TableCell>
                    <TableCell className="num-cell font-semibold"><span className="num">{formatCurrency(r.balance)}</span></TableCell>
                    <TableCell><StatusBadge status={r.active ? 'active' : 'inactive'} /></TableCell>
                    <TableCell><div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(r)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-600" onClick={() => delMut.mutate(r.id)}><Trash2 className="size-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-6 shrink-0 relative">
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <PiggyBank className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editId ? (isRTL ? 'تعديل خزنة' : 'Edit Safe/Cashbox') : (isRTL ? 'اضافة خزنة جديد' : 'Add New Safe/Cashbox')}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الرمز *' : 'Code *'}</Label>
                <Input id="code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SAFE-01" className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-1.5 text-start">
                <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</Label>
                <Input id="nameAr" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder={isRTL ? 'الخزينة الرئيسية...' : 'Main Cashbox...'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-1.5 text-start col-span-2">
                <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                <Input id="nameEn" value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} placeholder="Main Cashbox..." className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
              </div>

              <div className="col-span-2 flex items-center gap-3 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-xl">
                <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} id="active-safe" className="data-[state=checked]:bg-blue-600 shrink-0" />
                <div className="space-y-0.5 flex-1 text-start">
                  <Label htmlFor="active-safe" className="text-sm font-bold text-blue-955 dark:text-blue-200 cursor-pointer">{isRTL ? 'نشط' : 'Active'}</Label>
                  <p className="text-xs text-blue-750/70 dark:text-blue-300/60 leading-normal">{isRTL ? 'تفعيل أو تعطيل الخزنة النقدية للمعاملات المالية' : 'Enable or disable cashbox for operations'}</p>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.code || !form.nameAr} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
              {saveMut.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (editId ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'اضافة خزنة ' : 'Add Safe'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
