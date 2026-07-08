'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatInt, formatDate } from '@/lib/format'
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
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Handshake, Users, Truck, Plus, Pencil, Trash2, Phone, Mail, Building2,
} from 'lucide-react'

interface Partner {
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
  paymentTerm?: { id: string; nameAr: string }
}

export function PartnersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'supplier'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: Partner[]; meta: any }>({
    queryKey: ['partners', search, filterType, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterType === 'customer') params.set('isCustomer', 'true')
      if (filterType === 'supplier') params.set('isSupplier', 'true')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/partners?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const partners = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1

  const stats = {
    total: partners.length,
    customers: partners.filter((p) => p.isCustomer).length,
    suppliers: partners.filter((p) => p.isSupplier).length,
    totalBalance: partners.reduce((s, p) => s + (p.currentBalance || 0), 0),
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
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['partners'] })
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/partners/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['partners'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const handleSave = (formData: FormData) => {
    const payload: any = {
      code: formData.get('code') || undefined,
      nameAr: formData.get('nameAr'),
      nameEn: formData.get('nameEn') || undefined,
      isCustomer: formData.get('isCustomer') === 'on',
      isSupplier: formData.get('isSupplier') === 'on',
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
    const rows = partners.map((p) => ({
      'الرمز': p.code,
      'الاسم': p.nameAr,
      'عميل': p.isCustomer ? 'نعم' : 'لا',
      'مورد': p.isSupplier ? 'نعم' : 'لا',
      'جهة الاتصال': p.contactName ?? '',
      'الهاتف': p.phone ?? '',
      'البريد': p.email ?? '',
      'الرقم الضريبي': p.taxNumber ?? '',
      'حد الائتمان': p.creditLimit,
      'الرصيد الحالي': p.currentBalance,
      'الحالة': p.active ? 'نشط' : 'غير نشط',
    }))
    exportToCSV('partners', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.partners')}
      description="إدارة موحدة للعملاء والموردين والشركاء التجاريين"
      icon={<Handshake className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الشريك أو الاسم أو الهاتف..."
      onAdd={() => { setEditing(null); setDialogOpen(true) }}
      addLabel={t('action.add')}
      onExport={handleExport}
      filters={
        <>
          <Button size="sm" variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')}>الكل</Button>
          <Button size="sm" variant={filterType === 'customer' ? 'default' : 'outline'} onClick={() => setFilterType('customer')}>عملاء</Button>
          <Button size="sm" variant={filterType === 'supplier' ? 'default' : 'outline'} onClick={() => setFilterType('supplier')}>موردون</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الشركاء" value={formatInt(total)} icon={<Handshake className="size-5" />} accent="emerald" />
        <KpiCard title="العملاء" value={formatInt(stats.customers)} icon={<Users className="size-5" />} accent="teal" />
        <KpiCard title="الموردون" value={formatInt(stats.suppliers)} icon={<Truck className="size-5" />} accent="amber" />
        <KpiCard title="إجمالي الأرصدة" value={formatCurrency(stats.totalBalance)} icon={<Building2 className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead className="text-end num-cell">الرصيد</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : partners.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا يوجد شركاء. ابدأ بإضافة أول شريك.</TableCell></TableRow>
              ) : partners.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.nameAr}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.isCustomer && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">عميل</Badge>}
                      {p.isSupplier && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px]">مورد</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.contactName ?? '—'}</TableCell>
                  <TableCell className="text-sm font-mono" dir="ltr">{p.phone ?? '—'}</TableCell>
                  <TableCell className="text-end num-cell">
                    <span className="num font-semibold tabular-nums" dir="ltr">{formatCurrency(p.currentBalance)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={p.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(p); setDialogOpen(true) }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {partners.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + partners.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل شريك' : 'إضافة شريك جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات الشريك التجاري</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)) }}>
            <ScrollArea className="max-h-[60vh] pe-2">
              <div className="grid grid-cols-2 gap-4 p-1">
                <div className="space-y-1.5">
                  <Label htmlFor="code">الرمز (تلقائي)</Label>
                  <Input id="code" name="code" defaultValue={editing?.code} placeholder="P-00001" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                  <Input id="nameAr" name="nameAr" defaultValue={editing?.nameAr} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                  <Input id="nameEn" name="nameEn" defaultValue={editing?.nameEn} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">جهة الاتصال</Label>
                  <Input id="contactName" name="contactName" defaultValue={editing?.contactName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">الهاتف</Label>
                  <Input id="phone" name="phone" defaultValue={editing?.phone} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" name="email" type="email" defaultValue={editing?.email} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxNumber">الرقم الضريبي</Label>
                  <Input id="taxNumber" name="taxNumber" defaultValue={editing?.taxNumber} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="creditLimit">حد الائتمان</Label>
                  <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={editing?.creditLimit ?? 0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="openingBalance">الرصيد الافتتاحي</Label>
                  <Input id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue={editing?.openingBalance ?? 0} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input id="address" name="address" defaultValue={editing?.address} />
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch id="isCustomer" name="isCustomer" defaultChecked={editing?.isCustomer ?? true} />
                    <Label htmlFor="isCustomer">عميل</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="isSupplier" name="isSupplier" defaultChecked={editing?.isSupplier ?? false} />
                    <Label htmlFor="isSupplier">مورد</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="active" name="active" defaultChecked={editing?.active ?? true} />
                    <Label htmlFor="active">نشط</Label>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
