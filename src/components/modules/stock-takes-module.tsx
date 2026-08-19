'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatInt, formatNumber, formatDate, formatDateTime } from '@/lib/format'
import { exportRows, printHTML, ExportColumn, ExportMeta, ColumnAlign } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { DatePicker } from '@/components/ui/date-picker'
import {
  ClipboardList, Plus, CheckCircle2, XCircle, MoreVertical, Package, ClipboardCheck,
  AlertTriangle, Printer, Download, Eye, EyeOff, Search, FileSpreadsheet, FileText,
  Layers, ShieldCheck, ArrowRightLeft, FileCheck, HelpCircle, Check, ScanBarcode, ChevronDown
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
// Constants & Configuration
// ────────────────────────────────────────────────────────────────────────────
const REQUIRE_APPROVAL = true
const POSTED_STATUS = 'posted'
const COST_ROLES = ['admin', 'owner', 'superadmin', 'manager', 'accountant', 'finance', 'inventory_manager']

const DISCREPANCY_REASONS = [
  { value: 'shrinkage', labelAr: 'عجز / انكماش مخزني', labelEn: 'Shrinkage / Stock Loss' },
  { value: 'damage', labelAr: 'تالف / انتهاء صلاحية', labelEn: 'Damage / Expiry' },
  { value: 'misplacement', labelAr: 'خطأ موقع / ترتيب مستودعي', labelEn: 'Location Misplacement' },
  { value: 'surplus', labelAr: 'فائض ورودي / توريد زاد', labelEn: 'Surplus Receipt' },
  { value: 'counting_error', labelAr: 'خطأ عد جرد سابق', labelEn: 'Previous Count Error' },
  { value: 'other', labelAr: 'سبب آخر (سجل الملاحظات)', labelEn: 'Other (See Notes)' },
]

export interface StockTakeItem {
  productId: string
  productName?: string
  productNameEn?: string
  sku?: string
  barcode?: string
  location?: string
  uom?: string
  systemQty: number
  countedQty: number | null
  diff: number
  unitCost: number
  varianceValue: number
  reason?: string
  isNew?: boolean
}

export interface StockTake {
  id: string
  code: string
  storehouseId?: string
  warehouseId?: string
  status: 'draft' | 'in_progress' | 'review' | 'posted' | 'completed' | 'cancelled' | string
  reason?: string
  notes?: string
  itemsJson: string
  items?: StockTakeItem[]
  adjustmentDate?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  approvedBy?: string
  postedBy?: string
  storehouse?: { id: string; name?: string; nameAr?: string; nameEn?: string; code: string }
  warehouse?: { id: string; nameAr?: string; nameEn?: string; code: string }
}

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 44
const VISIBLE_ROWS = 6
const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'

function safeParseItems(jsonString?: string): StockTakeItem[] {
  if (!jsonString) return []
  try {
    const parsed = JSON.parse(jsonString)
    if (!Array.isArray(parsed)) return []
    return parsed.map((it: any) => {
      const sysQty = Number(it.systemQty ?? 0)
      const countQty = it.countedQty === null || it.countedQty === undefined ? null : Number(it.countedQty)
      const diffVal = countQty === null ? 0 : countQty - sysQty
      const cost = Number(it.unitCost ?? 0)
      return {
        productId: String(it.productId || ''),
        productName: it.productName || it.nameAr || '',
        productNameEn: it.productNameEn || it.nameEn || '',
        sku: it.sku || '',
        barcode: it.barcode || '',
        location: it.location || 'A-01',
        uom: it.uom || 'Unit',
        systemQty: sysQty,
        countedQty: countQty,
        diff: diffVal,
        unitCost: cost,
        varianceValue: diffVal * cost,
        reason: it.reason || (diffVal < 0 ? 'shrinkage' : diffVal > 0 ? 'surplus' : 'other'),
        isNew: Boolean(it.isNew),
      }
    })
  } catch (e) {
    console.error('Failed to parse itemsJson safely:', e)
    return []
  }
}

export function StockTakesModule() {
  const { t, isRTL, dir, locale } = useT()
  const lang = locale ?? (isRTL ? 'ar' : 'en')
  const L = (ar: string, en: string) => (lang === 'en' ? en : ar)

  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = String((session?.user as any)?.role ?? '').toLowerCase()
  const canViewCost = !role || COST_ROLES.includes(role)

  // Filters & State
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailTake, setDetailTake] = useState<StockTake | null>(null)
  const [postConfirmTake, setPostConfirmTake] = useState<StockTake | null>(null)
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false)
  const [selectedAddProductId, setSelectedAddProductId] = useState('')

  // Create Form State
  const [createForm, setCreateForm] = useState({
    storehouseId: '',
    countType: 'full', // full | category | abc
    categoryId: '',
    countAsOf: new Date().toISOString().split('T')[0],
    notes: '',
  })

  // Counting Interactive State
  const [countItems, setCountItems] = useState<StockTakeItem[]>([])
  const [blindMode, setBlindMode] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  // Safe fetch helper to prevent JSON parse errors on HTML 401/500 responses
  const fetchJson = async (url: string) => {
    const r = await fetch(url)
    const contentType = r.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      if (r.status === 401) {
        throw new Error(L('جلسة المستخدم منتهية، يرجى إعادة تسجيل الدخول', 'Session expired, please sign in again.'))
      }
      throw new Error(L(`استجابة غير متوقعة من الخادم (${r.status})`, `Unexpected server response (${r.status})`))
    }
    const data = await r.json()
    if (!r.ok) {
      throw new Error(data?.error || data?.message || L('فشل تحميل البيانات', 'Failed to load data'))
    }
    return data
  }

  // Query: Unfiltered all stocktakes for accurate global KPIs
  const { data: allTakesData } = useQuery<{ data: StockTake[] }>({
    queryKey: ['all-stock-takes-kpis'],
    queryFn: () => fetchJson('/api/erp/stock-takes?pageSize=1000'),
  })

  // Query: Filtered stocktakes for the table
  const { data: takesData, isLoading, isError, refetch } = useQuery<{ data: StockTake[]; total: number }>({
    queryKey: ['stock-takes', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('q', search.trim())
      return fetchJson(`/api/erp/stock-takes?${params}`)
    },
  })

  // Auxiliary data queries
  const { data: storehousesData } = useQuery<{ data: any[] }>({
    queryKey: ['storehouses-for-takes'],
    queryFn: () => fetchJson('/api/erp/storehouses'),
  })

  const { data: categoriesData } = useQuery<{ data: any[] }>({
    queryKey: ['categories-for-takes'],
    queryFn: async () => {
      try {
        return await fetchJson('/api/erp/categories?tree=false')
      } catch {
        return { data: [] }
      }
    },
  })

  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-for-takes'],
    queryFn: () => fetchJson('/api/erp/products?type=product'),
  })

  const takes = takesData?.data ?? []
  const allTakes = allTakesData?.data ?? []
  const storehouses = storehousesData?.data ?? []
  const categories = categoriesData?.data ?? []
  const products = productsData?.data ?? []

  const storehouseName = (s?: any) => {
    if (!s) return '—'
    return lang === 'en' ? (s.nameEn || s.nameAr || s.name) : (s.nameAr || s.nameEn || s.name)
  }

  // Global KPIs (Unfiltered)
  const kpis = useMemo(() => {
    const total = allTakes.length
    const draft = allTakes.filter((t) => t.status === 'draft' || t.status === 'in_progress').length
    const review = allTakes.filter((t) => t.status === 'review').length
    const posted = allTakes.filter((t) => t.status === 'posted' || t.status === 'completed').length
    const cancelled = allTakes.filter((t) => t.status === 'cancelled').length

    let totalVarianceVal = 0
    allTakes.forEach((t) => {
      if (t.status === 'posted' || t.status === 'completed') {
        const items = safeParseItems(t.itemsJson)
        items.forEach((it) => {
          totalVarianceVal += Number(it.varianceValue || 0)
        })
      }
    })

    return { total, draft, review, posted, cancelled, totalVarianceVal }
  }, [allTakes])

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/stock-takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل الحفظ', 'Save failed'))
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(L('تم إنشاء جلسة الجرد بنجاح', 'Stocktake session created successfully'))
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      qc.invalidateQueries({ queryKey: ['all-stock-takes-kpis'] })
      setCreateDialogOpen(false)
      setCreateForm({
        storehouseId: '',
        countType: 'full',
        categoryId: '',
        countAsOf: new Date().toISOString().split('T')[0],
        notes: '',
      })
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const r = await fetch(`/api/erp/stock-takes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || L('فشل التحديث', 'Update failed'))
      }
      return r.json()
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.body.status === 'posted' || variables.body.status === 'completed'
          ? L('تم ترحيل الجرد وتحديث أرصدة المخزون وإنشاء القيد المحاسبي بنجاح', 'Stocktake posted, inventory updated & journal posted successfully')
          : L('تم تحديث جلسة الجرد بنجاح', 'Stocktake session updated successfully')
      )
      qc.invalidateQueries({ queryKey: ['stock-takes'] })
      qc.invalidateQueries({ queryKey: ['all-stock-takes-kpis'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock-on-hand'] })
      qc.invalidateQueries({ queryKey: ['stock-moves'] })
      setDetailTake(null)
      setPostConfirmTake(null)
    },
    onError: (e: any) => toast.error(e.message || L('حدث خطأ', 'An error occurred')),
  })

  // Open counting / detail modal
  function openDetail(take: StockTake) {
    const parsed = safeParseItems(take.itemsJson)
    // Enrich item names
    const enriched = parsed.map((it) => {
      const p = products.find((p) => p.id === it.productId)
      const pName = p ? (lang === 'en' ? p.nameEn || p.nameAr : p.nameAr || p.nameEn) : it.productName || it.productId
      return {
        ...it,
        productName: pName,
        sku: it.sku || p?.sku || '',
        barcode: it.barcode || p?.barcode || '',
        unitCost: it.unitCost || p?.costPrice || 0,
      }
    })
    setCountItems(enriched)
    setDetailTake(take)
    setItemSearch('')
  }

  // Update item in modal
  function updateCountItem(idx: number, field: keyof StockTakeItem, val: any) {
    const next = [...countItems]
    const item = { ...next[idx] }

    if (field === 'countedQty') {
      const counted = val === '' || val === null || val === undefined ? null : Math.max(0, Number(val))
      item.countedQty = counted
      item.diff = counted === null ? 0 : counted - item.systemQty
      item.varianceValue = item.diff * item.unitCost
    } else if (field === 'reason') {
      item.reason = String(val)
    }

    next[idx] = item
    setCountItems(next)
  }

  // Add extra product to session
  function handleAddExtraProduct() {
    if (!selectedAddProductId) return
    const p = products.find((x) => x.id === selectedAddProductId)
    if (!p) return

    if (countItems.some((x) => x.productId === p.id)) {
      toast.error(L('المنتج موجود بالفعل بالجلسة', 'Product already exists in session'))
      return
    }

    const pName = lang === 'en' ? p.nameEn || p.nameAr : p.nameAr || p.nameEn
    const newItem: StockTakeItem = {
      productId: p.id,
      productName: pName,
      sku: p.sku,
      barcode: p.barcode ?? '',
      location: 'Extra-Item',
      uom: p.uom?.nameAr || 'Unit',
      systemQty: 0,
      countedQty: 1,
      diff: 1,
      unitCost: p.costPrice || 0,
      varianceValue: p.costPrice || 0,
      reason: 'surplus',
      isNew: true,
    }

    setCountItems([newItem, ...countItems])
    setSelectedAddProductId('')
    setAddItemDialogOpen(false)
    toast.success(L('تمت إضافة الصنف الزائد بنجاح', 'Extra product added successfully'))
  }

  // Submit forms
  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.storehouseId) return toast.error(L('المستودع مطلوب', 'Storehouse is required'))
    createMutation.mutate({
      storehouseId: createForm.storehouseId,
      warehouseId: createForm.storehouseId,
      countType: createForm.countType,
      categoryId: createForm.countType === 'category' ? createForm.categoryId : undefined,
      countAsOf: createForm.countAsOf,
      notes: createForm.notes,
      status: 'draft',
    })
  }

  function handleSaveProgress(nextStatus?: string) {
    if (!detailTake) return
    const status = nextStatus || detailTake.status
    updateMutation.mutate({
      id: detailTake.id,
      body: {
        status,
        items: countItems,
        notes: detailTake.notes,
      },
    })
  }

  function executePost() {
    if (!postConfirmTake) return
    updateMutation.mutate({
      id: postConfirmTake.id,
      body: {
        status: POSTED_STATUS,
        items: countItems,
      },
    })
  }

  // Printing & Reports
  async function handlePrintWorksheet(take: StockTake) {
    const items = safeParseItems(take.itemsJson)
    const stName = storehouseName(take.storehouse)

    const rowsHtml = items
      .map(
        (it, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td style="font-family:monospace;font-weight:600">${it.sku || '—'}</td>
        <td style="font-weight:600">${it.productName}</td>
        <td style="text-align:center">${it.barcode || '—'}</td>
        <td style="text-align:center">${it.location || 'A-01'}</td>
        <td style="text-align:center">${it.uom || L('الوحدة', 'Unit')}</td>
        <td style="text-align:center;font-weight:bold;min-width:80px">______</td>
        <td style="text-align:center;min-width:120px">__________________</td>
      </tr>`
      )
      .join('')

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1E40AF; padding-bottom:12px; margin-bottom:20px;">
          <div>
            <h1 style="margin:0; font-size:20px; color:#1E40AF;">${L('كشف الجرد المخزني الميداني', 'Physical Stocktake Worksheet')}</h1>
            <p style="margin:4px 0 0 0; color:#64748B; font-size:12px;">${L('رمز الجلسة', 'Session Code')}: <strong> </strong> &middot; ${L('المستودع', 'Warehouse')}: <strong>${stName}</strong></p>
          </div>
          <div style="text-align:left; font-size:11px; color:#475569;">
            <p style="margin:0;">${L('التاريخ', 'Date')}: ${formatDate(take.createdAt)}</p>
            <p style="margin:2px 0 0 0;">${L('إجمالي الأصناف', 'Total Items')}: ${items.length}</p>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:30px;">
          <thead>
            <tr style="background-color:#F1F5F9; color:#0F172A;">
              <th style="border:1px solid #CBD5E1; padding:8px;">#</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">SKU</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('اسم المنتج', 'Product Name')}</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('الباركود', 'Barcode')}</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('الموقع', 'Location')}</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('الوحدة', 'UOM')}</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('الكمية الفعلية', 'Counted Qty')}</th>
              <th style="border:1px solid #CBD5E1; padding:8px;">${L('ملاحظات الجارد', 'Counter Notes')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; margin-top:40px; font-size:12px; padding-top:20px; border-top:1px dashed #CBD5E1;">
          <div>
            <p style="margin:0 0 30px 0;">${L('اسم وتوقيع الجارد:', 'Counter Signature:')}</p>
            <p style="margin:0;">__________________________</p>
          </div>
          <div>
            <p style="margin:0 0 30px 0;">${L('اسم وتوقيع أمين المستودع:', 'Warehouse Keeper Signature:')}</p>
            <p style="margin:0;">__________________________</p>
          </div>
          <div>
            <p style="margin:0 0 30px 0;">${L('اعتماد مدير المخازن:', 'Inventory Manager Approval:')}</p>
            <p style="margin:0;">__________________________</p>
          </div>
        </div>
      </div>
    `

    await printHTML(html, L(`كشف-جرد-${take.code}`, `Stocktake-Worksheet-${take.code}`), { dir: isRTL ? 'rtl' : 'ltr' })
  }

  async function handlePrintVarianceReport(take: StockTake) {
    const items = safeParseItems(take.itemsJson).filter((x) => x.diff !== 0)
    const stName = storehouseName(take.storehouse)
    let totalDeficitVal = 0
    let totalSurplusVal = 0

    items.forEach((it) => {
      if (it.diff < 0) totalDeficitVal += Math.abs(it.varianceValue)
      else totalSurplusVal += it.varianceValue
    })
    const netVal = totalSurplusVal - totalDeficitVal

    const rowsHtml = items
      .map(
        (it, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td style="font-family:monospace;">${it.sku}</td>
        <td style="font-weight:600">${it.productName}</td>
        <td style="text-align:center">${formatNumber(it.systemQty, 0)}</td>
        <td style="text-align:center;font-weight:bold">${formatNumber(it.countedQty ?? 0, 0)}</td>
        <td style="text-align:center;font-weight:bold;color:${it.diff < 0 ? '#DC2626' : '#2563EB'}">${it.diff > 0 ? '+' : ''}${formatNumber(it.diff, 0)}</td>
        ${canViewCost ? `<td style="text-align:center">${formatCurrency(it.unitCost)}</td>` : ''}
        ${canViewCost ? `<td style="text-align:center;font-weight:bold;color:${it.varianceValue < 0 ? '#DC2626' : '#2563EB'}">${formatCurrency(it.varianceValue)}</td>` : ''}
        <td style="text-align:center">${DISCREPANCY_REASONS.find((r) => r.value === it.reason)?.[isRTL ? 'labelAr' : 'labelEn'] || it.reason}</td>
      </tr>`
      )
      .join('')

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px;">
        <div style="border-bottom:2px solid #DC2626; padding-bottom:12px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 style="margin:0; font-size:20px; color:#DC2626;">${L('تقرير فروقات الجرد المخزني', 'Stocktake Variance Report')}</h1>
            <p style="margin:4px 0 0 0; color:#64748B; font-size:12px;">${L('الجلسة', 'Session')}: <strong></strong> &middot; ${L('المستودع', 'Warehouse')}: <strong>${stName}</strong></p>
          </div>
          <div style="text-align:left; font-size:11px;">
            <p style="margin:0;">${L('الحالة', 'Status')}: <strong style="color:#059669">${take.status}</strong></p>
            <p style="margin:2px 0 0 0;">${L('تاريخ التقرير', 'Report Date')}: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        ${canViewCost
        ? `
        <div style="display:flex; gap:12px; margin-bottom:20px;">
          <div style="flex:1; background:#FEF2F2; border:1px solid #FECACA; padding:10px; border-radius:6px; text-align:center;">
            <span style="font-size:11px; color:#991B1B;">${L('إجمالي قيم العجز', 'Total Deficit Value')}</span>
            <div style="font-size:16px; font-weight:bold; color:#DC2626;">${formatCurrency(totalDeficitVal)}</div>
          </div>
          <div style="flex:1; background:#EFF6FF; border:1px solid #BFDBFE; padding:10px; border-radius:6px; text-align:center;">
            <span style="font-size:11px; color:#1E40AF;">${L('إجمالي قيم الفائض', 'Total Surplus Value')}</span>
            <div style="font-size:16px; font-weight:bold; color:#2563EB;">${formatCurrency(totalSurplusVal)}</div>
          </div>
          <div style="flex:1; background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px; text-align:center;">
            <span style="font-size:11px; color:#475569;">${L('صافي الأثر المحاسبي', 'Net Accounting Impact')}</span>
            <div style="font-size:16px; font-weight:bold; color:${netVal < 0 ? '#DC2626' : '#2563EB'};">${formatCurrency(netVal)}</div>
          </div>
        </div>`
        : ''
      }

        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background-color:#1E293B; color:#FFFFFF;">
              <th style="padding:8px; border:1px solid #334155;">#</th>
              <th style="padding:8px; border:1px solid #334155;">SKU</th>
              <th style="padding:8px; border:1px solid #334155;">${L('اسم المنتج', 'Product Name')}</th>
              <th style="padding:8px; border:1px solid #334155;">${L('النظام', 'System')}</th>
              <th style="padding:8px; border:1px solid #334155;">${L('الفعلي', 'Counted')}</th>
              <th style="padding:8px; border:1px solid #334155;">${L('الفرق', 'Diff')}</th>
              ${canViewCost ? `<th style="padding:8px; border:1px solid #334155;">${L('تكلفة الوحدة', 'Unit Cost')}</th>` : ''}
              ${canViewCost ? `<th style="padding:8px; border:1px solid #334155;">${L('قيمة الفرق', 'Variance Value')}</th>` : ''}
              <th style="padding:8px; border:1px solid #334155;">${L('سبب الانحراف', 'Reason Code')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${canViewCost ? 9 : 7}" style="text-align:center; padding:20px; color:#64748B;">${L('لا توجد فروقات مخزنية بهذه الجلسة. جميع الأصناف مطابقة 100%', 'No stock discrepancies in this session. All items 100% matched.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    `

    await printHTML(html, L(`تقرير-فروقات-${take.code}`, `Variance-Report-${take.code}`), { dir: isRTL ? 'rtl' : 'ltr' })
  }

  // Unified Export Handling
  function handleExport(format: 'excel' | 'pdf' | 'csv') {
    const exportCols: ExportColumn<StockTake>[] = [
      { key: 'code', header: L('رمز الجلسة', 'Code'), width: 16, align: 'center', type: 'text', value: (t) => t.code },
      { key: 'date', header: L('التاريخ', 'Date'), width: 16, align: 'center', type: 'date', value: (t) => t.createdAt },
      { key: 'storehouse', header: L('المستودع', 'Storehouse'), width: 22, align: 'center', type: 'text', value: (t) => storehouseName(t.storehouse) },
      { key: 'items', header: L('عدد الأصناف', 'Items Count'), width: 14, align: 'center', type: 'number', summable: true, value: (t) => safeParseItems(t.itemsJson).length },
      {
        key: 'discrepancies',
        header: L('عدد الفروقات', 'Discrepancies'),
        width: 14,
        align: 'center',
        type: 'number',
        summable: true,
        value: (t) => safeParseItems(t.itemsJson).filter((x) => x.diff !== 0).length,
      },
      {
        key: 'netDiff',
        header: L('صافي فرق الكميات', 'Net Diff Qty'),
        width: 16,
        align: 'center',
        type: 'number',
        summable: true,
        value: (t) => safeParseItems(t.itemsJson).reduce((s, x) => s + x.diff, 0),
      },
      { key: 'status', header: L('الحالة', 'Status'), width: 14, align: 'center', type: 'text', value: (t) => t.status },
    ]

    if (canViewCost) {
      exportCols.push({
        key: 'varianceVal',
        header: L('قيمة الفروقات', 'Variance Value'),
        width: 18,
        align: 'center',
        type: 'currency',
        summable: true,
        value: (t) => safeParseItems(t.itemsJson).reduce((s, x) => s + x.varianceValue, 0),
      })
    }

    const meta: ExportMeta = {
      fileName: L('تقرير-الجرد-المخزني', 'stocktakes-report'),
      title: L('تقرير الجرد المخزني والمطابقة', 'Stocktakes & Reconciliation Report'),
      subtitle: L('أورمنال إي آر بي', 'Orminal ERP'),
      isRTL,
      summary: [
        { label: L('إجمالي الجلسات', 'Total Stocktakes'), value: formatInt(kpis.total) },
        { label: L('الجلسات النشطة', 'Active Sessions'), value: formatInt(kpis.draft) },
        { label: L('الجلسات المرحّلة', 'Posted Sessions'), value: formatInt(kpis.posted) },
        ...(canViewCost ? [{ label: L('إجمالي صافي الفروقات', 'Net Financial Variance'), value: formatCurrency(kpis.totalVarianceVal) }] : []),
      ],
      labels: {
        generatedAt: L('تاريخ الاستخراج', 'Generated At'),
        totalRecords: L('إجمالي السجلات', 'Total Records'),
        grandTotal: L('الإجمالي', 'Total'),
      },
    }

    exportRows(format, takes, exportCols, meta)
  }

  function handleExportSessionItems(format: 'excel' | 'csv' | 'pdf', take: StockTake) {
    const items = countItems
    const exportCols: ExportColumn<(typeof countItems)[0]>[] = [
      { key: 'sku', header: L('رمز المنتج SKU', 'Product SKU'), width: 14, align: 'center', type: 'text', value: (i) => i.sku },
      { key: 'productName', header: L('اسم المنتج', 'Product Name'), width: 28, align: (isRTL ? 'right' : 'left') as ColumnAlign, type: 'text', value: (i) => i.productName },
      { key: 'location', header: L('الموقع', 'Location'), width: 14, align: 'center', type: 'text', value: (i) => i.location || '-' },
      { key: 'uom', header: L('الوحدة', 'UOM'), width: 12, align: 'center', type: 'text', value: (i) => i.uom || '-' },
      { key: 'systemQty', header: L('كمية النظام', 'System Qty'), width: 14, align: 'center', type: 'number', summable: true, value: (i) => i.systemQty },
      { key: 'countedQty', header: L('الكمية الفعلية', 'Counted Qty'), width: 14, align: 'center', type: 'number', summable: true, value: (i) => i.countedQty ?? 0 },
      { key: 'diff', header: L('الفرق', 'Diff Qty'), width: 12, align: 'center', type: 'number', summable: true, value: (i) => i.diff },
    ]

    if (canViewCost) {
      exportCols.push({
        key: 'varianceValue',
        header: L('قيمة الانحراف', 'Variance Value'),
        width: 16,
        align: 'center',
        type: 'currency',
        summable: true,
        value: (i) => i.varianceValue,
      })
    }

    exportCols.push({
      key: 'reason',
      header: L('سبب الانحراف', 'Reason Code'),
      width: 18,
      align: 'center',
      type: 'text',
      value: (i) => DISCREPANCY_REASONS.find((r) => r.value === i.reason)?.[isRTL ? 'labelAr' : 'labelEn'] || i.reason || '-',
    })

    const meta: ExportMeta = {
      fileName: L(`تفاصيل-جرد-${take.code}`, `Stocktake-Items-${take.code}`),
      title: L(`كشف تفاصيل جلسة جرد ${take.code}`, `Stocktake Session Details ${take.code}`),
      subtitle: `${L('المستودع', 'Warehouse')}: ${storehouseName(take.storehouse)} | ${L('أورمنال إي آر بي', 'Orminal ERP')}`,
      isRTL,
      summary: [
        { label: L('إجمالي الأصناف', 'Total Items'), value: formatInt(items.length) },
        { label: L('أصناف بها فروقات', 'Discrepancies'), value: formatInt(items.filter((x) => x.diff !== 0).length) },
        { label: L('صافي انحراف الكميات', 'Net Diff Qty'), value: formatInt(items.reduce((s, x) => s + x.diff, 0)) },
        ...(canViewCost ? [{ label: L('صافي الأثر المالي', 'Net Financial Variance'), value: formatCurrency(items.reduce((s, x) => s + x.varianceValue, 0)) }] : []),
      ],
      labels: {
        generatedAt: L('تاريخ الاستخراج', 'Generated At'),
        totalRecords: L('إجمالي السجلات', 'Total Records'),
        grandTotal: L('الإجمالي', 'Total'),
      },
    }

    exportRows(format, items, exportCols, meta)
  }

  // Filtered items in Detail Modal
  const filteredModalItems = useMemo(() => {
    if (!itemSearch.trim()) return countItems
    const q = itemSearch.trim().toLowerCase()
    return countItems.filter(
      (it) =>
        it.productName?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q) ||
        it.barcode?.toLowerCase().includes(q) ||
        it.location?.toLowerCase().includes(q)
    )
  }, [countItems, itemSearch])

  // Calculation for post confirmation modal
  const postCalculations = useMemo(() => {
    let deficitQty = 0
    let surplusQty = 0
    let deficitVal = 0
    let surplusVal = 0
    let matchedCount = 0
    let totalMismatched = 0

    countItems.forEach((it) => {
      if (it.diff === 0) {
        matchedCount++
      } else {
        totalMismatched++
        if (it.diff < 0) {
          deficitQty += Math.abs(it.diff)
          deficitVal += Math.abs(it.varianceValue)
        } else {
          surplusQty += it.diff
          surplusVal += it.varianceValue
        }
      }
    })

    const netValue = surplusVal - deficitVal

    return {
      matchedCount,
      totalMismatched,
      deficitQty,
      surplusQty,
      deficitVal,
      surplusVal,
      netValue,
    }
  }, [countItems])

  return (
    <ModuleShell
      title={t('module.stock-takes')}
      description={L('جرد المخزون، مطابقة الكميات، وإدارة تسويات الفروقات المحاسبية', 'Inventory counting, stock reconciliation and journal adjustments')}
      icon={<ClipboardList className="size-5" />}
      onAdd={() => {
        setCreateForm({
          storehouseId: storehouses[0]?.id || '',
          countType: 'full',
          categoryId: '',
          countAsOf: new Date().toISOString().split('T')[0],
          notes: '',
        })
        setCreateDialogOpen(true)
      }}
      addLabel={L('جرد جديد', 'New Stocktake')}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={L('البحث برمز الجلسة، المستودع، الملاحظات...', 'Search by session code, warehouse, notes...')}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-semibold text-xs border-slate-200 dark:border-slate-800">
              <Download className="size-3.5" />
              {L('تصدير ', 'Export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} collisionPadding={10} className="w-48">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 text-xs font-semibold cursor-pointer">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              {L('تصدير إكسل (Excel)', 'Export to Excel')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 text-xs font-semibold cursor-pointer">
              <FileText className="size-4 text-rose-600" />
              {L('تصدير بي دي إف (PDF)', 'Export to PDF')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 text-xs font-semibold cursor-pointer">
              <FileText className="size-4 text-blue-600" />
              {L('تصدير CSV', 'Export to CSV')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-xs font-semibold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder={L('كل الحالات', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent dir={dir}>
            <SelectItem value="all">{L('كل الحالات', 'All Statuses')}</SelectItem>
            <SelectItem value="draft">{L('مسودة / قيد البداية', 'Draft')}</SelectItem>
            <SelectItem value="in_progress">{L('قيد العد الفعلي', 'In Progress')}</SelectItem>
            <SelectItem value="review">{L('قيد المراجعة', 'Under Review')}</SelectItem>
            <SelectItem value="posted">{L('مُرحّل ومُعتمد', 'Posted & Reconciled')}</SelectItem>
            <SelectItem value="cancelled">{L('ملغي', 'Cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {/* Global Unfiltered KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2 mb-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <KpiCard title={L('إجمالي الجلسات', 'Total Stocktakes')} value={String(kpis.total)} icon={<ClipboardList className="size-4" />} accent="blue" />
            <KpiCard title={L('جلسات قيد العد', 'Active Counting')} value={String(kpis.draft)} icon={<ClipboardCheck className="size-4" />} accent="amber" />
            <KpiCard title={L('بانتظار الاعتماد', 'Under Review')} value={String(kpis.review)} icon={<ShieldCheck className="size-4" />} accent="violet" />
            <KpiCard title={L('مُرحّلة ومكتملة', 'Posted & Reconciled')} value={String(kpis.posted)} icon={<CheckCircle2 className="size-4" />} accent="sky" />
            {canViewCost ? (
              <KpiCard title={L('صافي أثر الترحيل', 'Net Posting Variance')} value={formatCurrency(kpis.totalVarianceVal)} icon={<ArrowRightLeft className="size-4" />} accent={kpis.totalVarianceVal < 0 ? 'rose' : 'sky'} />
            ) : (
              <KpiCard title={L('جلسات ملغية', 'Cancelled')} value={String(kpis.cancelled)} icon={<XCircle className="size-4" />} accent="rose" />
            )}
          </>
        )}
      </div>

      {/* Main Table Card */}
      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          {/* table-fixed + colgroup: يضمن محاذاة كل عمود مع رأسه بلا تداخل */}
          <table className="w-full caption-bottom text-sm min-w-[960px] table-fixed border-separate border-spacing-0">
            {/* عرض ثابت لكل عمود (المجموع 100%) */}
            <colgroup>
              <col className="w-[14%]" />{/* الرمز */}
              <col className="w-[14%]" />{/* التاريخ */}
              <col className="w-[24%]" />{/* المستودع */}
              <col className="w-[13%]" />{/* عدد الأصناف */}
              <col className="w-[13%]" />{/* انحرافات */}
              <col className="w-[12%]" />{/* الحالة */}
              <col className="w-[10%]" />{/* إجراءات */}
            </colgroup>

            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{L('الرمز', 'Code')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('التاريخ', 'Date')}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{L('المستودع', 'Storehouse')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('عدد الأصناف', 'Items')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('انحرافات', 'Discrepancies')}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{L('الحالة', 'Status')}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{L('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground border-b">
                    {L('جاري التحميل...', 'Loading...')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-rose-500 border-b">
                    <AlertTriangle className="size-8 mx-auto mb-2 opacity-80" />
                    {L('حدث خطأ أثناء تحميل بيانات الجرد. يرجى المحاولة مرة أخرى.', 'Error loading stocktakes data. Please retry.')}
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={() => refetch()}>{L('إعادة التحميل', 'Retry')}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : takes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground border-b">
                    <ClipboardList className="size-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{L('لا يوجد جلسات جرد مخزني متطابقة', 'No stocktake sessions found')}</p>
                    <p className="text-xs text-slate-500 mt-1">{L('ابدأ بإنشاء جلسة جرد جديدة لمطابقة وتسوية المخزون.', 'Create a new stocktake session to count and reconcile inventory.')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                takes.map((take) => {
                  const items = safeParseItems(take.itemsJson)
                  const totalDiffCount = items.filter((x) => x.diff !== 0).length

                  return (
                    <TableRow
                      key={take.id}
                      onClick={() => openDetail(take)}
                      className="hover:bg-muted/40 cursor-pointer align-middle"
                      title={L('اضغط لعرض/تعديل الجرد', 'Click to view/edit stocktake')}
                    >
                      <TableCell className="ps-6 font-mono text-xs border-b truncate" dir="ltr" title={take.code}>
                        {take.code}
                      </TableCell>
                      <TableCell className="text-sm text-center whitespace-nowrap border-b">
                        {formatDate(take.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium border-b truncate" title={storehouseName(take.storehouse)}>
                        <div className="flex items-center gap-1.5 truncate">
                          <Package className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{storehouseName(take.storehouse)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center border-b">
                        <span className="num tabular-nums font-semibold" dir="ltr">
                          {items.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-center border-b">
                        <div className="flex justify-center">
                          <Badge variant={totalDiffCount > 0 ? 'secondary' : 'outline'} className={cn('text-[11px] font-semibold px-2', totalDiffCount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900' : 'text-slate-500')}>
                            {totalDiffCount} {L('صنف', 'item(s)')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center border-b">
                        <div className="flex justify-center">
                          <StatusBadge status={take.status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-end pe-4 border-b" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} collisionPadding={10} className="w-52">
                            <DropdownMenuItem onClick={() => openDetail(take)} className="gap-2 text-xs font-semibold cursor-pointer">
                              <Eye className="size-4 text-blue-600" />
                              {take.status === 'posted' ? L('عرض تفاصيل الترحيل', 'View Posting Details') : L('فتح لشاشة العد والمطابقة', 'Open Count & Reconcile')}
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => handlePrintWorksheet(take)} className="gap-2 text-xs font-semibold cursor-pointer">
                              <Printer className="size-4 text-slate-600" />
                              {L('طباعة كشف الجرد الميداني', 'Print Stocktake Worksheet')}
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => handlePrintVarianceReport(take)} className="gap-2 text-xs font-semibold cursor-pointer">
                              <FileText className="size-4 text-amber-600" />
                              {L('طباعة تقرير الفروقات (PDF)', 'Print Variance Report')}
                            </DropdownMenuItem>

                            {take.status !== 'posted' && take.status !== 'cancelled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-xs font-semibold text-rose-600 focus:text-rose-600 cursor-pointer"
                                  onClick={() => updateMutation.mutate({ id: take.id, body: { status: 'cancelled' } })}
                                >
                                  <XCircle className="size-4" />
                                  {L('إلغاء جلسة الجرد', 'Cancel Session')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </table>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* Create New Session Dialog */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-950 border-b border-blue-100 dark:border-slate-800 p-4 sm:p-6 pe-14 sm:pe-16 shrink-0 relative">
            <div className="flex items-start gap-4">
              <div className="size-11 sm:size-12 rounded-xl bg-blue-200/30 dark:bg-blue-300 text-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <ClipboardList className="size-5 sm:size-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {L('إنشاء جرد مخزني جديدة', 'New Stocktake ')}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {L('حدد ا  مستودع ونطاق الجرد لبناء اللقطة (Snapshot) وتجميد الأرصدة للعد.', 'Select warehouse and count scope to build initial stock snapshot.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0">
            <DialogBody className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-4">
                {/* Warehouse */}
                <div className={cn('space-y-1.5', isRTL ? 'text-right' : 'text-left')}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {L('المستودع المستهدف للجرد *', 'Target Warehouse *')}
                  </Label>
                  <Select value={createForm.storehouseId} onValueChange={(v) => setCreateForm({ ...createForm, storehouseId: v })}>
                    <SelectTrigger dir={dir} className={cn('h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-sm bg-white dark:bg-slate-950', isRTL ? 'text-right' : 'text-left')}>
                      <SelectValue placeholder={L('اختر المستودع المستهدف', 'Select target storehouse')} />
                    </SelectTrigger>
                    <SelectContent dir={dir} className="z-[120]">
                      {storehouses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {storehouseName(s)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Scope */}
                <div className={cn('space-y-1.5', isRTL ? 'text-right' : 'text-left')}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('نطاق وتغطية الجرد', 'Count Scope')}</Label>
                  <Select value={createForm.countType} onValueChange={(v) => setCreateForm({ ...createForm, countType: v })}>
                    <SelectTrigger dir={dir} className="h-10 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={dir} className="z-[120]">
                      <SelectItem value="full">{L('جرد كامل شامل لجميع أصناف المستودع', 'Full Warehouse Stocktake')}</SelectItem>
                      <SelectItem value="category">{L('جرد جزئي مخصص لفئة منتجات معينة', 'Category Specific Count')}</SelectItem>
                      <SelectItem value="abc">{L('جرد دوري عشوائي (Periodic ABC Audit)', 'Periodic ABC Audit')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Selection if Category Scope */}
                {createForm.countType === 'category' && (
                  <div className={cn('space-y-1.5', isRTL ? 'text-right' : 'text-left')}>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('اختر الفئة المستهدفة *', 'Target Category *')}</Label>
                    <Select value={createForm.categoryId} onValueChange={(v) => setCreateForm({ ...createForm, categoryId: v })}>
                      <SelectTrigger dir={dir} className="h-10 border-slate-200 dark:border-slate-800 text-sm bg-white dark:bg-slate-950">
                        <SelectValue placeholder={L('اختر الفئة', 'Select category')} />
                      </SelectTrigger>
                      <SelectContent dir={dir} className="z-[120]">
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Snapshot Date */}
                <div className={cn('space-y-1.5', isRTL ? 'text-right' : 'text-left')}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('تاريخ الرصيد (As Of Snapshot Date)', 'Snapshot Date')}</Label>
                  <DatePicker
                    value={createForm.countAsOf}
                    onChange={(val) => setCreateForm({ ...createForm, countAsOf: val })}
                  />
                </div>

                {/* Notes */}
                <div className={cn('space-y-1.5', isRTL ? 'text-right' : 'text-left')}>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('ملاحظات الجلسة / الغرض من الجرد', 'Session Notes')}</Label>
                  <Textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    rows={2}
                    dir={dir}
                    className="border-slate-200 dark:border-slate-800 text-sm"
                    placeholder={L('مثال: جرد نهاية العام 2026، مطابقة ربع سنوية...', 'e.g. End of year audit 2026, quarterly reconciliation...')}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 [&>button]:w-full sm:[&>button]:w-auto">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} className="h-9 px-4 text-xs font-semibold">
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.storehouseId} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm">
                {createMutation.isPending ? L('جاري الإنشاء...', 'Creating...') : L('إنشاء الجلسة والبدء', 'Create & Start')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* Interactive Counting & Reconciliation Workspace Modal */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!detailTake} onOpenChange={(o) => !o && setDetailTake(null)}>
        <DialogContent className="!w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] sm:!w-[calc(100vw-3rem)] sm:!max-w-5xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90dvh] border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 sm:size-11 rounded-xl bg-blue-600/80 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="size-5 sm:size-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle>{L(`جلسة جرد ${detailTake?.code ?? ''}`, `Stocktake Session ${detailTake?.code ?? ''}`)}</DialogTitle>
                    {detailTake && <StatusBadge status={detailTake.status} />}
                  </div>
                  <DialogDescription className="text-xs text-blue-900 dark:text-blue-100 font-medium mt-0.5">
                    {L('المستودع', 'Warehouse')}: {storehouseName(detailTake?.storehouse)} &middot; {formatDate(detailTake?.createdAt)}
                  </DialogDescription>
                </div>
              </div>


            </div>
          </DialogHeader>

          {detailTake && (
            <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full overflow-hidden">
              <DialogBody className="flex-1 min-h-0 min-w-0 w-full overflow-x-hidden overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
                {/* Warning Banner */}
                {detailTake.status !== 'posted' && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs">
                    <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">{L('تنبيه تجميد حركة المخزون أثناء العد', 'Inventory Movement Freeze Notice')}</p>
                      <p className="opacity-90">{L('تأكد من عدم صرف أو استلام أي شحنة لهذا المستودع أثناء العد الميداني لضمان دقة اللقطة التسوية.', 'Ensure no stock issues or receipts occur during active count for full accuracy.')}</p>
                    </div>
                  </div>
                )}

                {/* Session Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="min-w-0 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 text-center shadow-xs">
                    <p className="text-[11px] text-slate-500 font-semibold mb-1 leading-tight break-words">{L('إجمالي الأصناف بالجلسة', 'Total Items')}</p>
                    <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      <span className="num">{countItems.length}</span>
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 text-center shadow-xs">
                    <p className="text-[11px] text-slate-500 font-semibold mb-1 leading-tight break-words">{L('أصناف بها فروقات', 'Discrepancies')}</p>
                    <p className={cn('text-lg sm:text-xl font-bold', countItems.filter((x) => x.diff !== 0).length > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                      <span className="num">{countItems.filter((x) => x.diff !== 0).length}</span>
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 text-center shadow-xs">
                    <p className="text-[11px] text-slate-500 font-semibold mb-1 leading-tight break-words">{L('صافي انحراف الكميات', 'Net Diff Qty')}</p>
                    <p className={cn('text-lg sm:text-xl font-bold', countItems.reduce((s, x) => s + x.diff, 0) !== 0 ? 'text-blue-600' : 'text-slate-600')}>
                      <span className="num">
                        {countItems.reduce((s, x) => s + x.diff, 0) > 0 ? '+' : ''}
                        {formatNumber(
                          countItems.reduce((s, x) => s + x.diff, 0),
                          0
                        )}
                      </span>
                    </p>
                  </div>

                  {canViewCost && (
                    <div className="min-w-0 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 text-center shadow-xs">
                      <p className="text-[11px] text-slate-500 font-semibold mb-1 leading-tight break-words">{L('صافي الأثر المالي', 'Net Financial Variance')}</p>
                      <p className={cn('text-base sm:text-lg font-bold', countItems.reduce((s, x) => s + x.varianceValue, 0) < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                        <span className="num">{formatCurrency(countItems.reduce((s, x) => s + x.varianceValue, 0))}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Toolbar: Search, Hide Quantities Toggle, Reports Dropdown & Add Extra Item */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-1">
                  <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                    <Search className="size-4 absolute start-3 top-2.5 text-slate-400" />
                    <Input
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder={L('بحث باسم المنتج، SKU، الباركود، أو موقع الرف...', 'Search by product name, SKU, barcode, location...')}
                      className="ps-9 h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:shrink-0">
                    {/* Hide System Balances (Blind Count Toggle) */}
                    {detailTake.status !== 'posted' && (
                      <div
                        className={cn(
                          'flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-semibold transition-colors cursor-pointer select-none',
                          blindMode
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-2xs'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        )}
                        onClick={() => setBlindMode(!blindMode)}
                      >
                        {blindMode ? (
                          <EyeOff className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        ) : (
                          <Eye className="size-3.5 text-slate-400 shrink-0" />
                        )}
                        <span>{L('إخفاء كميات النظام', 'Hide System Balances')}</span>
                        <Switch
                          checked={blindMode}
                          onCheckedChange={setBlindMode}
                          onClick={(e) => e.stopPropagation()}
                          className="scale-85 ms-0.5"
                        />
                      </div>
                    )}

                    {/* Separate Print Dropdown Menu */}
                    <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                          <Printer className="size-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{L('الطباعة', 'Print')}</span>
                          <ChevronDown className="size-4 text-slate-400 ms-0.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} collisionPadding={8} className="z-[120] w-35">
                        <DropdownMenuItem onClick={() => handlePrintWorksheet(detailTake)} className="gap-2 cursor-pointer text-xs">
                          <Printer className="size-4 text-blue-600" />
                          <span>{L('كشف الميدان', 'Worksheet')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintVarianceReport(detailTake)} className="gap-2 cursor-pointer text-xs">
                          <FileText className="size-4 text-amber-600" />
                          <span>{L('تقرير الفروقات', 'Variance Report')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Separate Export Dropdown Menu */}
                    <DropdownMenu dir={dir as 'rtl' | 'ltr'}>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                          <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{L('التصدير', 'Export')}</span>
                          <ChevronDown className="size-3 text-slate-400 ms-0.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} collisionPadding={10} className="z-[120] w-30">
                        <DropdownMenuItem onClick={() => handleExportSessionItems('excel', detailTake)} className="gap-2 cursor-pointer text-xs">
                          <FileSpreadsheet className="size-4 text-emerald-600" />
                          <span>{L('تصدير Excel', 'Export Excel')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportSessionItems('csv', detailTake)} className="gap-2 cursor-pointer text-xs">
                          <Download className="size-4 text-slate-600" />
                          <span>{L('تصدير CSV', 'Export CSV')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportSessionItems('pdf', detailTake)} className="gap-2 cursor-pointer text-xs">
                          <FileCheck className="size-4 text-rose-600" />
                          <span>{L('تصدير PDF', 'Export PDF')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {detailTake.status !== 'posted' && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setAddItemDialogOpen(true)} className="h-9 gap-1.5 text-xs font-semibold border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40">
                        <Plus className="size-3.5" />
                        <span>{L('إضافة صنف زائد', 'Add Extra Item')}</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Main Table */}
                <div className="w-full max-w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-950 shadow-xs">
                  <Table className="table-fixed border-separate border-spacing-0 min-w-[640px] w-full text-xs">
                    <TableHeader className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center ps-3">#</TableHead>
                        <TableHead className="w-48 text-start">{L('المنتج', 'Product')}</TableHead>
                        <TableHead className="w-24 text-center">{L('الموقع / UOM', 'Location/UOM')}</TableHead>
                        {!blindMode && <TableHead className="w-24 text-center num-cell">{L('كمية النظام', 'System Qty')}</TableHead>}
                        <TableHead className="w-32 text-center num-cell">{L('الكمية الفعلية', 'Counted Qty')}</TableHead>
                        {!blindMode && <TableHead className="w-24 text-center num-cell">{L('الفرق', 'Diff')}</TableHead>}
                        {canViewCost && !blindMode && <TableHead className="w-28 text-center num-cell">{L('قيمة الانحراف', 'Variance Val')}</TableHead>}
                        <TableHead className="w-44 text-start pe-3">{L('سبب الانحراف', 'Reason Code')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModalItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canViewCost ? (blindMode ? 5 : 8) : blindMode ? 4 : 7} className="text-center py-10 text-slate-500">
                            {L('لا توجد أصناف تطابق البحث الحالي', 'No items match current search')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredModalItems.map((it, idx) => {
                          const originalIdx = countItems.findIndex((x) => x.productId === it.productId)
                          const isDiff = it.diff !== 0

                          return (
                            <TableRow key={it.productId || idx} className={cn('hover:bg-slate-50/80 dark:hover:bg-slate-900/40', isDiff && !blindMode && 'bg-amber-50/30 dark:bg-amber-950/10')}>
                              <TableCell className="text-center ps-3 text-slate-400 font-mono text-[11px]">{idx + 1}</TableCell>
                              <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                                <div>{it.productName}</div>
                                <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                                  {it.sku} {it.barcode ? `• ${it.barcode}` : ''}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-slate-500 text-[11px]">
                                <div>{it.location}</div>
                                <div className="text-slate-400 text-[10px]">{it.uom}</div>
                              </TableCell>

                              {!blindMode && (
                                <TableCell className="num-cell text-center font-medium text-slate-600">
                                  <span className="num">{formatNumber(it.systemQty, 0)}</span>
                                </TableCell>
                              )}

                              {/* Counted Quantity Input */}
                              <TableCell className="num-cell p-1.5 text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={it.countedQty === null || it.countedQty === undefined ? '' : it.countedQty}
                                  onChange={(e) => updateCountItem(originalIdx, 'countedQty', e.target.value)}
                                  disabled={detailTake.status === 'posted'}
                                  placeholder={L('غير محدد', 'Uncounted')}
                                  className={cn('h-8 w-24 mx-auto text-center font-bold text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950', isDiff && !blindMode && 'border-amber-400 focus:ring-amber-500')}
                                />
                              </TableCell>

                              {!blindMode && (
                                <TableCell className="num-cell text-center text-xs">
                                  <span className={cn('num font-bold', it.diff > 0 ? 'text-blue-600 dark:text-blue-400' : it.diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')}>
                                    {it.diff > 0 ? '+' : ''}
                                    {formatNumber(it.diff, 0)}
                                  </span>
                                </TableCell>
                              )}

                              {canViewCost && !blindMode && (
                                <TableCell className="num-cell text-center text-xs">
                                  <span className={cn('num font-semibold', it.varianceValue < 0 ? 'text-rose-600' : it.varianceValue > 0 ? 'text-blue-600' : 'text-slate-400')}>{formatCurrency(it.varianceValue)}</span>
                                </TableCell>
                              )}

                              {/* Reason Code Selection */}
                              <TableCell className="pe-3 min-w-[140px]">
                                {isDiff && !blindMode ? (
                                  <Select value={it.reason || 'shrinkage'} onValueChange={(v) => updateCountItem(originalIdx, 'reason', v)} disabled={detailTake.status === 'posted'}>
                                    <SelectTrigger className="h-7 text-[11px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-blue-500">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir={dir} className="z-[120]">
                                      {DISCREPANCY_REASONS.map((r) => (
                                        <SelectItem key={r.value} value={r.value} className="text-[11px] cursor-pointer">
                                          {isRTL ? r.labelAr : r.labelEn}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogBody>

              <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 [&>button]:w-full sm:[&>button]:w-auto">
                <Button type="button" variant="outline" onClick={() => setDetailTake(null)} className="h-9 px-4 text-xs font-semibold">
                  {L('إغلاق', 'Close')}
                </Button>

                {detailTake.status !== 'posted' && (
                  <>
                    <Button type="button" variant="secondary" onClick={() => handleSaveProgress('in_progress')} disabled={updateMutation.isPending} className="h-9 px-4 text-xs font-semibold gap-1.5">
                      {L('حفظ المسودة', 'Save Draft')}
                    </Button>

                    <Button type="button" onClick={() => setPostConfirmTake(detailTake)} disabled={updateMutation.isPending} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm gap-1.5">
                      <CheckCircle2 className="size-4" />
                      {L('اعتماد وترحيل التسوية المحاسبية', 'Approve & Post Reconciliation')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* Sub-Dialog: Add Extra Product */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="sm:max-w-md w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader className="p-4 sm:p-6 pe-14 sm:pe-16 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">{L('إضافة صنف زائد غير موجود باللقطة', 'Add Extra Unrecorded Item')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="space-y-1.5 text-start">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{L('اختر المنتج المراد إضافته *', 'Select Product *')}</Label>
              <Select value={selectedAddProductId} onValueChange={setSelectedAddProductId}>
                <SelectTrigger dir={dir} className="h-10 border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950">
                  <SelectValue placeholder={L('اختر من قائمة المنتجات...', 'Select from product list...')} />
                </SelectTrigger>
                <SelectContent dir={dir} className="max-h-60 z-[120]">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {lang === 'en' ? p.nameEn || p.nameAr : p.nameAr || p.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 [&>button]:w-full sm:[&>button]:w-auto">
            <Button variant="outline" size="sm" onClick={() => setAddItemDialogOpen(false)} className="h-9 px-4 text-xs font-semibold">
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button size="sm" onClick={handleAddExtraProduct} disabled={!selectedAddProductId} className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
              {L('إضافة للجلسة', 'Add to Session')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* Pre-Post Reconciliation Financial Impact Confirmation Dialog */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!postConfirmTake} onOpenChange={(o) => !o && setPostConfirmTake(null)}>
        <DialogContent className="sm:max-w-lg w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader>
            <div className="flex items-start gap-3.5">
              <div className="size-11 sm:size-12 rounded-xl bg-blue-300/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <FileCheck className="size-5 sm:size-6 text-blue-600" />
              </div>
              <div className="space-y-1">
                <DialogTitle >{L('تاكيد ترحيل واعتماد التسوية المحاسبية', 'Confirm Reconcile & Post')}</DialogTitle>
                <DialogDescription >
                  {L(
                    `سيتم ترحيل الجلسة ${postConfirmTake?.code ?? ''} بشكل نهائي، وتحديث أرصدة المخزون وإنشاء القيد المحاسبي.`,
                    `Session ${postConfirmTake?.code ?? ''} will be posted permanently, updating stock balances and posting journal entries.`
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Impact Breakdown Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-start">
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">{L('الأصناف المطابقة 100%', 'Matched Items')}</span>
                <span className="text-lg font-bold text-emerald-600 num">{postCalculations.matchedCount}</span>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-start">
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">{L('الأصناف المنحرفة', 'Mismatched Items')}</span>
                <span className="text-lg font-bold text-amber-600 num">{postCalculations.totalMismatched}</span>
              </div>
            </div>

            {canViewCost && (
              <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 font-medium">{L('إجمالي قيم عجز المخزون (Shortage Expense):', 'Total Deficit Value:')}</span>
                  <span className="font-bold text-rose-600 num">-{formatCurrency(postCalculations.deficitVal)}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 font-medium">{L('إجمالي قيم فائض المخزون (Surplus Gain):', 'Total Surplus Value:')}</span>
                  <span className="font-bold text-blue-600 num">+{formatCurrency(postCalculations.surplusVal)}</span>
                </div>

                <div className="flex justify-between items-center pt-1 text-sm font-bold">
                  <span className="text-slate-900 dark:text-white">{L('صافي قيد تسوية الفروقات المحاسبية:', 'Net Journal Entry Impact:')}</span>
                  <span className={cn('num font-extrabold', postCalculations.netValue < 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(postCalculations.netValue)}</span>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldCheck className="size-4 shrink-0 mt-0.5" />
              <p>{L('ترحيل الجرد غير قابل للإلغاء أو التعديل، وسيتم تسجيل أثر التسوية في دفتر الحركة القياسية والأستاذ العام.', 'Posting is immutable and will write append-only stock moves and GL journal entries.')}</p>
            </div>
          </DialogBody>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 [&>button]:w-full sm:[&>button]:w-auto">
            <Button type="button" variant="outline" onClick={() => setPostConfirmTake(null)} className="h-9 px-4 text-xs font-semibold">
              {L('تراجع / تعديل', 'Back & Edit')}
            </Button>

            <Button type="button" onClick={executePost} disabled={updateMutation.isPending} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm gap-1.5">
              {updateMutation.isPending ? L('جاري الترحيل...', 'Posting...') : L('تأكيد الترحيل النهائي', 'Confirm & Post Reconcile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
// 