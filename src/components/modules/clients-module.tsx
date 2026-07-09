'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { exportToCSV, printHTML } from '@/lib/export'
import { formatCurrency, formatDate, initials } from '@/lib/format'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { Users, Wallet, CreditCard, UserCheck, Plus, Pencil, Trash2, FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Client {
  id: string
  code: string
  name: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  balance: number
  creditLimit: number
  openingBalance: number
  active: boolean
  createdAt: string
  _count?: { salesOrders: number; salesInvoices: number; salesPayments: number }
}

interface ClientResponse {
  data: Client[]
  total: number
  stats: { totalBalance: number; totalCreditLimit: number; activeClients: number }
}

interface StatementResponse {
  id: string
  name: string
  code: string
  balance: number
  salesOrders: any[]
  salesInvoices: any[]
  salesPayments: any[]
  salesCreditNotes: any[]
}

const EMPTY_FORM = {
  code: '',
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  openingBalance: 0,
  creditLimit: 0,
  active: true,
}

export function ClientsModule() {
  const { t, isRTL } = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statementId, setStatementId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ClientResponse>({
    queryKey: ['clients', search],
    queryFn: async () => {
      const r = await fetch(`/api/erp/clients?q=${encodeURIComponent(search)}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    staleTime: 30 * 1000,
  })

  const { data: statementData, isLoading: statementLoading } = useQuery<StatementResponse>({
    queryKey: ['client-statement', statementId],
    queryFn: async () => {
      const r = await fetch(`/api/erp/clients/${statementId}`)
      if (!r.ok) throw new Error('fetch failed')
      return r.json()
    },
    enabled: !!statementId,
  })

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch('/api/erp/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.created'))
      qc.invalidateQueries({ queryKey: ['clients'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/clients/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.updated'))
      qc.invalidateQueries({ queryKey: ['clients'] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/clients/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(t('success.deleted'))
      qc.invalidateQueries({ queryKey: ['clients'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || t('error.delete')),
  })

  const stats = data?.stats
  const rows = data?.data ?? []

  const handleAdd = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const handleEdit = (c: Client) => {
    setForm({
      code: c.code,
      name: c.name,
      contactName: c.contactName ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      taxNumber: c.taxNumber ?? '',
      openingBalance: c.openingBalance,
      creditLimit: c.creditLimit,
      active: c.active,
    })
    setEditId(c.id)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('اسم العميل مطلوب')
      return
    }
    const payload = { ...form, openingBalance: Number(form.openingBalance), creditLimit: Number(form.creditLimit) }
    if (editId) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    exportToCSV('clients', rows.map((r) => ({
      code: r.code,
      name: r.name,
      contactName: r.contactName,
      phone: r.phone,
      email: r.email,
      balance: r.balance,
      creditLimit: r.creditLimit,
      active: r.active ? 'نشط' : 'غير نشط',
    })), [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'contactName', label: 'جهة الاتصال' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد' },
      { key: 'balance', label: 'الرصيد' },
      { key: 'creditLimit', label: 'حد الائتمان' },
      { key: 'active', label: 'الحالة' },
    ])
  }

  const handlePrintStatement = () => {
    if (!statementData) return
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info">
            <h2>أورمنال للأنظمة المحاسبية</h2>
            <p>كشف حساب عميل</p>
          </div>
        </div>
        <div class="doc-meta">
          <div class="type">كشف حساب</div>
          <div class="code">${statementData.code}</div>
          <div class="date">${formatDate(new Date())}</div>
        </div>
      </div>
      <div class="party">
        <div class="label">بيانات العميل</div>
        <div class="name">${statementData.name}</div>
        <div class="sub">الرمز: ${statementData.code}</div>
        <div class="sub">الرصيد الحالي: ${formatCurrency(statementData.balance)}</div>
      </div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>النوع</th><th>الرمز</th><th>مدين</th><th>دائن</th></tr>
        </thead>
        <tbody>
          ${statementData.salesInvoices.map((i: any) => `
            <tr>
              <td>${formatDate(i.issueDate)}</td>
              <td>فاتورة</td>
              <td>${i.code}</td>
              <td>${formatCurrency(i.total)}</td>
              <td>—</td>
            </tr>
          `).join('')}
          ${statementData.salesOrders.map((o: any) => `
            <tr>
              <td>${formatDate(o.createdAt)}</td>
              <td>أمر بيع</td>
              <td>${o.code}</td>
              <td>${formatCurrency(o.total)}</td>
              <td>—</td>
            </tr>
          `).join('')}
          ${statementData.salesPayments.map((p: any) => `
            <tr>
              <td>${formatDate(p.date)}</td>
              <td>سند قبض</td>
              <td>${p.code}</td>
              <td>—</td>
              <td>${formatCurrency(p.amount)}</td>
            </tr>
          `).join('')}
          ${statementData.salesCreditNotes.map((c: any) => `
            <tr>
              <td>${formatDate(c.createdAt)}</td>
              <td>إشعار دائن</td>
              <td>${c.code}</td>
              <td>—</td>
              <td>${formatCurrency(c.total)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3">الرصيد الحالي</td><td colspan="2">${formatCurrency(statementData.balance)}</td></tr>
        </tfoot>
      </table>
    `
    printHTML(html, `كشف حساب - ${statementData.name}`)
  }

  return (
    <ModuleShell
      title={t('module.clients')}
      description="إدارة بيانات العملاء وأرصدتهم وحدود الائتمان"
      icon={<Users className="size-5" />}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="ابحث برمز أو اسم أو هاتف العميل..."
      onAdd={handleAdd}
      addLabel="عميل جديد"
      onExport={handleExport}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title="إجمالي العملاء"
              value={String(data?.total ?? 0)}
              icon={<Users className="size-5" />}
              accent="emerald"
            />
            <KpiCard
              title="إجمالي المستحقات"
              value={formatCurrency(stats?.totalBalance ?? 0)}
              icon={<Wallet className="size-5" />}
              accent="rose"
            />
            <KpiCard
              title="إجمالي حدود الائتمان"
              value={formatCurrency(stats?.totalCreditLimit ?? 0)}
              icon={<CreditCard className="size-5" />}
              accent="violet"
            />
            <KpiCard
              title="العملاء النشطون"
              value={String(stats?.activeClients ?? 0)}
              icon={<UserCheck className="size-5" />}
              accent="teal"
            />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <ScrollArea className="max-h-[60vh]">
          <Table className="table-sticky">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>جهة الاتصال</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead className="num-cell">الرصيد</TableHead>
                <TableHead className="num-cell">حد الائتمان</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-6" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !rows.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {t('empty.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c, idx) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setStatementId(c.id)}
                  >
                    <TableCell className="text-muted-foreground">
                      <span className="num">{idx + 1}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm cell-truncate">{c.contactName || '—'}</TableCell>
                    <TableCell className="text-sm tabular-nums" dir="ltr">{c.phone || '—'}</TableCell>
                    <TableCell className={`num-cell font-semibold ${c.balance > 0 ? 'text-rose-600 dark:text-rose-400' : c.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      <span className="num">{formatCurrency(c.balance)}</span>
                    </TableCell>
                    <TableCell className="num-cell text-muted-foreground">
                      <span className="num">{formatCurrency(c.creditLimit)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setStatementId(c.id)} title="كشف حساب">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(c)} title="تعديل">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(c.id)} title="حذف">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل عميل' : 'عميل جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات العميل بدقة. الحقول التي تحمل علامة * مطلوبة.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <Field label="الرمز" hint="تلقائي إذا تُرك فارغاً">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CL-0001" />
            </Field>
            <Field label="اسم العميل *" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم العميل" />
            </Field>
            <Field label="جهة الاتصال">
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </Field>
            <Field label="الهاتف">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </Field>
            <Field label="الرقم الضريبي">
              <Input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} dir="ltr" />
            </Field>
            <Field label="العنوان" className="col-span-2">
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </Field>
            <Field label="الرصيد الافتتاحي">
              <Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
            </Field>
            <Field label="حد الائتمان">
              <Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
            </Field>
            <div className="col-span-2 flex items-center gap-3 pt-1">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="active" />
              <Label htmlFor="active" className="cursor-pointer">عميل نشط</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="gap-1.5">
              {editId ? <>{t('action.save')}</> : <><Plus className="size-4" /> {t('action.create')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Statement Dialog */}
      <Dialog open={!!statementId} onOpenChange={(o) => !o && setStatementId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              كشف حساب العميل
            </DialogTitle>
            <DialogDescription>
              {statementData ? `${statementData.name} · ${statementData.code}` : '...'}
            </DialogDescription>
          </DialogHeader>

          {statementLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : statementData ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                  <p className={`text-lg font-bold ${statementData.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    <span className="num">{formatCurrency(statementData.balance)}</span>
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">فواتير</p>
                  <p className="text-lg font-bold tabular-nums">{statementData.salesInvoices.length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">مدفوعات</p>
                  <p className="text-lg font-bold tabular-nums">{statementData.salesPayments.length}</p>
                </Card>
              </div>

              {/* Movements */}
              <div className="rounded-lg border max-h-[40vh] overflow-y-auto">
                <Table className="table-sticky">
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الرمز</TableHead>
                      <TableHead className="num-cell">مدين</TableHead>
                      <TableHead className="num-cell">دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ...statementData.salesInvoices.map((i: any) => ({ date: i.issueDate, type: 'فاتورة', code: i.code, debit: i.total, credit: 0 })),
                      ...statementData.salesOrders.map((o: any) => ({ date: o.createdAt, type: 'أمر بيع', code: o.code, debit: o.total, credit: 0 })),
                      ...statementData.salesPayments.map((p: any) => ({ date: p.date, type: 'سند قبض', code: p.code, debit: 0, credit: p.amount })),
                      ...statementData.salesCreditNotes.map((c: any) => ({ date: c.createdAt, type: 'إشعار دائن', code: c.code, debit: 0, credit: c.total })),
                    ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{formatDate(m.date)}</TableCell>
                        <TableCell className="text-xs">{m.type}</TableCell>
                        <TableCell className="text-xs font-mono">{m.code}</TableCell>
                        <TableCell className="num-cell">
                          <span className="num">{m.debit ? formatCurrency(m.debit) : '—'}</span>
                        </TableCell>
                        <TableCell className="num-cell">
                          <span className="num">{m.credit ? formatCurrency(m.credit) : '—'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!statementData.salesInvoices.length && !statementData.salesOrders.length && !statementData.salesPayments.length && !statementData.salesCreditNotes.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('empty.noData')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatementId(null)}>{t('action.close')}</Button>
            <Button onClick={handlePrintStatement} disabled={!statementData} className="gap-1.5">
              <FileText className="size-4" /> طباعة الكشف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}

function Field({ label, children, required, hint, className }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium mb-1.5 block">
        {label} {required && <span className="text-rose-500">*</span>}
        {hint && <span className="text-muted-foreground font-normal"> · {hint}</span>}
      </Label>
      {children}
    </div>
  )
}
