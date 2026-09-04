'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/use-t'
import { useNav } from '@/stores/nav-store'
import {
  LayoutGrid,
  Plus,
  Trash2,
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Save,
  X,
  Columns,
  Layers,
  Building2,
  FolderTree,
  Edit2,
  Eye,
  Lock,
  BarChart2,
  Sliders,
  Grid,
  Menu,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface OrgStructureItem {
  id: string
  code: string
  nameAr: string
  nameEn?: string | null
  parentId?: string | null
  parent?: { id: string; code: string; nameAr: string; nameEn?: string | null } | null
  type: string
  level: number
  path?: string | null
  status?: string | null
  costCenterId?: string | null
  costCenter?: { id: string; code: string; nameAr: string; nameEn?: string | null } | null
  managerId?: string | null
  manager?: { id: string; employeeNo: string; nameAr: string; nameEn?: string | null } | null
  _count?: { employees?: number; children?: number }
  notes?: string | null
  active?: boolean
  // Extended Enterprise Audit & Suspension Fields
  createdAt?: string
  isSuspended?: boolean
  suspendedBy?: string | null
  suspendedAt?: string | null
  suspensionReason?: string | null
  suspensionCount?: number
  createdBy?: string
  updatedBy?: string
  updatedAt?: string
  modificationCount?: number
  printCount?: number
}

// Initial fallback seed data matching screenshot
const INITIAL_SEED_DATA: OrgStructureItem[] = [
  {
    id: '1',
    code: '1',
    nameAr: 'المدير العام',
    nameEn: 'General Manager',
    type: 'قطاع',
    level: 1,
    notes: 'أعلى مستوى',
    parentId: null,
    parent: null,
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 1,
    printCount: 5,
  },
  {
    id: '10',
    code: '10',
    nameAr: 'الدعم الفني',
    nameEn: 'Technical Support',
    type: 'إدارة',
    level: 3,
    notes: 'فرعي لتقنية المعلومات',
    parentId: '9',
    parent: { id: '9', code: '9', nameAr: 'إدارة تقنية المعلومات', nameEn: 'IT Department' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 0,
    printCount: 2,
  },
  {
    id: '2',
    code: '2',
    nameAr: 'إدارة المالية',
    nameEn: 'Finance Dept',
    type: 'إدارة عامة',
    level: 2,
    notes: 'تابعة للمدير العام',
    parentId: '1',
    parent: { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 2,
    printCount: 8,
  },
  {
    id: '3',
    code: '3',
    nameAr: 'إدارة التسويق',
    nameEn: 'Marketing Dept',
    type: 'إدارة عامة',
    level: 2,
    notes: 'تابعة للمدير العام',
    parentId: '1',
    parent: { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 0,
    printCount: 1,
  },
  {
    id: '4',
    code: '4',
    nameAr: 'إدارة المبيعات',
    nameEn: 'Sales Dept',
    type: 'إدارة عامة',
    level: 2,
    notes: 'تابعة للمدير العام',
    parentId: '1',
    parent: { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 3,
    printCount: 12,
  },
  {
    id: '5',
    code: '5',
    nameAr: 'المحاسبة',
    nameEn: 'Accounting',
    type: 'إدارة',
    level: 3,
    notes: 'ضمن إدارة المالية',
    parentId: '2',
    parent: { id: '2', code: '2', nameAr: 'إدارة المالية', nameEn: 'Finance Dept' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 1,
    printCount: 4,
  },
  {
    id: '6',
    code: '6',
    nameAr: 'التسويق الرقمي',
    nameEn: 'Digital Marketing',
    type: 'إدارة',
    level: 3,
    notes: 'تخصص فرعي',
    parentId: '3',
    parent: { id: '3', code: '3', nameAr: 'إدارة التسويق', nameEn: 'Marketing Dept' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 0,
    printCount: 0,
  },
  {
    id: '7',
    code: '7',
    nameAr: 'الموارد البشرية',
    nameEn: 'Human Resources',
    type: 'إدارة عامة',
    level: 2,
    notes: 'تابعة للمدير العام',
    parentId: '1',
    parent: { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 1,
    printCount: 3,
  },
  {
    id: '8',
    code: '8',
    nameAr: 'التوظيف والتدريب',
    nameEn: 'Recruitment & Training',
    type: 'إدارة',
    level: 3,
    notes: 'فرع من الموارد البشرية',
    parentId: '7',
    parent: { id: '7', code: '7', nameAr: 'الموارد البشرية', nameEn: 'Human Resources' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 0,
    printCount: 1,
  },
  {
    id: '9',
    code: '9',
    nameAr: 'إدارة تقنية المعلومات',
    nameEn: 'IT Department',
    type: 'إدارة عامة',
    level: 2,
    notes: 'تابعة للمدير العام',
    parentId: '1',
    parent: { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager' },
    createdAt: '14:04:46.069 17/08/2026',
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
    suspensionCount: 0,
    createdBy: 'admin',
    updatedBy: 'admin',
    updatedAt: '14:04:46.069 17/08/2026',
    modificationCount: 4,
    printCount: 9,
  },
]

export default function OrgStructureModule({
  embedded = false,
  onNavigateToDashboard,
}: {
  embedded?: boolean
  onNavigateToDashboard?: () => void
}) {
  const setActiveModule = useNav((s) => s.setActiveModule)
  const { isRTL, locale } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'list' | 'tree' | 'form' | 'audit'>('list')
  const [editingItem, setEditingItem] = useState<OrgStructureItem | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('ALL')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Suspension Modal state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [targetSuspendItem, setTargetSuspendItem] = useState<OrgStructureItem | null>(null)
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('')

  // Expanded Column visibility controls matching user request (Persisted in localStorage)
  const VISIBLE_COLS_STORAGE_KEY = 'orminal_erp_org_structure_visible_cols_v2'

  const DEFAULT_VISIBLE_COLS = useMemo(
    () => ({
      code: true,
      name: true,
      parentCode: true,
      parentName: true,
      type: true,
      level: true,
      costCenter: true,
      manager: true,
      employeeCount: true,
      notes: true,
      createdAt: true,
      isSuspended: true,
      suspendedBy: false,
      suspendedAt: false,
      suspensionReason: false,
      suspensionCount: false,
      createdBy: false,
      updatedBy: false,
      updatedAt: false,
      modificationCount: false,
      printCount: false,
    }),
    []
  )

  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS)
  const [isColsLoaded, setIsColsLoaded] = useState(false)

  // Hydrate user column preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VISIBLE_COLS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setVisibleCols((prev) => ({ ...prev, ...parsed }))
      }
    } catch (e) {
      console.error('Error reading column preferences:', e)
    } finally {
      setIsColsLoaded(true)
    }
  }, [])

  // Persist column preferences to localStorage whenever changed
  useEffect(() => {
    if (!isColsLoaded) return
    try {
      localStorage.setItem(VISIBLE_COLS_STORAGE_KEY, JSON.stringify(visibleCols))
    } catch (e) {
      console.error('Error saving column preferences:', e)
    }
  }, [visibleCols, isColsLoaded])

  // Interactive Column Resizing State (Excel-style drag-to-resize columns)
  const COL_WIDTHS_STORAGE_KEY = 'orminal_erp_org_structure_col_widths_v2'
  const DEFAULT_COL_WIDTHS = useMemo<Record<string, number>>(
    () => ({
      code: 100,
      name: 180,
      parentCode: 110,
      parentName: 180,
      type: 130,
      level: 80,
      notes: 190,
      createdAt: 160,
      isSuspended: 100,
      suspendedBy: 140,
      suspendedAt: 160,
      suspensionReason: 190,
      suspensionCount: 110,
      createdBy: 130,
      updatedBy: 130,
      updatedAt: 160,
      modificationCount: 110,
      printCount: 110,
    }),
    []
  )

  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS)
  const [isResizingMode, setIsResizingMode] = useState(false)

  // Hydrate custom column widths from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COL_WIDTHS_STORAGE_KEY)
      if (saved) {
        setColWidths((prev) => ({ ...prev, ...JSON.parse(saved) }))
      }
    } catch (e) {
      console.error('Error reading column width preferences:', e)
    }
  }, [])

  // Persist column widths to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(colWidths))
    } catch (e) {
      console.error('Error saving column width preferences:', e)
    }
  }, [colWidths])

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey] || 120

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = isRTL ? startX - moveEvent.clientX : moveEvent.clientX - startX
      const newWidth = Math.max(50, startWidth + deltaX)
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Form State
  const [formData, setFormData] = useState<{
    code: string
    nameAr: string
    nameEn: string
    parentId: string
    type: string
    costCenterId: string
    managerId: string
    status: string
    notes: string
    isSuspended: boolean
    suspensionReason: string
  }>({
    code: '',
    nameAr: '',
    nameEn: '',
    parentId: '',
    type: 'إدارة',
    costCenterId: '',
    managerId: '',
    status: 'ACTIVE',
    notes: '',
    isSuspended: false,
    suspensionReason: '',
  })

  // Fetch API data (Org Structure)
  const { data: items = INITIAL_SEED_DATA, isLoading, refetch } = useQuery({
    queryKey: ['org-structure'],
    queryFn: async () => {
      const res = await fetch('/api/erp/org-structure')
      if (!res.ok) throw new Error(L('فشل جلب بيانات الهيكل التنظيمي', 'Failed to fetch Org Structure data'))
      const json = await res.json()
      return (json.data && json.data.length > 0) ? json.data : INITIAL_SEED_DATA
    },
  })

  // Fetch Cost Centers for Master Data selector
  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers-lookup'],
    queryFn: async () => {
      const res = await fetch('/api/erp/cost-centers?pageSize=500')
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    },
  })

  // Fetch Employees for Manager selector
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-lookup'],
    queryFn: async () => {
      const res = await fetch('/api/erp/employees?pageSize=500')
      if (!res.ok) return []
      const json = await res.json()
      return json.data || []
    },
  })

  // Helper function to get all child/grandchild IDs of a node to prevent circular selection
  const invalidParentIds = useMemo(() => {
    if (!editingItem) return new Set<string>()
    const forbidden = new Set<string>([editingItem.id])

    const findChildren = (parentId: string) => {
      items.forEach((item) => {
        if (item.parentId === parentId && !forbidden.has(item.id)) {
          forbidden.add(item.id)
          findChildren(item.id)
        }
      })
    }
    findChildren(editingItem.id)
    return forbidden
  }, [editingItem, items])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof formData & { id?: string }) => {
      const isEdit = !!payload.id
      const res = await fetch('/api/erp/org-structure', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.message || L('فشل حفظ البيانات', 'Failed to save data'))
      return json.data
    },
    onSuccess: () => {
      toast.success(
        editingItem
          ? L('تم تحديث الهيكل التنظيمي بنجاح', 'Org Structure updated successfully')
          : L('تم إضافة هيكل تنظيمي جديد بنجاح', 'New Org Structure added successfully')
      )
      queryClient.invalidateQueries({ queryKey: ['org-structure'] })
      setViewMode('list')
      setEditingItem(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/erp/org-structure?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.message || L('فشل حذف الهيكل', 'Failed to delete structure'))
      return json
    },
    onSuccess: () => {
      toast.success(L('تم حذف الهيكل بنجاح', 'Structure deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['org-structure'] })
      if (viewMode === 'form') {
        setViewMode('list')
        setEditingItem(null)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Suspend/Reactivate Mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ id, isSuspended, suspensionReason }: { id: string; isSuspended: boolean; suspensionReason?: string }) => {
      const res = await fetch('/api/erp/org-structure', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isSuspended, suspensionReason }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.message || L('فشل تغيير حالة التوقيف', 'Failed to update suspension status'))
      return json.data
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isSuspended
          ? L('تم توقيف الهيكل التنظيمي بنجاح', 'Org Structure suspended successfully')
          : L('تم إلغاء التوقيف وتفعيل الهيكل بنجاح', 'Org Structure activated successfully')
      )
      queryClient.invalidateQueries({ queryKey: ['org-structure'] })
      setSuspendDialogOpen(false)
      setTargetSuspendItem(null)
      setSuspensionReasonInput('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Open Form for Adding New Record
  const handleAddNew = () => {
    const maxCode = items.reduce((acc, curr) => {
      const val = parseInt(curr.code, 10)
      return !isNaN(val) ? Math.max(acc, val) : acc
    }, 0)
    const nextCode = (maxCode + 1).toString()

    setFormData({
      code: nextCode,
      nameAr: '',
      nameEn: '',
      parentId: '',
      type: 'إدارة',
      costCenterId: '',
      managerId: '',
      status: 'ACTIVE',
      notes: '',
      isSuspended: false,
      suspensionReason: '',
    })
    setEditingItem(null)
    setViewMode('form')
  }

  // Open Form for Editing Existing Record
  const handleEdit = (item: OrgStructureItem) => {
    setEditingItem(item)
    setFormData({
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn || '',
      parentId: item.parentId || '',
      type: item.type || 'إدارة',
      costCenterId: item.costCenterId || '',
      managerId: item.managerId || '',
      status: item.status || (item.isSuspended ? 'SUSPENDED' : 'ACTIVE'),
      notes: item.notes || '',
      isSuspended: !!item.isSuspended,
      suspensionReason: item.suspensionReason || '',
    })
    setViewMode('form')
  }

  // Handle Form Submission
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.nameAr.trim()) {
      toast.error(L('يرجى ملء الحقول المطلوبة (رقم الهيكل واسم الهيكل)', 'Please fill in required fields (Code and Name)'))
      return
    }
    saveMutation.mutate({
      ...formData,
      id: editingItem?.id,
    })
  }

  // Calculate Level dynamically in Form
  const calculatedFormLevel = useMemo(() => {
    if (!formData.parentId) return 1
    const parentObj = items.find((i) => i.id === formData.parentId)
    return parentObj ? parentObj.level + 1 : 1
  }, [formData.parentId, items])

  // Filtered List items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status Filter
      if (statusFilter === 'ACTIVE' && (item.isSuspended || item.status === 'SUSPENDED' || item.status === 'ARCHIVED')) return false
      if (statusFilter === 'SUSPENDED' && !item.isSuspended && item.status !== 'SUSPENDED') return false
      if (statusFilter === 'ARCHIVED' && item.status !== 'ARCHIVED') return false

      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        item.code.toLowerCase().includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        (item.parent?.nameAr && item.parent.nameAr.toLowerCase().includes(q)) ||
        (item.costCenter?.nameAr && item.costCenter.nameAr.toLowerCase().includes(q)) ||
        (item.costCenter?.code && item.costCenter.code.toLowerCase().includes(q)) ||
        (item.manager?.nameAr && item.manager.nameAr.toLowerCase().includes(q)) ||
        (item.manager?.employeeNo && item.manager.employeeNo.toLowerCase().includes(q)) ||
        item.type.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.createdBy && item.createdBy.toLowerCase().includes(q)) ||
        (item.updatedBy && item.updatedBy.toLowerCase().includes(q))
      )
    })
  }, [items, search, statusFilter])

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage, pageSize])

  // Currently Selected Item in grid
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedId) || null
  }, [items, selectedId])



  // Export handlers (CSV, Excel, Word, PDF)
  const handleExportCSV = () => {
    const headers = [
      L('رقم الهيكل', 'Code'),
      L('اسم الهيكل', 'Structure Name'),
      L('الهيكل الأعلى', 'Parent Code'),
      L('اسم الهيكل الأعلى', 'Parent Name'),
      L('نوع الهيكل', 'Structure Type'),
      L('المستوى', 'Level'),
      L('التوقيف', 'Status'),
      L('مدخل البيانات', 'Created By'),
      L('تاريخ بدء الإدخال', 'Created At'),
    ]

    const rows = filteredItems.map((item) => [
      item.code,
      isRTL ? item.nameAr : (item.nameEn || item.nameAr),
      item.parent?.code || '-',
      isRTL ? (item.parent?.nameAr || '-') : (item.parent?.nameEn || item.parent?.nameAr || '-'),
      item.type,
      item.level ?? 1,
      item.isSuspended ? L('موقوف', 'Suspended') : L('نشط', 'Active'),
      item.createdBy || 'admin',
      item.createdAt || '-',
    ])

    let csvContent = '\uFEFF'
    csvContent += headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n'
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\r\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `org_structure_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(L('تم تصدير البيانات إلى ملف CSV بنجاح', 'Exported to CSV successfully'))
  }

  const handleExportExcel = () => {
    const title = L('جدول الهيكل التنظيمي', 'Organization Structure Data')
    const headers = [
      L('رقم الهيكل', 'Code'),
      L('اسم الهيكل', 'Structure Name'),
      L('الهيكل الأعلى', 'Parent Code'),
      L('اسم الهيكل الأعلى', 'Parent Name'),
      L('نوع الهيكل', 'Structure Type'),
      L('المستوى', 'Level'),
      L('التوقيف', 'Status'),
      L('مدخل البيانات', 'Created By'),
      L('تاريخ بدء الإدخال', 'Created At'),
    ]

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${title}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, Tahoma, 'Segoe UI', sans-serif; direction: rtl; text-align: right; }
          table { border-collapse: collapse; width: 100%; direction: rtl; }
          th { background-color: #2b5ba9; color: #ffffff; font-weight: bold; border: 1px solid #1a3c75; padding: 12px 14px; text-align: center; font-size: 28px; }
          td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 24px; font-family: Arial, Tahoma, 'Segoe UI', sans-serif; }
          tr:nth-child(even) { background-color: #b22045ff; }
          .header-title { font-size: 24px; font-weight: bold; text-align: center; background-color: #0952c6ff; color: #ffffff; padding: 16px; }
        </style>
      </head>
      <body dir="rtl">
        <table>
          <thead>
            <tr>
              <th colspan="${headers.length}" class="header-title">${title} - ${new Date().toLocaleDateString('ar-SA')}</th>
            </tr>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredItems
        .map(
          (item) => `
              <tr>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${item.code}</td>
                <td>${isRTL ? item.nameAr : (item.nameEn || item.nameAr)}</td>
                <td style="text-align:center;">${item.parent?.code || '-'}</td>
                <td>${isRTL ? (item.parent?.nameAr || '-') : (item.parent?.nameEn || item.parent?.nameAr || '-')}</td>
                <td style="text-align:center;">${item.type}</td>
                <td style="text-align:center;">${item.level ?? 1}</td>
                <td style="text-align:center;">${item.isSuspended ? L('موقوف', 'Suspended') : L('نشط', 'Active')}</td>
                <td>${item.createdBy || 'admin'}</td>
                <td style="text-align:center;">${item.createdAt || '-'}</td>
              </tr>
            `
        )
        .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `

    const blob = new Blob(['\uFEFF' + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `org_structure_${new Date().toISOString().slice(0, 10)}.xls`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(L('تم تصدير البيانات إلى Excel بنجاح', 'Exported to Excel successfully'))
  }

  const handleExportWord = () => {
    const title = L('تقرير الهيكل التنظيمي - نظام أورمينال ERP', 'Org Structure Report - Orminal ERP')
    const headers = [
      L('رقم الهيكل', 'Code'),
      L('اسم الهيكل', 'Structure Name'),
      L('الهيكل الأعلى', 'Parent Code'),
      L('اسم الهيكل الأعلى', 'Parent Name'),
      L('نوع الهيكل', 'Structure Type'),
      L('المستوى', 'Level'),
      L('التوقيف', 'Status'),
      L('مدخل البيانات', 'Created By'),
      L('تاريخ بدء الإدخال', 'Created At'),
    ]

    let docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 25px; }
          h1 { color: #2b5ba9; text-align: center; margin-bottom: 5px; font-size: 24px; border-bottom: 2px solid #2b5ba9; padding-bottom: 10px; }
          p.subtitle { text-align: center; color: #64748b; margin-bottom: 25px; font-size: 15px; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; direction: rtl; }
          th { background-color: #2b5ba9; color: #ffffff; border: 1px solid #1a3c75; padding: 10px; font-size: 16px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 14px; text-align: right; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body dir='rtl'>
        <h1>${title}</h1>
        <p class="subtitle">${L('تاريخ التصدير:', 'Export Date:')} ${new Date().toLocaleDateString('ar-SA')} | ${L('إجمالي السجلات:', 'Total Records:')} ${filteredItems.length}</p>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredItems
        .map(
          (item) => `
              <tr>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${item.code}</td>
                <td>${isRTL ? item.nameAr : (item.nameEn || item.nameAr)}</td>
                <td style="text-align:center;">${item.parent?.code || '-'}</td>
                <td>${isRTL ? (item.parent?.nameAr || '-') : (item.parent?.nameEn || item.parent?.nameAr || '-')}</td>
                <td style="text-align:center;">${item.type}</td>
                <td style="text-align:center;">${item.level ?? 1}</td>
                <td style="text-align:center;">${item.isSuspended ? L('موقوف', 'Suspended') : L('نشط', 'Active')}</td>
                <td>${item.createdBy || 'admin'}</td>
                <td style="text-align:center;">${item.createdAt || '-'}</td>
              </tr>
            `
        )
        .join('')}
          </tbody>
        </table>
        <div class="footer">${L('تم التصدير تلقائياً بواسطة نظام أورمينال ERP', 'Exported automatically by Orminal ERP')}</div>
      </body>
      </html>
    `

    const blob = new Blob(['\uFEFF' + docHtml], { type: 'application/msword;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `org_structure_${new Date().toISOString().slice(0, 10)}.doc`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(L('تم تصدير البيانات إلى Word بنجاح', 'Exported to Word successfully'))
  }

  const handleExportPDF = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) {
      toast.error(L('تعذر فتح نافذة التصدير. يرجى السماح بالنوافذ المنبثقة للطلب.', 'Could not open print window. Allow popups.'))
      return
    }

    const title = L('تقرير الهيكل التنظيمي', 'Organization Structure Report')
    const headers = [
      L('رقم الهيكل', 'Code'),
      L('اسم الهيكل', 'Structure Name'),
      L('الهيكل الأعلى', 'Parent Code'),
      L('اسم الهيكل الأعلى', 'Parent Name'),
      L('نوع الهيكل', 'Structure Type'),
      L('المستوى', 'Level'),
      L('التوقيف', 'Status'),
      L('مدخل البيانات', 'Created By'),
      L('تاريخ بدء الإدخال', 'Created At'),
    ]

    const content = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, system-ui, sans-serif; direction: rtl; text-align: right; color: #0f172a; margin: 0; padding: 20px; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2b5ba9; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: bold; color: #2b5ba9; }
          .info { font-size: 12px; color: #475569; }
          h2 { font-size: 18px; color: #1e293b; margin: 0 0 15px 0; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 15px; }
          th { background-color: #2b5ba9; color: white; padding: 8px 10px; border: 1px solid #1d4ed8; text-align: center; font-weight: 600; }
          td { padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; }
          .badge-active { background-color: #dcfce7; color: #166534; }
          .badge-suspended { background-color: #fee2e2; color: #991b1b; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">أورمينال تك - ORMINAL ERP</div>
          <div class="info">${L('تاريخ التقرير:', 'Report Date:')} ${new Date().toLocaleDateString('ar-SA')} | ${new Date().toLocaleTimeString('ar-SA')}</div>
        </div>
        <h2>${title}</h2>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredItems
        .map(
          (item) => `
              <tr>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${item.code}</td>
                <td>${isRTL ? item.nameAr : (item.nameEn || item.nameAr)}</td>
                <td style="text-align:center;">${item.parent?.code || '-'}</td>
                <td>${isRTL ? (item.parent?.nameAr || '-') : (item.parent?.nameEn || item.parent?.nameAr || '-')}</td>
                <td style="text-align:center;">${item.type}</td>
                <td style="text-align:center;">${item.level ?? 1}</td>
                <td style="text-align:center;">
                  <span class="badge ${item.isSuspended ? 'badge-suspended' : 'badge-active'}">
                    ${item.isSuspended ? L('موقوف', 'Suspended') : L('نشط', 'Active')}
                  </span>
                </td>
                <td>${item.createdBy || 'admin'}</td>
                <td style="text-align:center;">${item.createdAt || '-'}</td>
              </tr>
            `
        )
        .join('')}
          </tbody>
        </table>
        <div class="footer">${L('تم إنشاء المستند تلقائياً عبر نظام Orminal ERP', 'Document generated by Orminal ERP System')}</div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `

    printWin.document.write(content)
    printWin.document.close()
    toast.success(L('جارٍ فتح نافذة الطباعة/تخصيص PDF…', 'Opening PDF print view…'))
  }


  // Get Type Badge styling
  const getTypeBadge = (type: string) => {
    let label = type
    if (type === 'قطاع') label = L('قطاع', 'Sector')
    else if (type === 'إدارة عامة') label = L('إدارة عامة', 'General Directorate')
    else if (type === 'إدارة') label = L('إدارة', 'Department')
    else if (type === 'قسم') label = L('قسم', 'Section')
    else if (type === 'وحدة') label = L('وحدة', 'Unit')

    switch (type) {
      case 'قطاع':
        return <Badge className="bg-purple-600/10 text-purple-700 dark:text-purple-300 border-purple-200">{label}</Badge>
      case 'إدارة عامة':
        return <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-200">{label}</Badge>
      case 'إدارة':
        return <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">{label}</Badge>
      case 'قسم':
        return <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-200">{label}</Badge>
      case 'وحدة':
        return <Badge className="bg-slate-600/10 text-slate-700 dark:text-slate-300 border-slate-200">{label}</Badge>
      default:
        return <Badge variant="outline">{label}</Badge>
    }
  }

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft
  const BreadcrumbChevron = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className={cn('w-full flex flex-col gap-3 font-sans', isRTL ? 'text-right' : 'text-left', embedded ? '' : 'p-3 md:p-5 max-w-[1800px] mx-auto')}>

      {/* ---------------- BREADCRUMB HEADER BAR (Matching Screenshot) ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-primary dark:bg-blue-600/90 text-white p-2.5 sm:px-4 rounded-t-lg shadow-sm">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto max-w-full py-0.5 scrollbar-none">
            <LayoutGrid className="size-4 shrink-0 text-white" />

            {/* 1. الرئيسية: عند النقر يتم التحول إلى شاشة لوحة التحكم */}
            <button
              type="button"
              onClick={() => {
                setActiveModule('dashboard')
                if (onNavigateToDashboard) {
                  onNavigateToDashboard()
                }
              }}
              className="hover:bg-white/15 px-2 py-1 rounded-md transition-all text-blue-100 hover:text-white flex items-center gap-1 cursor-pointer font-medium text-xs sm:text-sm shrink-0"
              title={L('الرئيسية', 'Dashboard')}
            >
              <span>{L('الرئيسية', 'Home')}</span>
            </button>

            <BreadcrumbChevron className="size-3 text-blue-300 shrink-0" />

            {/* 2. الهيكل التنظيمي: عند النقر تفتح شاشة تعديل الهيكل */}
            <button
              type="button"
              onClick={() => {
                if (!editingItem && items.length > 0) {
                  handleEdit(items[0])
                } else if (!editingItem) {
                  handleAddNew()
                } else {
                  setViewMode('form')
                }
              }}
              className={cn(
                "px-2 py-1 rounded-md transition-all font-semibold cursor-pointer text-xs sm:text-sm shrink-0",
                viewMode === 'form'
                  ? "bg-white/20 text-white shadow-sm ring-1 ring-white/30"
                  : "text-blue-100 hover:bg-white/15 hover:text-white"
              )}
              title={L(' شاشة تعديل الهيكل التنظيمي', ' Org Structure Edit Screen')}
            >
              {L('الهيكل التنظيمي', 'Organizational Structure')}
            </button>

            <BreadcrumbChevron className="size-3 text-blue-300 shrink-0 hidden sm:inline-block" />
          </div>

          {/* 3. تنقل بين أنماط العرض */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/25 p-0.5 rounded-lg border border-white/10 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center",
                viewMode === 'list'
                  ? "bg-white text-blue-900 shadow-sm font-bold"
                  : "text-blue-100 hover:bg-white/15 hover:text-white"
              )}
              title={L('جدول الهيكل التنظيمي', 'Org Structure Data Table')}
            >
              <Grid className="size-3.5" />
              <span>{L('الجدول', 'Table')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center",
                viewMode === 'tree'
                  ? "bg-white text-blue-900 shadow-sm font-bold"
                  : "text-blue-100 hover:bg-white/15 hover:text-white"
              )}
              title={L('المخطط التنظيمي الشجري التفاعلي', 'Interactive Org Chart Tree')}
            >
              <FolderTree className="size-3.5" />
              <span className="truncate">{L('الشجرة التنظيمية', 'Org Tree')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('audit')}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center",
                viewMode === 'audit'
                  ? "bg-white text-blue-900 shadow-sm font-bold"
                  : "text-blue-100 hover:bg-white/15 hover:text-white"
              )}
              title={L('سجل التدقيق والتغييرات الحرج', 'System Audit & History Log')}
            >
              <BarChart2 className="size-3.5" />
              <span className="truncate">{L('سجل التدقيق', 'Audit Log')}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== 'list' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setViewMode('list')}
              className="h-7 px-2.5 gap-1 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/25 cursor-pointer"
            >
              <ArrowIcon className="size-3.5" />
              <span>{L('العودة إلى القائمة', 'Back to List')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/*                              VIEW 1: LIST VIEW                            */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <Card className="border border-border shadow-sm rounded-b-lg overflow-hidden bg-card">

          {/* DRAG COLUMN GROUPING BANNER (Matching Screenshot) */}
          <div className="bg-slate-100 dark:bg-slate-900/80 border-b px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span className="italic flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              {L('اسحب العمود هنا للتجميع الخاص به', 'Drag a column header here to group')}
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
              {L('إجمالي الهياكل المعرفة:', 'Total Defined Structures:')} <strong className="text-foreground">{items.length}</strong>
            </div>
          </div>

          {/* ACTION TOOLBAR (Exact layout replica of user screenshot) */}
          <div className="p-2 sm:p-3 border-b flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-900/40">

            {/* Right Group in RTL: Columns Dropdown & Search Input */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Columns Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs bg-background">
                    <span>{L('أعمدة', 'Columns')}</span>
                    <ChevronLeft className="size-3 -rotate-90 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56 max-h-80 overflow-y-auto">
                  <DropdownMenuCheckboxItem checked={visibleCols.code} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, code: !!v }))}>
                    {L('رقم الهيكل', 'Code')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.name} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, name: !!v }))}>
                    {L('اسم الهيكل', 'Name')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.parentCode} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, parentCode: !!v }))}>
                    {L('الهيكل الأعلى', 'Parent Code')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.parentName} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, parentName: !!v }))}>
                    {L('اسم الهيكل الأعلى', 'Parent Name')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.type} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, type: !!v }))}>
                    {L('نوع الهيكل', 'Type')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.level} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, level: !!v }))}>
                    {L('المستوى', 'Level')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.notes} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, notes: !!v }))}>
                    {L('ملاحظات', 'Notes')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.createdAt} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, createdAt: !!v }))}>
                    {L('تاريخ الإدخال', 'Entry Date')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.isSuspended} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, isSuspended: !!v }))}>
                    {L('التوقيف', 'Suspension')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.suspendedBy} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, suspendedBy: !!v }))}>
                    {L('المستخدم الموقف', 'Suspended By')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.suspendedAt} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, suspendedAt: !!v }))}>
                    {L('تاريخ التوقيف', 'Suspension Date')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.suspensionReason} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, suspensionReason: !!v }))}>
                    {L('سبب التوقيف', 'Suspension Reason')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.suspensionCount} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, suspensionCount: !!v }))}>
                    {L('مرات التوقيف', 'Suspension Count')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.createdBy} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, createdBy: !!v }))}>
                    {L('مدخل البيانات', 'Entered By')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.updatedBy} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, updatedBy: !!v }))}>
                    {L('أخر معدل للبيانات', 'Last Editor')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.updatedAt} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, updatedAt: !!v }))}>
                    {L('تاريخ أخر تعديل', 'Last Modified Date')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.modificationCount} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, modificationCount: !!v }))}>
                    {L('مرات التعديل', 'Modification Count')}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleCols.printCount} onCheckedChange={(v) => setVisibleCols((p) => ({ ...p, printCount: !!v }))}>
                    {L('مرات الطباعة', 'Print Count')}
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={() => {
                      setVisibleCols(DEFAULT_VISIBLE_COLS)
                      toast.success(L('تم إعادة ضبط الأعمدة إلى الوضع الافتراضي', 'Columns reset to default'))
                    }}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer justify-center py-1.5"
                  >
                    {L('إعادة ضبط الأعمدة الافتراضية', 'Reset Default Columns')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search Box */}
              <div className="relative w-full sm:w-52">
                <Search className={cn('size-3.5 absolute top-2.5 text-muted-foreground', isRTL ? 'right-2.5' : 'left-2.5')} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={L('بحث في الهياكل…', 'Search structures…')}
                  className={cn('h-8 text-xs bg-background', isRTL ? 'pr-7 pl-6' : 'pl-7 pr-6')}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className={cn('absolute top-2 text-muted-foreground hover:text-foreground', isRTL ? 'left-2' : 'right-2')}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-md border border-slate-300/50 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-all",
                    statusFilter === 'ALL' ? "bg-white dark:bg-slate-900 text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {L('الكل', 'All')}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                    statusFilter === 'ACTIVE' ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-muted-foreground hover:text-emerald-600"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {L('نشط', 'Active')}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SUSPENDED')}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                    statusFilter === 'SUSPENDED' ? "bg-red-600 text-white font-bold shadow-xs" : "text-muted-foreground hover:text-red-600"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-red-400" />
                  {L('موقوف', 'Suspended')}
                </button>
              </div>
            </div>

            {/* Toolbar Action Icons matching screenshot */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Export Dropdown (Excel, CSV, Word, PDF) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                    title={L('خيارات التصدير (Excel, CSV, Word, PDF)', 'Export Options (Excel, CSV, Word, PDF)')}
                  >
                    <FileSpreadsheet className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} className="w-52 shadow-xl border-slate-200 dark:border-slate-800 z-50">
                  <DropdownMenuItem onClick={handleExportExcel} className="gap-2.5 text-xs font-medium cursor-pointer py-2">
                    <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{L('Excel', 'Excel')}</span>

                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV} className="gap-2.5 text-xs font-medium cursor-pointer py-2">
                    <Columns className="size-4 text-blue-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{L('CSV', 'CSV')}</span>

                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportWord} className="gap-2.5 text-xs font-medium cursor-pointer py-2">
                    <FileText className="size-4 text-indigo-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{L('Word', 'Word')}</span>

                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} className="gap-2.5 text-xs font-medium cursor-pointer py-2">
                    <Printer className="size-4 text-red-600 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{L('PDF', 'PDF')}</span>

                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>



              {/* Chart: فتح المخطط التنظيمي البياني الشجري */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('tree')}
                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer transition-all"
                title={L(' المخطط التنظيمي البياني ', 'Org Chart')}
              >
                <BarChart2 className="size-4" />
              </Button>

              {/* Print */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                onClick={() => window.print()}
                title={L('طباعة الجدول', 'Print Table')}
              >
                <Printer className="size-4" />
              </Button>

              {/* Lock Status */}
              <Button
                variant="ghost"
                size="sm"
                disabled={!selectedItem}
                className={cn(
                  "h-8 w-8 p-0 transition-all",
                  selectedItem
                    ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 shadow-xs hover:scale-105"
                    : "text-slate-400 opacity-40 cursor-not-allowed"
                )}
                onClick={() => {
                  if (selectedItem) {
                    toast.info(L(`تغيير حالة قفل الشاشة `, `Lock status toggled `))
                  }
                }}
                title={selectedItem ? L(`قفل الشاشة`, `Lock Screen: `) : L('اختر صفي من الجدول أولاً', 'Select a row to lock')}
              >
                <Lock className="size-4" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="sm"
                disabled={!selectedItem}
                className={cn(
                  "h-8 w-8 p-0 transition-all",
                  selectedItem
                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shadow-xs hover:scale-105"
                    : "text-red-300 opacity-40 cursor-not-allowed"
                )}
                onClick={() => {
                  if (selectedItem && confirm(L(`هل تريد حذف الهيكل «${selectedItem.nameAr}»؟`, `Delete "${selectedItem.nameAr}"?`))) {
                    deleteMutation.mutate(selectedItem.id)
                  }
                }}
                title={selectedItem ? L(`حذف`, `Delete `) : L('اختر صفي من الجدول للحذف', 'Select a row to delete')}
              >
                <Trash2 className="size-4" />
              </Button>

              {/* Edit */}
              <Button
                variant="ghost"
                size="sm"
                disabled={!selectedItem}
                className={cn(
                  "h-8 w-8 p-0 transition-all",
                  selectedItem
                    ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-xs hover:scale-105"
                    : "text-amber-300 opacity-40 cursor-not-allowed"
                )}
                onClick={() => {
                  if (selectedItem) handleEdit(selectedItem)
                }}
                title={selectedItem ? L(`تعديل`, `Edit `) : L('اختر صفي من الجدول للتعديل', 'Select a row to edit')}
              >
                <Edit2 className="size-4" />
              </Button>

              {/* Details Eye */}
              <Button
                variant="ghost"
                size="sm"
                disabled={!selectedItem}
                className={cn(
                  "h-8 w-8 p-0 transition-all",
                  selectedItem
                    ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40  shadow-xs hover:scale-105"
                    : "text-emerald-300 opacity-40 cursor-not-allowed"
                )}
                onClick={() => {
                  if (selectedItem) handleEdit(selectedItem)
                }}
                title={selectedItem ? L(`عرض`, `View `) : L('اختر صفي من الجدول أولاً للعرض', 'Select a row to view')}
              >
                <Eye className="size-4" />
              </Button>

              {/* Add New (+) */}
              <Button
                size="sm"
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 p-0 rounded-md shadow-sm"
                title={L('إضافة ', 'Add ')}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>



          {/* MAIN GRID TABLE WITH HORIZONTAL SCROLLBAR */}
          <div className="overflow-x-auto min-h-[420px] w-full">
            <Table className="min-w-[1500px] border-collapse text-[11px] table-fixed">
              <TableHeader className="bg-slate-100/90 dark:bg-slate-900 border-b">
                <TableRow className="h-8 hover:bg-transparent text-slate-700 dark:text-slate-200">
                  {visibleCols.code && (
                    <TableHead
                      style={{ width: `${colWidths.code || 100}px`, minWidth: `${colWidths.code || 100}px`, maxWidth: `${colWidths.code || 100}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('رقم الهيكل', 'Code')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('code', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, code: DEFAULT_COL_WIDTHS.code }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.name && (
                    <TableHead
                      style={{ width: `${colWidths.name || 180}px`, minWidth: `${colWidths.name || 180}px`, maxWidth: `${colWidths.name || 180}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('اسم الهيكل', 'Structure Name')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('name', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, name: DEFAULT_COL_WIDTHS.name }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.parentCode && (
                    <TableHead
                      style={{ width: `${colWidths.parentCode || 110}px`, minWidth: `${colWidths.parentCode || 110}px`, maxWidth: `${colWidths.parentCode || 110}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('الهيكل الأعلى', 'Parent Code')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('parentCode', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, parentCode: DEFAULT_COL_WIDTHS.parentCode }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.parentName && (
                    <TableHead
                      style={{ width: `${colWidths.parentName || 180}px`, minWidth: `${colWidths.parentName || 180}px`, maxWidth: `${colWidths.parentName || 180}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('اسم الهيكل الأعلى', 'Parent Name')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('parentName', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, parentName: DEFAULT_COL_WIDTHS.parentName }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.type && (
                    <TableHead
                      style={{ width: `${colWidths.type || 130}px`, minWidth: `${colWidths.type || 130}px`, maxWidth: `${colWidths.type || 130}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('نوع الهيكل', 'Type')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('type', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, type: DEFAULT_COL_WIDTHS.type }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.level && (
                    <TableHead
                      style={{ width: `${colWidths.level || 80}px`, minWidth: `${colWidths.level || 80}px`, maxWidth: `${colWidths.level || 80}px` }}
                      className="font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap relative select-none group"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{L('المستوى', 'Level')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('level', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, level: DEFAULT_COL_WIDTHS.level }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.notes && (
                    <TableHead
                      style={{ width: `${colWidths.notes || 190}px`, minWidth: `${colWidths.notes || 190}px`, maxWidth: `${colWidths.notes || 190}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('ملاحظات', 'Notes')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('notes', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, notes: DEFAULT_COL_WIDTHS.notes }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.createdAt && (
                    <TableHead
                      style={{ width: `${colWidths.createdAt || 160}px`, minWidth: `${colWidths.createdAt || 160}px`, maxWidth: `${colWidths.createdAt || 160}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{L('تاريخ الإدخال', 'Entry Date')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('createdAt', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, createdAt: DEFAULT_COL_WIDTHS.createdAt }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.isSuspended && (
                    <TableHead
                      style={{ width: `${colWidths.isSuspended || 100}px`, minWidth: `${colWidths.isSuspended || 100}px`, maxWidth: `${colWidths.isSuspended || 100}px` }}
                      className="font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap relative select-none group"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{L('التوقيف', 'Suspension')}</span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">≡</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart('isSuspended', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, isSuspended: DEFAULT_COL_WIDTHS.isSuspended }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                        title={L('سحب لتغيير عرض العمود (انقر مرتين للإعادة)', 'Drag to resize column (Double click to reset)')}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.suspendedBy && (
                    <TableHead
                      style={{ width: `${colWidths.suspendedBy || 140}px`, minWidth: `${colWidths.suspendedBy || 140}px`, maxWidth: `${colWidths.suspendedBy || 140}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('المستخدم الموقف', 'Suspended By')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('suspendedBy', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, suspendedBy: DEFAULT_COL_WIDTHS.suspendedBy }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.suspendedAt && (
                    <TableHead
                      style={{ width: `${colWidths.suspendedAt || 160}px`, minWidth: `${colWidths.suspendedAt || 160}px`, maxWidth: `${colWidths.suspendedAt || 160}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('تاريخ التوقيف', 'Suspension Date')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('suspendedAt', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, suspendedAt: DEFAULT_COL_WIDTHS.suspendedAt }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.suspensionReason && (
                    <TableHead
                      style={{ width: `${colWidths.suspensionReason || 190}px`, minWidth: `${colWidths.suspensionReason || 190}px`, maxWidth: `${colWidths.suspensionReason || 190}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('سبب التوقيف', 'Suspension Reason')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('suspensionReason', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, suspensionReason: DEFAULT_COL_WIDTHS.suspensionReason }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.suspensionCount && (
                    <TableHead
                      style={{ width: `${colWidths.suspensionCount || 110}px`, minWidth: `${colWidths.suspensionCount || 110}px`, maxWidth: `${colWidths.suspensionCount || 110}px` }}
                      className="font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap relative select-none group"
                    >
                      <span>{L('مرات التوقيف', 'Suspension Count')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('suspensionCount', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, suspensionCount: DEFAULT_COL_WIDTHS.suspensionCount }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.createdBy && (
                    <TableHead
                      style={{ width: `${colWidths.createdBy || 130}px`, minWidth: `${colWidths.createdBy || 130}px`, maxWidth: `${colWidths.createdBy || 130}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('مدخل البيانات', 'Entered By')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('createdBy', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, createdBy: DEFAULT_COL_WIDTHS.createdBy }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.updatedBy && (
                    <TableHead
                      style={{ width: `${colWidths.updatedBy || 130}px`, minWidth: `${colWidths.updatedBy || 130}px`, maxWidth: `${colWidths.updatedBy || 130}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('أخر معدل للبيانات', 'Last Editor')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('updatedBy', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, updatedBy: DEFAULT_COL_WIDTHS.updatedBy }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.updatedAt && (
                    <TableHead
                      style={{ width: `${colWidths.updatedAt || 160}px`, minWidth: `${colWidths.updatedAt || 160}px`, maxWidth: `${colWidths.updatedAt || 160}px` }}
                      className={cn(
                        'font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap relative select-none group',
                        isRTL ? 'text-right' : 'text-left'
                      )}
                    >
                      <span className="truncate">{L('تاريخ أخر تعديل', 'Last Modified Date')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('updatedAt', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, updatedAt: DEFAULT_COL_WIDTHS.updatedAt }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.modificationCount && (
                    <TableHead
                      style={{ width: `${colWidths.modificationCount || 110}px`, minWidth: `${colWidths.modificationCount || 110}px`, maxWidth: `${colWidths.modificationCount || 110}px` }}
                      className="font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap relative select-none group"
                    >
                      <span>{L('مرات التعديل', 'Modification Count')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('modificationCount', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, modificationCount: DEFAULT_COL_WIDTHS.modificationCount }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}

                  {visibleCols.printCount && (
                    <TableHead
                      style={{ width: `${colWidths.printCount || 110}px`, minWidth: `${colWidths.printCount || 110}px`, maxWidth: `${colWidths.printCount || 110}px` }}
                      className="font-bold py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap relative select-none group"
                    >
                      <span>{L('مرات الطباعة', 'Print Count')}</span>
                      <div
                        onMouseDown={(e) => handleResizeStart('printCount', e)}
                        onDoubleClick={() => setColWidths((p) => ({ ...p, printCount: DEFAULT_COL_WIDTHS.printCount }))}
                        className={cn(
                          "absolute top-0 bottom-0 w-3 z-30 cursor-col-resize hover:bg-blue-500/80 transition-colors flex items-center justify-center group/handle",
                          isRTL ? "-left-1.5" : "-right-1.5",
                          isResizingMode ? "bg-blue-400/40 animate-pulse" : "bg-transparent"
                        )}
                      >
                        <div className="w-[2px] h-4/5 bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                      {L('لا توجد نتائج مطابقة لبيانات الهيكل التنظيمي', 'No matching organization structure records found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const nameText = isRTL ? item.nameAr : (item.nameEn || item.nameAr)
                    const parentNameText = isRTL ? (item.parent?.nameAr || '-') : (item.parent?.nameEn || item.parent?.nameAr || '-')
                    const notesText = item.notes || '-'
                    const createdAtText = item.createdAt || '14:04:46.069 17/08/2026'
                    const suspendedByText = item.suspendedBy || '-'
                    const suspendedAtText = item.suspendedAt || '-'
                    const suspensionReasonText = item.suspensionReason || '-'
                    const createdByText = item.createdBy || 'admin'
                    const updatedByText = item.updatedBy || 'admin'
                    const updatedAtText = item.updatedAt || '14:04:46.069 17/08/2026'

                    const isSelected = selectedId === item.id

                    return (
                      <TableRow
                        key={item.id}
                        data-selected={isSelected || undefined}
                        onClick={() => setSelectedId(item.id)}
                        onDoubleClick={() => handleEdit(item)}
                        className={cn(
                          "h-8 select-none cursor-pointer border-b border-slate-200 dark:border-slate-700",
                          isSelected
                            ? "!bg-[#d0e2f7] dark:!bg-[#1e3a5f] !border-l-[3px] !border-l-blue-600 dark:!border-l-blue-400"
                            : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        )}
                        style={isSelected ? { backgroundColor: '#a0ccff50' } : undefined}
                      >
                        {visibleCols.code && (
                          <TableCell
                            style={{ width: `${colWidths.code || 100}px`, minWidth: `${colWidths.code || 100}px`, maxWidth: `${colWidths.code || 100}px` }}
                            className="font-semibold text-blue-600 dark:text-blue-400 font-mono border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={item.code}>
                              {item.code}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.name && (
                          <TableCell
                            style={{ width: `${colWidths.name || 180}px`, minWidth: `${colWidths.name || 180}px`, maxWidth: `${colWidths.name || 180}px` }}
                            className="font-medium text-foreground border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={nameText}>
                              {nameText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.parentCode && (
                          <TableCell
                            style={{ width: `${colWidths.parentCode || 110}px`, minWidth: `${colWidths.parentCode || 110}px`, maxWidth: `${colWidths.parentCode || 110}px` }}
                            className="font-mono text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={item.parent?.code || item.parentId || '-'}>
                              {item.parent?.code || item.parentId || '-'}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.parentName && (
                          <TableCell
                            style={{ width: `${colWidths.parentName || 180}px`, minWidth: `${colWidths.parentName || 180}px`, maxWidth: `${colWidths.parentName || 180}px` }}
                            className="text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={parentNameText}>
                              {parentNameText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.type && (
                          <TableCell
                            style={{ width: `${colWidths.type || 130}px`, minWidth: `${colWidths.type || 130}px`, maxWidth: `${colWidths.type || 130}px` }}
                            className="border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <div className="truncate block w-full" title={item.type}>
                              {getTypeBadge(item.type)}
                            </div>
                          </TableCell>
                        )}

                        {visibleCols.level && (
                          <TableCell
                            style={{ width: `${colWidths.level || 80}px`, minWidth: `${colWidths.level || 80}px`, maxWidth: `${colWidths.level || 80}px` }}
                            className="text-center border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="font-mono font-bold">
                              {item.level}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.notes && (
                          <TableCell
                            style={{ width: `${colWidths.notes || 190}px`, minWidth: `${colWidths.notes || 190}px`, maxWidth: `${colWidths.notes || 190}px` }}
                            className="text-muted-foreground border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={notesText}>
                              {notesText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.createdAt && (
                          <TableCell
                            style={{ width: `${colWidths.createdAt || 160}px`, minWidth: `${colWidths.createdAt || 160}px`, maxWidth: `${colWidths.createdAt || 160}px` }}
                            className="font-mono text-[10px] text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={createdAtText}>
                              {createdAtText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.isSuspended && (
                          <TableCell
                            style={{ width: `${colWidths.isSuspended || 100}px`, minWidth: `${colWidths.isSuspended || 100}px`, maxWidth: `${colWidths.isSuspended || 100}px` }}
                            className="text-center border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            {item.isSuspended ? (
                              <Badge variant="destructive" className="gap-1 text-[9px] py-0 px-1">
                                <XCircle className="size-2.5" />
                                {L('موقف', 'Suspended')}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {L('نشط', 'Active')}
                              </span>
                            )}
                          </TableCell>
                        )}

                        {visibleCols.suspendedBy && (
                          <TableCell
                            style={{ width: `${colWidths.suspendedBy || 140}px`, minWidth: `${colWidths.suspendedBy || 140}px`, maxWidth: `${colWidths.suspendedBy || 140}px` }}
                            className="text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={suspendedByText}>
                              {suspendedByText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.suspendedAt && (
                          <TableCell
                            style={{ width: `${colWidths.suspendedAt || 160}px`, minWidth: `${colWidths.suspendedAt || 160}px`, maxWidth: `${colWidths.suspendedAt || 160}px` }}
                            className="font-mono text-[10px] text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={suspendedAtText}>
                              {suspendedAtText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.suspensionReason && (
                          <TableCell
                            style={{ width: `${colWidths.suspensionReason || 190}px`, minWidth: `${colWidths.suspensionReason || 190}px`, maxWidth: `${colWidths.suspensionReason || 190}px` }}
                            className="text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={suspensionReasonText}>
                              {suspensionReasonText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.suspensionCount && (
                          <TableCell
                            style={{ width: `${colWidths.suspensionCount || 110}px`, minWidth: `${colWidths.suspensionCount || 110}px`, maxWidth: `${colWidths.suspensionCount || 110}px` }}
                            className="text-center font-mono border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            {item.suspensionCount ?? 0}
                          </TableCell>
                        )}

                        {visibleCols.createdBy && (
                          <TableCell
                            style={{ width: `${colWidths.createdBy || 130}px`, minWidth: `${colWidths.createdBy || 130}px`, maxWidth: `${colWidths.createdBy || 130}px` }}
                            className="text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={createdByText}>
                              {createdByText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.updatedBy && (
                          <TableCell
                            style={{ width: `${colWidths.updatedBy || 130}px`, minWidth: `${colWidths.updatedBy || 130}px`, maxWidth: `${colWidths.updatedBy || 130}px` }}
                            className="text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={updatedByText}>
                              {updatedByText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.updatedAt && (
                          <TableCell
                            style={{ width: `${colWidths.updatedAt || 160}px`, minWidth: `${colWidths.updatedAt || 160}px`, maxWidth: `${colWidths.updatedAt || 160}px` }}
                            className="font-mono text-[10px] text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            <span className="truncate block w-full cursor-default" title={updatedAtText}>
                              {updatedAtText}
                            </span>
                          </TableCell>
                        )}

                        {visibleCols.modificationCount && (
                          <TableCell
                            style={{ width: `${colWidths.modificationCount || 110}px`, minWidth: `${colWidths.modificationCount || 110}px`, maxWidth: `${colWidths.modificationCount || 110}px` }}
                            className="text-center font-mono border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            {item.modificationCount ?? 0}
                          </TableCell>
                        )}

                        {visibleCols.printCount && (
                          <TableCell
                            style={{ width: `${colWidths.printCount || 110}px`, minWidth: `${colWidths.printCount || 110}px`, maxWidth: `${colWidths.printCount || 110}px` }}
                            className="text-center font-mono border-r border-slate-100 dark:border-slate-800 py-1 px-2 overflow-hidden"
                          >
                            {item.printCount ?? 0}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* PAGINATION FOOTER (Exact replica of user screenshot) */}
          <div className="p-2.5 bg-slate-100/90 dark:bg-slate-900 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
            {/* Left Info in RTL: "1 من 1 صفحة العناصر 10" */}
            <div className="flex items-center gap-2">
              <span>
                {L(`1 من ${totalPages} صفحة العناصر ${filteredItems.length}`, `Page ${currentPage} of ${totalPages} (Items ${filteredItems.length})`)}
              </span>
            </div>

            {/* Right Controls: Items selector & Page buttons */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Items</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(val) => {
                    setPageSize(Number(val))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-7 w-16 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1 dir-ltr">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0 bg-background"
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0 bg-background"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>

                <span className="h-7 min-w-[28px] px-2 flex items-center justify-center rounded-md bg-blue-600 text-white font-mono font-bold text-xs">
                  {currentPage}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0 bg-background"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0 bg-background"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/*                              VIEW 2: FORM VIEW                            */}
      {/* ========================================================================= */}
      {viewMode === 'form' && (
        <form onSubmit={handleSubmitForm} className="flex flex-col gap-4">

          {/* TOP RECORD NAVIGATION & ACTIONS TOOLBAR */}
          <div className="p-2 sm:p-2.5 bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF]  dark:bg-none dark:bg-blue-700/80  border-b border-blue-100 dark:border-blue-700/40 rounded-lg flex flex-wrap items-center justify-between gap-2.5 shadow-md backdrop-blur-sm">
            {/* Left Section: Action & Record Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* السجل Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold gap-1 bg-primary dark:bg-blue-600/90 hover:bg-blue-500 text-slate-100 border-blue-300/80 dark:border-blue-500/90 hover:border-slate-200 transition-all rounded-md shadow-xs cursor-pointer"
                  >
                    <FolderTree className="size-4 text-white-400 shrink-0" />
                    <span>{L('السجل', 'Record')}</span>
                    <BreadcrumbChevron className="size-3.5 text-white-400 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} className="w-30 z-50">
                  <DropdownMenuItem onClick={handleAddNew} className="gap-2 text-xs font-medium cursor-pointer">
                    <Plus className="size-3.5 text-blue-500" />
                    <span>{L('سجل جديد', 'New Record')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode('list')} className="gap-2 text-xs font-medium cursor-pointer">
                    <Grid className="size-3.5 text-emerald-500" />
                    <span>{L('عرض الكل', 'View All ')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refetch()} className="gap-2 text-xs font-medium cursor-pointer">
                    <RotateCw className="size-3.5 text-amber-500" />
                    <span>{L('تحديث', 'Refresh')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* الإجراء Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold gap-1.5 bg-primary dark:bg-blue-600/90 hover:bg-blue-500 text-slate-100 border-blue-300/80 dark:border-blue-500/90 hover:border-slate-200 transition-all rounded-md shadow-xs cursor-pointer"
                  >
                    <Sliders className="size-3.5 text-blue-100 shrink-0" />
                    <span>{L('الإجراء', 'Action')}</span>
                    <BreadcrumbChevron className="size-3.5 text-white-400 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={6} className="w-30 z-50">
                  <DropdownMenuItem onClick={handleSubmitForm} className="gap-2 text-xs font-medium cursor-pointer">
                    <Save className="size-3.5 text-emerald-500" />
                    <span>{L('حفظ', 'Save')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()} className="gap-2 text-xs font-medium cursor-pointer">
                    <Printer className="size-3.5 text-blue-500" />
                    <span>{L('طباعة', 'Print')}</span>
                  </DropdownMenuItem>
                  {editingItem && (
                    <DropdownMenuItem
                      className="gap-2 text-xs font-medium text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer"
                      onClick={() => {
                        if (confirm(L('هل أنت تأكد من حذف هذا الهيكل التنظيمي؟', 'Delete this organizational structure?'))) {
                          deleteMutation.mutate(editingItem.id)
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      <span>{L('حذف', 'Delete')}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>

          {/* MAIN FORM CARD */}
          <Card className="p-5 sm:p-6 border border-border shadow-sm space-y-6 bg-card">
            <div className="border-b pb-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" />
                <h3 className="font-bold text-base text-foreground">
                  {editingItem
                    ? L(`تعديل هيكل تنظيمي (${editingItem.nameAr})`, `Edit Org Structure (${editingItem.nameEn || editingItem.nameAr})`)
                    : L('إضافة هيكل تنظيمي جديد', 'Add New Org Structure')}
                </h3>
              </div>
              <Badge variant="outline" className="font-mono text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                {L(`المستوى المحسوب: ${calculatedFormLevel}`, `Calculated Level: ${calculatedFormLevel}`)}
              </Badge>
            </div>

            {/* Grid Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* رقم الهيكل */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-xs font-bold flex items-center gap-1">
                  {L('رقم الهيكل', 'Structure Code')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                  placeholder={L('مثال: 11', 'e.g. 11')}
                  className={cn('font-mono h-10 text-sm dir-ltr', isRTL ? 'text-right' : 'text-left')}
                  required
                />
              </div>

              {/* اسم الهيكل (عربي) */}
              <div className="space-y-2">
                <Label htmlFor="nameAr" className="text-xs font-bold flex items-center gap-1">
                  {L('اسم الهيكل (بالعربية)', 'Structure Name (Arabic)')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nameAr"
                  value={formData.nameAr}
                  onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                  placeholder={L('مثال: إدارة الجودة والرقابة', 'e.g. Quality Control Department')}
                  className="h-10 text-sm"
                  required
                />
              </div>

              {/* اسم الهيكل (إنجليزي) */}
              <div className="space-y-2">
                <Label htmlFor="nameEn" className="text-xs font-medium">
                  {L('اسم الهيكل (بالإنجليزية)', 'Structure Name (English)')}
                </Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                  placeholder="e.g. Quality Control Dept"
                  className={cn('h-10 text-sm dir-ltr', isRTL ? 'text-right' : 'text-left')}
                />
              </div>

              {/* الهيكل الأعلى مع حماية العلاقات الدائرية */}
              <div className="space-y-2">
                <Label htmlFor="parentId" className="text-xs font-medium">
                  {L('الهيكل الأعلى (التابع له)', 'Parent Structure')}
                </Label>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(val) => setFormData((p) => ({ ...p, parentId: val === 'none' ? '' : val }))}
                >
                  <SelectTrigger id="parentId" className="h-10 text-sm">
                    <SelectValue placeholder={L('اختر الهيكل الأعلى…', 'Select Parent Structure…')} />
                  </SelectTrigger>
                  <SelectContent align={isRTL ? 'start' : 'end'}>
                    <SelectItem value="none">{L('بدون هيكل أعلى (وحدة رئيسية)', 'No Parent (Root Unit)')}</SelectItem>
                    {items.map((parent) => {
                      const isForbidden = invalidParentIds.has(parent.id)
                      return (
                        <SelectItem key={parent.id} value={parent.id} disabled={isForbidden}>
                          {parent.code} - {isRTL ? parent.nameAr : (parent.nameEn || parent.nameAr)} {isForbidden ? `(${L('غير متاح - مرجع دائي', 'Forbidden - Cycle')})` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* نوع الهيكل */}
              <div className="space-y-2">
                <Label htmlFor="type" className="text-xs font-medium">
                  {L('نوع الهيكل', 'Structure Type')}
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData((p) => ({ ...p, type: val }))}
                >
                  <SelectTrigger id="type" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align={isRTL ? 'start' : 'end'}>
                    <SelectItem value="قطاع">{L('قطاع', 'Sector')}</SelectItem>
                    <SelectItem value="إدارة عامة">{L('إدارة عامة', 'General Directorate')}</SelectItem>
                    <SelectItem value="إدارة">{L('إدارة', 'Department')}</SelectItem>
                    <SelectItem value="قسم">{L('قسم', 'Section')}</SelectItem>
                    <SelectItem value="وحدة">{L('وحدة', 'Unit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* مركز التكلفة المرتبط */}
              <div className="space-y-2">
                <Label htmlFor="costCenterId" className="text-xs font-medium">
                  {L('مركز التكلفة المرتبط (المحاسبة)', 'Linked Cost Center')}
                </Label>
                <Select
                  value={formData.costCenterId || 'none'}
                  onValueChange={(val) => setFormData((p) => ({ ...p, costCenterId: val === 'none' ? '' : val }))}
                >
                  <SelectTrigger id="costCenterId" className="h-10 text-sm">
                    <SelectValue placeholder={L('اختر مركز التكلفة…', 'Select Cost Center…')} />
                  </SelectTrigger>
                  <SelectContent align={isRTL ? 'start' : 'end'}>
                    <SelectItem value="none">{L('بدون مركز تكلفة', 'No Cost Center')}</SelectItem>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {isRTL ? cc.nameAr : (cc.nameEn || cc.nameAr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* مدير الهيكل / المسند له */}
              <div className="space-y-2">
                <Label htmlFor="managerId" className="text-xs font-medium">
                  {L('مدير الهيكل التنظيمي', 'Structure Manager')}
                </Label>
                <Select
                  value={formData.managerId || 'none'}
                  onValueChange={(val) => setFormData((p) => ({ ...p, managerId: val === 'none' ? '' : val }))}
                >
                  <SelectTrigger id="managerId" className="h-10 text-sm">
                    <SelectValue placeholder={L('اختر مدير الهيكل…', 'Select Manager…')} />
                  </SelectTrigger>
                  <SelectContent align={isRTL ? 'start' : 'end'}>
                    <SelectItem value="none">{L('بدون مدير مسند', 'Unassigned Manager')}</SelectItem>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.employeeNo} - {isRTL ? emp.nameAr : (emp.nameEn || emp.nameAr)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* الحالة الإدارية */}
              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs font-medium">
                  {L('الحالة التشغيلية', 'Operational Status')}
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData((p) => ({ ...p, status: val, isSuspended: val === 'SUSPENDED' }))}
                >
                  <SelectTrigger id="status" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align={isRTL ? 'start' : 'end'}>
                    <SelectItem value="ACTIVE">{L('نشط (مفعل)', 'Active')}</SelectItem>
                    <SelectItem value="SUSPENDED">{L('موقوف (مؤقتاً)', 'Suspended')}</SelectItem>
                    <SelectItem value="ARCHIVED">{L('مؤرشف', 'Archived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* المستوى تلقائي */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {L('المستوى التنظيمي (تلقائي)', 'Organizational Level (Auto)')}
                </Label>
                <div className="h-10 px-3 bg-muted border rounded-md flex items-center font-mono font-bold text-sm text-blue-700 dark:text-blue-300">
                  {calculatedFormLevel}
                </div>
              </div>

              {/* ملاحظات */}
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="notes" className="text-xs font-medium">
                  {L('ملاحظات', 'Notes')}
                </Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={L('أي ملاحظات إضافية حول هذا الهيكل التنظيمي…', 'Additional notes about this structure…')}
                  className="h-10 text-sm"
                />
              </div>

            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setViewMode('list')
                  setEditingItem(null)
                }}
              >
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
              >
                <Save className="size-4" />
                <span>{editingItem ? L('حفظ التعديلات', 'Save Changes') : L('حفظ', 'Save')}</span>
              </Button>
            </div>
          </Card>

        </form>
      )}

      {/* ========================================================================= */}
      {/*                              VIEW 3: TREE VIEW                            */}
      {/* ========================================================================= */}
      {viewMode === 'tree' && (
        <Card className="p-4 border border-border shadow-sm rounded-b-lg bg-card min-h-[500px]">
          <div className="flex items-center justify-between border-b pb-3 mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FolderTree className="size-5 text-blue-600" />
              <h3 className="font-bold text-base text-foreground">
                {L('المخطط التنظيمي الشجري التفاعلي', 'Interactive Organizational Tree')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleAddNew} className="h-8 gap-1 text-xs">
                <Plus className="size-3.5" />
                {L('إضافة وحدة إدارية', 'Add Unit')}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-lg border border-slate-200/60 dark:border-slate-800">
            <OrgTreeVisualizer
              items={items}
              isRTL={isRTL}
              L={L}
              getTypeBadge={getTypeBadge}
              onEdit={handleEdit}
              onSuspend={(item) => {
                setTargetSuspendItem(item)
                setSuspensionReasonInput(item.suspensionReason || '')
                setSuspendDialogOpen(true)
              }}
            />
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/*                              VIEW 4: AUDIT LOG VIEW                       */}
      {/* ========================================================================= */}
      {viewMode === 'audit' && (
        <Card className="p-4 border border-border shadow-sm rounded-b-lg bg-card">
          <div className="flex items-center justify-between border-b pb-3 mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-5 text-purple-600" />
              <h3 className="font-bold text-base text-foreground">
                {L('سجل تدقيق وتغييرات الهيكل التنظيمي (Audit Logs)', 'Org Structure System Audit Log')}
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {L('سجل حرج غير قابل للتعديل', 'Immutable Audit History')}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-100 dark:bg-slate-900">
                <TableRow>
                  <TableHead className="font-bold">{L('رقم الهيكل', 'Code')}</TableHead>
                  <TableHead className="font-bold">{L('اسم الهيكل', 'Name')}</TableHead>

                  <TableHead className="font-bold">{L('مدخل البيانات', 'Created By')}</TableHead>
                  <TableHead className="font-bold">{L('تاريخ الإدخال', 'Created At')}</TableHead>
                  <TableHead className="font-bold text-center">{L('عدد التعديلات', 'Modifications')}</TableHead>
                  <TableHead className="font-bold">{L('حالة التوقيف', 'Suspension')}</TableHead>
                  <TableHead className="font-bold">{L('سبب التوقيف', 'Suspension Reason')}</TableHead>
                  <TableHead className="font-bold text-center">{L('مرات الطباعة', 'Print Count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold text-blue-600">{item.code}</TableCell>
                    <TableCell className="font-medium">{isRTL ? item.nameAr : (item.nameEn || item.nameAr)}</TableCell>

                    <TableCell>{item.createdBy || 'admin'}</TableCell>
                    <TableCell className="font-mono text-[11px]">{item.createdAt || '-'}</TableCell>
                    <TableCell className="text-center font-bold">{item.modificationCount ?? 0}</TableCell>
                    <TableCell>
                      {item.isSuspended ? (
                        <Badge variant="destructive" className="text-[10px]">{L('موقوف', 'Suspended')}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">{L('نشط', 'Active')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{item.suspensionReason || '-'}</TableCell>
                    <TableCell className="text-center font-mono">{item.printCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/*                       SUSPENSION REASON MODAL DIALOG                     */}
      {/* ========================================================================= */}
      {suspendDialogOpen && targetSuspendItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-5 bg-card border shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-red-600" />
                <h4 className="font-bold text-base">
                  {targetSuspendItem.isSuspended
                    ? L(`تفعيل الهيكل «${targetSuspendItem.nameAr}»`, `Activate Structure "${targetSuspendItem.nameAr}"`)
                    : L(`توقيف الهيكل «${targetSuspendItem.nameAr}»`, `Suspend Structure "${targetSuspendItem.nameAr}"`)}
                </h4>
              </div>
              <button onClick={() => setSuspendDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {targetSuspendItem.isSuspended
                ? L('سيؤدي إلغاء التوقيف إلى تفعيل الإدارة وإعادة إدراجها في قائمة التشغيل والعمليات الهيكلية.', 'Re-activating will make this structure operational for transactional assignment.')
                : L('تنبيه: سيؤدي التوقيف إلى تعليق جميع العمليات الإدارية الخاصة بهذا الهيكل التنظيمي.', 'Warning: Suspending will halt administrative assignments for this organizational unit.')}
            </p>

            {!targetSuspendItem.isSuspended && (
              <div className="space-y-1.5">
                <Label htmlFor="suspensionReasonInput" className="text-xs font-bold">
                  {L('سبب التوقيف الإداري', 'Suspension Reason')}
                </Label>
                <Input
                  id="suspensionReasonInput"
                  value={suspensionReasonInput}
                  onChange={(e) => setSuspensionReasonInput(e.target.value)}
                  placeholder={L('أدخل سبب التوقيف الإداري…', 'Enter administrative suspension reason…')}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button size="sm" variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                {L('إلغاء', 'Cancel')}
              </Button>
              <Button
                size="sm"
                variant={targetSuspendItem.isSuspended ? 'default' : 'destructive'}
                disabled={suspendMutation.isPending}
                onClick={() => {
                  suspendMutation.mutate({
                    id: targetSuspendItem.id,
                    isSuspended: !targetSuspendItem.isSuspended,
                    suspensionReason: suspensionReasonInput,
                  })
                }}
              >
                {targetSuspendItem.isSuspended ? L('تأكيد التفعيل', 'Confirm Activation') : L('تأكيد التوقيف', 'Confirm Suspension')}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}

// Sub-component: Recursive Visual Tree Renderer with Interactive Zoom & Pan Controls
function OrgTreeVisualizer({
  items,
  isRTL,
  L,
  getTypeBadge,
  onEdit,
  onSuspend,
}: {
  items: OrgStructureItem[]
  isRTL: boolean
  L: (ar: string, en: string) => string
  getTypeBadge: (type: string) => React.ReactNode
  onEdit: (item: OrgStructureItem) => void
  onSuspend: (item: OrgStructureItem) => void
}) {
  const [zoom, setZoom] = useState(1.0)
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const handleZoomIn = () => setZoom((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 2.0))
  const handleZoomOut = () => setZoom((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.35))
  const handleResetZoom = () => setZoom(1.0)
  const handleFitScreen = () => setZoom(0.65) // Auto scale to fit all horizontal branches

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedMap({})
      setAllCollapsed(false)
    } else {
      const map: Record<string, boolean> = {}
      items.forEach((item) => {
        if (items.some((child) => child.parentId === item.id)) {
          map[item.id] = true
        }
      })
      setCollapsedMap(map)
      setAllCollapsed(true)
    }
  }

  const toggleNodeCollapse = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const rootNodes = useMemo(() => items.filter((i) => !i.parentId), [items])

  return (
    <div className="flex flex-col w-full relative group">
      {/* Floating Interactive Zoom & Control Toolbar */}
      <div className="sticky top-2 z-20 self-center flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-background/95 dark:bg-slate-950/95 border border-slate-300 dark:border-slate-800 rounded-xl shadow-lg backdrop-blur-md transition-all max-w-[95vw] overflow-x-auto scrollbar-none justify-center">
        {/* Zoom Out Button (-) */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleZoomOut}
          className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
          title={L('تصغير (-) ', 'Zoom Out (-)')}
        >
          <ZoomOut className="size-4" />
        </Button>

        {/* Zoom Percentage Display */}
        <div className="h-8 px-2 flex items-center justify-center font-mono font-bold text-xs bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 min-w-[48px] sm:min-w-[55px] shrink-0">
          {Math.round(zoom * 100)}%
        </div>

        {/* Zoom In Button (+) */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleZoomIn}
          className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
          title={L('تكبير (+)', 'Zoom In (+)')}
        >
          <ZoomIn className="size-4" />
        </Button>

        <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-800 mx-0.5 shrink-0" />

        {/* Reset Zoom Button */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleResetZoom}
          className="h-8 px-2 text-xs font-medium gap-1 text-slate-600 dark:text-slate-400 hover:text-foreground cursor-pointer shrink-0"
          title={L('إعادة ضبط (100%)', 'Reset Zoom (100%)')}
        >
          <RotateCcw className="size-3.5" />
          <span className="hidden sm:inline">{L('100%', '100%')}</span>
        </Button>

        {/* Fit Screen Button */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleFitScreen}
          className="h-8 px-2 text-xs font-medium gap-1 text-slate-600 dark:text-slate-400 hover:text-foreground cursor-pointer shrink-0"
          title={L('احتواء الشاشة الكاملة', 'Fit Screen')}
        >
          <Maximize2 className="size-3.5" />
          <span className="hidden sm:inline">{L('تلاءم', 'Fit')}</span>
        </Button>

        <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-800 mx-0.5 shrink-0" />

        {/* Collapse / Expand All Button */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={toggleCollapseAll}
          className="h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1 sm:gap-1.5 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
          title={allCollapsed ? L('توسيع كافة الفروع', 'Expand All') : L('طي كافة الفروع', 'Collapse All')}
        >
          {allCollapsed ? <ChevronsDown className="size-3.5 text-blue-600" /> : <ChevronsUp className="size-3.5 text-blue-600" />}
          <span className="text-[11px] sm:text-xs">{allCollapsed ? L('توسيع الكل', 'Expand All') : L('طي الكل', 'Collapse All')}</span>
        </Button>
      </div>

      {/* Scalable Viewport Container */}
      <div className="w-full overflow-auto min-h-[600px] p-6 flex justify-center items-start border rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 scrollbar-thin">
        <div
          className="transition-transform duration-200 ease-out origin-top flex flex-col gap-10 items-center min-w-max py-4 px-6"
          style={{ transform: `scale(${zoom})` }}
        >
          {rootNodes.map((root) => (
            <TreeNodeItem
              key={root.id}
              item={root}
              allItems={items}
              isRTL={isRTL}
              L={L}
              getTypeBadge={getTypeBadge}
              onEdit={onEdit}
              onSuspend={onSuspend}
              collapsedMap={collapsedMap}
              onToggleCollapse={toggleNodeCollapse}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TreeNodeItem({
  item,
  allItems,
  isRTL,
  L,
  getTypeBadge,
  onEdit,
  onSuspend,
  collapsedMap,
  onToggleCollapse,
}: {
  item: OrgStructureItem
  allItems: OrgStructureItem[]
  isRTL: boolean
  L: (ar: string, en: string) => string
  getTypeBadge: (type: string) => React.ReactNode
  onEdit: (item: OrgStructureItem) => void
  onSuspend: (item: OrgStructureItem) => void
  collapsedMap: Record<string, boolean>
  onToggleCollapse: (id: string) => void
}) {
  const isCollapsed = !!collapsedMap[item.id]
  const children = useMemo(() => allItems.filter((i) => i.parentId === item.id), [allItems, item.id])
  const nameText = isRTL ? item.nameAr : (item.nameEn || item.nameAr)

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div
        className={cn(
          "w-72 p-3.5 rounded-2xl border-2 shadow-md transition-all relative bg-card hover:shadow-xl",
          item.isSuspended
            ? "border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 ring-1 ring-red-400/40"
            : "border-blue-200 dark:border-blue-800/80 hover:border-blue-500 ring-1 ring-blue-500/10"
        )}
      >
        {/* Card Header: Code Badge & Actions */}
        <div className="flex items-center justify-between border-b pb-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              #{item.code}
            </span>
            {getTypeBadge(item.type)}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/60 cursor-pointer"
              onClick={() => onEdit(item)}
              title={L('تعديل الهيكل', 'Edit Structure')}
            >
              <Edit2 className="size-3.5 text-amber-600 dark:text-amber-400" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 cursor-pointer"
              onClick={() => onSuspend(item)}
              title={item.isSuspended ? L('تفعيل الهيكل', 'Activate Structure') : L('توقيف الهيكل', 'Suspend Structure')}
            >
              {item.isSuspended ? (
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="size-3.5 text-red-600 dark:text-red-400" />
              )}
            </Button>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-bold text-sm text-foreground text-center py-1 truncate" title={nameText}>
          {nameText}
        </h4>

        {/* Information Table */}
        <div className="space-y-1.5 text-xs text-muted-foreground bg-slate-100/90 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 my-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">{L('المدير المسند:', 'Manager:')}</span>
            <strong className="text-foreground truncate max-w-[130px]" title={item.manager?.nameAr || L('بدون مدير', 'None')}>
              {item.manager ? item.manager.nameAr : <span className="text-slate-400 font-normal">{L('بدون مدير', 'None')}</span>}
            </strong>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">{L('مركز التكلفة:', 'Cost Center:')}</span>
            {item.costCenter ? (
              <strong className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {item.costCenter.code} - {item.costCenter.nameAr}
              </strong>
            ) : (
              <span className="text-slate-400 font-normal">{L('غير مرتبط', 'Unlinked')}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">{L('عدد الموظفين:', 'Employees:')}</span>
            <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0 h-4 font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {item._count?.employees ?? 0}
            </Badge>
          </div>
        </div>

        {/* Expand / Collapse Button */}
        {children.length > 0 && (
          <button
            onClick={() => onToggleCollapse(item.id)}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-2.5 py-0.5 shadow-lg transition-all flex items-center gap-1 cursor-pointer ring-2 ring-background text-[11px] font-bold"
            title={isCollapsed ? L('توسيع التفرعات', 'Expand Branch') : L('طي التفرعات', 'Collapse Branch')}
          >
            <span>{isCollapsed ? `+${children.length}` : '-'}</span>
          </button>
        )}
      </div>

      {/* Children Branches */}
      {!isCollapsed && children.length > 0 && (
        <div className="flex flex-col items-center mt-5 w-full">
          {/* Vertical Connecting Stem */}
          <div className="w-0.5 h-5 bg-blue-400 dark:bg-blue-700 shadow-xs" />

          {/* Horizontal Branch Line Container */}
          <div className="flex gap-8 items-start pt-4 relative border-t-2 border-blue-400 dark:border-blue-700">
            {children.map((child) => (
              <TreeNodeItem
                key={child.id}
                item={child}
                allItems={allItems}
                isRTL={isRTL}
                L={L}
                getTypeBadge={getTypeBadge}
                onEdit={onEdit}
                onSuspend={onSuspend}
                collapsedMap={collapsedMap}
                onToggleCollapse={onToggleCollapse}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
