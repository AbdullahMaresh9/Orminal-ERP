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
import { Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react'

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

  const [csv, setCsv] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dryMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/erp/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun: true, updateExisting }),
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
      const r = await fetch('/api/erp/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun: false, updateExisting }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message ?? L('فشل الاستيراد', 'Import failed'))
      return data
    },
    onSuccess: () => {
      toast.success(t('coa.success.imported'))
      onImported()
      onOpenChange(false)
      setCsv('')
      setDryResult(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => setCsv(String(e.target?.result ?? ''))
    reader.readAsText(file, 'utf-8')
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
        <DialogHeader className="px-6 py-5 shrink-0">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-white dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shadow-sm shrink-0">
              <Upload className="size-6" />
            </div>
            <div>
              <DialogTitle>{t('coa.import.title')}</DialogTitle>
              <DialogDescription className="mt-0.5">{t('coa.import.desc')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              'rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 transition-colors p-6 text-center cursor-pointer',
              csv && 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20',
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <FileText className={cn('size-8 mx-auto mb-2', csv ? 'text-emerald-500' : 'text-muted-foreground/50')} />
            <p className="text-sm font-medium">{csv ? L('تم تحميل الملف ✓', 'File loaded ✓') : t('coa.import.dropzone')}</p>
            <p className="text-xs text-muted-foreground mt-1">{L('أو الصق بيانات CSV أدناه', 'or paste CSV data below')}</p>
          </div>

          {/* CSV textarea */}
          <textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setDryResult(null) }}
            placeholder={t('coa.import.csvPlaceholder')}
            rows={6}
            dir="ltr"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono p-3 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />

          {/* Options */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={updateExisting}
              onCheckedChange={setUpdateExisting}
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
                  {dryResult.valid ? L('البيانات صحيحة', 'Data is valid') : L('توجد أخطاء', 'Validation errors found')}
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
            disabled={!csv.trim() || dryMutation.isPending}
          >
            {dryMutation.isPending ? L('جاري التحقق...', 'Checking...') : t('coa.import.dryRun')}
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={!canImport || importMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {importMutation.isPending ? L('جاري الاستيراد...', 'Importing...') : t('coa.import.confirmImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
