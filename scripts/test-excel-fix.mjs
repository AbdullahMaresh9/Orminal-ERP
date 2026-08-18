import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'

async function readExcelRobust(filePathOrBuffer) {
  const buffer = typeof filePathOrBuffer === 'string' ? readFileSync(filePathOrBuffer) : filePathOrBuffer
  
  // Load zip with JSZip
  const zip = await JSZip.loadAsync(buffer)
  
  // Fix namespace prefix issue in workbook.xml if present (<x:sheets> -> <sheets>)
  const wbXmlFile = zip.file('xl/workbook.xml')
  if (wbXmlFile) {
    let wbXml = await wbXmlFile.async('string')
    if (wbXml.includes('<x:')) {
      wbXml = wbXml.replace(/<x:/g, '<').replace(/<\/x:/g, '</')
      zip.file('xl/workbook.xml', wbXml)
    }
  }

  // Generate clean buffer
  const cleanBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  // Read with ExcelJS
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(cleanBuffer)
  return workbook
}

async function test() {
  const workbook = await readExcelRobust('دليل الحسابات (1).xlsx')
  console.log('Worksheets:', workbook.worksheets.map(w => w.name))
  const sheet = workbook.worksheets[0]
  console.log('Sheet row count:', sheet.rowCount)

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 10) {
      console.log(`Row ${rowNumber}:`, row.values.slice(1))
    }
  })
}

test().catch(console.error)
