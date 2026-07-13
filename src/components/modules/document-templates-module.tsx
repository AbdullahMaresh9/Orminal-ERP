'use client'

import { useState } from 'react'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { toast } from 'sonner'
import { FileText, FileEdit, Plus, Pencil, Eye, Code } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody} from '@/components/ui/dialog'

interface Template {
  id: string; name: string; description: string; category: string; lastEdited?: string
}

const TEMPLATES: Template[] = [
  { id: 'invoice', name: 'فاتورة ضريبية', description: 'قالب الفاتورة الضريبية الأساسي', category: 'invoices', lastEdited: '2024-01-15' },
  { id: 'receipt', name: 'سند قبض', description: 'سند قبض نقدي / بنكي', category: 'invoices', lastEdited: '2024-01-10' },
  { id: 'payment', name: 'سند صرف', description: 'سند صرف للموردين', category: 'invoices', lastEdited: '2024-01-08' },
  { id: 'sales-order', name: 'أمر بيع', description: 'أمر بيع للعملاء', category: 'invoices', lastEdited: '2024-01-05' },
  { id: 'purchase-order', name: 'أمر شراء', description: 'أمر شراء من مورد', category: 'invoices', lastEdited: '2024-01-12' },
  { id: 'product-label', name: 'ملصق منتج', description: 'ملصق المنتج مع الباركود', category: 'products', lastEdited: '2024-01-03' },
  { id: 'product-card', name: 'بطاقة منتج', description: 'بطاقة المنتج للعرض', category: 'products', lastEdited: '2024-01-02' },
  { id: 'quotation', name: 'عرض سعر', description: 'قالب عرض سعر للعملاء', category: 'general', lastEdited: '2024-01-14' },
  { id: 'delivery-note', name: 'مذكرة تسليم', description: 'مذكرة تسليم بضاعة', category: 'general', lastEdited: '2024-01-09' },
]

const DEFAULT_HTML = `<div class="invoice">
  <h1>فاتورة ضريبية</h1>
  <div class="party">
    <strong>{{company_name}}</strong><br/>
    الرقم الضريبي: {{tax_number}}
  </div>
  <table>
    <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
    {{#items}}
    <tr><td>{{name}}</td><td>{{qty}}</td><td>{{price}}</td><td>{{total}}</td></tr>
    {{/items}}
  </table>
  <div class="totals">
    <div>الإجمالي: {{grand_total}}</div>
  </div>
</div>`

const DEFAULT_CSS = `.invoice { font-family: 'Cairo', sans-serif; padding: 20px; }
h1 { color: #2563EB; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px; }
.totals { margin-top: 20px; text-align: left; font-weight: bold; }`

export function DocumentTemplatesModule() {
  const { t } = useT()
  const [editing, setEditing] = useState<Template | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', html: DEFAULT_HTML, css: DEFAULT_CSS })

  function openEdit(tpl: Template) {
    setEditing(tpl)
    setForm({ name: tpl.name, html: DEFAULT_HTML, css: DEFAULT_CSS })
    setDialogOpen(true)
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', html: DEFAULT_HTML, css: DEFAULT_CSS })
    setDialogOpen(true)
  }

  function handleSave() {
    toast.success(t('success.saved'))
    setDialogOpen(false)
  }

  return (
    <ModuleShell
      title={t('module.document-templates')}
      description="قوالب المستندات القابلة للتخصيص"
      icon={<FileText className="size-5" />}
      onAdd={openAdd}
      addLabel="قالب جديد"
    >
      <Tabs defaultValue="general" className="gap-4">
        <TabsList>
          <TabsTrigger value="general">عام</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير</TabsTrigger>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
        </TabsList>

        {(['general', 'invoices', 'products'] as const).map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.filter((t) => t.category === cat).map((tpl) => (
                <Card key={tpl.id} className="p-5 gap-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                      <FileText className="size-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{cat}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{tpl.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                    {tpl.lastEdited && (
                      <p className="text-[10px] text-muted-foreground mt-1">آخر تعديل: {tpl.lastEdited}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(tpl)}>
                      <Pencil className="size-3.5" /> تعديل
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => toast.info('معاينة القالب')}>
                      <Eye className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="size-5" />
              {editing ? `تعديل: ${editing.name}` : 'قالب جديد'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>          <DialogBody>          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto scrollbar-thin">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">اسم القالب</Label>
              <Input id="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="فاتورة ضريبية مخصصة" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Code className="size-3.5" /> HTML</Label>
                <Textarea
                  value={form.html}
                  onChange={(e) => setForm({ ...form, html: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Code className="size-3.5" /> CSS</Label>
                <Textarea
                  value={form.css}
                  onChange={(e) => setForm({ ...form, css: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>معاينة</Label>
              <div className="rounded-lg border bg-white text-black overflow-hidden">
                <iframe
                  title="preview"
                  srcDoc={`<html dir="rtl"><head><style>${form.css}</style></head><body>${form.html}</body></html>`}
                  className="w-full h-64 bg-white"
                />
              </div>
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={handleSave} className="gap-1.5">
              <FileText className="size-4" /> {t('action.save')}
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
