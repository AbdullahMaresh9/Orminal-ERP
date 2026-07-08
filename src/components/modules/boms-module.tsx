'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatNumber, formatInt } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ClipboardList, Plus, Pencil, Trash2, Printer, CheckCircle2, Package, Layers, FileCheck,
} from 'lucide-react'

interface Product { id: string; sku: string; nameAr: string }
interface BomComponent {
  id?: string
  productId: string
  quantity: number
  scrapPercent: number
  product?: Product
}
interface Bom {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  productId: string
  quantity: number
  version: number
  status: string
  active: boolean
  product?: Product
  components?: BomComponent[]
}

interface ComponentDraft {
  key: string
  productId: string
  quantity: string
  scrapPercent: string
}

export function BomsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Bom | null>(null)
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [version, setVersion] = useState('1')
  const [components, setComponents] = useState<ComponentDraft[]>([
    { key: '1', productId: '', quantity: '1', scrapPercent: '0' },
  ])

  const { data, isLoading } = useQuery<{ data: Bom[]; meta: any }>({
    queryKey: ['boms', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      params.set('pageSize', '200')
      const r = await fetch(`/api/erp/boms?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-bom'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=300')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const items = data?.data ?? []
  const products = productsData?.data ?? []

  const stats = {
    total: items.length,
    approved: items.filter((i) => i.status === 'approved').length,
    active: items.filter((i) => i.active).length,
    byProduct: new Set(items.map((i) => i.productId)).size,
  }

  const resetForm = () => {
    setNameAr(''); setNameEn(''); setProductId('')
    setQuantity('1'); setVersion('1')
    setComponents([{ key: '1', productId: '', quantity: '1', scrapPercent: '0' }])
  }

  const openCreate = () => {
    setEditing(null); resetForm(); setDialogOpen(true)
  }

  const openEdit = (b: Bom) => {
    setEditing(b)
    setNameAr(b.nameAr); setNameEn(b.nameEn ?? '')
    setProductId(b.productId); setQuantity(String(b.quantity)); setVersion(String(b.version))
    setComponents(
      (b.components ?? []).length > 0
        ? (b.components ?? []).map((c, i) => ({
            key: String(i + 1),
            productId: c.productId,
            quantity: String(c.quantity),
            scrapPercent: String(c.scrapPercent),
          }))
        : [{ key: '1', productId: '', quantity: '1', scrapPercent: '0' }]
    )
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('اختر المنتج')
      if (!nameAr) throw new Error('الاسم مطلوب')
      const payload: any = {
        nameAr, nameEn, productId,
        quantity: Number(quantity) || 1,
        version: Number(version) || 1,
        components: components
          .filter((c) => c.productId && Number(c.quantity) > 0)
          .map((c) => ({
            productId: c.productId,
            quantity: Number(c.quantity),
            scrapPercent: Number(c.scrapPercent) || 0,
          })),
      }
      const url = editing ? `/api/erp/boms/${editing.id}` : '/api/erp/boms'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      qc.invalidateQueries({ queryKey: ['boms'] })
      setDialogOpen(false)
      resetForm()
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/boms/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم اعتماد قائمة التركيب')
      qc.invalidateQueries({ queryKey: ['boms'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/boms/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['boms'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  const updateComponent = (key: string, field: keyof ComponentDraft, value: string) => {
    setComponents((prev) => prev.map((c) => c.key === key ? { ...c, [field]: value } : c))
  }
  const addComponent = () => setComponents((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', scrapPercent: '0' }])
  const removeComponent = (key: string) => {
    if (components.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setComponents((p) => p.filter((c) => c.key !== key))
  }

  const handleExport = () => {
    const rows = items.map((b) => ({
      'الرمز': b.code,
      'الاسم': b.nameAr,
      'المنتج': b.product?.nameAr ?? '',
      'الكمية': b.quantity,
      'الإصدار': b.version,
      'الحالة': b.status,
      'البنود': b.components?.length ?? 0,
    }))
    exportToCSV('boms', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (b: Bom) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <div class="logo">أ</div>
          <div class="info"><h2>الأستاذ</h2><p>نظام المحاسبة والإدارة المالية</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">قائمة التركيب</div>
          <div class="code">${b.code}</div>
          <div class="date">إصدار ${b.version}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المنتج النهائي</div>
        <div class="name">${b.product?.nameAr ?? ''}</div>
        <div class="sub">SKU: ${b.product?.sku ?? ''} · الكمية الأساسية: ${b.quantity}</div>
      </div>
      <table>
        <thead><tr><th>SKU</th><th>المكوّن</th><th>الكمية</th><th>الهدر %</th></tr></thead>
        <tbody>
          ${(b.components ?? []).map((c) => `
            <tr>
              <td>${c.product?.sku ?? ''}</td>
              <td>${c.product?.nameAr ?? ''}</td>
              <td>${c.quantity}</td>
              <td>${c.scrapPercent}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="notes">الحالة: ${b.status === 'approved' ? 'معتمدة' : 'مسودة'} · ${b.active ? 'نشطة' : 'غير نشطة'}</div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المُعدّ</div></div>
        <div class="sig"><div class="line"></div><div class="label">المُراجِع</div></div>
        <div class="sig"><div class="line"></div><div class="label">المُعتمِد</div></div>
      </div>
    `
    printHTML(html, `قائمة تركيب ${b.code}`)
  }

  return (
    <ModuleShell
      title={t('module.boms')}
      description="إدارة قوائم التركيب (BOM) للمواد المكوّنة والمنتج النهائي"
      icon={<ClipboardList className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز القائمة أو الاسم..."
      onAdd={openCreate}
      addLabel={t('action.add')}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي القوائم" value={formatInt(stats.total)} icon={<ClipboardList className="size-5" />} accent="emerald" />
        <KpiCard title="معتمدة" value={formatInt(stats.approved)} icon={<FileCheck className="size-5" />} accent="teal" />
        <KpiCard title="نشطة" value={formatInt(stats.active)} icon={<CheckCircle2 className="size-5" />} accent="amber" />
        <KpiCard title="منتجات مغطّاة" value={formatInt(stats.byProduct)} icon={<Package className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead className="text-end num-cell">الكمية</TableHead>
                <TableHead className="text-end num-cell">الإصدار</TableHead>
                <TableHead className="text-end num-cell">البنود</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد قوائم تركيب. ابدأ بإضافة أول قائمة.</TableCell></TableRow>
              ) : items.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{b.code}</TableCell>
                  <TableCell className="font-medium">{b.nameAr}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">{b.product?.sku ?? '—'}</Badge>
                      <span className="text-sm">{b.product?.nameAr ?? '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{formatNumber(b.quantity, 2)}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{b.version}</span></TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{b.components?.length ?? 0}</span></TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {b.status === 'draft' && (
                        <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="اعتماد" onClick={() => approveMutation.mutate(b.id)}>
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" title="طباعة" onClick={() => handlePrint(b)}>
                        <Printer className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(b)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-rose-500 hover:text-rose-600" onClick={() => deleteMutation.mutate(b.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل قائمة تركيب' : 'إضافة قائمة تركيب جديدة'}</DialogTitle>
            <DialogDescription>أدخل المنتج النهائي والمكوّنات</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label>المنتج النهائي *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                <Input id="nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                <Input id="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">الكمية الأساسية</Label>
                <Input id="quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="version">الإصدار</Label>
                <Input id="version" type="number" value={version} onChange={(e) => setVersion(e.target.value)} dir="ltr" />
              </div>
            </div>

            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">المكوّن</TableHead>
                    <TableHead className="text-end num-cell w-28">الكمية</TableHead>
                    <TableHead className="text-end num-cell w-24">الهدر %</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="ps-3">
                        <Select value={c.productId} onValueChange={(v) => updateComponent(c.key, 'productId', v)}>
                          <SelectTrigger className="h-9 min-w-[260px]"><SelectValue placeholder="اختر المكوّن" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={c.quantity} onChange={(e) => updateComponent(c.key, 'quantity', e.target.value)} />
                      </TableCell>
                      <TableCell className="text-end num-cell">
                        <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={c.scrapPercent} onChange={(e) => updateComponent(c.key, 'scrapPercent', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeComponent(c.key)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Button type="button" size="sm" variant="outline" onClick={addComponent} className="gap-1.5">
              <Plus className="size-3.5" /> إضافة مكوّن
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
