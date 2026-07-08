'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeftRight, Download, Package, TrendingUp, Activity, Layers } from 'lucide-react'

export function StockMovesModule() {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  const { data, isLoading } = useQuery<any>({
    queryKey: ['stock-moves', search, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ q: search })
      if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter)
      const r = await fetch(`/api/erp/stock-moves?${params}`)
      if (!r.ok) throw new Error(); return r.json()
    },
  })
  const rows = data?.data ?? []

  const handleExport = () => exportToCSV('stock-moves', rows.map((r: any) => ({
    date: new Date(r.postingDate).toLocaleDateString('en-CA'), product: r.product?.nameAr || '', sku: r.product?.sku || '',
    from: r.sourceWarehouse?.nameAr || '', to: r.destWarehouse?.nameAr || '', qty: r.quantity, state: r.state, doc: r.documentType,
  })))

  const today = new Date().toDateString()
  const todayCount = rows.filter((r:any) => new Date(r.postingDate).toDateString() === today).length
  const doneCount = rows.filter((r:any) => r.state === 'done').length

  return (
    <ModuleShell title="حركات المخزون" description="سجل حركات المخزون (للقراءة فقط — سجل مُلحق)" icon={<ArrowLeftRight className="size-5" />} onSearch={setSearch} searchValue={search} onExport={handleExport}
      filters={<Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent>
        <SelectItem value="all">الكل</SelectItem><SelectItem value="draft">مسودة</SelectItem><SelectItem value="done">مكتمل</SelectItem><SelectItem value="cancelled">ملغي</SelectItem>
      </SelectContent></Select>}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard title="إجمالي الحركات" value={String(rows.length)} icon={<ArrowLeftRight className="size-5" />} accent="emerald" />
            <KpiCard title="اليوم" value={String(todayCount)} icon={<Activity className="size-5" />} accent="teal" />
            <KpiCard title="مكتملة" value={String(doneCount)} icon={<TrendingUp className="size-5" />} accent="violet" />
            <KpiCard title="أنواع المستندات" value={String(new Set(rows.map((r:any)=>r.documentType)).size)} icon={<Layers className="size-5" />} accent="amber" />
          </>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]"><Table className="table-sticky">
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead><TableHead>المنتج</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead>
            <TableHead className="num-cell">الكمية</TableHead><TableHead>نوع المستند</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({length:5}).map((_,i)=><TableRow key={i}>{Array.from({length:7}).map((_,j)=><TableCell key={j}><Skeleton className="h-6" /></TableCell>)}</TableRow>) :
             !rows.length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">لا توجد حركات</TableCell></TableRow> :
             rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.postingDate).toLocaleDateString('en-CA')}</TableCell>
                <TableCell className="text-sm"><div><p className="font-medium">{r.product?.nameAr || '—'}</p><p className="text-[10px] text-muted-foreground">{r.product?.sku}</p></div></TableCell>
                <TableCell className="text-xs">{r.sourceWarehouse?.nameAr || '—'}</TableCell>
                <TableCell className="text-xs">{r.destWarehouse?.nameAr || '—'}</TableCell>
                <TableCell className="num-cell"><span className="num">{formatNumber(r.quantity)}</span></TableCell>
                <TableCell className="text-xs">{r.documentType || '—'}</TableCell>
                <TableCell><StatusBadge status={r.state} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ScrollArea>
      </div>
    </ModuleShell>
  )
}
