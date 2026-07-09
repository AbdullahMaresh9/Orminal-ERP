'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatInt, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ClipboardList, Plus, Trash2, Printer, CheckCircle2, Clock, FileCheck2, ShoppingCart,
} from 'lucide-react'

interface Product { id: string; sku: string; nameAr: string }
interface Partner { id: string; code: string; nameAr: string }
interface CostCenter { id: string; code: string; nameAr: string }
interface PurchaseRequestLine {
  id?: string
  productId?: string
  product?: Product
  quantity: number
  requiredDate?: string
  costCenter?: CostCenter
  notes?: string
}
interface PurchaseRequest {
  id: string
  code: string
  requesterId?: string
  department?: string
  requiredDate?: string
  status: string
  notes?: string
  createdAt: string
  lines: PurchaseRequestLine[]
}

interface LineDraft {
  key: string
  productId: string
  quantity: string
  requiredDate: string
  costCenterId: string
  notes: string
}

const STATUS_FLOW = ['draft', 'submitted', 'approved', 'rejected', 'converted']
const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مُقدمة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  converted: 'تم تحويلها',
}

const DEPARTMENTS = ['المشتريات', 'المالية', 'المبيعات', 'المخزون', 'تقنية المعلومات', 'الموارد البشرية', 'الإدارة']

export function PurchaseRequestsModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery<{ data: PurchaseRequest[]; meta: any }>({
    queryKey: ['purchase-requests', search, filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const r = await fetch(`/api/erp/purchase-requests?${params}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
  })

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: costCentersData } = useQuery<{ data: CostCenter[] }>({
    queryKey: ['cost-centers-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/cost-centers?pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const { data: suppliersData } = useQuery<{ data: Partner[] }>({
    queryKey: ['suppliers-for-pr'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isSupplier=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const requests = data?.data ?? []
  const total = data?.meta?.pagination?.total ?? 0
  const totalPages = data?.meta?.pagination?.totalPages ?? 1
  const products = productsData?.data ?? []
  const costCenters = costCentersData?.data ?? []
  const suppliers = suppliersData?.data ?? []

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'draft' || r.status === 'submitted').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    converted: requests.filter((r) => r.status === 'converted').length,
  }), [requests])

  // Form
  const [department, setDepartment] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { key: '1', productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' },
  ])
  const [convertTarget, setConvertTarget] = useState<PurchaseRequest | null>(null)
  const [convertPartnerId, setConvertPartnerId] = useState('')

  const resetForm = () => {
    setDepartment(''); setRequiredDate(''); setNotes('')
    setLines([{ key: '1', productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' }])
  }

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
  }
  const addLine = () => setLines((p) => [...p, { key: String(Date.now()), productId: '', quantity: '1', requiredDate: '', costCenterId: '', notes: '' }])
  const removeLine = (key: string) => {
    if (lines.length <= 1) { toast.error('يجب وجود بند واحد على الأقل'); return }
    setLines((p) => p.filter((l) => l.key !== key))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      if (validLines.length === 0) throw new Error('أضف بنداً واحداً على الأقل')
      const payload = {
        department,
        requiredDate: requiredDate || undefined,
        status: 'submitted',
        notes,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          requiredDate: l.requiredDate || undefined,
          costCenterId: l.costCenterId || undefined,
          notes: l.notes,
        })),
      }
      const r = await fetch('/api/erp/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الحفظ')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب الشراء')
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      setAddOpen(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ req, action, partnerId: pid }: { req: PurchaseRequest; action: 'approve' | 'reject' | 'convert'; partnerId?: string }) => {
      if (action === 'convert') {
        if (!pid) throw new Error('اختر المورد أولاً')
        const payload = {
          partnerId: pid,
          orderDate: new Date().toISOString().slice(0, 10),
          status: 'draft',
          lines: req.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: 0,
          })),
        }
        const r = await fetch('/api/erp/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err?.error?.message ?? 'فشل التحويل')
        }
        // Update PR status to converted
        await fetch(`/api/erp/purchase-requests/${req.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'converted' }),
        })
        return r.json()
      }
      const r = await fetch(`/api/erp/purchase-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'فشل الإجراء')
      }
      return r.json()
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'convert' ? 'تم التحويل إلى أمر شراء' : 'تم تنفيذ الإجراء')
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      if (vars.action === 'convert') {
        setConvertTarget(null); setConvertPartnerId('')
      }
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleExport = () => {
    const rows = requests.map((r) => ({
      'الرمز': r.code,
      'الإدارة': r.department ?? '',
      'التاريخ المطلوب': r.requiredDate ? formatDate(r.requiredDate) : '',
      'تاريخ الإنشاء': formatDate(r.createdAt),
      'عدد البنود': r.lines.length,
      'الحالة': STATUS_LABELS[r.status] ?? r.status,
    }))
    exportToCSV('purchase-requests', rows)
    toast.success('تم تصدير الملف')
  }

  const handlePrint = (r: PurchaseRequest) => {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال</h2>
            <p>نظام المحاسبة والإدارة المالية</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">طلب شراء</div>
          <div class="code">${r.code}</div>
          <div class="date">${formatDate(r.createdAt)}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">الإدارة</div>
        <div class="name">${r.department ?? '—'}</div>
        ${r.requiredDate ? `<div class="sub">التاريخ المطلوب: ${formatDate(r.requiredDate)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>التاريخ المطلوب</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${r.lines.map((l) => `
            <tr>
              <td>${l.product?.sku ?? ''}</td>
              <td>${l.product?.nameAr ?? ''}</td>
              <td>${l.quantity}</td>
              <td>${l.requiredDate ? formatDate(l.requiredDate) : '—'}</td>
              <td>${l.notes ?? ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${r.notes ? `<div class="notes">${r.notes}</div>` : ''}
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">طالب الشراء</div></div>
        <div class="sig"><div class="line"></div><div class="label">مدير المشتريات</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `طلب شراء ${r.code}`)
  }

  return (
    <ModuleShell
      title={t('module.purchase-requests')}
      description="طلبات الشراء الداخلية وتحويلها إلى أوامر شراء"
      icon={<ClipboardList className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز الطلب..."
      onAdd={() => { resetForm(); setAddOpen(true) }}
      addLabel="طلب شراء جديد"
      onExport={handleExport}
      filters={
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard title="إجمالي الطلبات" value={formatInt(stats.total)} icon={<ClipboardList className="size-5" />} accent="emerald" />
        <KpiCard title="قيد المعالجة" value={formatInt(stats.pending)} icon={<Clock className="size-5" />} accent="amber" />
        <KpiCard title="معتمدة" value={formatInt(stats.approved)} icon={<CheckCircle2 className="size-5" />} accent="teal" />
        <KpiCard title="مُحوّلة" value={formatInt(stats.converted)} icon={<FileCheck2 className="size-5" />} accent="violet" />
      </div>

      <Card className="rounded-xl overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="ps-4">الرمز</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>التاريخ المطلوب</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead className="text-end num-cell">عدد البنود</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد طلبات شراء.</TableCell></TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="ps-4 font-mono text-xs" dir="ltr">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.department ?? '—'}</TableCell>
                  <TableCell className="text-sm">{r.requiredDate ? formatDate(r.requiredDate) : '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="text-end num-cell"><span className="num tabular-nums" dir="ltr">{r.lines.length}</span></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'submitted' && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-emerald-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ req: r, action: 'approve' })}>
                            <CheckCircle2 className="size-3.5" /> اعتماد
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-rose-600" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ req: r, action: 'reject' })}>
                            رفض
                          </Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-violet-600" onClick={() => { setConvertTarget(r); setConvertPartnerId('') }}>
                          <ShoppingCart className="size-3.5" /> تحويل لأمر شراء
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handlePrint(r)}>
                        <Printer className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <p className="text-muted-foreground">
          عرض {requests.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + requests.length} من {total}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>طلب شراء جديد</DialogTitle>
            <DialogDescription>حدد الإدارة والبنود المطلوبة مع التواريخ ومراكز التكلفة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الإدارة</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requiredDate">التاريخ المطلوب</Label>
                <Input id="requiredDate" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
              </div>
            </div>

            <Card className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="ps-3">المنتج</TableHead>
                    <TableHead className="text-end num-cell w-24">الكمية</TableHead>
                    <TableHead className="w-36">التاريخ المطلوب</TableHead>
                    <TableHead className="w-40">مركز التكلفة</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="ps-3">
                        <Select value={l.productId} onValueChange={(v) => updateLine(l.key, 'productId', v)}>
                          <SelectTrigger className="h-9 min-w-[220px]"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
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
                        <Input className="h-9 text-end tabular-nums" type="number" step="0.01" dir="ltr" value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9" type="date" value={l.requiredDate} onChange={(e) => updateLine(l.key, 'requiredDate', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Select value={l.costCenterId} onValueChange={(v) => updateLine(l.key, 'costCenterId', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="بدون" /></SelectTrigger>
                          <SelectContent>
                            {costCenters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span dir="ltr" className="font-mono text-xs">{c.code}</span> — {c.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-9" value={l.notes} onChange={(e) => updateLine(l.key, 'notes', e.target.value)} placeholder="—" />
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => removeLine(l.key)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
                        <Plus className="size-3.5" /> إضافة بند
                      </Button>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>

            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'جاري الحفظ...' : 'إنشاء وتقديم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertTarget} onOpenChange={(o) => { if (!o) { setConvertTarget(null); setConvertPartnerId('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تحويل إلى أمر شراء</DialogTitle>
            <DialogDescription>
              اختر المورد لإنشاء أمر شراء من الطلب {convertTarget?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>المورد *</Label>
              <Select value={convertPartnerId} onValueChange={setConvertPartnerId}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span dir="ltr" className="font-mono text-xs">{p.code}</span> — {p.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {convertTarget && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">عدد البنود: {convertTarget.lines.length}</p>
                <ul className="mt-1 space-y-0.5">
                  {convertTarget.lines.slice(0, 4).map((l) => (
                    <li key={l.id} className="text-xs">{l.product?.nameAr} × <span className="num" dir="ltr">{l.quantity}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setConvertTarget(null); setConvertPartnerId('') }}>إلغاء</Button>
            <Button type="button" disabled={actionMutation.isPending || !convertPartnerId} onClick={() => convertTarget && actionMutation.mutate({ req: convertTarget, action: 'convert', partnerId: convertPartnerId })}>
              {actionMutation.isPending ? 'جاري التحويل...' : 'تحويل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
