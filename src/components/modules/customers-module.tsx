'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt } from '@/lib/format'
import { exportToCSV } from '@/lib/export'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Users, Plus, Pencil, Trash2, Phone, Mail, Building2, MapPin, Hash, Coins
} from 'lucide-react'

interface Customer {
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

export default function CustomersModule() {
  const { t, locale } = useT()
  const isRTL = locale === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading } = useQuery<{ data: Customer[]; meta: { pagination: { total: number; totalPages: number } } }>({
    queryKey: ['customers', search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('isCustomer', 'true')
      if (search) params.set('q', search)
      if (statusFilter === 'active') params.set('active', 'true')
      if (statusFilter === 'inactive') params.set('active', 'false')

      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/partners?${params}`)
      if (!r.ok) throw new Error('Failed to load customers')
      return r.json()
    },
  })

  const customers = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1

  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.active).length,
    totalBalance: customers.reduce((s, c) => s + (c.currentBalance || 0), 0),
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
        throw new Error(err?.error?.message ?? 'Failed to save customer')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || (isRTL ? 'حدث خطأ' : 'An error occurred')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/partners/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete customer')
      return r.json()
    },
    onSuccess: () => {
      toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Deleted successfully')
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: () => toast.error(isRTL ? 'حدث خطأ' : 'An error occurred'),
  })

  const handleSave = (formData: FormData) => {
    const payload: any = {
      code: formData.get('code') || undefined,
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      isCustomer: true,
      isSupplier: false,
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

  const handleExport = () => {
    const rows = customers.map((c) => ({
      [isRTL ? 'الرمز' : 'Code']: c.code,
      [isRTL ? 'الاسم' : 'Name']: c.nameAr,
      [isRTL ? 'جهة الاتصال' : 'Contact Person']: c.contactName ?? '',
      [isRTL ? 'الهاتف' : 'Phone']: c.phone ?? '',
      [isRTL ? 'البريد' : 'Email']: c.email ?? '',
      [isRTL ? 'الرقم الضريبي' : 'Tax Number']: c.taxNumber ?? '',
      [isRTL ? 'حد الائتمان' : 'Credit Limit']: c.creditLimit,
      [isRTL ? 'الرصيد الحالي' : 'Current Balance']: c.currentBalance,
      [isRTL ? 'الحالة' : 'Status']: c.active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive'),
    }))
    exportToCSV('customers', rows)
    toast.success(isRTL ? 'تم تصدير الملف' : 'Exported successfully')
  }

  return (
    <ModuleShell
      title={isRTL ? 'العملاء' : 'Customers'}
      description={isRTL ? 'إدارة العملاء والحسابات والذمم المدينة والمبيعات' : 'Manage customers, account parameters, receivables and sales records'}
      icon={<Users className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={isRTL ? 'ابحث برمز العميل أو الاسم أو الهاتف...' : 'Search by customer code, name or phone...'}
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={isRTL ? 'إضافة عميل جديد' : 'Add Customer'}
      onExport={handleExport}
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
        <KpiCard title={isRTL ? 'إجمالي العملاء' : 'Total Customers'} value={formatInt(total)} icon={<Users className="size-5" />} accent="sky" />
        <KpiCard title={isRTL ? 'العملاء النشطون' : 'Active Customers'} value={formatInt(stats.active)} icon={<Users className="size-5" />} accent="blue" />
        <KpiCard title={isRTL ? 'إجمالي الأرصدة' : 'Total Balances'} value={formatCurrency(stats.totalBalance)} icon={<Building2 className="size-5" />} accent="violet" />
        <KpiCard title={isRTL ? 'متوسط الرصيد' : 'Avg Balance'} value={formatCurrency(stats.total ? Math.round(stats.totalBalance / stats.total) : 0)} icon={<Coins className="size-5" />} accent="amber" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">{isRTL ? 'الرمز' : 'Code'}</TableHead>
                <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{isRTL ? 'جهة الاتصال' : 'Contact Person'}</TableHead>
                <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead className="text-end num-cell">{isRTL ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    {isRTL ? 'لا يوجد عملاء. ابدأ بإضافة أول عميل.' : 'No customers found. Add your first customer.'}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="ps-4 font-mono text-xs" dir="ltr">
                      {c.code}
                    </TableCell>
                    <TableCell className="font-medium">{c.nameAr}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.contactName ?? '—'}</TableCell>
                    <TableCell className="text-sm font-mono" dir="ltr">
                      {c.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-end num-cell">
                      <span className="num font-semibold tabular-nums" dir="ltr">
                        {formatCurrency(c.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm" dir={dir}>
        <p className="text-muted-foreground">
          {isRTL
            ? `عرض ${customers.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + customers.length} من ${total}`
            : `Showing ${customers.length === 0 ? 0 : (page - 1) * pageSize + 1}–${(page - 1) * pageSize + customers.length} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {isRTL ? 'السابق' : 'Previous'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {isRTL ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {isRTL ? 'التالي' : 'Next'}
          </Button>
        </div>
      </div>

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
                  <Users className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-xl font-bold tracking-tight text-blue-900 dark:text-white">
                    {editing
                      ? (isRTL ? 'تعديل بيانات العميل' : 'Edit Customer Details')
                      : (isRTL ? 'إضافة عميل جديد' : 'Add New Customer')}
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
                      {isRTL ? 'رمز العميل (تلقائي)' : 'Customer Code (Auto)'}
                    </Label>
                    <Input
                      id="code"
                      name="code"
                      defaultValue={editing?.code}
                      placeholder="C-00001"
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
                        placeholder="customer@example.com"
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
