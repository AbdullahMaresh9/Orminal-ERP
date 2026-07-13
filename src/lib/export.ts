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

export function printHTML(html: string, title = 'مستند') {
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
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; padding: 24px; background: #fff; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563EB; padding-bottom: 16px; margin-bottom: 20px; }
  .doc-header .company { display: flex; gap: 12px; align-items: center; }
  .doc-header .company .logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; }
  .doc-header .company .info h2 { font-size: 18px; color: #2563EB; }
  .doc-header .company .info p { font-size: 12px; color: #555; margin-top: 2px; }
  .doc-header .doc-meta { text-align: left; }
  .doc-header .doc-meta .type { font-size: 20px; font-weight: 700; color: #2563EB; }
  .doc-header .doc-meta .code { font-size: 13px; color: #555; margin-top: 4px; }
  .doc-header .doc-meta .date { font-size: 12px; color: #777; }
  .party { background: #eff6ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-inline-start: 4px solid #2563EB; }
  .party .label { font-size: 11px; color: #2563EB; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .party .name { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .party .sub { font-size: 12px; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  thead th { background: #2563EB; color: #fff; padding: 10px 8px; text-align: right; font-weight: 600; }
  tbody td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tfoot td { padding: 10px 8px; border-top: 2px solid #2563EB; font-weight: 700; }
  .totals { margin-top: 16px; margin-inline-start: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals .row.grand { border-top: 2px solid #2563EB; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #2563EB; }
  .notes { margin-top: 20px; font-size: 12px; color: #555; padding: 10px; background: #f9fafb; border-radius: 6px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
  .signatures .sig { width: 200px; text-align: center; }
  .signatures .sig .line { border-top: 1px solid #333; margin-bottom: 6px; }
  .signatures .sig .label { font-size: 12px; color: #555; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #777; }
  .status-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
  @page { margin: 2cm; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
</style>
</head>
<body>
${html}
<div class="footer">
  ${title} · تم إنشاؤه بواسطة نظام أورمنال المحاسبي · ${new Date().toLocaleString('ar-SA')}
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); }
</script>
</body>
</html>
  `)
  win.document.close()
}
