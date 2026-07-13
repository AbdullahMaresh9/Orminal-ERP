'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Boxes, AlertTriangle, Coins } from 'lucide-react'

interface Warehouse { id: string; code: string; nameAr: string }
interface Product {
  id: string
  sku: string
  nameAr: string
  costPrice: number
  minStock: number
  uom?: { id: string; nameAr: string; code: string }
  category?: { id: string; nameAr: string }
}
interface StockQuant {
  id: string
  productId: string
  product: Product
  warehouseId: string
  warehouse: Warehouse
  location?: { id: string; code: string; nameAr: string }
  quantity: number
  reservedQty: number
  available: number
  value: number
  isLowStock: boolean
}

export function StockOnHandModule() {
  const { t } = useT()
  const [warehouseId, setWarehouseId] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const { data: whData } = useQuery<{ data: Warehouse[] }>({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/warehouses?pageSize=100')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const warehouses = whData?.data ?? []

  const { data, isLoading } = useQuery<{ data: StockQuant[]; meta: any }>({
    queryKey: ['stock-quants', warehouseId, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (warehouseId !== 'all') params.set('warehouseId', warehouseId)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/stock-quants?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const rows = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1

  const stats = {
    totalItems: rows.length,
    totalQuantity: rows.reduce((s, r) => s + r.quantity, 0),
    totalValue: rows.reduce((s, r) => s + r.value, 0),
    lowStockCount: rows.filter((r) => r.isLowStock).length,
  }

  const handleExport = () => {
    const exportRows = rows.map((r) => ({
      'SKU': r.product.sku,
      'المنتج': r.product.nameAr,
      'المستودع': r.warehouse.nameAr,
      'الكمية': r.quantity,
      'المحجوز': r.reservedQty,
      'المتاح': r.available,
      'التكلفة': r.product.costPrice,
      'القيمة': r.value,
      'مخزون منخفض': r.isLowStock ? 'نعم' : 'لا',
    }))
    exportToCSV('stock-on-hand', exportRows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.stock-on-hand')}
      description="المخزون الحالي عبر المستودعات مع القيم"
      icon={<Package className="size-5" />}
      onExport={handleExport}
      filters={
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="كل المستودعات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المستودعات</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <span dir="ltr" className="font-mono text-xs">{w.code}</span> — {w.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="عدد الأصناف" value={formatInt(stats.totalItems)} icon={<Boxes className="size-5" />} accent="blue" />
        <KpiCard title="إجمالي الكمية" value={formatInt(stats.totalQuantity)} icon={<Package className="size-5" />} accent="sky" />
        <KpiCard title="قيمة المخزون" value={formatCurrency(stats.totalValue)} icon={<Coins className="size-5" />} accent="violet" />
        <KpiCard title="تنبيهات منخفضة" value={formatInt(stats.lowStockCount)} icon={<AlertTriangle className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[65vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">SKU</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>المستودع</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead className="text-end num-cell">الكمية</TableHead>
                <TableHead className="text-end num-cell">المحجوز</TableHead>
                <TableHead className="text-end num-cell">المتاح</TableHead>
                <TableHead className="text-end num-cell">التكلفة</TableHead>
                <TableHead className="text-end num-cell">القيمة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد أصناف في المخزون</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.product.sku}</TableCell>
                  <TableCell className="font-medium">{r.product.nameAr}</TableCell>
                  <TableCell className="text-sm">{r.warehouse.nameAr}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.product.uom?.nameAr ?? '—'}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatInt(r.quantity)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums text-amber-600" dir="ltr">{formatInt(r.reservedQty)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold text-blue-600" dir="ltr">{formatInt(r.available)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatCurrency(r.product.costPrice)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums font-semibold" dir="ltr">{formatCurrency(r.value)}</span></TableCell>
                  <TableCell>
                    {r.isLowStock ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] gap-1">
                        <AlertTriangle className="size-2.5" /> منخفض
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[10px]">
                        متاح
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">الإجمالي</TableCell>
                  <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatInt(stats.totalQuantity)}</span></TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell colSpan={2} className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(stats.totalValue)}</span></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + rows.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>
    </ModuleShell>
  )
}
