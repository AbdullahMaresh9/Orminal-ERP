'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import { exportRows, ExportColumn, ExportFormat, ExportMeta } from '@/lib/export'
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import React, { useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Lock,
  Unlock,
  Printer,
  RotateCcw,
  User,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Download,
  FileSpreadsheet,
  Check,
  X,
  Ban,
  ShieldCheck,
  ArrowRight,
  Layers,
  History,
  Copy,
  BarChart2,
  Grid,
  List,
  Columns as ColumnsIcon,
  Save,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'

// Types & Interfaces
interface CurrencyDenomination {
  id: string
  currencyId: string
  code: string
  nameAr: string
  nameEn?: string | null
  value: number
  sortOrder: number
  isSuspended: boolean
}

interface ExchangeRateHistory {
  id: string
  currencyId: string
  baseCurrencyId: string
  rate: number
  buyRate?: number | null
  sellRate?: number | null
  minLimit?: number | null
  maxLimit?: number | null
  rateDate: string
  effectiveDate: string
  rateType: string
  notes?: string | null
  baseCurrency?: {
    code: string
    nameAr: string
    symbol: string
  }
}

interface Currency {
  id: string
  code: string
  nameAr: string
  nameEn?: string | null
  symbol: string
  fractionNameAr?: string | null
  fractionNameEn?: string | null
  decimals: number
  exchangeRate: number
  buyRate?: number | null
  sellRate?: number | null
  minLimit?: number | null
  maxLimit?: number | null
  sortOrder: number
  isBase: boolean
  isInventory: boolean
  status: 'active' | 'suspended' | 'archived' | string
  active: boolean
  suspensionCount: number
  suspendedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  createdById?: string | null
  updatedById?: string | null
  _count?: {
    denominations: number
    exchangeRates: number
  }
  denominations?: CurrencyDenomination[]
  exchangeRates?: ExchangeRateHistory[]
}

interface Stats {
  total: number
  active: number
  suspended: number
  baseCurrency: { id: string; code: string; nameAr: string; symbol: string } | null
}

interface ColumnDef {
  id: string
  label: string
  visible: boolean
}

// Full Bilingual Dictionary for Column Headers
const COLUMN_LABELS: Record<string, { ar: string; en: string }> = {
  code: { ar: 'العملة', en: 'Currency' },
  nameAr: { ar: 'اسم العملة', en: 'Currency Name' },
  nameEn: { ar: 'الاسم الأساسي', en: 'Primary Name' },
  decimals: { ar: 'عدد الخانات', en: 'Decimals' },
  fractionNameAr: { ar: 'اسم الفكة', en: 'Fraction Name' },
  isBase: { ar: 'عملة أساسية', en: 'Base Currency' },
  isInventory: { ar: 'عملة مخزون', en: 'Inventory Currency' },
  exchangeRate: { ar: 'سعر التحويل', en: 'Exchange Rate' },
  minLimit: { ar: 'الحد الأدنى', en: 'Min Limit' },
  maxLimit: { ar: 'الحد الأعلى', en: 'Max Limit' },
  sellRate: { ar: 'سعر البيع', en: 'Sell Rate' },
  buyRate: { ar: 'سعر الشراء', en: 'Buy Rate' },
  sortOrder: { ar: 'الترتيب', en: 'Sort Order' },
  status: { ar: 'التوقيف', en: 'Status' },
  suspendedBy: { ar: 'المستخدم الموقف', en: 'Suspended By' },
  suspendedAt: { ar: 'تاريخ التوقيف', en: 'Suspension Date' },
  suspensionReason: { ar: 'سبب التوقيف', en: 'Suspension Reason' },
  suspensionCount: { ar: 'مرات التوقيف', en: 'Suspension Count' },
  createdBy: { ar: 'مدخل البيانات', en: 'Data Entry By' },
  entryStartDate: { ar: 'تاريخ بدء الإدخال', en: 'Entry Start Date' },
  createdAt: { ar: 'تاريخ الإدخال', en: 'Creation Date' },
  updatedBy: { ar: 'أخر معدل للبيانات', en: 'Last Updated By' },
  updatedAt: { ar: 'تاريخ أخر تعديل', en: 'Last Modified Date' },
  modificationCount: { ar: 'مرات التعديل', en: 'Modification Count' },
  printCount: { ar: 'مرات الطباعة', en: 'Print Count' },
}

const getColumnLabel = (colId: string, isRTL: boolean) => {
  const item = COLUMN_LABELS[colId]
  if (!item) return colId
  return isRTL ? item.ar : item.en
}

// 25 Available Columns requested by the user
const INITIAL_COLUMNS: ColumnDef[] = [
  { id: 'code', label: 'العملة', visible: true },
  { id: 'nameAr', label: 'اسم العملة', visible: true },
  { id: 'nameEn', label: 'الاسم الأساسي', visible: false },
  { id: 'decimals', label: 'عدد الخانات', visible: true },
  { id: 'fractionNameAr', label: 'اسم الفكة', visible: false },
  { id: 'isBase', label: 'عملة أساسية', visible: true },
  { id: 'isInventory', label: 'عملة مخزون', visible: true },
  { id: 'exchangeRate', label: 'سعر التحويل', visible: true },
  { id: 'minLimit', label: 'الحد الأدنى', visible: false },
  { id: 'maxLimit', label: 'الحد الأعلى', visible: false },
  { id: 'sellRate', label: 'سعر البيع', visible: false },
  { id: 'buyRate', label: 'سعر الشراء', visible: false },
  { id: 'sortOrder', label: 'الترتيب', visible: false },
  { id: 'status', label: 'التوقيف', visible: false },
  { id: 'suspendedBy', label: 'المستخدم الموقف', visible: false },
  { id: 'suspendedAt', label: 'تاريخ التوقيف', visible: false },
  { id: 'suspensionReason', label: 'سبب التوقيف', visible: false },
  { id: 'suspensionCount', label: 'مرات التوقيف', visible: true },
  { id: 'createdBy', label: 'مدخل البيانات', visible: true },
  { id: 'entryStartDate', label: 'تاريخ بدء الإدخال', visible: false },
  { id: 'createdAt', label: 'تاريخ الإدخال', visible: true },
  { id: 'updatedBy', label: 'أخر معدل للبيانات', visible: true },
  { id: 'updatedAt', label: 'تاريخ أخر تعديل', visible: true },
  { id: 'modificationCount', label: 'مرات التعديل', visible: false },
  { id: 'printCount', label: 'مرات الطباعة', visible: false },
]

export function CurrenciesModule({ embedded = false }: { embedded?: boolean }) {
  // Navigation & View State ('list' | 'add' | 'edit' | 'view')
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit' | 'view'>('list')
  const { t, locale } = useT()
  const isRTL = locale === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'
  // Data State
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    suspended: 0,
    baseCurrency: null,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null)

  // Column Selector State with localStorage Persistence
  const [columns, setColumns] = useState<ColumnDef[]>(INITIAL_COLUMNS)
  const [tempColumns, setTempColumns] = useState<ColumnDef[]>(INITIAL_COLUMNS)
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false)
  const columnsMenuRef = useRef<HTMLDivElement>(null)

  // Load saved column preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('orminal_currencies_columns')
      if (saved) {
        const parsed: ColumnDef[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = INITIAL_COLUMNS.map((initCol) => {
            const match = parsed.find((p) => p.id === initCol.id)
            return match ? { ...initCol, visible: match.visible } : initCol
          })
          setColumns(merged)
          setTempColumns(merged)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Close columns dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setIsColumnsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Save selected columns
  const handleApplyColumns = () => {
    setColumns(tempColumns)
    setIsColumnsMenuOpen(false)
    try {
      localStorage.setItem('orminal_currencies_columns', JSON.stringify(tempColumns))
      toast.success(isRTL ? 'تم تحديث الأعمدة بنجاح.' : 'The columns have been successfully updated.')
    } catch (e) {
      console.error(e)
    }
  }

  // Toggle all columns in temp selection
  const handleToggleAllColumns = (select: boolean) => {
    setTempColumns((prev) => prev.map((c) => ({ ...c, visible: select })))
  }

  // Active visible columns list
  const visibleColumns = useMemo(() => {
    return columns.filter((c) => c.visible)
  }, [columns])

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    nameAr: '',
    nameEn: '',
    symbol: '',
    fractionNameAr: '',
    fractionNameEn: '',
    decimals: 2,
    exchangeRate: 1.0,
    buyRate: '',
    sellRate: '',
    minLimit: '',
    maxLimit: '',
    sortOrder: 0,
    isBase: false,
    isInventory: false,
    status: 'active',
    notes: '',
  })

  // Sub-tabs State inside Add/Edit Form ('denominations' | 'exchangeRates')
  const [activeSubTab, setActiveSubTab] = useState<'denominations' | 'exchangeRates'>('denominations')

  // Denominations Sub-tab State
  const [denominations, setDenominations] = useState<CurrencyDenomination[]>([])
  const [denomSearch, setDenomSearch] = useState('')
  const [isAddDenomOpen, setIsAddDenomOpen] = useState(false)
  const [denomForm, setDenomForm] = useState({
    code: '',
    nameAr: '',
    value: '',
    sortOrder: 1,
    isSuspended: false,
  })

  // Exchange Rates History Sub-tab State
  const [ratesList, setRatesList] = useState<ExchangeRateHistory[]>([])
  const [rateSearch, setRateSearch] = useState('')
  const [isAddRateOpen, setIsAddRateOpen] = useState(false)
  const [rateForm, setRateForm] = useState({
    rate: '',
    buyRate: '',
    sellRate: '',
    minLimit: '',
    maxLimit: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [showKPIs, setShowKPIs] = useState(false)

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [currencyToDelete, setCurrencyToDelete] = useState<Currency | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

  // Fetch Currencies from API
  const fetchCurrencies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)

      const res = await fetch(`/api/erp/currencies?${params.toString()}`)
      const json = await res.json()

      if (json.data) {
        const items: Currency[] = json.data.items || []
        setCurrencies(items)
        setStats(
          json.data.stats || {
            total: items.length,
            active: items.filter((i) => i.status === 'active').length,
            suspended: items.filter((i) => i.status === 'suspended').length,
            baseCurrency: items.find((i) => i.isBase) || null,
          }
        )
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في جلب العملات' : 'Error fetching currencies'))
    } finally {
      setLoading(false)
    }
  }, [searchQuery, isRTL])

  useEffect(() => {
    fetchCurrencies()
  }, [fetchCurrencies])

  // Selected Currency Record
  const selectedCurrency = useMemo(() => {
    return currencies.find((c) => c.id === selectedCurrencyId) || null
  }, [currencies, selectedCurrencyId])

  // Fetch Denominations & Exchange Rates for active form record
  const fetchSubTabData = useCallback(async (currId: string) => {
    if (!currId) return
    try {
      // Fetch Denominations
      const resDenom = await fetch(`/api/erp/currencies/${currId}/denominations`)
      const jsonDenom = await resDenom.json()
      if (resDenom.ok && jsonDenom.data) {
        setDenominations(jsonDenom.data.denominations || [])
      }

      // Fetch Rates
      const resRates = await fetch(`/api/erp/currencies/${currId}/exchange-rates`)
      const jsonRates = await resRates.json()
      if (resRates.ok && jsonRates.data) {
        setRatesList(jsonRates.data.rates || [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Action: Open Add Form
  const handleOpenAdd = () => {
    setFormData({
      id: '',
      code: '',
      nameAr: '',
      nameEn: '',
      symbol: '',
      fractionNameAr: '',
      fractionNameEn: '',
      decimals: 2,
      exchangeRate: 1.0,
      buyRate: '',
      sellRate: '',
      minLimit: '',
      maxLimit: '',
      sortOrder: (currencies.length + 1) * 10,
      isBase: currencies.length === 0,
      isInventory: false,
      status: 'active',
      notes: '',
    })
    setDenominations([])
    setRatesList([])
    setActiveSubTab('denominations')
    setViewMode('add')
  }

  // Action: Open View or Edit Form
  const handleOpenForm = (curr: Currency, mode: 'view' | 'edit') => {
    setSelectedCurrencyId(curr.id)
    setFormData({
      id: curr.id,
      code: curr.code,
      nameAr: curr.nameAr,
      nameEn: curr.nameEn || '',
      symbol: curr.symbol,
      fractionNameAr: curr.fractionNameAr || '',
      fractionNameEn: curr.fractionNameEn || '',
      decimals: curr.decimals,
      exchangeRate: curr.exchangeRate,
      buyRate: curr.buyRate != null ? String(curr.buyRate) : '',
      sellRate: curr.sellRate != null ? String(curr.sellRate) : '',
      minLimit: curr.minLimit != null ? String(curr.minLimit) : '',
      maxLimit: curr.maxLimit != null ? String(curr.maxLimit) : '',
      sortOrder: curr.sortOrder,
      isBase: curr.isBase,
      isInventory: curr.isInventory,
      status: curr.status,
      notes: curr.notes || '',
    })
    fetchSubTabData(curr.id)
    setActiveSubTab('denominations')
    setViewMode(mode)
  }

  // Action: Save Currency Form
  const handleSave = async (andAddNew = false) => {
    if (!formData.code.trim() || !formData.nameAr.trim()) {
      toast.error(isRTL ? 'يرجى استكمال الحقول المطلوبة' : 'Please complete the required fields')
      return
    }

    setSubmitting(true)
    try {
      const isEdit = viewMode === 'edit' && formData.id
      const url = isEdit ? `/api/erp/currencies/${formData.id}` : '/api/erp/currencies'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          symbol: formData.symbol || formData.code,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        toast.success(
          isEdit
            ? isRTL ? `تم حفظ التعديلات للعملة (${formData.code}) بنجاح.` : `Edited currency (${formData.code}) successfully.`
            : isRTL ? `تم إضافة العملة (${formData.code}) بنجاح.` : `Added currency (${formData.code}) successfully.`
        )
        await fetchCurrencies()

        if (andAddNew) {
          handleOpenAdd()
        } else {
          const savedItem = json.data
          if (savedItem && savedItem.id) {
            handleOpenForm(savedItem, 'view')
          } else {
            setViewMode('list')
          }
        }
      } else {
        toast.error(json.error?.message || (isRTL ? 'حدث خطأ في النظام أثناء حفظ العملة' : 'An error occurred while saving the currency'))
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ في الاتصال بالخادم' : 'Error connecting to the server'))
    } finally {
      setSubmitting(false)
    }
  }

  // Action: Delete Selected Currency (Triggers custom confirmation dialog)
  const handleDeleteSelected = (curr?: Currency) => {
    const target = curr || selectedCurrency
    if (!target) {
      toast.error(isRTL ? 'يرجى تحديد عملة من القائمة أولاً.' : 'Please select a currency from the list first.')
      return
    }

    if (target.isBase) {
      toast.error(isRTL ? 'لا يمكن حذف العملة الأساسية للنظام.' : 'Cannot delete the base currency of the system.')
      return
    }

    setCurrencyToDelete(target)
    setDeleteErrorMessage(null)
    setDeleteConfirmOpen(true)
  }

  // Execute Actual Currency Deletion after Dialog Confirmation
  const confirmExecuteDelete = async () => {
    if (!currencyToDelete) return
    setDeleting(true)
    setDeleteErrorMessage(null)
    try {
      const res = await fetch(`/api/erp/currencies/${currencyToDelete.id}?lang=${isRTL ? 'ar' : 'en'}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (res.ok) {
        toast.success(isRTL ? 'تم حذف العملة بنجاح.' : 'The currency has been successfully deleted.')
        setSelectedCurrencyId(null)
        setCurrencyToDelete(null)
        setDeleteConfirmOpen(false)
        setDeleteErrorMessage(null)
        if (viewMode !== 'list') setViewMode('list')
        fetchCurrencies()
      } else {
        const errorMsg = json.error?.message || (isRTL ? 'تعذر حذف العملة لوجود معاملات مالية مرتبطة بها.' : 'Failed to delete the currency because it is linked to financial transactions.')
        toast.error(errorMsg)
        setDeleteConfirmOpen(false)
        setCurrencyToDelete(null)
      }
    } catch (err: any) {
      const fallbackMsg = err.message || (isRTL ? 'خطأ في عملية الحذف' : 'An error occurred while deleting the currency')
      toast.error(fallbackMsg)
      setDeleteConfirmOpen(false)
      setCurrencyToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  // Add Denomination handler
  const handleAddDenomination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id) {
      toast.error(isRTL ? 'يرجى حفظ العملة أولاً قبل إضافة الفئات.' : 'Please save the currency before adding denominations.')
      return
    }

    if (!denomForm.code.trim() || !denomForm.nameAr.trim() || !denomForm.value) {
      toast.error(isRTL ? 'يرجى استكمال بيانات الفئة (الرقم، اسم الفئة، والقيمة).' : 'Please fill in the denomination data (code, name in Arabic, and value).')
      return
    }

    try {
      const res = await fetch(`/api/erp/currencies/${formData.id}/denominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(denomForm),
      })
      const json = await res.json()

      if (res.ok) {
        toast.success(isRTL ? 'تم إضافة فئة العملة بنجاح.' : 'The denomination has been successfully added.')
        setDenominations((prev) => [...prev, json.data])
        setDenomForm({
          code: '',
          nameAr: '',
          value: '',
          sortOrder: denominations.length + 2,
          isSuspended: false,
        })
        setIsAddDenomOpen(false)
      } else {
        toast.error(json.error?.message || (isRTL ? 'تعذر إضافة الفئة' : 'Failed to add denomination'))
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ أثناء إضافة الفئة' : 'An error occurred while adding the denomination'))
    }
  }

  // Delete Denomination handler
  const handleDeleteDenomination = async (denId: string) => {
    if (!formData.id) return
    try {
      const res = await fetch(`/api/erp/currencies/${formData.id}/denominations/${denId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDenominations((prev) => prev.filter((d) => d.id !== denId))
        toast.success(isRTL ? 'تم حذف فئة العملة.' : 'The denomination has been successfully deleted.')
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Add Historical Exchange Rate handler
  const handleAddExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id) return
    if (!rateForm.rate || Number(rateForm.rate) <= 0) {
      toast.error(isRTL ? 'يرجى إدخال سعر تحويل صحيح أكبر من الصفر.' : 'Please enter a valid exchange rate greater than zero.')
      return
    }

    try {
      const res = await fetch(`/api/erp/currencies/${formData.id}/exchange-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateForm),
      })
      const json = await res.json()

      if (res.ok) {
        toast.success(isRTL ? 'تم تسجيل سعر الصرف الجديد وتحديث سعر العملة.' : 'The exchange rate has been successfully updated.')
        setRatesList((prev) => [json.data, ...prev])
        setFormData((prev) => ({ ...prev, exchangeRate: Number(rateForm.rate) }))
        setIsAddRateOpen(false)
        fetchCurrencies()
      } else {
        toast.error(json.error?.message || (isRTL ? 'فشل تحديث سعر الصرف' : 'Failed to update exchange rate'))
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'خطأ أثناء تسجيل سعر الصرف' : 'An error occurred while recording the exchange rate'))
    }
  }

  // Navigation across records inside Form View
  const currentRecordIndex = useMemo(() => {
    return currencies.findIndex((c) => c.id === formData.id)
  }, [currencies, formData.id])

  const handleNavigateRecord = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (currencies.length === 0) return
    let newIndex = 0
    if (direction === 'first') newIndex = 0
    else if (direction === 'prev') newIndex = Math.max(0, currentRecordIndex - 1)
    else if (direction === 'next') newIndex = Math.min(currencies.length - 1, currentRecordIndex + 1)
    else if (direction === 'last') newIndex = currencies.length - 1

    const target = currencies[newIndex]
    if (target) {
      handleOpenForm(target, viewMode === 'edit' ? 'edit' : 'view')
    }
  }

  // Filtered Denominations for sub-tab
  const filteredDenominations = useMemo(() => {
    if (!denomSearch) return denominations
    return denominations.filter(
      (d) =>
        d.code.toLowerCase().includes(denomSearch.toLowerCase()) ||
        d.nameAr.includes(denomSearch) ||
        (d.nameEn && d.nameEn.toLowerCase().includes(denomSearch.toLowerCase())) ||
        String(d.value).includes(denomSearch)
    )
  }, [denominations, denomSearch])

  // Filtered Exchange Rates for sub-tab
  const filteredRates = useMemo(() => {
    if (!rateSearch) return ratesList
    return ratesList.filter(
      (r) =>
        String(r.rate).includes(rateSearch) ||
        (r.notes && r.notes.includes(rateSearch))
    )
  }, [ratesList, rateSearch])

  // Cell Value Renderer for Table Columns (Supports Bilingual AR/EN data display)
  const renderCellContent = (curr: Currency, colId: string) => {
    switch (colId) {
      case 'code':
        return <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{curr.code}</span>
      case 'nameAr':
        // Display English name if system language is English & nameEn is provided
        return (
          <span className="text-slate-800 dark:text-slate-200">
            {!isRTL && curr.nameEn ? curr.nameEn : curr.nameAr}
          </span>
        )
      case 'nameEn':
        return <span className="font-mono text-slate-500 dark:text-slate-400">{curr.nameEn || '-'}</span>
      case 'decimals':
        return <span className="font-mono text-center block text-slate-800 dark:text-slate-300">{curr.decimals}</span>
      case 'fractionNameAr':
        return (
          <span className="text-slate-800 dark:text-slate-300">
            {!isRTL && curr.fractionNameEn ? curr.fractionNameEn : (curr.fractionNameAr || '-')}
          </span>
        )
      case 'isBase':
        return curr.isBase ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto stroke-[3]" /> : '-'
      case 'isInventory':
        return curr.isInventory ? <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto stroke-[3]" /> : '-'
      case 'exchangeRate':
        return <span className="font-mono font-semibold block text-center text-slate-800 dark:text-slate-200">{curr.exchangeRate}</span>
      case 'minLimit':
        return <span className="font-mono text-center block text-slate-800 dark:text-slate-300">{curr.minLimit ?? '-'}</span>
      case 'maxLimit':
        return <span className="font-mono text-center block text-slate-800 dark:text-slate-300">{curr.maxLimit ?? '-'}</span>
      case 'sellRate':
        return <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold block text-center">{curr.sellRate ?? '-'}</span>
      case 'buyRate':
        return <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold block text-center">{curr.buyRate ?? '-'}</span>
      case 'sortOrder':
        return <span className="font-mono text-center block text-slate-800 dark:text-slate-300">{curr.sortOrder}</span>
      case 'status':
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${curr.status === 'active'
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
          >
            {curr.status === 'active' ? (isRTL ? 'نشطة' : 'Active') : (isRTL ? 'موقوفة' : 'Suspended')}
          </span>
        )
      case 'suspendedBy':
        return <span className="text-slate-800 dark:text-slate-300">{curr.status === 'suspended' ? (isRTL ? 'مدير النظام' : 'System Admin') : '-'}</span>
      case 'suspendedAt':
        return (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {curr.suspendedAt ? new Date(curr.suspendedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB') : '-'}
          </span>
        )
      case 'suspensionReason':
        return <span className="text-slate-800 dark:text-slate-300">{curr.status === 'suspended' ? (isRTL ? 'توقيف إداري' : 'Administrative Suspension') : '-'}</span>
      case 'suspensionCount':
        return <span className="font-mono text-center block text-slate-600 dark:text-slate-400">{curr.suspensionCount || 0}</span>
      case 'createdBy':
        return <span className="text-center block text-slate-600 dark:text-slate-400">1</span>
      case 'entryStartDate':
        return (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {new Date(curr.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}
          </span>
        )
      case 'createdAt':
        return (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {new Date(curr.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}
          </span>
        )
      case 'updatedBy':
        return <span className="text-center block text-slate-600 dark:text-slate-400">1</span>
      case 'updatedAt':
        return (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {new Date(curr.updatedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}
          </span>
        )
      case 'modificationCount':
        return <span className="font-mono text-center block text-slate-500 dark:text-slate-400">1</span>
      case 'printCount':
        return <span className="font-mono text-center block text-slate-500 dark:text-slate-400">0</span>
      default:
        return '-'
    }
  }

  // =========================================================================
  // RENDER 1: MAIN CURRENCIES LIST SCREEN
  // =========================================================================
  if (viewMode === 'list') {
    return (
      <div className={`space-y-3 font-sans text-slate-800 dark:text-slate-100 ${embedded ? '' : 'p-3 md:p-5'}`} dir={dir}>
        {/* Top Blue Breadcrumb Title Bar */}
        <div className="bg-primary dark:bg-blue-600/90 border-b border-blue-100 dark:border-blue-700/50 text-white px-4 py-2.5 rounded-t-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{isRTL ? "الرئيسية" : "Home"}</span>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-white/70" /> : <ChevronRight className="w-4 h-4 text-white/70" />}
            <span>{isRTL ? "العملات" : "Currencies"}</span>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-white/70" /> : <ChevronRight className="w-4 h-4 text-white/70" />}
            <span className="text-white/90 font-normal">{isRTL ? "الكل" : "All"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKPIs(!showKPIs)}
              className="p-1 rounded bg-white/10 hover:bg-white/30 border border-slate-400/40 text-white hover:text-white transition-colors"
              title={isRTL ? "عرض الإحصائيات" : "Statistics"}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button className="p-1 rounded bg-white/10 hover:bg-white/30 border border-slate-400/40 text-white hover:text-white transition-colors">
              <Grid className="w-4 h-4" />
            </button>
            <button className="p-1 rounded bg-white/10 hover:bg-white/30 border border-slate-400/40 text-white hover:text-white transition-colors">
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional KPI Cards Bar */}
        {showKPIs && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-100 dark:bg-slate-900/80 p-3 rounded-md border border-slate-200 dark:border-slate-800">
            <div className="bg-white dark:bg-slate-800/90 p-3 rounded border border-slate-200 dark:border-slate-700/80 text-center shadow-xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isRTL ? 'إجمالي العملات' : 'Total Currencies'}</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-800/90 p-3 rounded border border-slate-200 dark:border-slate-700/80 text-center shadow-xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isRTL ? 'العملة الأساسية' : 'Base Currency'}</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.baseCurrency ? stats.baseCurrency.code : isRTL ? 'غير محددة' : 'Not Selected'}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800/90 p-3 rounded border border-slate-200 dark:border-slate-700/80 text-center shadow-xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isRTL ? 'العملات النشطة' : 'Active Currencies'}</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.active}</p>
            </div>
            <div className="bg-white dark:bg-slate-800/90 p-3 rounded border border-slate-200 dark:border-slate-700/80 text-center shadow-xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isRTL ? 'العملات الموقوفة' : 'Suspended Currencies'}</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.suspended}</p>
            </div>
          </div>
        )}

        {/* Column Grouping Sub-header */}
        <div className="bg-[#f4f5f8] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-sm text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
          <span>{isRTL ? "اسحب العمود هنا لتجميع العمود الخاص به" : "Drag a column header here to group by that column"}</span>
        </div>

        {/* Main Toolbar Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          {/* Left Side: Columns Selector Dropdown & Search Input */}
          <div className="flex items-center gap-2 w-full sm:w-auto relative" ref={columnsMenuRef}>
            {/* Columns Dropdown Trigger Button */}
            <button
              onClick={() => {
                setTempColumns(columns)
                setIsColumnsMenuOpen(!isColumnsMenuOpen)
              }}
              className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 font-medium shadow-2xs transition-colors"
            >
              <ColumnsIcon className="w-3.5 h-3.5 text-[#2b529a] dark:text-blue-400" />
              <span>{isRTL ? 'أعمدة' : 'Columns'}</span>
              <span className="text-[10px]">▼</span>
            </button>

            {/* Columns Customization Dropdown Menu Popover */}
            {isColumnsMenuOpen && (
              <div className={`absolute top-full ${isRTL ? 'right-0' : 'left-0'} mt-1.5 w-54 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-xl z-50 p-3 text-xs animate-in fade-in duration-150`}>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 mb-2 font-bold text-slate-800 dark:text-slate-100">
                  <span className="flex items-center gap-1.5">
                    <ColumnsIcon className="w-4 h-4 text-[#2b529a] dark:text-blue-400" />
                    {isRTL ? 'أعمدة الجدول' : 'Table Columns'}
                  </span>
                  <button
                    onClick={() => setIsColumnsMenuOpen(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2 text-[12px]">
                  <button
                    onClick={() => handleToggleAllColumns(true)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded border border-slate-300 dark:border-slate-600 transition-colors"
                  >
                    {isRTL ? 'تحديد الكل' : 'Select All'}
                  </button>
                  <button
                    onClick={() => handleToggleAllColumns(false)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded border border-slate-300 dark:border-slate-600 transition-colors"
                  >
                    {isRTL ? 'إلغاء الكل' : 'Deselect All'}
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 p-2 rounded bg-slate-50/50 dark:bg-slate-900/60">
                  {tempColumns.map((col) => (
                    <label
                      key={col.id}
                      className="flex text-[13px] items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setTempColumns((prev) =>
                            prev.map((c) => (c.id === col.id ? { ...c, visible: checked } : c))
                          )
                        }}
                        className="w-4 h-4 rounded text-[#2b529a] dark:text-blue-500 border-slate-300 dark:border-slate-600 focus:ring-[#2b529a] dark:bg-slate-800"
                      />
                      <span className="text-slate-700 dark:text-slate-200 font-medium">
                        {getColumnLabel(col.id, isRTL)}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-2.5 mt-2.5">
                  <button
                    onClick={() => setIsColumnsMenuOpen(false)}
                    className="px-3 py-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded border border-slate-300 dark:border-slate-600 font-medium transition-colors"
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleApplyColumns}
                    className="px-4 py-1 text-white bg-[#2b529a] dark:bg-blue-600 hover:bg-[#23437e] dark:hover:bg-blue-700 rounded font-bold shadow-xs flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'موافق' : 'OK'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-400`} />
              <input
                type="text"
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1 text-xs border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500`}
              />
            </div>
          </div>

          {/* Right Side: Action Icons Toolbar */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end overflow-x-auto">
            {/* Refresh */}
            <button
              onClick={fetchCurrencies}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-[#2b529a] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title={isRTL ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title={isRTL ? 'طباعة' : 'Print'}
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Excel Export */}
            <button
              onClick={() => toast.success(isRTL ? 'تم تصدير ملف اكسل بنجاح' : 'Exported to Excel successfully')}
              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
              title={isRTL ? 'تصدير' : 'Export'}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>

            <span className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* View selected */}
            <button
              onClick={() => selectedCurrency && handleOpenForm(selectedCurrency, 'view')}
              disabled={!selectedCurrency}
              className={`p-1.5 rounded transition-colors ${selectedCurrency
                ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                }`}
              title={isRTL ? 'عرض التفاصيل' : 'View Details'}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Edit selected */}
            <button
              onClick={() => selectedCurrency && handleOpenForm(selectedCurrency, 'edit')}
              disabled={!selectedCurrency}
              className={`p-1.5 rounded transition-colors ${selectedCurrency
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                }`}
              title={isRTL ? 'تعديل العملة' : 'Edit Currency'}
            >
              <Edit className="w-4 h-4" />
            </button>

            {/* Delete selected */}
            <button
              onClick={() => handleDeleteSelected()}
              disabled={!selectedCurrency}
              className={`p-1.5 rounded transition-colors ${selectedCurrency && !selectedCurrency.isBase
                ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                }`}
              title={isRTL ? 'حذف العملة' : 'Delete Currency'}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Add New Currency Button */}
            <button
              onClick={handleOpenAdd}
              className="p-1.5 text-white bg-primary dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 rounded shadow-xs transition-all flex items-center gap-1 px-2.5 font-semibold text-xs ml-1"
              title={isRTL ? 'إضافة عملة' : 'Add Currency'}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">{isRTL ? 'إضافة' : 'Add'}</span>
            </button>
          </div>
        </div>

        {/* Data Table Container with Fully Localized Bilingual Headers & Cells */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs border-collapse`}>
              <thead>
                <tr className="bg-[#f1f3f7] dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-bold">
                  <th className="py-2.5 px-3 border-r border-l border-slate-200 dark:border-slate-700/80 text-center w-10">
                    {isRTL ? '#' : 'NO'}
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="py-2.5 px-3 border-r border-l border-slate-200 dark:border-slate-700/80 whitespace-nowrap">
                      {getColumnLabel(col.id, isRTL)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#2b529a] dark:text-blue-400" />
                        <span>{isRTL ? 'جاري تحميل البيانات...' : 'Loading Data...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : currencies.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      {isRTL ? 'لا توجد عملات مسجلة' : 'No Currencies Found'}
                    </td>
                  </tr>
                ) : (
                  currencies.map((curr, idx) => {
                    const isSelected = selectedCurrencyId === curr.id
                    return (
                      <tr
                        key={curr.id}
                        onClick={() => setSelectedCurrencyId(curr.id)}
                        onDoubleClick={() => handleOpenForm(curr, 'view')}
                        className={`cursor-pointer transition-colors ${isSelected
                          ? 'bg-[#d9e2f3] dark:bg-blue-900/60 text-slate-900 dark:text-slate-100 font-semibold border-y border-blue-400 dark:border-blue-500'
                          : idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                          }`}
                      >
                        <td className="py-2.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-500 dark:text-slate-400">
                          {idx + 1}
                        </td>
                        {visibleColumns.map((col) => (
                          <td key={col.id} className="py-2.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
                            {renderCellContent(curr, col.id)}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination Bar */}
          <div className="bg-[#f8f9fa] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>
                {isRTL
                  ? `1 من 1 صفحة العناصر ${currencies.length}`
                  : `1 of 1 Page ${currencies.length}`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span>{isRTL ? 'العناصر في كل صفحة' : 'Items per page'}</span>
                <select className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded text-xs focus:outline-none">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 dir-ltr">
                <button className="p-1 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40" disabled>
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button className="p-1 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40" disabled>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 py-0.5 bg-[#2b529a] dark:bg-blue-600 text-white rounded text-xs font-bold">1</span>
                <button className="p-1 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40" disabled>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="p-1 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40" disabled>
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Confirmation Dialog for Delete Currency */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 p-0 overflow-hidden shadow-2xl rounded-lg">
            <div className="bg-rose-50 dark:bg-rose-950/40 p-4 border-b border-rose-100 dark:border-rose-900/50 flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-rose-900 dark:text-rose-200">
                  {isRTL ? 'تأكيد حذف العملة' : 'Confirm Currency Deletion'}
                </DialogTitle>
                <DialogDescription className="text-xs text-rose-700/80 dark:text-rose-400 mt-0.5">
                  {isRTL ? 'هذا الإجراء سيؤدي إلى حذف العملة  نهائياً.' : 'This action will permanently delete the currency.'}
                </DialogDescription>
              </div>
            </div>

            <div className="p-5 text-xs text-slate-700 dark:text-slate-300 space-y-3">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {isRTL ? 'هل أنت متأكد من حذف العملة التالية؟' : 'Are you sure to delete the following currency?'}
              </p>

              {currencyToDelete && (
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-md border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#2b529a] dark:bg-blue-600 text-white font-mono font-bold rounded text-xs">
                      {currencyToDelete.code}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {isRTL ? currencyToDelete.nameAr : (currencyToDelete.nameEn || currencyToDelete.nameAr)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {isRTL ? `سعر التحويل: ${currencyToDelete.exchangeRate}` : `Rate: ${currencyToDelete.exchangeRate}`}
                  </span>
                </div>
              )}

              {deleteErrorMessage ? (
                <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 p-3 rounded-md border border-rose-200 dark:border-rose-900/80 flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">{isRTL ? 'تعذر حذف العملة لوجود معاملات مالية مرتبطة بها ' : 'currency deletion is not allowed because there are financial transactions related to it'}</p>
                    <p className="leading-relaxed">{deleteErrorMessage}</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {isRTL
                      ? 'ملاحظة: لن يمكنك إتمام العملية إذا كانت هناك معاملات مالية أو أسعار صرف مرتبطة بهذه العملة.'
                      : 'Note: You cannot delete this currency if it is linked to active financial transactions or rates.'}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="bg-slate-50 dark:bg-slate-900/90 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={confirmExecuteDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-xs flex items-center gap-1.5"
              >
                {deleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // =========================================================================
  // RENDER 2: ADD / EDIT / VIEW CURRENCY FORM SCREEN
  // =========================================================================
  const isViewOnly = viewMode === 'view'
  const isEditing = viewMode === 'edit'
  const isAdding = viewMode === 'add'

  return (
    <div className={`space-y-3 font-sans text-slate-800 dark:text-slate-100 ${embedded ? '' : 'p-3 md:p-5'}`} dir={dir}>
      {/* Top Navigation & Action Dropdowns Bar */}
      <div className="bg-primary dark:bg-blue-600/90 border-b border-blue-100 dark:border-blue-700/50 text-white px-4 py-2.5 rounded-t-md flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium">
          {/* Back to List */}
          <button
            onClick={() => setViewMode('list')}
            className="hover:underline flex items-center gap-1 font-semibold text-white"
          >
            <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
          </button>
          {isRTL ? <ChevronLeft className="w-3.5 h-3.5 text-white/70" /> : <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
          <button onClick={() => setViewMode('list')} className="hover:underline font-semibold text-white">
            <span>{isRTL ? 'العملات' : 'Currencies'}</span>
          </button>
          {isRTL ? <ChevronLeft className="w-3.5 h-3.5 text-white/70" /> : <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
          <span className="text-white/90">
            {isRTL
              ? isAdding
                ? 'إضافة عملة'
                : isEditing
                  ? 'تعديل عملة'
                  : 'عرض عملة'
              : isAdding
                ? 'Add Currency'
                : isEditing
                  ? 'Edit Currency'
                  : 'View Currency'}
          </span>
        </div>

        {/* Record Navigation Controls (<< < [ 1 ] > >>) */}
        {!isAdding && currencies.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-white bg-white/10 px-2 py-1 rounded text-xs">
              <button
                onClick={() => handleNavigateRecord('first')}
                className="hover:text-amber-300 p-0.5 transition-colors"
                title={isRTL ? 'الأول' : 'First'}
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleNavigateRecord('prev')}
                className="hover:text-amber-300 p-0.5 transition-colors"
                title={isRTL ? 'السابق' : 'Previous'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono px-1">
                {currentRecordIndex + 1} / {currencies.length}
              </span>
              <button
                onClick={() => handleNavigateRecord('next')}
                className="hover:text-amber-300 p-0.5 transition-colors"
                title={isRTL ? 'التالي' : 'Next'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleNavigateRecord('last')}
                className="hover:text-amber-300 p-0.5 transition-colors"
                title={isRTL ? 'الأخير' : 'Last'}
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            {isViewOnly ? <Lock className="w-4 h-4 text-amber-300" /> : <Unlock className="w-4 h-4 text-emerald-300" />}
          </div>
        )}
      </div>

      {/* Sub-Header Dropdown Menus */}
      <div className="bg-[#f4f5f8] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-sm flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          {formData.code ? (isRTL ? `كود العملة: ${formData.code}` : `Currency Code: ${formData.code}`) : ''}
        </div>
      </div>

      {/* Form Main Layout with Left Action Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Main Form Content Grid */}
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Column 1: Currency Code & Name */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'العملة' : 'Currency'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'رمز/كود العملة (SAR, YER, USD)' : 'Currency Code (SAR, YER, USD)'}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono uppercase bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'اسم الفكة' : 'Fraction Name'}
                </label>
                <input
                  type="text"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'مثال: هللة, فلس, سنت' : 'Example: Halala, Fils, Cent'}
                  value={formData.fractionNameAr}
                  onChange={(e) => setFormData({ ...formData, fractionNameAr: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'الحد الأعلى' : 'Maximum Limit'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'الحد الأعلى لسعر الصرف' : 'Maximum Limit of Exchange Rate'}
                  value={formData.maxLimit}
                  onChange={(e) => setFormData({ ...formData, maxLimit: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'الترتيب' : 'Sort Order'}
                </label>
                <input
                  type="number"
                  disabled={isViewOnly}
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono text-center bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Column 2: Arabic Name & Decimals & Buy Rate */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'اسم العملة' : 'Currency Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'مثال: الريال السعودي' : 'Example: Saudi Riyal'}
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'عدد الخانات' : 'Number of Decimals'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  disabled={isViewOnly}
                  value={formData.decimals}
                  onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) || 2 })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono text-center bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'سعر الشراء' : 'Buy Rate'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'سعر شراء العملة' : 'Buy Rate'}
                  value={formData.buyRate}
                  onChange={(e) => setFormData({ ...formData, buyRate: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              {/* Base Currency Checkbox */}
              <div className="pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isViewOnly}
                    checked={formData.isBase}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isBase: e.target.checked,
                        exchangeRate: e.target.checked ? 1.0 : formData.exchangeRate,
                      })
                    }
                    className="w-4 h-4 text-[#2b529a] dark:text-blue-500 rounded border-slate-300 dark:border-slate-600 focus:ring-[#2b529a] dark:bg-slate-800"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {isRTL ? 'عملة أساسية' : 'Base Currency'}
                  </span>
                </label>
              </div>
            </div>

            {/* Column 3: English Name & Min Limit & Sell Rate */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'اسم العملة (إنجليزي)' : 'Currency Name (English)'}
                </label>
                <input
                  type="text"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'مثال: Saudi Riyal' : 'Example: Saudi Riyal'}
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'الحد الأدنى' : 'Minimum Limit'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'الحد الأدنى لسعر الصرف' : 'Minimum Exchange Rate'}
                  value={formData.minLimit}
                  onChange={(e) => setFormData({ ...formData, minLimit: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'سعر البيع' : 'Sell Rate'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  disabled={isViewOnly}
                  placeholder={isRTL ? 'سعر بيع العملة' : 'Sell Rate'}
                  value={formData.sellRate}
                  onChange={(e) => setFormData({ ...formData, sellRate: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Column 4: Direct Exchange Rate & Inventory Checkbox */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  {isRTL ? 'سعر التحويل' : 'Exchange Rate'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  disabled={isViewOnly || formData.isBase}
                  value={formData.isBase ? 1.0 : formData.exchangeRate}
                  onChange={(e) =>
                    setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1.0 })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400 font-mono font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              {/* Inventory Currency Checkbox */}
              <div className="pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isViewOnly}
                    checked={formData.isInventory}
                    onChange={(e) => setFormData({ ...formData, isInventory: e.target.checked })}
                    className="w-4 h-4 text-[#2b529a] dark:text-blue-500 rounded border-slate-300 dark:border-slate-600 focus:ring-[#2b529a] dark:bg-slate-800"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {isRTL ? 'عملة مخزون' : 'Inventory Currency'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Sub-Tab Navigation Header Bar */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveSubTab('denominations')}
                className={`px-4 py-2 text-xs font-bold rounded-t-md transition-colors flex items-center gap-1.5 ${activeSubTab === 'denominations'
                  ? 'bg-[#2b529a] dark:bg-blue-600 text-white border-t border-x border-slate-300 dark:border-blue-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="text-xs">{isRTL ? 'فئات العملة' : 'Denominations'}</span>
              </button>

              {/* CRITICAL BUSINESS RULE: Only show "تغيير أسعار العملة" tab if currency is NOT Base Currency (!isBase) */}
              {!formData.isBase && (
                <button
                  onClick={() => setActiveSubTab('exchangeRates')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-md transition-colors flex items-center gap-1.5 ${activeSubTab === 'exchangeRates'
                    ? 'bg-[#2b529a] dark:bg-blue-600 text-white border-t border-x border-slate-300 dark:border-blue-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'تغيير أسعار العملة' : 'Exchange Rates History'}</span>
                </button>
              )}
            </div>

            {/* Sub-Tab Content 1: Denominations (فئات العملة) */}
            {activeSubTab === 'denominations' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-md space-y-3">
                {/* Sub-toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-400`} />
                    <input
                      type="text"
                      placeholder={isRTL ? 'بحث...' : 'Search...'}
                      value={denomSearch}
                      onChange={(e) => setDenomSearch(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400`}
                    />
                  </div>

                  {!isViewOnly && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsAddDenomOpen(true)}
                        className="p-1 bg-blue-600 dark:bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
                        title={isRTL ? 'إضافة فئة عملة' : 'Add Denomination'}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toast.success(isRTL ? 'تم التصدير بنجاح' : 'Exported successfully')}
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                        title={isRTL ? 'تصدير' : 'Export'}
                      >
                        <FileSpreadsheet className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Form to Add Denomination */}
                {isAddDenomOpen && (
                  <form onSubmit={handleAddDenomination} className="p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/60 rounded text-xs space-y-2">
                    <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">{isRTL ? 'إضافة فئة جديدة' : 'Add Denomination'}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        required
                        placeholder={isRTL ? 'الكود *' : 'Code *'}
                        value={denomForm.code}
                        onChange={(e) => setDenomForm({ ...denomForm, code: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                      <input
                        type="text"
                        required
                        placeholder={isRTL ? 'اسم الفئة *' : 'Category *'}
                        value={denomForm.nameAr}
                        onChange={(e) => setDenomForm({ ...denomForm, nameAr: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded"
                      />
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder={isRTL ? 'القيمة *' : 'Value *'}
                        value={denomForm.value}
                        onChange={(e) => setDenomForm({ ...denomForm, value: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="px-3 py-1 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors"
                        >
                          {isRTL ? 'حفظ' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddDenomOpen(false)}
                          className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Denominations Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
                  <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
                    <thead>
                      <tr className="bg-[#f1f3f7] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                        <th className="py-1.5 px-2 border-r border-l border-slate-200 dark:border-slate-700 text-center w-8">{isRTL ? 'م' : 'NO'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700">{isRTL ? 'الكود' : 'Code'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700">{isRTL ? 'اسم الفئة' : 'Category'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'القيمة' : 'Value'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'الترتيب' : 'Sort Order'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'التوقيف' : 'Status'}</th>
                        {!isViewOnly && <th className="py-1.5 px-2 text-center">{isRTL ? 'حذف' : 'Delete'}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDenominations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 dark:text-slate-500">
                            {isRTL ? 'لا توجد فئات عملة مسجلة لهذه العملة بعد.' : 'No denominations registered for this currency yet.'}
                          </td>
                        </tr>
                      ) : (
                        filteredDenominations.map((d, idx) => (
                          <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-1.5 px-2 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                              {d.code}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200">
                              {!isRTL && d.nameEn ? d.nameEn : d.nameAr}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {d.value}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-600 dark:text-slate-400">
                              {d.sortOrder}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center">
                              {d.isSuspended ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">{isRTL ? 'موقوفة' : 'Suspended'}</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{isRTL ? 'نشطة' : 'Active'}</span>
                              )}
                            </td>
                            {!isViewOnly && (
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  onClick={() => handleDeleteDenomination(d.id)}
                                  className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isRTL ? `عرض 1 إلى ${filteredDenominations.length} من ${filteredDenominations.length} المدخلات` : `Showing 1 to ${filteredDenominations.length} of ${filteredDenominations.length} Entries`}
                </div>
              </div>
            )}

            {/* Sub-Tab Content 2: Exchange Rates History (تغيير أسعار العملة) */}
            {activeSubTab === 'exchangeRates' && !formData.isBase && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-md space-y-3">
                {/* Sub-toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-400`} />
                    <input
                      type="text"
                      placeholder={isRTL ? 'بحث...' : 'Search...'}
                      value={rateSearch}
                      onChange={(e) => setRateSearch(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#2b529a] dark:focus:border-blue-400`}
                    />
                  </div>

                  {!isViewOnly && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsAddRateOpen(true)}
                        className="p-1 bg-[#2b529a] dark:bg-blue-600 text-white rounded hover:bg-[#23437e] dark:hover:bg-blue-500 transition-colors flex items-center gap-1 px-2 text-xs font-bold"
                        title={isRTL ? 'إضافة سعر صرف جديد' : 'Add New Rate'}
                      >
                        <Plus className="w-4.5 h-5" />
                        <span>{isRTL ? 'تسجيل سعر جديد' : 'Add New Rate'}</span>
                      </button>
                      <button
                        onClick={() => toast.success(isRTL ? 'تم التصدير بنجاح' : 'Exported successfully')}
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                        title={isRTL ? 'تصدير' : 'Export'}
                      >
                        <FileSpreadsheet className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Form to Add Historical Exchange Rate */}
                {isAddRateOpen && (
                  <form onSubmit={handleAddExchangeRate} className="p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/60 rounded text-xs space-y-2">
                    <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">{isRTL ? 'تسجيل سعر صرف تاريخي جديد' : 'Add Historical Exchange Rate'}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        required
                        placeholder={isRTL ? 'سعر التحويل *' : 'Exchange Rate *'}
                        value={rateForm.rate}
                        onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono font-bold"
                      />
                      <input
                        type="number"
                        step="0.001"
                        placeholder={isRTL ? 'الحد الأدنى' : 'Min Limit'}
                        value={rateForm.minLimit}
                        onChange={(e) => setRateForm({ ...rateForm, minLimit: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                      <input
                        type="number"
                        step="0.001"
                        placeholder={isRTL ? 'الحد الأعلى' : 'Max Limit'}
                        value={rateForm.maxLimit}
                        onChange={(e) => setRateForm({ ...rateForm, maxLimit: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                      <input
                        type="number"
                        step="0.001"
                        placeholder={isRTL ? 'سعر البيع' : 'Sell Rate'}
                        value={rateForm.sellRate}
                        onChange={(e) => setRateForm({ ...rateForm, sellRate: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                      <input
                        type="number"
                        step="0.001"
                        placeholder={isRTL ? 'سعر الشراء' : 'Buy Rate'}
                        value={rateForm.buyRate}
                        onChange={(e) => setRateForm({ ...rateForm, buyRate: e.target.value })}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddRateOpen(false)}
                        className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 bg-[#2b529a] dark:bg-blue-600 text-white rounded font-bold hover:bg-[#23437e] dark:hover:bg-blue-500 transition-colors"
                      >
                        {isRTL ? 'حفظ السعر' : 'Save Rate'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Exchange Rates History Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
                  <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} text-xs`}>
                    <thead>
                      <tr className="bg-[#f1f3f7] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                        <th className="py-1.5 px-2 border-r border-l border-slate-200 dark:border-slate-700 text-center w-8">#</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'سعر التحويل' : 'Exchange Rate'} *</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'الحد الأدنى' : 'Minimum Limit'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'الحد الأعلى' : 'Maximum Limit'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'سعر البيع' : 'Sell Rate'}</th>
                        <th className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-700 text-center">{isRTL ? 'سعر الشراء' : 'Buy Rate'}</th>
                        <th className="py-1.5 px-3 text-center">{isRTL ? 'تاريخ السريان' : 'Effective Date'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredRates.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                            {isRTL ? 'لا يوجد سجل أسعار صرف مسجلة لهذه العملة' : 'No exchange rates recorded for this currency'}
                          </td>
                        </tr>
                      ) : (
                        filteredRates.map((r, idx) => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-1.5 px-2 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                              {r.rate}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-600 dark:text-slate-400">
                              {r.minLimit ?? '-'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-slate-600 dark:text-slate-400">
                              {r.maxLimit ?? '-'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">
                              {r.sellRate ?? '-'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-l border-slate-200 dark:border-slate-800 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              {r.buyRate ?? '-'}
                            </td>
                            <td className="py-1.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                              {new Date(r.effectiveDate || r.rateDate).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isRTL ? `عرض 1 إلى ${filteredRates.length} من ${filteredRates.length} المدخلات` : `Displaying ${filteredRates.length} of ${filteredRates.length} records`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Left Side Vertical Action Buttons Bar */}
        <div className="flex md:flex-col gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-sm justify-center md:justify-start">
          {/* 1. Add Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={!isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${isViewOnly && !submitting
              ? 'bg-transparent text-blue-700 dark:text-blue-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white cursor-pointer border border-blue-400 dark:border-blue-500/60'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'إضافة عملة جديدة' : 'Add New Currency'}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* 2. Edit Button */}
          <button
            type="button"
            onClick={() => {
              if (isViewOnly && selectedCurrency) {
                setViewMode('edit')
              }
            }}
            disabled={!isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${isViewOnly && !submitting
              ? 'bg-transparent text-[#2b529a] dark:text-amber-400 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 dark:hover:text-white border border-slate-400 dark:border-amber-500/60 cursor-pointer'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'تعديل' : 'Edit'}
          >
            <Edit className="w-4 h-4" />
          </button>

          {/* 3. Delete Button */}
          <button
            type="button"
            onClick={() => handleDeleteSelected()}
            disabled={!isViewOnly || formData.isBase || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${isViewOnly && !formData.isBase && !submitting
              ? 'bg-transparent text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white cursor-pointer border border-rose-400 dark:border-rose-500/60'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'حذف' : 'Delete'}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* 4. Search / Back Button */}
          <button
            type="button"
            onClick={() => setViewMode('list')}
            disabled={!isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${isViewOnly && !submitting
              ? 'bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-400 dark:border-blue-500/60 cursor-pointer'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'البحث في القائمة' : 'Search in List'}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 5. Save Button */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${!isViewOnly && !submitting
              ? 'bg-transparent text-emerald-700 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white cursor-pointer border border-emerald-700 dark:border-emerald-500/60'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'حفظ' : 'Save'}
          >
            <Save className="w-4 h-4" />
          </button>

          {/* 6. Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${isViewOnly && !submitting
              ? 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-black dark:hover:text-white border border-slate-400 dark:border-slate-600 cursor-pointer'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'طباعة' : 'Print'}
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* 7. Undo / Reset Button */}
          <button
            type="button"
            onClick={() => {
              if (isAdding) {
                handleOpenAdd()
              } else if (selectedCurrency) {
                handleOpenForm(selectedCurrency, 'edit')
              }
            }}
            disabled={isViewOnly || submitting}
            className={`p-2.5 rounded shadow-xs transition-colors ${!isViewOnly && !submitting
              ? 'bg-transparent text-amber-500 dark:text-amber-400 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 cursor-pointer border border-amber-500 dark:border-amber-500/60'
              : 'bg-slate-300/50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              }`}
            title={isRTL ? 'تراجع' : 'Undo'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Professional Confirmation Dialog for Delete Currency */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md grid grid-cols-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 p-0 overflow-hidden shadow-2xl rounded-lg">
          <DialogHeader className="flex flex-row gap-3">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 rounded-full shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>
                {isRTL ? 'تأكيد حذف العملة' : 'Confirm Currency Deletion'}
              </DialogTitle>
              <DialogDescription className="text-xs text-rose-700/80 dark:text-rose-400 mt-0.5">
                {isRTL ? '  سيتم حذف العملة بشكل نهائي.' : 'This will permanently delete the currency.'}
              </DialogDescription>
            </div>

          </DialogHeader>

          <div className="p-5 text-xs text-slate-700 dark:text-slate-300 space-y-3">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {isRTL ? 'هل أنت متأكد من رغبتك في حذف العملة التالية؟' : 'Are you sure you want to delete the following currency?'}
            </p>

            {currencyToDelete && (
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-md border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#2b529a] dark:bg-blue-600 text-white font-mono font-bold rounded text-xs">
                    {currencyToDelete.code}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {isRTL ? currencyToDelete.nameAr : (currencyToDelete.nameEn || currencyToDelete.nameAr)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {isRTL ? `سعر التحويل: ${currencyToDelete.exchangeRate}` : `Rate: ${currencyToDelete.exchangeRate}`}
                </span>
              </div>
            )}

            {deleteErrorMessage ? (
              <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 p-3 rounded-md border border-rose-200 dark:border-rose-900/80 flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{isRTL ? 'تعذر حذف العملة لوجود معاملات مالية مرتبطة بها ' : 'currency deletion is not allowed because there are financial transactions related to it'}</p>

                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {isRTL
                    ? 'ملاحظة: لن يمكنك إتمام العملية إذا كانت هناك معاملات مالية أو أسعار صرف مرتبطة بهذه العملة.'
                    : 'Note: You cannot delete this currency if it is linked to active financial transactions or rates.'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 dark:bg-slate-900/90 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={confirmExecuteDelete}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-xs flex items-center gap-1.5"
            >
              {deleting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CurrenciesModule
