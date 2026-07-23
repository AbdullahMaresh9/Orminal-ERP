// CSV / JSON export utilities with Arabic BOM support

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

// Print settings cache (client-side, loaded from API)
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
  } catch {}
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

export async function printHTML(html: string, title = 'مستند') {
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

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('الرجاء السماح بالنوافذ المنبثقة للطباعة')
    return
  }
  win.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { margin: 0; padding: 0; }
  body { font-family: '${fontFamily}', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; background: #fff; line-height: 1.7; font-size: ${fontSize}px; }
  .doc-page { max-width: 210mm; margin: 0 auto; padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm; background: #fff; position: relative; }
  ${watermarkCss}
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563EB; padding-bottom: 20px; margin-bottom: 24px; }
  .doc-header .company { display: flex; gap: 14px; align-items: center; }
  .doc-header .company .logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
  .doc-header .company .info h2 { font-size: 20px; color: #2563EB; }
  .doc-header .company .info p { font-size: 12px; color: #555; margin-top: 2px; }
  .doc-header .doc-meta { text-align: left; }
  .doc-header .doc-meta .type { font-size: 20px; font-weight: 700; color: #2563EB; }
  .doc-header .doc-meta .code { font-size: 13px; color: #555; margin-top: 4px; }
  .doc-header .doc-meta .date { font-size: 12px; color: #777; }
  .party { background: #eff6ff; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; border-inline-start: 4px solid #2563EB; }
  .party .label { font-size: 11px; color: #2563EB; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .party .name { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .party .sub { font-size: 12px; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: ${fontSize}px; }
  thead th { background: #2563EB; color: #fff; padding: 12px 10px; text-align: right; font-weight: 600; }
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
  @page { margin: 0; size: ${paperSize}; }
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
  ${title} · تم إنشاؤه بواسطة نظام أورمنال ERP · ${new Date().toLocaleString('ar-SA')}
</div>` : ''}
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); }
</script>
</body>
</html>
  `)
  win.document.close()
}
