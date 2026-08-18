'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import { Upload, AlertCircle, CheckCircle2, FileText, FileSpreadsheet, Trash2 } from 'lucide-react'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

interface ImportError { field: string; code: string; message: string }
interface DryRunResult {
  dryRun: boolean
  valid: boolean
  rows: number
  toCreate: number
  toUpdate: number
  errors?: ImportError[]
}

export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)

  const [fileName, setFileName] = useState('')
  const [fileBase64, setFileBase64] = useState('')
  const [csv, setCsv] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasData = Boolean(fileBase64 || csv.trim())

  const dryMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { dryRun: true, updateExisting }
      if (fileBase64) payload.fileBase64 = fileBase64
      else if (csv.trim()) payload.csv = csv

      const r = await fetch('/api/erp/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok && r.status !== 422) throw new Error(data?.error?.message ?? L('فشل التحقق', 'Validation failed'))
      return data.data ?? data
    },
    onSuccess: (data: DryRunResult) => setDryResult(data),
    onError: (e: Error) => toast.error(e.message),
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { dryRun: false, updateExisting }
      if (fileBase64) payload.fileBase64 = fileBase64
      else if (csv.trim()) payload.csv = csv

      const r = await fetch('/api/erp/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message ?? L('فشل الاستيراد', 'Import failed'))
      return data
    },
    onSuccess: () => {
      toast.success(t('coa.success.imported'))
      onImported()
      onOpenChange(false)
      clearFile()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function clearFile() {
    setFileName('')
    setFileBase64('')
    setCsv('')
    setDryResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFile(file: File) {
    setFileName(file.name)
    setDryResult(null)

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setFileBase64(result)
        setCsv('')
      }
      reader.readAsDataURL(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCsv(String(e.target?.result ?? ''))
        setFileBase64('')
      }
      reader.readAsText(file, 'utf-8')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const errors = dryResult?.errors ?? []
  const canImport = dryResult?.valid && !importMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden" dir={dir}>
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-white dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shadow-sm shrink-0">
              <Upload className="size-6" />
            </div>
            <div>
              <DialogTitle>{t('coa.import.title')}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {L('استيراد شجرة الحسابات من ملف Excel (.xlsx) أو CSV', 'Import chart of accounts from Excel (.xlsx) or CSV file')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              'rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 transition-colors p-6 text-center cursor-pointer relative',
              hasData && 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20',
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {fileName ? (
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  {fileName.endsWith('.xlsx') ? (
                    <FileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <FileText className="size-8 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {fileName.endsWith('.xlsx') ? L('ملف اكسل جاهز للفحص والرفع', 'Excel spreadsheet ready') : L('ملف CSV جاهز', 'CSV file ready')}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50" onClick={clearFile}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="size-8 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">{t('coa.import.dropzone')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {L('يدعم ملفات Excel (.xlsx) و CSV بحجم يصل إلى 5000 صف', 'Supports Excel (.xlsx) and CSV files up to 5,000 rows')}
                </p>
              </>
            )}
          </div>

          {/* CSV Textarea option */}
          {!fileBase64 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{L('أو لزق نص CSV مباشرة:', 'Or paste CSV text directly:')}</Label>
              <textarea
                value={csv}
                onChange={(e) => { setCsv(e.target.value); setDryResult(null) }}
                placeholder={t('coa.import.csvPlaceholder')}
                rows={4}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono p-3 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          )}

          {/* Options */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Switch
              checked={updateExisting}
              onCheckedChange={(checked) => { setUpdateExisting(checked); setDryResult(null) }}
              className="data-[state=checked]:bg-blue-600"
            />
            <Label className="text-xs font-semibold cursor-pointer">{t('coa.import.updateExisting')}</Label>
          </label>

          {/* Dry run result */}
          {dryResult && (
            <div className={cn(
              'rounded-lg border p-4 space-y-3',
              dryResult.valid
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
            )}>
              <div className="flex items-center gap-2">
                {dryResult.valid
                  ? <CheckCircle2 className="size-4 text-emerald-600" />
                  : <AlertCircle className="size-4 text-rose-600" />
                }
                <span className="text-sm font-semibold">
                  {dryResult.valid ? L('جميع البيانات سليمة ومطابقة للمعايير', 'All data is valid and compliant') : L('توجد أخطاء في البيانات', 'Validation errors found')}
                </span>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {t('coa.import.toCreate')}: {dryResult.toCreate}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400">
                    {t('coa.import.toUpdate')}: {dryResult.toUpdate}
                  </Badge>
                </div>
              </div>

              {errors.length > 0 && (
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-400">
                        <AlertCircle className="size-3 shrink-0 mt-0.5" />
                        <span><span className="font-mono">{err.field}</span>: {err.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
          <Button
            variant="outline"
            onClick={() => dryMutation.mutate()}
            disabled={!hasData || dryMutation.isPending}
          >
            {dryMutation.isPending ? L('جاري فحص التجربة...', 'Validating...') : t('coa.import.dryRun')}
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!canImport || importMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {importMutation.isPending ? L('جاري الاستيراد الفعلي...', 'Importing...') : t('coa.import.confirmImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
