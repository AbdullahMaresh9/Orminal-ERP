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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
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
  const { t, isRTL, dir } = useT()
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
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
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
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
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
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handlePrint = (b: Bom) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>أورمنال</h2><p>نظام إدارة موارد المؤسسات ERP</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">قائمة تركيب BOM</div>
          <div class="code">${b.code}</div>
          <div class="date">النسخة: ${b.version}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">المنتج النهائي</div>
        <div class="name">${b.product?.nameAr ?? ''}</div>
        <div class="sub">SKU: ${b.product?.sku ?? ''} · الكمية الأساسية: ${b.quantity}</div>
      </div>
      <table>
        <thead><tr><th>المكوّن</th><th>SKU</th><th>الكمية المطلوبة</th><th>الهدر %</th></tr></thead>
        <tbody>
          ${(b.components ?? []).map((c) => `
            <tr>
              <td>${c.product?.nameAr ?? '—'}</td>
              <td>${c.product?.sku ?? '—'}</td>
              <td>${c.quantity}</td>
              <td>${c.scrapPercent}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المعدّ</div></div>
        <div class="sig"><div class="line"></div><div class="label">الاعتماد</div></div>
      </div>
    `
    printHTML(html, `قائمة تركيب ${b.code}`)
  }

  const addComponent = () => {
    setComponents([...components, { key: String(Date.now()), productId: '', quantity: '1', scrapPercent: '0' }])
  }

  const updateComponent = (key: string, field: keyof ComponentDraft, value: string) => {
    setComponents(components.map((c) => (c.key === key ? { ...c, [field]: value } : c)))
  }

  const removeComponent = (key: string) => {
    if (components.length <= 1) {
      toast.error('يجب أن تحتوي قائمة التركيب على مكوّن واحد على الأقل')
      return
    }
    setComponents(components.filter((c) => c.key !== key))
  }

  const handleExport = () => {
    const rows = items.map((b) => ({
      'الرمز': b.code,
      'الاسم': b.nameAr,
      'المنتج': b.product?.nameAr ?? '',
      'الكمية الأساسية': b.quantity,
      'الإصدار': b.version,
      'المكونات': b.components?.length ?? 0,
      'الحالة': b.status,
    }))
    exportToCSV('boms', rows)
    toast.success('تم تصدير الملف')
  }

  return (
    <ModuleShell
      title={t('module.boms')}
      description="إدارة قوائم تركيب المواد وهياكل المنتجات (BOM)"
      icon={<ClipboardList className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز القائمة أو الاسم..."
      onAdd={openCreate}
      addLabel={t('action.add')}
      onExport={handleExport}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard title="إجمالي القوائم" value={formatInt(stats.total)} icon={<ClipboardList className="size-5" />} accent="blue" />
        <KpiCard title="قوائم معتمدة" value={formatInt(stats.approved)} icon={<FileCheck className="size-5" />} accent="sky" />
        <KpiCard title="منتجات نشطة" value={formatInt(stats.active)} icon={<Package className="size-5" />} accent="amber" />
        <KpiCard title="تغطية المنتجات" value={formatInt(stats.byProduct)} icon={<Layers className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المنتج النهائي</TableHead>
                <TableHead className="text-end num-cell">الكمية الأساسية</TableHead>
                <TableHead className="text-end num-cell">الإصدار</TableHead>
                <TableHead className="text-end num-cell">عدد المكونات</TableHead>
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
                        <Button size="icon" variant="ghost" className="size-8 text-blue-600" title="اعتماد" onClick={() => approveMutation.mutate(b.id)}>
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
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <DialogHeader>
            <div className="flex items-start gap-4 text-start">
              <div className="size-12 rounded-xl bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-sm shadow-blue-100/40 dark:shadow-none shrink-0">
                <ClipboardList className="size-6" />
              </div>
              <div className="space-y-1 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-blue-955 dark:text-white">
                  {editing ? (isRTL ? 'تعديل قائمة تركيب' : 'Edit Bill of Materials') : (isRTL ? 'إضافة قائمة تركيب جديد ' : 'Add New Bill of Materials')}
                </DialogTitle>

              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10 max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1 text-start">
                  <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'المنتج النهائي *' : 'Final Product *'}</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500"><SelectValue placeholder={isRTL ? 'اختر المنتج النهائي' : 'Select final product'} /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="nameAr" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</Label>
                  <Input id="nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={isRTL ? 'قائمة تركيب منتج...' : 'e.g. Product BOM...'} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="nameEn" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input id="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Product BOM..." className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="quantity" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الكمية الأساسية' : 'Base Quantity'}</Label>
                  <Input id="quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
                <div className="space-y-1.5 text-start">
                  <Label htmlFor="version" className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'الإصدار' : 'Version'}</Label>
                  <Input id="version" type="number" value={version} onChange={(e) => setVersion(e.target.value)} className="h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 text-end font-mono" dir="ltr" />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">{isRTL ? 'المكوّنات والمواد الخام' : 'Components & Raw Materials'}</Label>
                <Card className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80">
                          <TableHead className="text-start font-semibold text-xs text-slate-500 dark:text-slate-400 py-3 ps-4">{isRTL ? 'المكوّن' : 'Component'}</TableHead>
                          <TableHead className="text-end font-semibold text-xs text-slate-500 dark:text-slate-400 py-3 w-32">{isRTL ? 'الكمية' : 'Quantity'}</TableHead>
                          <TableHead className="text-end font-semibold text-xs text-slate-500 dark:text-slate-400 py-3 w-28">{isRTL ? 'الهدر %' : 'Scrap %'}</TableHead>
                          <TableHead className="py-3 w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {components.map((c) => (
                          <TableRow key={c.key} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                            <TableCell className="py-2.5 ps-4 text-start">
                              <Select value={c.productId} onValueChange={(v) => updateComponent(c.key, 'productId', v)}>
                                <SelectTrigger className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 w-full min-w-[240px]">
                                  <SelectValue placeholder={isRTL ? 'اختر المكوّن' : 'Select component'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      <span dir="ltr" className="font-mono text-xs">{p.sku}</span> — {p.nameAr}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Input className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-end font-mono tabular-nums" type="number" step="0.01" dir="ltr" value={c.quantity} onChange={(e) => updateComponent(c.key, 'quantity', e.target.value)} />
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Input className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 text-end font-mono tabular-nums" type="number" step="0.01" dir="ltr" value={c.scrapPercent} onChange={(e) => updateComponent(c.key, 'scrapPercent', e.target.value)} />
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Button type="button" size="icon" variant="ghost" className="size-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg" onClick={() => removeComponent(c.key)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>

              <Button type="button" size="sm" variant="outline" onClick={addComponent} className="h-9 px-4 border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold gap-1.5 mt-1">
                <Plus className="size-4 text-blue-600" />
                {isRTL ? 'إضافة مكوّن' : 'Add Component'}
              </Button>
            </div>
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()} className="h-10 px-5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-100 dark:shadow-none">
              {saveMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
