import ExcelJS from 'exceljs'
import { resolve } from 'node:path'

async function inspectExcel() {
  const filePath = resolve('دليل الحسابات (1).xlsx')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  console.log('Worksheets:', workbook.worksheets.map(w => w.name))
  const sheet = workbook.worksheets[0]

  console.log(`Sheet "${sheet.name}" row count: ${sheet.rowCount}`)
  
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 35) {
      console.log(`Row ${rowNumber}:`, JSON.stringify(row.values.slice(1)))
    }
  })
}

inspectExcel().catch(console.error)
