'use client'

// ============================================================
// CSV / JSON export utilities with Arabic BOM support
// ============================================================

export function exportToCSV(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows.length) {
    rows = [{}]
  }
  const keys = headers ? headers.map((h) => h.key) : Object.keys(rows[0])
  const labels = headers ? headers.map((h) => h.label) : keys
  const escape = (val: any) => {
    if (val === null || val === undefined) return ''
    const s = String(val).replace(/"/g, '""')
    return /[",\n\r]/.test(s) ? `"${s}"` : s
  }
  const csv = [
    labels.join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\n')
  // BOM for Arabic Excel compatibility
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

export function exportToJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 200)
}

// ============================================================
// Print settings cache (client-side, loaded from API)
// ============================================================

let printSettings: Record<string, string> | null = null

async function loadPrintSettings(): Promise<Record<string, string>> {
  if (printSettings) return printSettings
  try {
    const r = await fetch('/api/erp/settings?category=printing')
    if (r.ok) {
      const data = await r.json()
      const result: Record<string, string> = {}
      for (const [key, meta] of Object.entries(data)) {
        result[key] = (meta as any).value
      }
      printSettings = result
      return result
    }
  } catch { }
  // Fallback defaults
  printSettings = {
    'print.paperSize': 'A4',
    'print.marginTop': '15',
    'print.marginBottom': '15',
    'print.marginLeft': '18',
    'print.marginRight': '18',
    'print.showLogo': 'true',
    'print.showSignatures': 'true',
    'print.showFooter': 'true',
    'print.fontFamily': 'Cairo',
    'print.fontSize': '13',
    'print.watermark': '',
    'doc.headerTitle': 'أورمنال — نظام إدارة موارد المؤسسات ERP',
    'doc.footerNote': 'شكراً لتعاملكم معنا',
  }
  return printSettings
}

// Clear print settings cache (call when settings are saved)
export function clearPrintSettingsCache() {
  printSettings = null
}

// ============================================================
// printHTML — يدعم الآن الاتجاه (rtl/ltr) والصفحة العرضية
// ============================================================

export interface PrintOptions {
  /** اتجاه المستند، الافتراضي rtl للحفاظ على السلوك القديم */
  dir?: 'rtl' | 'ltr'
  lang?: string
  /** صفحة عرضية — مناسبة لتقارير الجداول الواسعة */
  landscape?: boolean
  /** إغلاق النافذة تلقائياً بعد الطباعة */
  autoClose?: boolean
}

export async function printHTML(html: string, title = 'مستند', options?: PrintOptions) {
  const ps = await loadPrintSettings()
  const paperSize = ps['print.paperSize'] || 'A4'
  const marginTop = ps['print.marginTop'] || '15'
  const marginBottom = ps['print.marginBottom'] || '15'
  const marginLeft = ps['print.marginLeft'] || '18'
  const marginRight = ps['print.marginRight'] || '18'
  const fontFamily = ps['print.fontFamily'] || 'Cairo'
  const fontSize = ps['print.fontSize'] || '13'
  const watermark = ps['print.watermark'] || ''
  const showFooter = ps['print.showFooter'] !== 'false'

  const dir = options?.dir ?? 'rtl'
  const lang = options?.lang ?? (dir === 'rtl' ? 'ar' : 'en')
  const isRTL = dir === 'rtl'
  const landscape = !!options?.landscape
  const pageWidth = landscape ? '297mm' : '210mm'
  const headAlign = isRTL ? 'right' : 'left'

  const watermarkCss = watermark ? `
  .doc-page::after {
    content: "${watermark}";
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 80px;
    color: rgba(0,0,0,0.05);
    z-index: 0;
    pointer-events: none;
  }` : ''

  const win = window.open('', '_blank', 'width=1000,height=760')
  if (!win) {
    alert(isRTL ? 'الرجاء السماح بالنوافذ المنبثقة للطباعة' : 'Please allow pop-ups to print')
    return
  }

  win.document.write(`<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { margin: 0; padding: 0; }
  body { font-family: '${fontFamily}', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; background: #fff; line-height: 1.7; font-size: ${fontSize}px; }
  .doc-page { max-width: ${pageWidth}; margin: 0 auto; padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm; background: #fff; position: relative; }
  ${watermarkCss}
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563EB; padding-bottom: 20px; margin-bottom: 24px; }
  .doc-header .company { display: flex; gap: 14px; align-items: center; }
  .doc-header .company .logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
  .doc-header .company .info h2 { font-size: 20px; color: #2563EB; }
  .doc-header .company .info p { font-size: 12px; color: #555; margin-top: 2px; }
  .doc-header .doc-meta { text-align: ${isRTL ? 'left' : 'right'}; }
  .doc-header .doc-meta .type { font-size: 20px; font-weight: 700; color: #2563EB; }
  .doc-header .doc-meta .code { font-size: 13px; color: #555; margin-top: 4px; }
  .doc-header .doc-meta .date { font-size: 12px; color: #777; }
  .party { background: #eff6ff; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; border-inline-start: 4px solid #2563EB; }
  .party .label { font-size: 11px; color: #2563EB; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .party .name { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .party .sub { font-size: 12px; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: ${fontSize}px; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead th { background: #2563EB; color: #fff; padding: 12px 10px; text-align: ${headAlign}; font-weight: 600; }
  tbody td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tfoot td { padding: 12px 10px; border-top: 2px solid #2563EB; font-weight: 700; }
  .totals { margin-top: 20px; margin-inline-start: auto; width: 300px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; }
  .totals .row.grand { border-top: 2px solid #2563EB; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 800; color: #2563EB; }
  .notes { margin-top: 24px; font-size: 12px; color: #555; padding: 12px 16px; background: #f9fafb; border-radius: 6px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 72px; }
  .signatures .sig { width: 220px; text-align: center; }
  .signatures .sig .line { border-top: 1px solid #333; margin-bottom: 8px; }
  .signatures .sig .label { font-size: 12px; color: #555; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #777; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-item { padding: 10px 14px; background: #f9fafb; border-radius: 6px; }
  .info-item .label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
  .info-item .value { font-size: 14px; font-weight: 500; margin-top: 2px; }

  /* ---- أنماط تقارير الجداول (تُستخدم من exportRowsToPDF) ---- */
  .rpt-cards { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
  .rpt-card { flex: 1; min-width: 130px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
  .rpt-card .lbl { font-size: 10px; color: #6b7280; font-weight: 600; letter-spacing: .3px; }
  .rpt-card .val { font-size: 15px; font-weight: 800; color: #111827; margin-top: 3px; }
  .rpt-table td.num, .rpt-table th.num { font-variant-numeric: tabular-nums; }
  .rpt-table tfoot td { background: #dbeafe; color: #1e40af; }

  @page { margin: 0; size: ${paperSize}${landscape ? ' landscape' : ''}; }
  @media print {
    body { background: #fff; }
    .doc-page { padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm; max-width: 100%; }
    .no-print { display: none !important; }
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @media screen {
    body { background: #e5e7eb; padding: 20px; }
    .doc-page { box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 4px; }
  }
</style>
</head>
<body>
<div class="doc-page">
${html}
${showFooter ? `<div class="footer">
  ${title} · ${isRTL ? 'تم إنشاؤه بواسطة نظام أورمنال ERP' : 'Generated by Orminal ERP'} · ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
</div>` : ''}
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  ${options?.autoClose ? 'window.onafterprint = function() { window.close(); };' : ''}
</script>
</body>
</html>
  `)
  win.document.close()
}

// ============================================================
// نظام تصدير الجداول الموحّد: CSV / Excel / PDF
// ============================================================

export type ExportFormat = 'csv' | 'excel' | 'pdf'
export type ColumnAlign = 'start' | 'center' | 'end'
export type ColumnType = 'text' | 'number' | 'currency' | 'date'

export interface ExportColumn<T> {
  key: string
  header: string
  /** عرض العمود: بالأحرف في Excel، وبالنسبة المئوية في PDF */
  width?: number
  align?: ColumnAlign
  type?: ColumnType
  /** القيمة المعروضة (نص/رقم) — تُستخدم في CSV و PDF، وفي Excel للأعمدة غير التاريخية */
  value: (row: T) => string | number | Date | null | undefined
  /**
   * القيمة الخام للتاريخ لخلايا Excel (تُحوَّل إلى كائن Date حقيقي).
   * تُستخدم فقط عند type === 'date'. إن لم تُحدَّد يُحاوَل تحويل ناتج value.
   */
  dateValue?: (row: T) => Date | string | number | null | undefined
  /** تنسيق عرض التاريخ في Excel (numFmt)، الافتراضي 'yyyy-mm-dd' */
  dateFormat?: string
  /** تنسيق الخلية الرقمية في Excel (numFmt) */
  numFmt?: string
  /** يُجمع في صف الإجماليات */
  summable?: boolean
}

export interface ExportMeta {
  /** اسم الملف بدون امتداد */
  fileName: string
  title: string
  subtitle?: string
  logoUrl?: string
  isRTL?: boolean
  summary?: Array<{ label: string; value: string }>
  labels?: {
    generatedAt?: string
    totalRecords?: string
    grandTotal?: string
  }
}

const escapeHtml = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const stamp = () => new Date().toISOString().slice(0, 10)
const isNumericType = (t?: ColumnType) => t === 'number' || t === 'currency'
const sumColumn = <T,>(rows: T[], c: ExportColumn<T>) =>
  rows.reduce((s, r) => s + (Number(c.value(r)) || 0), 0)

/** تحويل قيمة (Date / نص ISO / رقم زمني) إلى كائن Date صالح، أو null عند التعذّر */
const coerceDate = (v: unknown): Date | null => {
  if (v == null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  // دعم صيغة dd/mm/yyyy الشائعة عربياً بالإضافة إلى ISO
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    let year = Number(dmy[3])
    if (year < 100) year += 2000
    const d = new Date(year, month - 1, day)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** نص التاريخ للعرض في CSV / PDF */
const formatDateCell = (v: unknown, isRTL?: boolean): string => {
  const d = coerceDate(v)
  if (!d) return String(v ?? '')
  return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')
}

/* ---------------- CSV ---------------- */

export function exportRowsToCSV<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const esc = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return /[",\n\r;]/.test(s) ? `"${s}"` : s
  }

  const cellText = (c: ExportColumn<T>, row: T): string => {
    const raw = c.value(row)
    if (c.type === 'date') {
      const src = c.dateValue ? c.dateValue(row) : raw
      // إن كان value نصاً منسّقاً مسبقاً نعرضه كما هو، وإلا نُنسّق الخام
      return typeof raw === 'string' && raw ? raw : formatDateCell(src, meta.isRTL)
    }
    return String(raw ?? '')
  }

  const lines = [
    columns.map((c) => esc(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => esc(cellText(c, row))).join(',')),
  ]

  if (rows.length && columns.some((c) => c.summable)) {
    lines.push(
      columns
        .map((c, i) =>
          c.summable ? esc(sumColumn(rows, c)) : i === 0 ? esc(meta.labels?.grandTotal ?? 'Total') : ''
        )
        .join(',')
    )
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${meta.fileName}-${stamp()}.csv`)
}

/* ---------------- Excel (ExcelJS) ---------------- */

export async function exportRowsToExcel<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.creator = meta.subtitle ?? 'Orminal ERP'
  wb.created = new Date()

  const headerRowIndex = meta.summary?.length ? 5 : 4

  const ws = wb.addWorksheet(meta.title.slice(0, 30) || 'Report', {
    views: [{ rightToLeft: !!meta.isRTL, state: 'frozen', ySplit: headerRowIndex }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const colCount = columns.length
  const lastCol = ws.getColumn(colCount).letter

  const fontName = 'Segoe UI'

  // عنوان
  ws.mergeCells(`A1:${lastCol}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = meta.title
  titleCell.font = { name: fontName, size: 16, bold: true, color: { argb: 'FF0F172A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 32

  // سطر المعلومات
  ws.mergeCells(`A2:${lastCol}2`)
  const subCell = ws.getCell('A2')
  subCell.value = `${meta.subtitle ?? 'Orminal ERP'}   •   ${meta.labels?.generatedAt ?? 'Generated'}: ${new Date().toLocaleString()}   •   ${meta.labels?.totalRecords ?? 'Records'}: ${rows.length}`
  subCell.font = { name: fontName, size: 10, color: { argb: 'FF64748B' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(2).height = 22

  // شريط الملخص
  if (meta.summary?.length) {
    ws.mergeCells(`A3:${lastCol}3`)
    const s = ws.getCell('A3')
    s.value = meta.summary.map((x) => `${x.label}: ${x.value}`).join('     |     ')
    s.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF1D4ED8' } }
    s.alignment = { vertical: 'middle', horizontal: 'center' }
    s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
    ws.getRow(3).height = 24
  }

  const hAlign = (a?: ColumnAlign) => (a === 'end' ? 'right' : a === 'start' ? 'left' : 'center')

  // رأس الجدول
  const headerRow = ws.getRow(headerRowIndex)
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: fontName, bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    cell.alignment = { vertical: 'middle', horizontal: hAlign(c.align), wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
    }
  })
  headerRow.height = 28

  // الصفوف
  rows.forEach((row, rIdx) => {
    const r = ws.getRow(headerRowIndex + 1 + rIdx)
    columns.forEach((c, i) => {
      const cell = r.getCell(i + 1)
      const raw = c.value(row)

      if (c.type === 'date') {
        // تحويل إلى كائن Date حقيقي ليتعامل معه Excel كتاريخ (فرز/تصفية/حساب)
        const d = coerceDate(c.dateValue ? c.dateValue(row) : raw)
        if (d) {
          cell.value = d
          cell.numFmt = c.dateFormat ?? 'yyyy-mm-dd'
        } else {
          cell.value = (raw as any) ?? ''
        }
      } else if (isNumericType(c.type)) {
        cell.value = Number(raw) || 0
        if (c.numFmt) cell.numFmt = c.numFmt
        else if (c.type === 'currency') cell.numFmt = '#,##0.00'
        else if (c.type === 'number') cell.numFmt = '#,##0'
      } else {
        cell.value = (raw as any) ?? ''
      }

      cell.font = { name: fontName, size: 10, color: { argb: 'FF0F172A' } }
      cell.alignment = { vertical: 'middle', horizontal: hAlign(c.align) }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      if (rIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })
    r.height = 22
  })

  // الإجماليات
  if (rows.length && columns.some((c) => c.summable)) {
    const tr = ws.getRow(headerRowIndex + 1 + rows.length)
    columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1)
      if (c.summable) {
        cell.value = sumColumn(rows, c)
        cell.numFmt = c.type === 'number' ? '#,##0' : '#,##0.00'
      } else if (i === 0) {
        cell.value = meta.labels?.grandTotal ?? 'Total'
      }
      cell.font = { name: fontName, bold: true, size: 11, color: { argb: 'FF0F172A' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
      cell.alignment = { vertical: 'middle', horizontal: hAlign(c.align) }
      cell.border = {
        top: { style: 'double', color: { argb: 'FF1E40AF' } },
        bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
        left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      }
    })
    tr.height = 26
  }

  // عرض الأعمدة + فلترة تلقائية
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(c.width ?? 16, c.header.length + 6)
  })
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: colCount },
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${meta.fileName}-${stamp()}.xlsx`
  )
}

/* ---------------- PDF (عبر printHTML وإعدادات الطباعة) ---------------- */

export async function exportRowsToPDF<T>(rows: T[], columns: ExportColumn<T>[], meta: ExportMeta) {
  const isRTL = !!meta.isRTL
  const alignOf = (a?: ColumnAlign) =>
    a === 'end' ? (isRTL ? 'left' : 'right') : a === 'center' ? 'center' : isRTL ? 'right' : 'left'

  const cellText = (c: ExportColumn<T>, row: T): string => {
    const raw = c.value(row)
    if (c.type === 'date') {
      const src = c.dateValue ? c.dateValue(row) : raw
      return typeof raw === 'string' && raw ? raw : formatDateCell(src, isRTL)
    }
    return String(raw ?? '')
  }

  const head = `
    <div class="doc-header">
      <div class="company">
        ${meta.logoUrl ? `<img src="${escapeHtml(meta.logoUrl)}" class="logo" alt="logo" />` : ''}
        <div class="info">
          <h2>${escapeHtml(meta.subtitle ?? (isRTL ? 'أورمنال' : 'Orminal'))}</h2>
          <p>${isRTL ? 'نظام إدارة موارد المؤسسات ERP' : 'Enterprise Resource Planning (ERP)'}</p>
        </div>
      </div>
      <div class="doc-meta">
        <div class="type">${escapeHtml(meta.title)}</div>
        <div class="code">${escapeHtml(meta.labels?.totalRecords ?? 'Records')}: ${rows.length}</div>
        <div class="date">${escapeHtml(meta.labels?.generatedAt ?? 'Generated')}: ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</div>
      </div>
    </div>`

  const cards = meta.summary?.length
    ? `<div class="rpt-cards">${meta.summary
      .map((s) => `<div class="rpt-card"><div class="lbl">${escapeHtml(s.label)}</div><div class="val">${escapeHtml(s.value)}</div></div>`)
      .join('')}</div>`
    : ''

  const foot =
    rows.length && columns.some((c) => c.summable)
      ? `<tfoot><tr>${columns
        .map((c, i) => {
          if (c.summable) {
            return `<td class="num" style="text-align:${alignOf(c.align)}">${sumColumn(rows, c).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`
          }
          return `<td>${i === 0 ? escapeHtml(meta.labels?.grandTotal ?? 'Total') : ''}</td>`
        })
        .join('')}</tr></tfoot>`
      : ''

  const table = `
    <table class="rpt-table">
      <thead>
        <tr>${columns
      .map(
        (c) =>
          `<th class="${isNumericType(c.type) ? 'num' : ''}" style="text-align:${alignOf(c.align)}${c.width ? `;width:${c.width}%` : ''}">${escapeHtml(c.header)}</th>`
      )
      .join('')}</tr>
      </thead>
      <tbody>
        ${rows.length
      ? rows
        .map(
          (row) =>
            `<tr>${columns
              .map(
                (c) =>
                  `<td class="${isNumericType(c.type) ? 'num' : ''}" style="text-align:${alignOf(c.align)}">${escapeHtml(cellText(c, row))}</td>`
              )
              .join('')}</tr>`
        )
        .join('')
      : `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px;color:#777">${isRTL ? 'لا توجد بيانات' : 'No data'}</td></tr>`
    }
      </tbody>
      ${foot}
    </table>`

  await printHTML(head + cards + table, meta.title, {
    dir: isRTL ? 'rtl' : 'ltr',
    landscape: true,
  })
}

/* ---------------- موزّع موحّد ---------------- */

export async function exportRows<T>(
  format: ExportFormat,
  rows: T[],
  columns: ExportColumn<T>[],
  meta: ExportMeta
) {
  if (format === 'csv') return exportRowsToCSV(rows, columns, meta)
  if (format === 'excel') return exportRowsToExcel(rows, columns, meta)
  return exportRowsToPDF(rows, columns, meta)
}