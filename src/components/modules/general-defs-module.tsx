'use client'

// =============================================================================
// Enterprise ERP — General Reference Definitions Master-Detail & Table Module
// Unified Lookup Center for HR, Org, Finance, and Common System Modules.
// Features: Dual View (Grid / Split), Fallback Registry, Interactive Toolbar,
// Double-Click Navigation, Multi-Select, Referential Safety & Audit Logging.
// =============================================================================

import React, { useState, useEffect, useMemo } from 'react'
import { useT } from '@/lib/i18n/use-t'
import { useToast } from '@/hooks/use-toast'
import {
  STATIC_TYPE_SUMMARIES,
  getStaticSeedItems,
  SYSTEM_DEFINITION_TYPES,
  DefinitionTypeMeta,
} from '@/lib/erp/general-definitions-registry'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'

// Lucide Icons
import {
  LayoutGrid,
  Table as TableIcon,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Eye,
  FileSpreadsheet,
  Printer,
  Copy,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  ShieldAlert,
  Briefcase,
  Award,
  GraduationCap,
  BookMarked,
  UserX,
  HeartPulse,
  ShieldCheck,
  FileText,
  Network,
  Layers,
  Save,
  Ban,
  CheckSquare,
  Square,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

export interface DefinitionTypeSummary {
  code: string
  numericId: number
  nameAr: string
  nameEn: string
  domain: 'HR' | 'ORG' | 'COMMON' | 'FINANCE'
  icon: string
  isSystem: boolean
  totalItems: number
  activeItems: number
}

export interface DefinitionItem {
  id: string
  companyId: string
  typeCode: string
  code: string
  nameAr: string
  nameEn?: string | null
  description?: string | null
  sortOrder: number
  isSystem: boolean
  active: boolean
  usageCount?: number
  createdAt: string
  updatedAt: string
}

interface GeneralDefsModuleProps {
  embedded?: boolean
}

// Icon Mapping Helper
const ICON_MAP: Record<string, React.ReactNode> = {
  Briefcase: <Briefcase className="size-4" />,
  Award: <Award className="size-4" />,
  ShieldAlert: <ShieldAlert className="size-4" />,
  Layers: <Layers className="size-4" />,
  GraduationCap: <GraduationCap className="size-4" />,
  BookMarked: <BookMarked className="size-4" />,
  UserX: <UserX className="size-4" />,
  HeartPulse: <HeartPulse className="size-4" />,
  ShieldCheck: <ShieldCheck className="size-4" />,
  FileText: <FileText className="size-4" />,
  Network: <Network className="size-4" />,
}

export default function GeneralDefsModule({ embedded = false }: GeneralDefsModuleProps) {
  const { isRTL, locale } = useT()
  const { toast } = useToast()

  // Primary State initialized with fallback registry so table is NEVER empty
  const [types, setTypes] = useState<DefinitionTypeSummary[]>(STATIC_TYPE_SUMMARIES)
  const [selectedType, setSelectedType] = useState<DefinitionTypeSummary | null>(STATIC_TYPE_SUMMARIES[0] || null)
  const [items, setItems] = useState<DefinitionItem[]>(() => getStaticSeedItems(STATIC_TYPE_SUMMARIES[0]?.code || 'ACCOUNT_GROUP'))

  const [loadingTypes, setLoadingTypes] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // View Mode: 'TABLE' (Grid) vs 'MASTER_DETAIL' (Split)
  const [viewMode, setViewMode] = useState<'TABLE' | 'MASTER_DETAIL'>('TABLE')
  const [itemsViewActive, setItemsViewActive] = useState(false)

  // Selection & Highlight State
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string | null>(STATIC_TYPE_SUMMARIES[0]?.code || null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([])

  // Search & Filters
  const [searchCategory, setSearchCategory] = useState('')
  const [searchItem, setSearchItem] = useState('')
  const [activeDomainFilter, setActiveDomainFilter] = useState<'ALL' | 'HR' | 'ORG' | 'COMMON' | 'FINANCE'>('ALL')
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(false)

  // Pagination State
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // Column Visibility Controls
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    numericId: true,
    name: true,
    code: true,
    domain: true,
    itemCount: true,
    actions: true,
  })

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DefinitionItem | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    description: '',
    sortOrder: 0,
    active: true,
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Delete Dialog State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DefinitionItem | null>(null)

  // i18n Label Helper
  const L = (ar: string, en: string) => (locale === 'en' ? en || ar : ar)

  // Fetch Definition Types from API with Graceful Fallback
  const fetchTypes = async (autoSelectCode?: string) => {
    try {
      setLoadingTypes(true)
      const res = await fetch('/api/erp/general-definitions?mode=types&seed=true')
      const json = await res.json()
      if (res.ok && json.data && Array.isArray(json.data) && json.data.length > 0) {
        setTypes(json.data)
        const target = autoSelectCode
          ? json.data.find((t: DefinitionTypeSummary) => t.code === autoSelectCode)
          : selectedType
            ? json.data.find((t: DefinitionTypeSummary) => t.code === selectedType.code)
            : json.data[0]

        if (target) {
          setSelectedType(target)
          setSelectedCategoryCode(target.code)
        }
      } else {
        // Fallback to static registry data
        setTypes(STATIC_TYPE_SUMMARIES)
      }
    } catch (_err) {
      // Keep static fallback on network error
      setTypes(STATIC_TYPE_SUMMARIES)
    } finally {
      setLoadingTypes(false)
    }
  }

  // Fetch Items for Selected Definition Type
  const fetchItems = async (typeCode: string) => {
    try {
      setLoadingItems(true)
      const query = searchItem.trim() ? `&q=${encodeURIComponent(searchItem.trim())}` : ''
      const activeFlag = activeOnlyFilter ? '&activeOnly=true' : ''
      const res = await fetch(`/api/erp/general-definitions?typeCode=${typeCode}${query}${activeFlag}`)
      const json = await res.json()
      if (res.ok && json.data && Array.isArray(json.data) && json.data.length > 0) {
        setItems(json.data)
      } else {
        // Fallback to static seed items for this category
        setItems(getStaticSeedItems(typeCode))
      }
    } catch (_err) {
      setItems(getStaticSeedItems(typeCode))
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    fetchTypes()
  }, [])

  useEffect(() => {
    if (selectedType) {
      fetchItems(selectedType.code)
    }
  }, [selectedType, searchItem, activeOnlyFilter])

  // Filtered Categories
  const filteredTypes = useMemo(() => {
    return types.filter((t) => {
      const matchDomain = activeDomainFilter === 'ALL' || t.domain === activeDomainFilter
      const q = searchCategory.toLowerCase().trim()
      const matchSearch =
        !q ||
        t.nameAr.toLowerCase().includes(q) ||
        t.nameEn.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        String(t.numericId).includes(q)
      return matchDomain && matchSearch
    })
  }, [types, activeDomainFilter, searchCategory])

  // Paginated Categories
  const totalPages = Math.ceil(filteredTypes.length / pageSize) || 1
  const paginatedTypes = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTypes.slice(start, start + pageSize)
  }, [filteredTypes, currentPage, pageSize])

  // Handler for Selecting/Opening a Category (Double Click or View Button)
  const handleSelectCategory = (type: DefinitionTypeSummary) => {
    setSelectedType(type)
    setSelectedCategoryCode(type.code)
    setSelectedItemId(null)
    setCheckedItemIds([])
    setItemsViewActive(true)
    fetchItems(type.code)
  }

  // Open Add Dialog
  const handleOpenAdd = () => {
    if (!selectedType) return
    setEditingItem(null)
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      description: '',
      sortOrder: (items.length + 1) * 10,
      active: true,
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  // Open Edit Dialog
  const handleOpenEdit = (item?: DefinitionItem | null) => {
    const target = item || items.find((i) => i.id === selectedItemId) || items[0]
    if (!target) {
      toast({
        title: L('تنبيه', 'Notice'),
        description: L('يرجى تحديد عنصر أولاً لتعديله.', 'Please select an item first to edit.'),
      })
      return
    }
    setEditingItem(target)
    setFormData({
      code: target.code,
      nameAr: target.nameAr,
      nameEn: target.nameEn || '',
      description: target.description || '',
      sortOrder: target.sortOrder,
      active: target.active,
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  // Save Item Handler
  const handleSaveItem = async () => {
    if (!selectedType) return
    setFormError(null)

    if (!formData.nameAr.trim()) {
      setFormError(L('الاسم العربي مطلوب.', 'Arabic Name is required.'))
      return
    }

    if (!editingItem && !formData.code.trim()) {
      setFormError(L('رمز التعريف مطلوب.', 'Definition Code is required.'))
      return
    }

    try {
      setSubmitting(true)
      if (editingItem) {
        // Edit API Call
        const res = await fetch(`/api/erp/general-definitions/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: formData.code,
            nameAr: formData.nameAr,
            nameEn: formData.nameEn,
            description: formData.description,
            sortOrder: formData.sortOrder,
            active: formData.active,
          }),
        })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error?.message || json.message || L('فشل تعديل البيانات.', 'Failed to update.'))
        }

        toast({
          title: L('تم التعديل بنجاح', 'Updated Successfully'),
          description: L(`تم تحديث «${formData.nameAr}».`, `Updated "${formData.nameAr}".`),
        })
      } else {
        // Create API Call
        const res = await fetch('/api/erp/general-definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            typeCode: selectedType.code,
            code: formData.code,
            nameAr: formData.nameAr,
            nameEn: formData.nameEn,
            description: formData.description,
            sortOrder: formData.sortOrder,
            active: formData.active,
          }),
        })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error?.message || json.message || L('فشل حفظ العنصر الجديد.', 'Failed to create.'))
        }

        toast({
          title: L('تم الحفظ بنجاح', 'Saved Successfully'),
          description: L(`تمت إضافة «${formData.nameAr}».`, `Added "${formData.nameAr}".`),
        })
      }

      setIsFormOpen(false)
      fetchItems(selectedType.code)
      fetchTypes(selectedType.code)
    } catch (err: any) {
      setFormError(err.message || L('حدث خطأ أثناء الحفظ.', 'An error occurred while saving.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Delete Prompt
  const handleOpenDelete = (item?: DefinitionItem | null) => {
    const target = item || items.find((i) => i.id === selectedItemId)
    if (!target) {
      toast({
        title: L('تنبيه', 'Notice'),
        description: L('يرجى تحديد عنصر أولاً لحذفه.', 'Please select an item first to delete.'),
      })
      return
    }
    setDeletingItem(target)
    setIsDeleteOpen(true)
  }

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingItem || !selectedType) return
    try {
      setSubmitting(true)
      const res = await fetch(`/api/erp/general-definitions/${deletingItem.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error?.message || json.message || L('تعذر حذف السجل.', 'Failed to delete definition.'))
      }

      toast({
        title: L('تم الحذف بنجاح', 'Deleted successfully'),
        description: json.data?.message || L('تم إزالة عنصر التعريف.', 'Definition item removed.'),
      })

      setIsDeleteOpen(false)
      setDeletingItem(null)
      setSelectedItemId(null)
      fetchItems(selectedType.code)
      fetchTypes(selectedType.code)
    } catch (err: any) {
      toast({
        title: L('تعذر الحذف', 'Delete Blocked'),
        description: err.message,
        variant: 'destructive',
      })
      setIsDeleteOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle Item Active/Disable State
  const handleToggleItemActive = async (item: DefinitionItem) => {
    try {
      const res = await fetch(`/api/erp/general-definitions/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      if (res.ok) {
        toast({
          title: !item.active ? L('تم التفعيل', 'Activated') : L('تم التوقيف', 'Deactivated'),
          description: !item.active
            ? L(`تم تنشيط عنصر «${item.nameAr}».`, `Activated "${item.nameAr}".`)
            : L(`تم توقيف عنصر «${item.nameAr}».`, `Deactivated "${item.nameAr}".`),
        })
        if (selectedType) fetchItems(selectedType.code)
      }
    } catch (_err) {
      // Local optimistic update if API unavailable
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i))
      )
    }
  }

  return (
    <div className={`flex flex-col md:flex-row gap-3 md:gap-4 ${embedded ? 'p-1' : 'p-2 sm:p-4 md:p-5'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 0. Toolbar Palette (Responsive: Horizontal scroll on mobile, vertical column on desktop) */}
      {itemsViewActive && selectedType && (
        <div className="flex flex-row md:flex-col gap-2 bg-card border border-border/80 rounded-lg p-1.5 shadow-sm justify-start overflow-x-auto shrink-0 scrollbar-none">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-md bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400"
            title={L('عرض / تعديل', 'View / Edit')}
            onClick={() => {
              if (itemsViewActive) {
                handleOpenEdit()
              } else if (selectedType) {
                handleSelectCategory(selectedType)
              }
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400"
            title={L('بحث', 'Search')}
            onClick={() => {
              const el = document.getElementById('search-input-defs')
              if (el) el.focus()
            }}
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
            title={L('إضافة', 'Add')}
            onClick={handleOpenAdd}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-md bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 dark:bg-slate-800 dark:text-slate-300"
            title={L('طباعة', 'Print')}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-md bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400"
            title={L('تحديث ', 'Refresh')}
            onClick={() => {
              fetchTypes()
              if (selectedType) fetchItems(selectedType.code)
            }}
          >
            <RefreshCw className={`size-4 ${loadingTypes || loadingItems ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 space-y-3 sm:space-y-4 min-w-0 w-full">
        {/* 1. Header Banner & Navigation Path */}
        <div className="rounded-lg overflow-hidden border border-blue-900/30 dark:border-slate-800 shadow-md">
          {/* Top Dark Blue Title Bar */}
          <div className="bg-primary dark:bg-blue-600/90 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
              <div className="p-1.5 rounded bg-white/15 backdrop-blur-sm text-white shrink-0">
                <LayoutGrid className="size-4" />
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold truncate">
                <span className="cursor-pointer hover:underline shrink-0" onClick={() => setItemsViewActive(false)}>
                  {L('الرئيسية', 'Home')}
                </span>
                <span className="shrink-0">›</span>
                <span className="opacity-90 cursor-pointer hover:underline truncate" onClick={() => setItemsViewActive(false)}>
                  {L('التعريفات العامة', 'General Definitions')}
                </span>
                <span className="shrink-0">›</span>
                <span className="text-amber-300 font-bold truncate">
                  {itemsViewActive && selectedType
                    ? isRTL ? selectedType.nameAr : selectedType.nameEn
                    : L('الكل', 'All')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 size-8"
                onClick={() => fetchTypes()}
              >
                <RefreshCw className={`size-4 ${loadingTypes ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Sub Header & Details Info Bar */}
          {itemsViewActive && selectedType && (
            <div className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700/60 font-medium flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 self-start sm:self-auto"
                onClick={() => setItemsViewActive(false)}
              >
                {isRTL ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                {L('العودة للقائمة', 'Back to List')}
              </Button>

              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                <div className="px-2.5 py-1 rounded bg-primary/10 text-primary font-bold text-xs sm:text-sm shrink-0">
                  {L('النوع', 'Type')}: {selectedType.numericId}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
                    <span className="truncate">{isRTL ? selectedType.nameAr : selectedType.nameEn}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {selectedType.code}
                    </Badge>
                  </h3>

                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Main Toolbar */}
        <div className="bg-card border border-border/80 rounded-lg p-2 sm:p-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 flex-1 w-full md:w-auto">
            {/* Columns Visibility Dropdown */}
            {!itemsViewActive && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold shrink-0">
                    <SlidersHorizontal className="size-3.5 text-primary" />
                    {L('أعمدة', 'Columns')}
                    <ChevronLeft className="size-3.5 rotate-270" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                  <DropdownMenuLabel>{L('إظهار / إخفاء الأعمدة', 'Toggle Column Visibility')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.numericId}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, numericId: v }))}
                  >
                    {L('النوع / الرقم', 'Type ID')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.name}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, name: v }))}
                  >
                    {L('الاسم', 'Name')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.code}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, code: v }))}
                  >
                    {L('الرمز النظامي', 'System Code')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.domain}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, domain: v }))}
                  >
                    {L('النطاق', 'Domain')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.itemCount}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, itemCount: v }))}
                  >
                    {L('عدد العناصر', 'Items Count')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.actions}
                    onCheckedChange={(v) => setVisibleColumns((p) => ({ ...p, actions: v }))}
                  >
                    {L('الإجراءات', 'Actions')}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Search Box */}
            <div className="relative flex-1 min-w-[160px] sm:min-w-[220px] max-w-full">
              <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="search-input-defs"
                placeholder={
                  itemsViewActive
                    ? L('بحث في عناصر التعريف...', 'Search definition items...')
                    : L('بحث في أنواع التعريفات العامة...', 'Search categories...')
                }
                value={itemsViewActive ? searchItem : searchCategory}
                onChange={(e) =>
                  itemsViewActive ? setSearchItem(e.target.value) : setSearchCategory(e.target.value)
                }
                className="ps-9 h-9 text-xs"
              />
            </div>

            {/* Domain Filter Badges */}
            {!itemsViewActive && (
              <div className="flex items-center gap-1 bg-muted/80 dark:bg-slate-700/60 p-1 rounded-md overflow-x-auto max-w-full scrollbar-none">
                <Button
                  variant={activeDomainFilter === 'ALL' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2 sm:px-2.5 shrink-0"
                  onClick={() => setActiveDomainFilter('ALL')}
                >
                  {L('الكل', 'All')}
                </Button>
                <Button
                  variant={activeDomainFilter === 'HR' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2 sm:px-2.5 shrink-0"
                  onClick={() => setActiveDomainFilter('HR')}
                >
                  {L('الموارد البشرية', 'HR')}
                </Button>
                <Button
                  variant={activeDomainFilter === 'COMMON' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2 sm:px-2.5 shrink-0"
                  onClick={() => setActiveDomainFilter('COMMON')}
                >
                  {L('عامة', 'Common')}
                </Button>
                <Button
                  variant={activeDomainFilter === 'FINANCE' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2 sm:px-2.5 shrink-0"
                  onClick={() => setActiveDomainFilter('FINANCE')}
                >
                  {L('مالية', 'Finance')}
                </Button>
              </div>
            )}
          </div>

          {/* Action Toolbar Buttons */}
          <div className="flex items-center justify-between md:justify-end gap-1.5 w-full md:w-auto pt-1 md:pt-0 border-t md:border-t-0 border-border/40">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Excel Export">
                <FileSpreadsheet className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40" title="Print" onClick={() => window.print()}>
                <Printer className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:bg-accent" title="Copy">
                <Copy className="size-4" />
              </Button>
            </div>

            {itemsViewActive && selectedType && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 gap-1 text-xs border-red-500/30 text-red-600 dark:text-red-400"
                  onClick={() => handleOpenDelete()}
                >
                  <Trash2 className="size-3.5" />
                  <span>{L('حذف', 'Delete')}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 gap-1 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400"
                  onClick={() => handleOpenEdit()}
                >
                  <Pencil className="size-3.5" />
                  <span>{L('تعديل', 'Edit')}</span>
                </Button>
                <Button size="sm" className="h-8 px-3 gap-1 text-xs bg-primary hover:bg-primary/90" onClick={handleOpenAdd}>
                  <Plus className="size-4" />
                  <span>{L('إضافة', 'Add')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Main Display Body */}
        {viewMode === 'TABLE' && !itemsViewActive ? (
          /* GRID TABLE VIEW (Matching Screenshot #1) */
          <Card className="border-border/70 shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto w-full scrollbar-thin">
              <Table className="w-full text-xs min-w-[640px] sm:min-w-full">
                <TableHeader className="bg-slate-100/90 dark:bg-slate-800/80 border-b border-border">
                  <TableRow className="hover:bg-transparent">
                    {visibleColumns.numericId && (
                      <TableHead className="w-20 text-center font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center justify-center gap-1">
                          <span>{L('النوع', 'Type')}</span>
                          <SlidersHorizontal className="size-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.name && (
                      <TableHead className="text-start font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1">
                          <span>{L('الاسم', 'Name')}</span>
                          <SlidersHorizontal className="size-3 text-muted-foreground" />
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.code && (
                      <TableHead className="w-40 text-start font-bold text-slate-800 dark:text-slate-200">
                        {L('الرمز النظامي', 'System Code')}
                      </TableHead>
                    )}
                    {visibleColumns.domain && (
                      <TableHead className="w-28 text-center font-bold text-slate-800 dark:text-slate-200">
                        {L('النطاق', 'Domain')}
                      </TableHead>
                    )}
                    {visibleColumns.itemCount && (
                      <TableHead className="w-28 text-center font-bold text-slate-800 dark:text-slate-200">
                        {L('عدد العناصر', 'Items Count')}
                      </TableHead>
                    )}
                    {visibleColumns.actions && (
                      <TableHead className="w-24 text-center font-bold text-slate-800 dark:text-slate-200">
                        {L('الإجراءات', 'Actions')}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTypes ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
                        {L('جاري تحميل التعريفات العامة...', 'Loading definitions...')}
                      </TableCell>
                    </TableRow>
                  ) : paginatedTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        {L('لا توجد نتائج مطابقة للبحث.', 'No matching definitions found.')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTypes.map((type) => (
                      <TableRow
                        key={type.code}
                        className={`cursor-pointer transition-colors border-b border-border/40 ${selectedCategoryCode === type.code
                          ? 'bg-primary/10 font-medium'
                          : 'hover:bg-primary/5'
                          }`}
                        onClick={() => {
                          setSelectedCategoryCode(type.code)
                          setSelectedType(type)
                        }}
                        onDoubleClick={() => handleSelectCategory(type)}
                      >
                        {visibleColumns.numericId && (
                          <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300">
                            {type.numericId}
                          </TableCell>
                        )}
                        {visibleColumns.name && (
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded bg-primary/10 text-primary shrink-0">
                                {ICON_MAP[type.icon] || <Layers className="size-4" />}
                              </span>
                              <span className="truncate">{isRTL ? type.nameAr : type.nameEn}</span>
                            </div>
                          </TableCell>
                        )}
                        {visibleColumns.code && (
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {type.code}
                          </TableCell>
                        )}
                        {visibleColumns.domain && (
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                type.domain === 'HR'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                  : type.domain === 'ORG'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                    : type.domain === 'FINANCE'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                              }
                            >
                              {type.domain}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.itemCount && (
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-bold">
                              {type.activeItems} / {type.totalItems}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.actions && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => handleSelectCategory(type)}
                            >
                              <Eye className="size-3.5" />
                              {L('عرض', 'view')}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer Bar */}
            <div className="bg-card border-t border-border px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground font-medium text-center sm:text-start">
                {L(
                  `1 من ${totalPages} صفحة العناصر ${filteredTypes.length}`,
                  `Page 1 of ${totalPages} (Total ${filteredTypes.length} Items)`
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{L('العناصر في كل صفحة', 'Items per page')}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="h-7 text-xs rounded border border-input bg-background px-2 py-0.5"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsRight className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>

                  <span className="px-2 font-semibold">{currentPage}</span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsLeft className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          /* CATEGORY ITEMS DETAIL VIEW (Matching Screenshot #2) */
          <div className="space-y-2 w-full">
            {/* Category Items Data Table (Matching Screenshot #2 Layout) */}
            <Card className="border-border/70 shadow-sm overflow-hidden w-full">
              <div className="overflow-x-auto w-full scrollbar-thin">
                <Table className="w-full text-xs min-w-[650px] sm:min-w-full">
                  <TableHeader className="bg-slate-100/90 dark:bg-slate-800/80 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 text-center">
                        <input
                          type="checkbox"
                          checked={checkedItemIds.length > 0 && checkedItemIds.length === items.length}
                          onChange={(e) => {
                            if (e.target.checked) setCheckedItemIds(items.map((i) => i.id))
                            else setCheckedItemIds([])
                          }}
                          className="rounded border-input"
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center font-bold text-slate-800 dark:text-slate-200">#</TableHead>
                      <TableHead className="w-28 sm:w-32 font-bold text-slate-800 dark:text-slate-200">{L('الرمز', 'Code')}</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">{L('الاسم *', 'Name *')}</TableHead>
                      <TableHead className="w-24 text-center font-bold text-slate-800 dark:text-slate-200">{L('التوقيف', 'Status')}</TableHead>
                      <TableHead className="w-20 text-center font-bold text-slate-800 dark:text-slate-200">{L('الترتيب', 'Sort')}</TableHead>
                      <TableHead className="w-40 sm:w-48 font-bold text-slate-800 dark:text-slate-200">{L('ملاحظات', 'Notes')}</TableHead>
                      <TableHead className="w-24 text-center font-bold text-slate-800 dark:text-slate-200">{L('الإجراءات', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingItems ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
                          {L('جاري تحميل العناصر...', 'Loading items...')}
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          {L('لا توجد عناصر مسجلة في هذا التعريف حتى الآن.', 'No items registered for this category yet.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const isSelected = selectedItemId === item.id
                        const isChecked = checkedItemIds.includes(item.id)
                        return (
                          <TableRow
                            key={item.id}
                            className={`cursor-pointer transition-colors border-b border-border/40 ${isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-primary/5'
                              }`}
                            onClick={() => setSelectedItemId(item.id)}
                            onDoubleClick={() => handleOpenEdit(item)}
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setCheckedItemIds((p) => [...p, item.id])
                                  else setCheckedItemIds((p) => p.filter((id) => id !== item.id))
                                }}
                                className="rounded border-input"
                              />
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {item.code}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                              <div>
                                <span>{isRTL ? item.nameAr : item.nameEn || item.nameAr}</span>
                                {item.nameEn && isRTL && (
                                  <span className="block text-[11px] text-muted-foreground font-normal">
                                    {item.nameEn}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 text-[11px] px-2 font-bold ${item.active
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400'
                                  }`}
                                onClick={() => handleToggleItemActive(item)}
                              >
                                {item.active ? (
                                  <CheckCircle2 className="size-3 me-1" />
                                ) : (
                                  <XCircle className="size-3 me-1" />
                                )}
                                {item.active ? L('نشط', 'Active') : L('موقوف', 'Inactive')}
                              </Button>
                            </TableCell>

                            <TableCell className="text-center font-mono font-semibold">
                              {item.sortOrder}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px] truncate max-w-[140px] sm:max-w-[180px]">
                              {item.description || '-'}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  title={L('تعديل', 'Edit')}
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  title={L('حذف', 'Delete')}
                                  onClick={() => handleOpenDelete(item)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Items Pagination Footer Bar */}
              <div className="bg-card border-t border-border px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {L(`عرض 1 إلى ${items.length} من ${items.length} المدخلات`, `Showing 1 to ${items.length} of ${items.length} entries`)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">1</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* STEP 1: Refactored Form Dialog for Add / Edit Definition Item */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 max-w-[95vw] w-full p-0" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-4 sm:p-5 border-b border-border/80 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <DialogTitle className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {editingItem ? (
                <>
                  <Pencil className="size-4.5 text-amber-500 shrink-0" />
                  <span className="truncate">{L(`تعديل عنصر «${editingItem.nameAr}»`, `Edit Item "${editingItem.nameEn}"`)}</span>
                </>
              ) : (
                <>
                  <Plus className="size-4.5 text-blue-600 shrink-0" />
                  <span className="truncate">{L(`إضافة عنصر جديد في «${selectedType?.nameAr || ''}»`, `Add Item to "${selectedType?.nameEn || ''}"`)}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {formError && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs p-3 rounded-md font-medium">
                {formError}
              </div>
            )}

            {/* 2-Column Strict CSS Grid Layout for Code & Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                  {L('رمز التعريف (Code) *', 'Code *')}
                </Label>
                <Input
                  placeholder="EX: ASSET_01"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  disabled={!!editingItem && editingItem.isSystem}
                  className="h-9 sm:h-10 text-xs uppercase font-mono border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md px-3"
                />
                {editingItem?.isSystem && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {L('الرمز النظامي غير قابل للتعديل.', 'System code cannot be changed.')}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                  {L('ترتيب العرض', 'Sort Order')}
                </Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                  className="h-9 sm:h-10 text-xs border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md px-3"
                />
              </div>
            </div>

            {/* Arabic Name Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                {L('الاسم بالعربية *', 'Arabic Name *')}
              </Label>
              <Input
                placeholder="أدخل الاسم بالعربية..."
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                className="h-9 sm:h-10 text-xs border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md px-3"
              />
            </div>

            {/* English Name Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                {L('الاسم بالإنجليزية', 'English Name')}
              </Label>
              <Input
                placeholder="Enter English Name..."
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                className="h-9 sm:h-10 text-xs border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md px-3"
              />
            </div>

            {/* Description / Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                {L('ملاحظه', 'Note')}
              </Label>
              <Input
                placeholder={L("ملاحظات توضيحية خيارية...", "Optional explanatory notes...")}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="h-9 sm:h-10 text-xs border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md px-3"
              />
            </div>

            {/* Active Status Flexbox Container */}
            <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50">
              <div className="space-y-0.5 me-2">
                <Label className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {L('حالة التنشيط', 'Active Status')}
                </Label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {L('عند التوقيف لن يظهر هذا العنصر في القوائم المنسدلة الجديدة.', 'When disabled, this item will be hidden from lookups.')}
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, active: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border/80 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFormOpen(false)}
              disabled={submitting}
              className="h-9 sm:h-10 w-full sm:w-auto px-4 border border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md font-medium text-xs"
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveItem}
              disabled={submitting}
              className="h-9 sm:h-10 w-full sm:w-auto px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {L('حفظ البيانات', 'Save Item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 max-w-[95vw] w-full p-0" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-4 sm:p-5 border-b border-border/80 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <DialogTitle className="text-base sm:text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <ShieldAlert className="size-5 shrink-0" />
              <span className="truncate">{L('تأكيد حذف عنصر التعريف', 'Confirm Definition Delete')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs space-y-3">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {L(
                `هل أنت تأكد من رغبتك في حذف عنصر التعريف «${deletingItem?.nameAr || ''}» (${deletingItem?.code || ''})؟`,
                `Are you sure you want to delete definition item "${deletingItem?.nameEn || deletingItem?.nameAr || ''}"?`
              )}
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-3 rounded-lg text-amber-800 dark:text-amber-300 text-[11px] leading-normal">
              {L(
                'تنبيه نظامي: إذا كان هذا العنصر مستخدماً في سجلات مالية أو وظيفية، سيقوم النظام بمنع الحذف وتنبيهك للحفاظ على سلامة البيانات.',
                'Safety Note: If this item is referenced in transactions or profiles, deletion will be blocked safely.'
              )}
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border/80 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={submitting}
              className="h-9 sm:h-10 w-full sm:w-auto px-4 border border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md font-medium text-xs"
            >
              {L('إلغاء', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="h-9 sm:h-10 w-full sm:w-auto px-5 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {L('تأكيد الحذف ', 'Confirm Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { GeneralDefsModule }
