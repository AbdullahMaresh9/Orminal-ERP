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
import {
  Truck, Plus, Pencil, Trash2, Phone, Mail, Building2, MapPin, Hash, Coins, Download, FileSpreadsheet, FileText, FileDown
} from 'lucide-react'

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  isCustomer: boolean
  isSupplier: boolean
  contactName?: string
  phone?: string
  email?: string
  taxNumber?: string
  address?: string
  creditLimit: number
  openingBalance: number
  currentBalance: number
  active: boolean
  createdAt: string
}

const VISIBLE_ROWS = 5
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

export default function SuppliersModule() {
  const { t, locale } = useT()
  const isRTL = locale === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'
  const stickyHead = 'sticky top-0 z-20 bg-muted whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]'
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading } = useQuery<{ data: Supplier[]; meta: { pagination: { total: number; totalPages: number } } }>({
    queryKey: ['suppliers', search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('isSupplier', 'true')
      if (search) params.set('q', search)
      if (statusFilter === 'active') params.set('active', 'true')
      if (statusFilter === 'inactive') params.set('active', 'false')

      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/partners?${params}`)
      if (!r.ok) throw new Error('Failed to load suppliers')
      return r.json()
    },
  })

  const suppliers = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1

  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.active).length,
    totalBalance: suppliers.reduce((s, c) => s + (c.currentBalance || 0), 0),
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/erp/partners/${editing.id}` : '/api/erp/partners'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed to save supplier')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ' : 'An error occurred')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/partners/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete supplier')
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Deleted successfully')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  })

  const handleSave = (formData: FormData) => {
    const payload: any = {
      code: formData.get('code') || undefined,
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      isCustomer: false,
      isSupplier: true,
      contactName: formData.get('contactName') || undefined,
      phone: formData.get('phone') || undefined,
      email: formData.get('email') || undefined,
      taxNumber: formData.get('taxNumber') || undefined,
      address: formData.get('address') || undefined,
      creditLimit: Number(formData.get('creditLimit')) || 0,
      openingBalance: Number(formData.get('openingBalance')) || 0,
      active: formData.get('active') === 'on',
    }
    saveMutation.mutate(payload)
  }

  const exportColumns: ExportColumn<Supplier>[] = [
    { key: 'code', header: isRTL ? 'الرمز' : 'Code', width: 14, align: 'center', value: (s) => s.code },
    { key: 'name', header: isRTL ? 'الاسم' : 'Name', width: 24, align: 'center', value: (s) => isRTL ? s.nameAr : (s.nameEn || s.nameAr) },
    { key: 'contactName', header: isRTL ? 'جهة الاتصال' : 'Contact Person', width: 20, align: 'center', value: (s) => s.contactName ?? '' },
    { key: 'phone', header: isRTL ? 'الهاتف' : 'Phone', width: 16, align: 'center', type: 'number', numFmt: '0', value: (s) => (s.phone ? Number(String(s.phone).replace(/\D/g, '')) || s.phone : '') },
    { key: 'currentBalance', header: isRTL ? 'الرصيد' : 'Balance', width: 16, align: 'center', type: 'currency', summable: true, value: (s) => s.currentBalance },
    { key: 'status', header: isRTL ? 'الحالة' : 'Status', width: 12, align: 'center', value: (s) => s.active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive') },
  ]

  const exportMeta: ExportMeta = {
    fileName: isRTL ? 'الموردون' : 'suppliers',
    title: isRTL ? 'تقرير الموردين' : 'Suppliers Report',
    subtitle: isRTL ? 'أورمنال' : 'Orminal',
    isRTL,
    summary: [
      { label: isRTL ? 'إجمالي الموردين' : 'Total Suppliers', value: formatInt(total) },
      { label: isRTL ? 'الموردون النشطون' : 'Active Suppliers', value: formatInt(stats.active) },
      { label: isRTL ? 'إجمالي الأرصدة' : 'Total Balances', value: formatCurrency(stats.totalBalance) },
    ],
    labels: {
      generatedAt: isRTL ? 'تاريخ الإنشاء' : 'Generated',
      totalRecords: isRTL ? 'عدد السجلات' : 'Records',
      grandTotal: isRTL ? 'الإجمالي' : 'Total',
    },
  }

  const handleExport = async (format: ExportFormat) => {
    if (!suppliers.length) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export')
      return
    }
    try {
      await exportRows(format, suppliers, exportColumns, exportMeta)
      toast.success(isRTL ? 'تم تصدير الملف' : 'File exported')
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'فشل التصدير' : 'Export failed'))
    }
  }

  return (
    <ModuleShell
      title={isRTL ? 'الموردون' : 'Suppliers'}
      description={isRTL ? 'إدارة الموردين وعمليات التوريد والمدفوعات والمستحقات' : 'Manage suppliers, procurement accounts, payables and vendor operations'}
      icon={<Truck className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={isRTL ? 'ابحث برمز المورد أو الاسم أو الهاتف...' : 'Search by supplier code, name or phone...'}
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={isRTL ? 'إضافة مورد جديد' : 'Add Supplier'}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-4" />
              <span className="hidden sm:inline">{isRTL ? 'تصدير' : 'Export'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-44">
            <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="size-4 text-emerald-600" /> {isRTL ? 'تصدير Excel' : 'Export Excel'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 cursor-pointer">
              <FileText className="size-4 text-sky-600" /> {isRTL ? 'تصدير CSV' : 'Export CSV'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer">
              <FileDown className="size-4 text-rose-600" /> {isRTL ? 'تصدير PDF' : 'Export PDF'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <>
          <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => { setStatusFilter('all'); setPage(1); }}>
            {isRTL ? 'الكل' : 'All'}
          </Button>
          <Button size="sm" variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => { setStatusFilter('active'); setPage(1); }}>
            {isRTL ? 'نشط' : 'Active'}
          </Button>
          <Button size="sm" variant={statusFilter === 'inactive' ? 'default' : 'outline'} onClick={() => { setStatusFilter('inactive'); setPage(1); }}>
            {isRTL ? 'غير نشط' : 'Inactive'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title={isRTL ? 'إجمالي الموردين' : 'Total Suppliers'} value={formatInt(total)} icon={<Truck className="size-5" />} accent="amber" />
        <KpiCard title={isRTL ? 'الموردون النشطون' : 'Active Suppliers'} value={formatInt(stats.active)} icon={<Truck className="size-5" />} accent="blue" />
        <KpiCard title={isRTL ? 'إجمالي الأرصدة' : 'Total Balances'} value={formatCurrency(stats.totalBalance)} icon={<Building2 className="size-5" />} accent="violet" />
        <KpiCard title={isRTL ? 'متوسط الرصيد' : 'Avg Balance'} value={formatCurrency(stats.total ? Math.round(stats.totalBalance / stats.total) : 0)} icon={<Coins className="size-5" />} accent="sky" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div
          className="w-full overflow-y-auto overflow-x-auto overscroll-contain"
          style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <table className="w-full caption-bottom text-sm min-w-[900px] table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${stickyHead} ps-4 text-start`}>{isRTL ? 'الرمز' : 'Code'}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                <TableHead className={`${stickyHead} text-start`}>{isRTL ? 'جهة الاتصال' : 'Contact Person'}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead className={`${stickyHead} text-center`}>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className={`${stickyHead} text-end pe-4`}>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {isRTL ? 'لا يوجد موردون. ابدأ بإضافة أول مورد.' : 'No suppliers found. Add your first supplier.'}
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/40">
                    <TableCell className="ps-4 font-mono text-xs border-b truncate" dir="ltr">
                      {s.code}
                    </TableCell>
                    <TableCell className="font-medium border-b truncate">
                      {isRTL ? s.nameAr : (s.nameEn || s.nameAr)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground border-b truncate">{s.contactName ?? '—'}</TableCell>
                    <TableCell className="text-sm font-mono text-center border-b whitespace-nowrap" dir="ltr">
                      {s.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-center border-b whitespace-nowrap">
                      <span className="num font-semibold tabular-nums" dir="ltr">
                        {formatCurrency(s.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center border-b">
                      <StatusBadge status={s.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end pe-4 border-b">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(s.id)}>
                          <Trash2 className="size-4.5 ps-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </Card>



      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSave(new FormData(e.currentTarget))
            }}
            className="flex flex-col max-h-[90vh] h-full overflow-hidden"
          >
            <DialogHeader className="bg-gradient-to-r from-blue-50 to-[#E6F0FF] rtl:bg-gradient-to-l dark:bg-none dark:bg-blue-700/80 border-b border-blue-100 dark:border-blue-800 p-6 shrink-0 relative">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-md dark:shadow-blue-900/30 shrink-0">
                  <Truck className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-900 dark:text-white">
                    {editing
                      ? (isRTL ? 'تعديل بيانات المورد' : 'Edit Supplier Details')
                      : (isRTL ? 'إضافة مورد جديد' : 'Add New Supplier')}
                  </DialogTitle>

                </div>
              </div>
            </DialogHeader>

            <DialogBody className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-thin">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'البيانات الأساسية' : 'Basic Information'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="code" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'رمز المورد (تلقائي)' : 'Supplier Code (Auto)'}
                    </Label>
                    <Input
                      id="code"
                      name="code"
                      defaultValue={editing?.code}
                      placeholder="S-00001"
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 font-mono text-sm bg-slate-50 dark:bg-slate-900/50", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الاسم بالكامل (عربي) *' : 'Full Name (Arabic) *'}
                    </Label>
                    <Input
                      id="nameAr"
                      name="nameAr"
                      defaultValue={editing?.nameAr}
                      placeholder={isRTL ? 'مثال: شركة الحلول المتقدمة' : 'e.g. Advanced Solutions Co.'}
                      required
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الاسم بالكامل (إنجليزي)' : 'Full Name (English)'}
                    </Label>
                    <Input
                      id="nameEn"
                      name="nameEn"
                      defaultValue={editing?.nameEn}
                      placeholder="e.g. Advanced Solutions Co."
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="taxNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الرقم الضريبي (TIN)' : 'Tax Identification Number (TIN)'}
                    </Label>
                    <div className="relative">
                      <Hash className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="taxNumber"
                        name="taxNumber"
                        defaultValue={editing?.taxNumber}
                        placeholder="300000000000003"
                        dir={dir}
                        className={cn("h-10 ps-9 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm font-mono", isRTL ? "text-right" : "text-left")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <Phone className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'بيانات المسؤول والاتصال' : 'Contact Information'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="contactName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'اسم جهة الاتصال / المسؤول' : 'Contact Person / Representative'}
                    </Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      defaultValue={editing?.contactName}
                      placeholder={isRTL ? 'مثال: محمد أحمد' : 'e.g. John Doe'}
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="phone"
                        name="phone"
                        defaultValue={editing?.phone}
                        placeholder="+966 50 000 0000"
                        dir={dir}
                        className={cn("h-10 ps-9 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm font-mono", isRTL ? "text-right" : "text-left")}
                      />
                    </div>
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={editing?.email}
                        placeholder="supplier@example.com"
                        dir={dir}
                        className={cn("h-10 ps-9 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm font-mono", isRTL ? "text-right" : "text-left")}
                      />
                    </div>
                  </div>

                  <div className={cn("space-y-1.5 md:col-span-2", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="address" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'العنوان' : 'Address'}
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="address"
                        name="address"
                        defaultValue={editing?.address}
                        placeholder={isRTL ? 'مثال: الرياض، حي السليمانية، شارع التحلية' : 'e.g. King Fahd Rd, Al Olaya, Riyadh'}
                        dir={dir}
                        className={cn("h-10 ps-9 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm", isRTL ? "text-right" : "text-left")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <Coins className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'البيانات المالية والأرصدة' : 'Financial & Credit Configuration'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="creditLimit" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'حد الائتمان' : 'Credit Limit'}
                    </Label>
                    <Input
                      id="creditLimit"
                      name="creditLimit"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.creditLimit ?? 0}
                      placeholder="0.00"
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm font-semibold tabular-nums", isRTL ? "text-right" : "text-left")}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRTL ? "text-right" : "text-left")}>
                    <Label htmlFor="openingBalance" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                    </Label>
                    <Input
                      id="openingBalance"
                      name="openingBalance"
                      type="number"
                      step="0.01"
                      defaultValue={editing?.openingBalance ?? 0}
                      placeholder="0.00"
                      dir={dir}
                      className={cn("h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-sm font-semibold tabular-nums", isRTL ? "text-right" : "text-left")}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/60">
                  <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {isRTL ? 'حالة الحساب' : 'Account Status'}
                  </h3>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <Label htmlFor="active" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                        {isRTL ? 'نشط' : 'Active Status'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? 'تفعيل الحساب' : 'Activate the account'}
                      </p>
                    </div>
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-4 shrink-0">
              <div className="flex items-center justify-end gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="px-5 py-2.5 h-11 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-6 py-2.5 h-11 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                >
                  {saveMutation.isPending
                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                    : (isRTL ? 'حفظ ' : 'Save ')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
