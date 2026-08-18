'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatNumber } from '@/lib/format'
import { exportRows, ExportColumn, ExportFormat } from '@/lib/export'
import { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ArrowLeftRight, Download, Activity, TrendingUp, Layers, FileSpreadsheet, FileText, FileCheck, ChevronDown } from 'lucide-react'

const HEADER_HEIGHT = 42
const ROW_HEIGHT = 50
const VISIBLE_ROWS = 6

const stickyHead = 'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-sm whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

const STATE_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  waiting: { ar: 'في الانتظار', en: 'Waiting' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  assigned: { ar: 'مخصص', en: 'Assigned' },
  done: { ar: 'مكتمل', en: 'Completed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

const DOC_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  inventory_requisition: { ar: 'طلب مخزون', en: 'Inventory Requisition' },
  stock_transfer: { ar: 'تحويل مخزني', en: 'Stock Transfer' },
  delivery: { ar: 'تسليم مبيعات', en: 'Sales Delivery' },
  incoming: { ar: 'استلام مشتريات', en: 'Goods Receipt' },
  inventory_adjustment: { ar: 'تعديل مخزني', en: 'Inventory Adjustment' },
  stock_take: { ar: 'جرد مخزني', en: 'Stock Take' },
  purchase_return: { ar: 'مرتجع مشتريات', en: 'Purchase Return' },
  sales_return: { ar: 'مرتجع مبيعات', en: 'Sales Return' },
  production: { ar: 'إنتاج تصنيعي', en: 'Manufacturing Production' },
}

export function StockMovesModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  const statusLabel = (s: string) => STATE_LABELS[s]?.[isRTL ? 'ar' : 'en'] ?? s
  const docTypeLabel = (dt?: string) => {
    if (!dt) return '—'
    return DOC_TYPE_LABELS[dt]?.[isRTL ? 'ar' : 'en'] ?? dt
  }
  const productName = (p?: any) => (isRTL ? p?.nameAr : (p?.nameEn || p?.nameAr)) ?? '—'
  const warehouseName = (w?: any) => (isRTL ? w?.nameAr : (w?.nameEn || w?.nameAr)) ?? '—'

  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  const { data, isLoading } = useQuery<any>({
    queryKey: ['stock-moves', search, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ q: search })
      if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter)
      const r = await fetch(`/api/erp/stock-moves?${params}`)
      if (!r.ok) throw new Error(L('فشل جلب حركات المخزون', 'Failed to fetch stock moves'))
      return r.json()
    },
  })
  const rows = data?.data ?? []

  const today = new Date().toDateString()
  const todayCount = rows.filter((r: any) => new Date(r.postingDate).toDateString() === today).length
  const doneCount = rows.filter((r: any) => r.state === 'done').length

  const exportColumns: ExportColumn<any>[] = [
    {
      key: 'postingDate',
      header: L('التاريخ', 'Date'),
      width: 14,
      align: 'center',
      type: 'date',
      value: (r) => r.postingDate ? new Date(r.postingDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—',
      dateValue: (r) => r.postingDate ? new Date(r.postingDate) : null,
    },
    {
      key: 'product',
      header: L('المنتج', 'Product'),
      width: 25,
      align: 'start',
      type: 'text',
      value: (r) => `${productName(r.product)} (${r.product?.sku ?? ''})`,
    },
    {
      key: 'sourceWarehouse',
      header: L('المستودع المصدر', 'Source Warehouse'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (r) => warehouseName(r.sourceWarehouse),
    },
    {
      key: 'destWarehouse',
      header: L('المستودع الوجهة', 'Destination Warehouse'),
      width: 20,
      align: 'start',
      type: 'text',
      value: (r) => warehouseName(r.destWarehouse),
    },
    {
      key: 'quantity',
      header: L('الكمية', 'Quantity'),
      width: 12,
      align: 'center',
      type: 'number',
      value: (r) => formatNumber(r.quantity),
    },
    {
      key: 'documentType',
      header: L('نوع المستند', 'Document Type'),
      width: 15,
      align: 'center',
      type: 'text',
      value: (r) => docTypeLabel(r.documentType),
    },
    {
      key: 'state',
      header: L('الحالة', 'Status'),
      width: 12,
      align: 'center',
      type: 'text',
      value: (r) => statusLabel(r.state),
    },
  ]

  const handleExport = async (format: ExportFormat) => {
    if (!rows.length) {
      toast.error(L('لا توجد بيانات للتصدير', 'No data to export'))
      return
    }
    try {
      await exportRows(format, rows, exportColumns, {
        fileName: `stock_moves_${new Date().toISOString().split('T')[0]}`,
        title: L('تقرير حركات المخزون', 'Stock Moves Report'),
        subtitle: L(`إجمالي السجلات: ${rows.length}`, `Total Records: ${rows.length}`),
        isRTL,
      })
    } catch (e: any) {
      toast.error(e?.message || L('فشل التصدير', 'Export failed'))
    }
  }

  return (
    <ModuleShell
      title={t('module.stock-moves') || L('حركات المخزون', 'Stock Moves')}
      description={L('سجل حركات المخزون (للقراءة فقط — سجل مُلحق)', 'Stock movement history log (Read only)')}
      icon={<ArrowLeftRight className="size-5" />}
      onSearch={setSearch}
      searchValue={search}
      searchPlaceholder={L('ابحث عن حركة مخزون، منتج، رمز...', 'Search stock moves, products, SKU...')}
      actions={
        <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold">
              <Download className="size-4 text-emerald-600" />
              <span>{L('تصدير', 'Export')}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} collisionPadding={8} className="w-36 z-50">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer text-xs">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>{L('تصدير Excel', 'Export Excel')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer text-xs">
              <FileText className="size-4 text-rose-600" />
              <span>{L('تصدير PDF', 'Export PDF')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer text-xs">
              <FileCheck className="size-4 text-blue-600" />
              <span>{L('تصدير CSV', 'Export CSV')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder={L('الحالة', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{L('جميع الحالات', 'All Statuses')}</SelectItem>
            <SelectItem value="draft">{L('مسودة', 'Draft')}</SelectItem>
            <SelectItem value="waiting">{L('في الانتظار', 'Waiting')}</SelectItem>
            <SelectItem value="confirmed">{L('مؤكد', 'Confirmed')}</SelectItem>
            <SelectItem value="assigned">{L('مخصص', 'Assigned')}</SelectItem>
            <SelectItem value="done">{L('مكتمل', 'Completed')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title={L('إجمالي الحركات', 'Total Moves')}
              value={String(rows.length)}
              icon={<ArrowLeftRight className="size-5" />}
              accent="blue"
            />
            <KpiCard
              title={L('حركات اليوم', "Today's Moves")}
              value={String(todayCount)}
              icon={<Activity className="size-5" />}
              accent="sky"
            />
            <KpiCard
              title={L('مكتملة', 'Completed')}
              value={String(doneCount)}
              icon={<TrendingUp className="size-5" />}
              accent="violet"
            />
            <KpiCard
              title={L('أنواع المستندات', 'Document Types')}
              value={String(new Set(rows.map((r: any) => r.documentType)).size)}
              icon={<Layers className="size-5" />}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* Stock Moves Table — Fixed Header + Body Scroll (~5 rows visible) */}
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />{/* التاريخ */}
              <col className="w-[26%]" />{/* المنتج */}
              <col className="w-[16%]" />{/* المستودع المصدر */}
              <col className="w-[18%]" />{/* المستودع الوجهة */}
              <col className="w-[10%]" />{/* الكمية */}
              <col className="w-[10%]" />{/* نوع المستند */}
              <col className="w-[10%]" />{/* الحالة */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المنتج', 'Product')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المستودع المصدر', 'Source Warehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المستودع الوجهة', 'Destination Warehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الكمية', 'Quantity')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('نوع المستند', 'Document Type')}</TableHead>
                <TableHead className={`${stickyHead} text-center pe-4`}>{L('الحالة', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-[52px]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="border-b">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 border-b">
                    {L('لا توجد حركات مخزون مطابقة', 'No stock moves found')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow
                    key={r.id}
                    className="h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-middle"
                  >
                    <TableCell className="ps-4 text-xs text-muted-foreground border-b whitespace-nowrap">
                      {r.postingDate ? new Date(r.postingDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—'}
                    </TableCell>
                    <TableCell className="text-sm border-b truncate">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate" title={productName(r.product)}>
                          {productName(r.product)}
                        </p>
                        {r.product?.sku && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate" dir="ltr">
                            {r.product.sku}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300 border-b truncate" title={warehouseName(r.sourceWarehouse)}>
                      {warehouseName(r.sourceWarehouse)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300 border-b truncate" title={warehouseName(r.destWarehouse)}>
                      {warehouseName(r.destWarehouse)}
                    </TableCell>
                    <TableCell className="text-center border-b font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatNumber(r.quantity)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground border-b truncate">
                      {docTypeLabel(r.documentType)}
                    </TableCell>
                    <TableCell className="text-center pe-4 border-b">
                      <StatusBadge status={r.state} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </Card>
    </ModuleShell>
  )
}
