'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Package, AlertTriangle, DollarSign, Tag, MoreVertical, Pencil, Trash2, Plus, Boxes, PackageCheck,
} from 'lucide-react'

interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  nameAr: string | null
  description: string | null
  categoryId: string | null
  unit: string
  costPrice: number
  salePrice: number
  taxRate: number
  minStock: number
  type: string
  active: boolean
  createdAt: string
  category?: { id: string; name: string; nameAr: string | null } | null
  stockItems?: { quantity: number }[]
}

const EMPTY_FORM = {
  sku: '', barcode: '', name: '', nameAr: '', description: '',
  categoryId: '', unit: 'piece', costPrice: 0, salePrice: 0,
  taxRate: 15, minStock: 0, type: 'product', active: true,
}

const TYPE_OPTIONS = [
  { value: 'product', label: 'منتج' },
  { value: 'service', label: 'خدمة' },
  { value: 'raw_material', label: 'مادة خام' },
  { value: 'finished', label: 'منتج نهائي' },
]

const UNIT_OPTIONS = [
  { value: 'piece', label: 'قطعة' },
  { value: 'kg', label: 'كجم' },
  { value: 'liter', label: 'لتر' },
  { value: 'box', label: 'صندوق' },
  { value: 'pack', label: 'عبوة' },
  { value: 'meter', label: 'متر' },
]

export function ProductsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ data: Product[]; total: number }>({
    queryKey: ['products', search, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const r = await fetch(`/api/erp/products?${params}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const { data: categoriesData } = useQuery<{ data: any[] }>({
    queryKey: ['categories-for-products'],
    queryFn: async () => {
      const r = await fetch('/api/erp/categories')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const products = data?.data ?? []
  const categories = categoriesData?.data ?? []

  // KPIs
  const kpis = useMemo(() => {
    const total = products.length
    const lowStock = products.filter(p => {
      const qty = (p.stockItems ?? []).reduce((s, x) => s + x.quantity, 0)
      return qty <= p.minStock
    }).length
    const totalValue = products.reduce((s, p) => {
      const qty = (p.stockItems ?? []).reduce((s, x) => s + x.quantity, 0)
      return s + qty * p.costPrice
    }, 0)
    const avgPrice = total > 0 ? products.reduce((s, p) => s + p.salePrice, 0) / total : 0
    return { total, lowStock, totalValue, avgPrice }
  }, [products])

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingId
      const url = isEdit ? `/api/erp/products/${editingId}` : '/api/erp/products'
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'save failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/products/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'delete failed')
      }
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDialogOpen(true)
  }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku, barcode: p.barcode ?? '', name: p.name, nameAr: p.nameAr ?? '',
      description: p.description ?? '', categoryId: p.categoryId ?? '',
      unit: p.unit, costPrice: p.costPrice, salePrice: p.salePrice,
      taxRate: p.taxRate, minStock: p.minStock, type: p.type, active: p.active,
    })
    setEditingId(p.id)
    setDialogOpen(true)
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('الاسم مطلوب')
    saveMutation.mutate(form)
  }
  function handleExport() {
    exportToCSV('products', products.map(p => ({
      sku: p.sku,
      barcode: p.barcode ?? '',
      name: p.name,
      nameAr: p.nameAr ?? '',
      category: p.category?.name ?? '',
      type: p.type,
      unit: p.unit,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      taxRate: p.taxRate,
      minStock: p.minStock,
      stock: (p.stockItems ?? []).reduce((s, x) => s + x.quantity, 0),
      active: p.active ? 'نعم' : 'لا',
    })), [
      { key: 'sku', label: 'SKU' },
      { key: 'barcode', label: 'باركود' },
      { key: 'name', label: 'الاسم' },
      { key: 'nameAr', label: 'الاسم العربي' },
      { key: 'category', label: 'الفئة' },
      { key: 'type', label: 'النوع' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'costPrice', label: 'سعر التكلفة' },
      { key: 'salePrice', label: 'سعر البيع' },
      { key: 'taxRate', label: 'الضريبة %' },
      { key: 'minStock', label: 'الحد الأدنى' },
      { key: 'stock', label: 'المخزون' },
      { key: 'active', label: 'نشط' },
    ])
  }
  function handlePrint() {
    const rows = products.map(p => `
      <tr>
        <td>${p.sku}</td>
        <td>${p.name}${p.nameAr ? ' / ' + p.nameAr : ''}</td>
        <td>${p.category?.name ?? '—'}</td>
        <td>${TYPE_OPTIONS.find(x => x.value === p.type)?.label ?? p.type}</td>
        <td>${p.unit}</td>
        <td>${formatNumber(p.costPrice)}</td>
        <td>${formatNumber(p.salePrice)}</td>
        <td>${(p.stockItems ?? []).reduce((s, x) => s + x.quantity, 0)}</td>
      </tr>`).join('')
    printHTML(`
      <div class="doc-header">
        <div class="company">
          <div class="logo">A</div>
          <div class="info"><h2>نظام الأستاذ المحاسبي</h2><p>قائمة المنتجات</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">قائمة المنتجات</div>
          <div class="code">${products.length} منتج</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>SKU</th><th>الاسم</th><th>الفئة</th><th>النوع</th><th>الوحدة</th><th>التكلفة</th><th>البيع</th><th>المخزون</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'قائمة المنتجات')
  }

  return (
    <ModuleShell
      title={t('module.products')}
      description="إدارة كتالوج المنتجات والخدمات والمواد الخام"
      icon={<Package className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالاسم أو SKU أو الباركود..."
      onAdd={openAdd}
      addLabel="منتج جديد"
      onExport={handleExport}
      onPrint={handlePrint}
      filters={
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي المنتجات" value={String(kpis.total)} icon={<Boxes className="size-5" />} accent="emerald" />
            <KpiCard title="مخزون منخفض" value={String(kpis.lowStock)} icon={<AlertTriangle className="size-5" />} accent="amber" />
            <KpiCard title="قيمة المخزون" value={formatCurrency(kpis.totalValue)} icon={<DollarSign className="size-5" />} accent="teal" />
            <KpiCard title="متوسط سعر البيع" value={formatCurrency(kpis.avgPrice)} icon={<Tag className="size-5" />} accent="violet" />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead className="text-end">التكلفة</TableHead>
                <TableHead className="text-end">البيع</TableHead>
                <TableHead className="text-end">المخزون</TableHead>
                <TableHead className="text-end">الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6" /></TableCell>)}
                  </TableRow>
                ))
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                    <Package className="size-10 mx-auto mb-2 opacity-50" />
                    لا توجد منتجات مطابقة. ابدأ بإضافة منتج جديد.
                  </TableCell>
                </TableRow>
              ) : products.map(p => {
                const stock = (p.stockItems ?? []).reduce((s, x) => s + x.quantity, 0)
                const low = stock <= p.minStock
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.nameAr && <span className="text-xs text-muted-foreground">{p.nameAr}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.category?.name ?? '—'}</TableCell>
                    <TableCell>
                      <span className="text-xs">{TYPE_OPTIONS.find(o => o.value === p.type)?.label ?? p.type}</span>
                    </TableCell>
                    <TableCell className="text-xs">{p.unit}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatNumber(p.costPrice)}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatNumber(p.salePrice)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <span className={low ? 'text-amber-600 font-bold' : ''}>{formatNumber(stock)}</span>
                      {low && <AlertTriangle className="inline size-3 ms-1 text-amber-500" />}
                    </TableCell>
                    <TableCell className="text-end">
                      <StatusBadge status={p.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-4 ms-2" /> تعديل</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600" onClick={() => {
                            if (confirm(`حذف المنتج "${p.name}"؟`)) deleteMutation.mutate(p.id)
                          }}><Trash2 className="size-4 ms-2" /> حذف</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل منتج' : 'منتج جديد'}</DialogTitle>
            <DialogDescription>{editingId ? 'تحديث بيانات المنتج' : 'إضافة منتج جديد إلى الكتالوج'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="تلقائي إن تُرك فارغاً" />
            </div>
            <div className="space-y-1.5">
              <Label>الباركود</Label>
              <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الاسم (عربي)</Label>
              <Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
            </div>
            <div className="space-y-1.5">
              <Label>الفئة</Label>
              <Select value={form.categoryId || 'none'} onValueChange={v => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون فئة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فئة</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.nameAr ? ' / ' + c.nameAr : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الوحدة</Label>
              <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>سعر التكلفة</Label>
              <Input type="number" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>سعر البيع</Label>
              <Input type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>نسبة الضريبة %</Label>
              <Input type="number" step="0.01" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>الحد الأدنى للمخزون</Label>
              <Input type="number" step="0.01" value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Switch checked={form.active} onCheckedChange={c => setForm({ ...form, active: c })} id="active" />
              <Label htmlFor="active">المنتج نشط</Label>
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
