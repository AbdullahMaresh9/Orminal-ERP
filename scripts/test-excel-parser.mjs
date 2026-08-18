import JSZip from 'jszip'
import { readFileSync } from 'node:fs'

export async function parseXlsxBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer)

  // 1. Read shared strings
  const strings = []
  const ssFile = zip.file('xl/sharedStrings.xml')
  if (ssFile) {
    let ssXml = await ssFile.async('string')
    // Remove BOM if present
    ssXml = ssXml.replace(/^\uFEFF/, '')
    const matches = ssXml.match(/<(?:[a-zA-Z0-9_]+:)?t[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?t>/g) || []
    for (const m of matches) {
      const text = m.replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
      strings.push(text)
    }
  }

  // 2. Read sheet1
  const sheetFile = zip.file('xl/worksheets/sheet1.xml') || zip.file('xl/worksheets/sheet.xml')
  if (!sheetFile) {
    throw new Error('لم يتم العثور على ورقة عمل داخل ملف Excel')
  }

  let sheetXml = await sheetFile.async('string')
  sheetXml = sheetXml.replace(/^\uFEFF/, '')

  // Match rows with optional namespace prefix: <x:row ...> or <row ...>
  const rowRegex = /<(?:[a-zA-Z0-9_]+:)?row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?row>/g
  const cellRegex = /<(?:[a-zA-Z0-9_]+:)?c[^>]*r="([A-Z]+)(\d+)"([^>]*)>(?:<(?:[a-zA-Z0-9_]+:)?v>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?v>)?/g

  const rows = []
  let rowMatch

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10)
    const rowContent = rowMatch[2]

    const rowCells = []
    let cellMatch

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colStr = cellMatch[1]
      const attributes = cellMatch[3]
      let rawVal = cellMatch[4] ?? ''

      // Calculate col index: A=0, B=1, ...
      let colIdx = 0
      for (let i = 0; i < colStr.length; i++) {
        colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64)
      }
      colIdx -= 1

      let val = rawVal
      const isString = attributes.includes('t="s"')
      if (isString && rawVal !== '') {
        const idx = parseInt(rawVal, 10)
        val = strings[idx] ?? rawVal
      }

      rowCells[colIdx] = val ? String(val).trim() : ''
    }

    rows.push({ rowNum, cells: rowCells })
  }

  return rows
}

async function test() {
  const buf = readFileSync('دليل الحسابات (1).xlsx')
  const rows = await parseXlsxBuffer(buf)
  console.log(`Successfully extracted ${rows.length} rows using JSZip!`)
  console.log('Row 1 (Header):', rows[0].cells)
  console.log('Row 2 (Account 1):', rows[1].cells)
  console.log('Row 3 (Account 11):', rows[2].cells)
  console.log('Row 4 (Account 111):', rows[3].cells)
  console.log('Row 5 (Account 111001):', rows[4].cells)
}

test().catch(console.error)
