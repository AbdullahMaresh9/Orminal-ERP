'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, formatInt } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Truck, Plus, Pencil, Trash2, Printer, Wallet, CheckCircle2, CalendarDays, Eye,
} from 'lucide-react'

interface Supplier {
  id: string
  code: string
  name: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  balance: number
  openingBalance: number
  active: boolean
  createdAt: string
  _count?: { purchaseOrders: number; purchaseInvoices: number; purchasePayments: number }
}

const empty = {
  code: '',
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  openingBalance: 0,
  active: true,
}

export function SuppliersModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewData, setViewData] = useState<any>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery<{ data: Supplier[]; total: number }>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const r = await fetch('/api/erp/suppliers')
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
  })

  const list = data?.data ?? []
  const filtered = list.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [s.name, s.code, s.contactName, s.phone, s.email].some((v) => (v ?? '').toLowerCase().includes(q))
  })

  // KPIs
  const totalPayables = list.reduce((s, x) => s + (x.balance ?? 0), 0)
  const activeCount = list.filter((s) => s.active).length
  const now = new Date()
  const thisMonth = list.filter((s) => new Date(s.createdAt).getMonth() === now.getMonth() && new Date(s.createdAt).getFullYear() === now.getFullYear()).length

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/erp/suppliers/${editId}` : '/api/erp/suppliers'
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'request failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/suppliers/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('request failed')
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم الحذف بنجاح')
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: () => toast.error('حدث خطأ'),
  })

  function openAdd() {
    setEditId(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditId(s.id)
    setForm({
      code: s.code,
      name: s.name,
      contactName: s.contactName ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      taxNumber: s.taxNumber ?? '',
      openingBalance: s.openingBalance,
      active: s.active,
    })
    setOpen(true)
  }

  async function openView(s: Supplier) {
    try {
      const r = await fetch(`/api/erp/suppliers/${s.id}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setViewData(d)
      setViewOpen(true)
    } catch {
      toast.error('حدث خطأ')
    }
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error('الاسم مطلوب')
      return
    }
    saveMut.mutate(form)
  }

  function handleExport() {
    exportToCSV(
      'suppliers',
      filtered.map((s) => ({
        code: s.code,
        name: s.name,
        contactName: s.contactName ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        taxNumber: s.taxNumber ?? '',
        balance: s.balance,
        openingBalance: s.openingBalance,
        active: s.active ? 'نشط' : 'غير نشط',
      })),
      [
        { key: 'code', label: 'الرمز' },
        { key: 'name', label: 'الاسم' },
        { key: 'contactName', label: 'جهة الاتصال' },
        { key: 'phone', label: 'الهاتف' },
        { key: 'email', label: 'البريد' },
        { key: 'taxNumber', label: 'الرقم الضريبي' },
        { key: 'balance', label: 'الرصيد' },
        { key: 'openingBalance', label: 'رصيد افتتاحي' },
        { key: 'active', label: 'الحالة' },
      ]
    )
  }

  function handlePrintStatement(s: Supplier) {
    const d: any = viewData ?? s
    const invoices: any[] = d.purchaseInvoices ?? []
    const payments: any[] = d.purchasePayments ?? []
    const orders: any[] = d.purchaseOrders ?? []
    const creditNotes: any[] = d.purchaseCreditNotes ?? []
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال — نظام إدارة موارد المؤسسات ERP</h2>
            <p>كشف حساب مورد</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">كشف حساب مورد</div>
          <div class="code">${s.code}</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات المورد</div>
        <div class="name">${s.name}</div>
        <div class="sub">جهة الاتصال: ${s.contactName ?? '—'} | الهاتف: ${s.phone ?? '—'} | الرقم الضريبي: ${s.taxNumber ?? '—'}</div>
      </div>
      <h3 style="margin-top:20px;font-size:14px;color:#2563EB">الفواتير</h3>
      <table>
        <thead><tr><th>الكود</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${invoices.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#777;padding:16px">لا توجد فواتير</td></tr>' : invoices.map((i) => `
            <tr>
              <td>${i.code}</td>
              <td>${formatDate(i.issueDate)}</td>
              <td>${i.total.toFixed(2)}</td>
              <td>${i.paid.toFixed(2)}</td>
              <td>${(i.total - i.paid).toFixed(2)}</td>
              <td>${i.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h3 style="margin-top:20px;font-size:14px;color:#2563EB">المدفوعات (سندات الصرف)</h3>
      <table>
        <thead><tr><th>الكود</th><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>الحالة</th></tr></thead>
        <tbody>
          ${payments.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#777;padding:16px">لا توجد مدفوعات</td></tr>' : payments.map((p) => `
            <tr>
              <td>${p.code}</td>
              <td>${formatDate(p.date)}</td>
              <td>${p.amount.toFixed(2)}</td>
              <td>${p.method}</td>
              <td>${p.reference ?? '—'}</td>
              <td>${p.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h3 style="margin-top:20px;font-size:14px;color:#2563EB">أوامر الشراء</h3>
      <table>
        <thead><tr><th>الكود</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>الحالة</th></tr></thead>
        <tbody>
          ${orders.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#777;padding:16px">لا توجد أوامر شراء</td></tr>' : orders.map((o) => `
            <tr>
              <td>${o.code}</td>
              <td>${formatDate(o.createdAt)}</td>
              <td>${o.total.toFixed(2)}</td>
              <td>${o.paid.toFixed(2)}</td>
              <td>${o.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h3 style="margin-top:20px;font-size:14px;color:#2563EB">إشعارات دائنة</h3>
      <table>
        <thead><tr><th>الكود</th><th>التاريخ</th><th>المبلغ</th><th>السبب</th><th>الحالة</th></tr></thead>
        <tbody>
          ${creditNotes.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#777;padding:16px">لا توجد إشعارات دائنة</td></tr>' : creditNotes.map((c) => `
            <tr>
              <td>${c.code}</td>
              <td>${formatDate(c.issueDate)}</td>
              <td>${c.total.toFixed(2)}</td>
              <td>${c.reason ?? '—'}</td>
              <td>${c.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>الرصيد الحالي</span><span>${formatCurrency(s.balance)}</span></div>
      </div>
      <div class="signatures">
        <div class="sig"><div class="line"></div><div class="label">المحاسب</div></div>
        <div class="sig"><div class="line"></div><div class="label">المورد</div></div>
        <div class="sig"><div class="line"></div><div class="label">المدير المالي</div></div>
      </div>
    `
    printHTML(html, `كشف حساب — ${s.name}`)
  }

  return (
    <ModuleShell
      title={t('module.suppliers')}
      description="إدارة بيانات الموردين وأرصدتهم وكشوف الحساب"
      icon={<Truck className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث بالاسم أو الرمز أو الهاتف..."
      onAdd={openAdd}
      addLabel="مورد"
      onExport={handleExport}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard title="إجمالي الموردين" value={formatInt(list.length)} icon={<Truck className="size-5" />} accent="blue" />
            <KpiCard title="إجمالي الذمم الدائنة" value={formatCurrency(totalPayables)} icon={<Wallet className="size-5" />} accent="rose" />
            <KpiCard title="الموردون النشطون" value={formatInt(activeCount)} icon={<CheckCircle2 className="size-5" />} accent="sky" />
            <KpiCard title="المضافون هذا الشهر" value={formatInt(thisMonth)} icon={<CalendarDays className="size-5" />} accent="amber" />
          </>
        )}
      </div>

      {/* Table */}
      <Card className="rounded-xl border bg-card">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead>الرمز</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead className="num-cell">الرصيد</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                    لا يوجد موردون. ابدأ بإضافة أول مورد.
                  </TableCell>
                </TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openView(s)}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{s.code}</TableCell>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground cell-truncate">{s.contactName || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums" dir="ltr">{s.phone || '—'}</TableCell>
                  <TableCell className={`num-cell font-semibold ${s.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                    <span className="num">{formatCurrency(s.balance)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={s.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openView(s)} title="عرض">
                        <Eye className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => { setViewData(s); handlePrintStatement(s) }} title="كشف حساب">
                        <Printer className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(s)} title="تعديل">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا المورد؟')) delMut.mutate(s.id)
                      }} title="حذف">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل مورد' : 'إضافة مورد'}</DialogTitle>
            <DialogDescription>أدخل بيانات المورد. الرصيد الافتتاخي يُسجّل كرصيد مبدئي للمورد.</DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUP-0001 (تلقائي عند الإفراغ)" />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المورد" />
            </div>
            <div className="space-y-1.5">
              <Label>جهة الاتصال</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الرقم الضريبي</Label>
              <Input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>العنوان</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الرصيد الافتتاحي</Label>
              <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">المورد نشط</p>
                <p className="text-xs text-muted-foreground">الموردون غير النشطون لا يظهرون في القوائم</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>

      {/* View supplier statement */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>كشف حساب مورد — {viewData?.name ?? ''}</DialogTitle>
            <DialogDescription>
              الرمز: {viewData?.code ?? ''} · الرصيد الحالي: <span className="num">{formatCurrency(viewData?.balance ?? 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">الفواتير</h3>
                <span className="text-xs text-muted-foreground">{viewData?.purchaseInvoices?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(viewData?.purchaseInvoices ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد فواتير</p>
                ) : (viewData?.purchaseInvoices ?? []).map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <p className="font-medium">{i.code}</p>
                      <p className="text-muted-foreground">{formatDate(i.issueDate)}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold"><span className="num">{formatCurrency(i.total)}</span></p>
                      <p className="text-muted-foreground">متبقي: <span className="num">{formatCurrency(i.total - i.paid)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">المدفوعات</h3>
                <span className="text-xs text-muted-foreground">{viewData?.purchasePayments?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(viewData?.purchasePayments ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد مدفوعات</p>
                ) : (viewData?.purchasePayments ?? []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <p className="font-medium">{p.code}</p>
                      <p className="text-muted-foreground">{formatDate(p.date)} · {p.method}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-blue-600"><span className="num">{formatCurrency(p.amount)}</span></p>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">أوامر الشراء</h3>
                <span className="text-xs text-muted-foreground">{viewData?.purchaseOrders?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(viewData?.purchaseOrders ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد أوامر شراء</p>
                ) : (viewData?.purchaseOrders ?? []).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <p className="font-medium">{o.code}</p>
                      <p className="text-muted-foreground">{formatDate(o.createdAt)}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold"><span className="num">{formatCurrency(o.total)}</span></p>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">إشعارات دائنة</h3>
                <span className="text-xs text-muted-foreground">{viewData?.purchaseCreditNotes?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(viewData?.purchaseCreditNotes ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد إشعارات دائنة</p>
                ) : (viewData?.purchaseCreditNotes ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <p className="font-medium">{c.code}</p>
                      <p className="text-muted-foreground">{c.reason ?? '—'}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-rose-600"><span className="num">{formatCurrency(c.total)}</span></p>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>إغلاق</Button>
            <Button onClick={() => handlePrintStatement(viewData)} className="gap-1.5">
              <Printer className="size-4" /> طباعة الكشف
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
