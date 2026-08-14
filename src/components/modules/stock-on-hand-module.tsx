'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { useT } from '@/lib/i18n/use-t'
import { useNav } from '@/stores/nav-store'
import { useSession } from 'next-auth/react'
import { formatCurrency, formatInt, formatNumber, formatDateTime } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package, Boxes, AlertTriangle, Coins, RefreshCcw, Download, FileText,
  FileSpreadsheet, Printer, MoreHorizontal, History, ClipboardCheck,
  ArrowLeftRight, ExternalLink, ArrowUp, ArrowDown, ChevronsUpDown, PackageX,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
//  Types & Constants
// ────────────────────────────────────────────────────────────────────────────
interface Warehouse { id: string; code: string; nameAr: string; nameEn?: string }
interface Category { id: string; nameAr: string; nameEn?: string }

interface Product {
  id: string
  sku: string
  nameAr: string
  nameEn?: string
  costPrice: number
  minStock: number
  uom?: { id: string; nameAr: string; nameEn?: string; code: string }
  category?: { id: string; nameAr: string; nameEn?: string }
}

interface StockQuant {
  id: string
  productId: string
  product: Product
  warehouseId: string
  warehouse: Warehouse
  location?: { id: string; code: string; nameAr: string; nameEn?: string }
  quantity: number
  reservedQty: number
  available: number
  value: number
  isLowStock: boolean
}

interface ServerStats {
  totalItems?: number
  totalQuantity?: number
  totalValue?: number
  lowStockCount?: number
  outOfStockCount?: number
  negativeCount?: number
}

interface StockResponse {
  data: StockQuant[]
  meta?: { pagination?: { total?: number; totalPages?: number }; stats?: ServerStats }
}

type SortKey = 'quantity' | 'available' | 'value' | 'sku' | null
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'available' | 'low' | 'out' | 'negative'

const COST_ROLES = ['admin', 'owner', 'superadmin', 'manager', 'accountant', 'finance']

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 6
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

// ────────────────────────────────────────────────────────────────────────────
// Download Helpers
// ────────────────────────────────────────────────────────────────────────────
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────
export function StockOnHandModule() {
  const { t, isRTL, dir, locale } = useT()
  const lang = locale ?? (isRTL ? 'ar' : 'en')
  const L = (ar: string, en: string) => (lang === 'en' ? en : ar)

  const qc = useQueryClient()
  const { setActiveModule } = useNav()
  const { data: session } = useSession()

  const role = String((session?.user as any)?.role ?? '').toLowerCase()
  const canViewCost = !role || COST_ROLES.includes(role)

  // Filters / paging / sorting state
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [hideZero, setHideZero] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [exporting, setExporting] = useState(false)
  const [kardexItem, setKardexItem] = useState<StockQuant | null>(null)

  const resetPage = () => setPage(1)

  // Build query params
  const buildParams = (p: number, size: number) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (warehouseId !== 'all') params.set('warehouseId', warehouseId)
    if (categoryId !== 'all') params.set('categoryId', categoryId)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (hideZero) params.set('hideZero', '1')
    if (sortBy) { params.set('sortBy', sortBy); params.set('sortDir', sortDir) }
    params.set('page', String(p))
    params.set('pageSize', String(size))
    return params
  }

  // Warehouses filter list
  const { data: whData } = useQuery<{ data: Warehouse[] }>({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/warehouses')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const warehouses = whData?.data ?? []

  // Categories filter list
  const { data: catData } = useQuery<{ data: Category[] }>({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const r = await fetch('/api/erp/categories?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const categories = catData?.data ?? []

  // Main stock quants query
  const {
    data, isLoading, isError, isFetching, refetch, dataUpdatedAt,
  } = useQuery<StockResponse>({
    queryKey: ['stock-quants', search, warehouseId, categoryId, statusFilter, hideZero, sortBy, sortDir, page],
    queryFn: async () => {
      const r = await fetch(`/api/erp/stock-quants?${buildParams(page, pageSize)}`)
      if (!r.ok) throw new Error(L('فشل تحميل بيانات المخزون', 'Failed to load stock data'))
      return r.json()
    },
    placeholderData: (prev: StockResponse | undefined) => prev,
  })

  const rows = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? rows.length
  const totalPages = data?.meta?.pagination?.totalPages ?? 1

  // KPIs calculation from server or fallback
  const stats = useMemo(() => {
    const s = data?.meta?.stats
    if (s) {
      return {
        totalItems: s.totalItems ?? total,
        totalQuantity: s.totalQuantity ?? 0,
        totalValue: s.totalValue ?? 0,
        lowStockCount: s.lowStockCount ?? 0,
        fromServer: true as const,
      }
    }
    return {
      totalItems: total,
      totalQuantity: rows.reduce((sum: number, r: StockQuant) => sum + r.quantity, 0),
      totalValue: rows.reduce((sum: number, r: StockQuant) => sum + r.value, 0),
      lowStockCount: rows.filter((r: StockQuant) => r.isLowStock).length,
      fromServer: false as const,
    }
  }, [data, rows, total])

  // Row status classification
  const rowStatus = (r: StockQuant): StatusFilter => {
    if (r.quantity < 0 || r.available < 0) return 'negative'
    if (r.quantity === 0) return 'out'
    if (r.isLowStock) return 'low'
    return 'available'
  }

  // Sorting handler
  const toggleSort = (key: Exclude<SortKey, null>) => {
    if (sortBy === key) {
      setSortDir((d: SortDir) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    resetPage()
  }

  // Full export across ALL pages
  const fetchAll = async (): Promise<StockQuant[]> => {
    const acc: StockQuant[] = []
    const size = 200
    let p = 1
    for (let guard = 0; guard < 500; guard++) {
      const r = await fetch(`/api/erp/stock-quants?${buildParams(p, size)}`)
      if (!r.ok) throw new Error(L('فشل تحميل كامل البيانات التصديرية', 'Export data fetch failed'))
      const j: StockResponse = await r.json()
      const batch = j?.data ?? []
      acc.push(...batch)
      const tp = j?.meta?.pagination?.totalPages ?? 1
      if (batch.length === 0 || p >= tp) break
      p++
    }
    return acc
  }

  const exportColumns = () => {
    const cols: { key: string; label: string }[] = [
      { key: 'sku', label: 'SKU' },
      { key: 'product', label: L('المنتج', 'Product') },
      { key: 'category', label: L('الفئة', 'Category') },
      { key: 'warehouse', label: L('المستودع', 'Warehouse') },
      { key: 'location', label: L('الموقع', 'Location') },
      { key: 'uom', label: L('الوحدة', 'Unit') },
      { key: 'minStock', label: L('الحد الأدنى', 'Min Stock') },
      { key: 'quantity', label: L('الكمية', 'Quantity') },
      { key: 'reserved', label: L('المحجوز', 'Reserved') },
      { key: 'available', label: L('المتاح', 'Available') },
    ]
    if (canViewCost) {
      cols.push({ key: 'value', label: L('القيمة', 'Value') })
    }
    cols.push({ key: 'status', label: L('الحالة', 'Status') })
    return cols
  }

  const statusLabel = (r: StockQuant) => {
    const map: Record<StatusFilter, string> = {
      all: '',
      available: L('متاح', 'Available'),
      low: L('منخفض', 'Low Stock'),
      out: L('نافد', 'Out of Stock'),
      negative: L('سالب', 'Negative'),
    }
    return map[rowStatus(r)]
  }

  const toExportRow = (r: StockQuant) => ({
    sku: r.product.sku,
    product: lang === 'en' ? (r.product.nameEn || r.product.nameAr) : r.product.nameAr,
    category: r.product.category ? (lang === 'en' ? (r.product.category.nameEn || r.product.category.nameAr) : r.product.category.nameAr) : '',
    warehouse: lang === 'en' ? (r.warehouse.nameEn || r.warehouse.nameAr) : r.warehouse.nameAr,
    location: r.location ? `${r.location.code} - ${lang === 'en' ? (r.location.nameEn || r.location.nameAr) : r.location.nameAr}` : '',
    uom: r.product.uom ? (lang === 'en' ? (r.product.uom.nameEn || r.product.uom.nameAr) : r.product.uom.nameAr) : '',
    minStock: r.product.minStock ?? 0,
    quantity: r.quantity,
    reserved: r.reservedQty,
    available: r.available,
    value: r.value,
    status: statusLabel(r),
  })

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (exporting) return
    setExporting(true)
    const tId = toast.loading(L('جارٍ تجهيز ملف التصدير بكامل الصفحات...', 'Preparing export for all pages...'))
    try {
      const all = await fetchAll()
      if (all.length === 0) {
        toast.error(L('لا توجد بيانات للتصدير', 'No data to export'), { id: tId })
        return
      }
      const cols = exportColumns()
      const records = all.map(toExportRow)
      const stamp = new Date().toISOString().slice(0, 10)
      const fileBase = `stock-on-hand-${stamp}`

      if (format === 'csv') {
        exportToCSV(fileBase, records, cols)
      } else if (format === 'excel') {
        const head = cols.map((c) => `<th style="background:#1e3a8a;color:#fff;padding:6px;border:1px solid #ccc">${escapeHtml(c.label)}</th>`).join('')
        const body = records.map((rec) =>
          `<tr>${cols.map((c) => `<td style="padding:6px;border:1px solid #ddd">${escapeHtml((rec as any)[c.key])}</td>`).join('')}</tr>`
        ).join('')
        const html =
          `<html dir="${dir}"><head><meta charset="utf-8"></head><body>` +
          `<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
          `</body></html>`
        downloadBlob(`${fileBase}.xls`, new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }))
      } else {
        openPrint(records, cols)
      }
      toast.success(L(`تم تصدير ${all.length} صنف بنجاح`, `Exported ${all.length} items successfully`), { id: tId })
    } catch {
      toast.error(L('فشل تصدير البيانات', 'Export failed'), { id: tId })
    } finally {
      setExporting(false)
    }
  }

  const openPrint = (records: any[], cols: { key: string; label: string }[]) => {
    const w = window.open('', '_blank', 'width=1024,height=768')
    if (!w) { toast.error(L('يرجى السماح بالنوافذ المنبثقة للتصدير', 'Please allow pop-ups for PDF export')); return }
    const title = L('تقرير المخزون الحالي', 'Stock on Hand Report')
    const now = formatDateTime(new Date().toISOString())
    const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')
    const body = records.map((rec) =>
      `<tr>${cols.map((c) => `<td>${escapeHtml(rec[c.key])}</td>`).join('')}</tr>`
    ).join('')
    w.document.write(`<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        *{font-family:'Segoe UI',Tahoma,Arial,sans-serif}
        body{padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0 0 4px}
        .meta{font-size:12px;color:#64748b;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:${isRTL ? 'right' : 'left'}}
        thead th{background:#1e3a8a;color:#fff}
        tbody tr:nth-child(even){background:#f8fafc}
        @media print{@page{size:landscape;margin:12mm}}
      </style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(now)} — ${escapeHtml(L('عدد الأصناف', 'Total Items'))}: ${records.length}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
      </body></html>`)
    w.document.close()
  }

  const colCount = 11 + (canViewCost ? 1 : 0)

  // Toolbar Component
  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={warehouseId} onValueChange={(v: string) => { setWarehouseId(v); resetPage() }}>
        <SelectTrigger dir={dir} className="w-56 h-9"><SelectValue placeholder={L('كل المستودعات', 'All Warehouses')} /></SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{L('كل المستودعات', 'All Warehouses')}</SelectItem>
          {warehouses.map((w: Warehouse) => (
            <SelectItem key={w.id} value={w.id}>
              <span dir="ltr" className="font-mono text-xs">{w.code}</span> — {lang === 'en' ? (w.nameEn || w.nameAr) : w.nameAr}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryId} onValueChange={(v: string) => { setCategoryId(v); resetPage() }}>
        <SelectTrigger dir={dir} className="w-40 h-9"><SelectValue placeholder={L('كل الفئات', 'All Categories')} /></SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{L('كل الفئات', 'All Categories')}</SelectItem>
          {categories.map((c: Category) => (
            <SelectItem key={c.id} value={c.id}>{lang === 'en' ? (c.nameEn || c.nameAr) : c.nameAr}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v as StatusFilter); resetPage() }}>
        <SelectTrigger dir={dir} className="w-36 h-9"><SelectValue placeholder={L('الحالة', 'Status')} /></SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{L('كل الحالات', 'All Statuses')}</SelectItem>
          <SelectItem value="available">{L('متاح', 'Available')}</SelectItem>
          <SelectItem value="low">{L('منخفض', 'Low Stock')}</SelectItem>
          <SelectItem value="out">{L('نافد', 'Out of Stock')}</SelectItem>
          <SelectItem value="negative">{L('سالب', 'Negative')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border bg-background">
        <Switch id="hideZero" checked={hideZero} onCheckedChange={(v: boolean) => { setHideZero(v); resetPage() }} />
        <Label htmlFor="hideZero" className="text-xs whitespace-nowrap cursor-pointer">{L('إخفاء رصيد صفر', 'Hide Zero')}</Label>
      </div>

      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCcw className={cn('size-4', isFetching && 'animate-spin')} />
        <span className="hidden md:inline">{L('تحديث', 'Refresh')}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={exporting}>
            <Download className="size-4" />
            <span className="hidden md:inline">{L('تصدير', 'Export')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isRTL ? 'start' : 'end'} side="bottom" sideOffset={4} collisionPadding={8} className="w-36">
          <DropdownMenuLabel>{L('تصدير البيانات', 'Export Data')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="size-4 text-emerald-600" /> Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
            <FileText className="size-4 text-blue-600" /> CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
            <Printer className="size-4 text-rose-600" /> PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <ModuleShell
      title={t('module.stock-on-hand')}
      description={L('المخزون الحالي عبر المستودعات مع التقييمات', 'Current stock on hand across warehouses with valuations')}
      icon={<Package className="size-5" />}
      onSearch={(v: string) => { setSearch(v); resetPage() }}
      searchValue={search}
      searchPlaceholder={L('بحث بالرمز أو اسم المنتج أو المستودع...', 'Search by SKU, product name, or warehouse...')}
      filters={toolbar}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title={L('عدد الأصناف', 'Total Items')} value={formatInt(stats.totalItems)} icon={<Boxes className="size-5" />} accent="blue" />
            <KpiCard title={L('إجمالي الكمية', 'Total Quantity')} value={formatInt(stats.totalQuantity)} icon={<Package className="size-5" />} accent="sky" />
            <KpiCard title={L('قيمة المخزون', 'Stock Valuation')} value={canViewCost ? formatCurrency(stats.totalValue) : '••••'} icon={<Coins className="size-5" />} accent="violet" />
            <KpiCard title={L('تنبيهات منخفضة', 'Low Stock Alerts')} value={formatInt(stats.lowStockCount)} icon={<AlertTriangle className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Last updated timestamp line */}
      {!isLoading && (
        <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5">
          <History className="size-3" />
          {L('آخر تحديث:', 'Last updated:')} {dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt).toISOString()) : '—'}
        </p>
      )}

      {/* Table Section — Sticky Header + Vertical Scroll + Column Alignment */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[1100px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[9%]" />{/* SKU */}
              <col className="w-[14%]" />{/* المنتج */}
              <col className="w-[13%]" />{/* المستودع */}
              <col className="w-[9%]" />{/* الموقع */}
              <col className="w-[6%]" />{/* الوحدة */}
              <col className="w-[6%]" />{/* الحد الأدنى */}
              <col className="w-[7%]" />{/* الكمية */}
              <col className="w-[6%]" />{/* المحجوز */}
              <col className="w-[7%]" />{/* المتاح */}
              {canViewCost && <col className="w-[9%]" />}{/* القيمة */}
              <col className="w-[9%]" />{/* الحالة */}
              <col className="w-[6%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('SKU', 'SKU')}</TableHead>
                <TableHead className={`${stickyHead} text-start pe-2`}>{L('المنتج', 'Product')}</TableHead>
                <TableHead className={`${stickyHead} text-start ps-3`}>{L('المستودع', 'Warehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الموقع', 'Location')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('الوحدة', 'Unit')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('الحد الأدنى', 'Min')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>
                  <button className="inline-flex items-center gap-1 hover:text-foreground mx-auto" onClick={() => toggleSort('quantity')}>
                    {L('الكمية', 'Quantity')} {sortBy !== 'quantity' ? <ChevronsUpDown className="size-3 opacity-40" /> : sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  </button>
                </TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>{L('المحجوز', 'Reserved')}</TableHead>
                <TableHead className={`${stickyHead} text-center num-cell`}>
                  <button className="inline-flex items-center gap-1 hover:text-foreground mx-auto" onClick={() => toggleSort('available')}>
                    {L('المتاح', 'Available')} {sortBy !== 'available' ? <ChevronsUpDown className="size-3 opacity-40" /> : sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  </button>
                </TableHead>
                {canViewCost && (
                  <TableHead className={`${stickyHead} text-end num-cell`}>
                    <button className="inline-flex items-center gap-1 hover:text-foreground ms-auto" onClick={() => toggleSort('value')}>
                      {L('القيمة', 'Value')} {sortBy !== 'value' ? <ChevronsUpDown className="size-3 opacity-40" /> : sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    </button>
                  </TableHead>
                )}
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: colCount }).map((_, j) => (
                      <TableCell key={j} className={j === 0 ? 'ps-4' : j === colCount - 1 ? 'pe-4' : ''}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="py-12 text-center border-b">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <PackageX className="size-8 text-rose-500" />
                      <p className="text-sm text-muted-foreground">{L('تعذّر تحميل بيانات المخزون', 'Failed to load stock data')}</p>
                      <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
                        <RefreshCcw className="size-4" /> {L('إعادة المحاولة', 'Retry')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-16 text-muted-foreground border-b">
                    <Boxes className="size-10 mx-auto mb-2 opacity-50" />
                    {L('لا توجد أصناف مطابقة في المخزون.', 'No matching stock items found.')}
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => {
                const st = rowStatus(r)
                const negative = st === 'negative'
                const productName = lang === 'en' ? (r.product.nameEn || r.product.nameAr) : r.product.nameAr
                const categoryName = r.product.category ? (lang === 'en' ? (r.product.category.nameEn || r.product.category.nameAr) : r.product.category.nameAr) : null
                const warehouseName = lang === 'en' ? (r.warehouse.nameEn || r.warehouse.nameAr) : r.warehouse.nameAr
                const locationName = r.location ? (lang === 'en' ? (r.location.nameEn || r.location.nameAr) : r.location.nameAr) : null
                const uomName = r.product.uom ? (lang === 'en' ? (r.product.uom.nameEn || r.product.uom.nameAr) : r.product.uom.nameAr) : '—'

                return (
                  <TableRow key={r.id} className={cn('hover:bg-muted/40 transition-colors', negative && 'bg-rose-50/60 dark:bg-rose-950/20')}>
                    <TableCell className="ps-4 font-mono text-xs truncate" dir="ltr">{r.product.sku}</TableCell>
                    <TableCell className="font-medium truncate pe-2">
                      <div className="flex flex-col truncate">
                        <span className="truncate">{productName}</span>
                        {categoryName && <span className="text-[10px] text-muted-foreground truncate">{categoryName}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm truncate ps-3">{warehouseName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">
                      {locationName ? (
                        <span className="truncate"><span dir="ltr" className="font-mono">{r.location?.code}</span> · {locationName}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">{uomName}</TableCell>
                    <TableCell className="text-center num-cell"><span className="num text-xs text-muted-foreground" dir="ltr">{formatInt(r.product.minStock ?? 0)}</span></TableCell>
                    <TableCell className="text-center num-cell"><span className={cn('num font-semibold', negative && 'text-rose-600')} dir="ltr">{formatInt(r.quantity)}</span></TableCell>
                    <TableCell className="text-center num-cell"><span className="num text-amber-600 dark:text-amber-400" dir="ltr">{formatInt(r.reservedQty)}</span></TableCell>
                    <TableCell className="text-center num-cell"><span className={cn('num font-semibold', r.available < 0 ? 'text-rose-600' : 'text-blue-600 dark:text-blue-400')} dir="ltr">{formatInt(r.available)}</span></TableCell>
                    {canViewCost && <TableCell className="text-end num-cell"><span className="num font-semibold" dir="ltr">{formatCurrency(r.value)}</span></TableCell>}
                    <TableCell className="text-center">
                      {st === 'negative' ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] gap-1 inline-flex items-center">
                          <AlertTriangle className="size-2.5" /> {L('سالب', 'Negative')}
                        </Badge>
                      ) : st === 'out' ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 text-[10px] inline-flex items-center">
                          {L('نافد', 'Out of Stock')}
                        </Badge>
                      ) : st === 'low' ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] gap-1 inline-flex items-center">
                          <AlertTriangle className="size-2.5" /> {L('منخفض', 'Low Stock')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] inline-flex items-center">
                          {L('متاح', 'In Stock')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' side="bottom" alignOffset={-10} collisionPadding={4} className="w-40">
                          <DropdownMenuItem onClick={() => setKardexItem(r)} className="gap-2 cursor-pointer">
                            <History className="size-4 text-blue-600" /> {L('حركات الصنف', 'Item Movements')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActiveModule('products')} className="gap-2 cursor-pointer">
                            <ExternalLink className="size-4 text-emerald-600" /> {L('بطاقة المنتج', 'Product Card')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setActiveModule('inventory-adjustments')} className="gap-2 cursor-pointer">
                            <ClipboardCheck className="size-4 text-amber-600" /> {L('تسوية جرد', 'Stock Adjustment')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActiveModule('inventory-transfers')} className="gap-2 cursor-pointer">
                            <ArrowLeftRight className="size-4 text-violet-600" /> {L('تحويل مخزني', 'Stock Transfer')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>

            {rows.length > 0 && !isError && (
              <TableFooter className="sticky bottom-0 z-20 bg-muted/90 backdrop-blur-sm shadow-[inset_0_1px_0_0_hsl(var(--border))]">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="ps-4 font-semibold">{L('الإجمالي (كل البيانات)', 'Total (All Data)')}</TableCell>
                  <TableCell className="text-center num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatInt(stats.totalQuantity)}</span></TableCell>
                  <TableCell colSpan={2}></TableCell>
                  {canViewCost && (
                    <TableCell className="text-end num-cell"><span className="num font-bold tabular-nums" dir="ltr">{formatCurrency(stats.totalValue)}</span></TableCell>
                  )}
                  <TableCell colSpan={2} className="pe-4"></TableCell>
                </TableRow>
              </TableFooter>
            )}
          </table>
        </div>
      </Card>

      {/* Kardex Dialog */}
      <KardexDialog item={kardexItem} onClose={() => setKardexItem(null)} L={L} dir={dir} isRTL={isRTL} canViewCost={canViewCost} />
    </ModuleShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Kardex (Stock Ledger) Dialog Component
// ────────────────────────────────────────────────────────────────────────────
interface Move {
  id: string
  postingDate: string
  quantity: number
  state?: string
  documentType?: string
  sourceWarehouse?: { id: string; nameAr: string; nameEn?: string }
  destWarehouse?: { id: string; nameAr: string; nameEn?: string }
  sourceWarehouseId?: string
  destWarehouseId?: string
}

function KardexDialog({
  item, onClose, L, dir, isRTL, canViewCost,
}: {
  item: StockQuant | null
  onClose: () => void
  L: (ar: string, en: string) => string
  dir: string
  isRTL: boolean
  canViewCost: boolean
}) {
  const open = !!item
  const { data, isLoading, isError } = useQuery<{ data: Move[] }>({
    queryKey: ['kardex', item?.productId, item?.warehouseId],
    enabled: open,
    queryFn: async () => {
      const params = new URLSearchParams({ productId: item!.productId, pageSize: '1000' })
      if (item!.warehouseId) params.set('warehouseId', item!.warehouseId)
      const r = await fetch(`/api/erp/stock-moves?${params}`)
      if (!r.ok) throw new Error(L('فشل تحميل حركات الصنف', 'Failed to load item movements'))
      return r.json()
    },
  })

  const whId = item?.warehouseId
  const moves = useMemo(() => {
    const list = [...(data?.data ?? [])]
    list.sort((a, b) => +new Date(a.postingDate) - +new Date(b.postingDate))
    let running = 0
    return list.map((m) => {
      const destId = m.destWarehouseId ?? m.destWarehouse?.id
      const srcId = m.sourceWarehouseId ?? m.sourceWarehouse?.id
      let signed = m.quantity
      if (whId) {
        if (destId === whId) signed = Math.abs(m.quantity)
        else if (srcId === whId) signed = -Math.abs(m.quantity)
      }
      running += signed
      return { ...m, signed, running }
    }).reverse()
  }, [data, whId])

  const productName = item ? (isRTL ? item.product.nameAr : (item.product.nameEn || item.product.nameAr)) : ''
  const warehouseName = item ? (isRTL ? item.warehouse.nameAr : (item.warehouse.nameEn || item.warehouse.nameAr)) : ''

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
        <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-600/40 p-5 shrink-0 relative">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
              <History className="size-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-bold text-blue-955 dark:text-white">{L('حركات الصنف', 'Item Movements')}</DialogTitle>
              <DialogDescription className="text-xs text-blue-800/80 dark:text-blue-100/90 font-normal">
                {item ? `${item.product.sku} · ${productName} · ${warehouseName}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="p-0 flex-1 overflow-hidden">
          <div className="max-h-[55vh] overflow-y-auto overflow-x-auto">
            <table className="w-full caption-bottom text-sm min-w-[650px] table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[20%]" />
                <col className="w-[30%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className={`${stickyHead} ps-4 text-start`}>{L('التاريخ', 'Date')}</TableHead>
                  <TableHead className={`${stickyHead} text-start`}>{L('المستند', 'Document')}</TableHead>
                  <TableHead className={`${stickyHead} text-start`}>{L('من → إلى', 'From → To')}</TableHead>
                  <TableHead className={`${stickyHead} text-end num-cell`}>{L('الحركة', 'Movement')}</TableHead>
                  <TableHead className={`${stickyHead} text-end num-cell`}>{L('الرصيد', 'Balance')}</TableHead>
                  <TableHead className={`${stickyHead} text-center pe-4`}>{L('الحالة', 'Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j} className={j === 0 ? 'ps-4' : j === 5 ? 'pe-4' : ''}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground border-b">{L('تعذّر تحميل حركات الصنف', 'Failed to load movements')}</TableCell>
                  </TableRow>
                ) : moves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground border-b">{L('لا توجد حركات مسجلة لهذا الصنف.', 'No recorded movements for this item.')}</TableCell>
                  </TableRow>
                ) : moves.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/40">
                    <TableCell className="ps-4 text-xs text-muted-foreground truncate">{new Date(m.postingDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-CA')}</TableCell>
                    <TableCell className="text-xs truncate">{m.documentType || '—'}</TableCell>
                    <TableCell className="text-xs truncate">
                      {(m.sourceWarehouse ? (isRTL ? m.sourceWarehouse.nameAr : (m.sourceWarehouse.nameEn || m.sourceWarehouse.nameAr)) : '—')} → {(m.destWarehouse ? (isRTL ? m.destWarehouse.nameAr : (m.destWarehouse.nameEn || m.destWarehouse.nameAr)) : '—')}
                    </TableCell>
                    <TableCell className="text-end num-cell">
                      <span className={cn('num font-semibold', m.signed >= 0 ? 'text-emerald-600' : 'text-rose-600')} dir="ltr">
                        {m.signed >= 0 ? '+' : ''}{formatNumber(m.signed)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end num-cell"><span className="num font-bold" dir="ltr">{formatNumber(m.running)}</span></TableCell>
                    <TableCell className="text-center pe-4 text-xs text-muted-foreground">{m.state || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
