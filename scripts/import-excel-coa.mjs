#!/usr/bin/env node
/**
 * Orminal ERP — Import Chart of Accounts from Excel (.xlsx) or CSV
 *
 * Usage:
 *   node scripts/import-excel-coa.mjs "دليل الحسابات (1).xlsx" --dry-run
 *   node scripts/import-excel-coa.mjs "دليل الحسابات (1).xlsx" --update-existing
 *   node scripts/import-excel-coa.mjs "دليل الحسابات (1).xlsx"
 */

import JSZip from 'jszip'
import { PrismaClient } from '@prisma/client'
import { resolve, relative } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const db = new PrismaClient()

// ── Arabic to English Column Mapper ───────────────────────────────────────────
const COLUMN_MAP = {
  'رقم الحساب': 'code',
  'رمز الحساب': 'code',
  'كود الحساب': 'code',
  'code': 'code',

  'اسم الحساب': 'nameAr',
  'اسم الحساب بالعربي': 'nameAr',
  'nameAr': 'nameAr',

  'اسم الحساب بالانجليزي': 'nameEn',
  'nameEn': 'nameEn',

  'كود الحساب الأعلى': 'parentCode',
  'parentCode': 'parentCode',

  'نوع الحساب': 'kind',
  'kind': 'kind',
  'isPosting': 'isPosting',

  'فئة الحساب': 'accountClass',
  'accountClass': 'accountClass',

  'نوع الحساب التحليلي': 'analyticalType',
  'تبويب الحساب': 'reportCategory',
  'reportCategory': 'reportCategory',

  'طبيعة الحساب': 'normalBalance',
  'normalBalance': 'normalBalance',

  'نوع التقرير': 'fsSection',
  'fsSection': 'fsSection',

  'التوقيف': 'active',
  'الحالة': 'active',
  'active': 'active',
  'currency': 'currency',
}

export function inferClassFromCode(code) {
  const c = String(code ?? '').trim()
  if (c.startsWith('1')) return 'asset'
  if (c.startsWith('2')) return 'liability'
  if (c.startsWith('3')) return 'equity'
  if (c.startsWith('4')) return 'revenue'
  if (c.startsWith('5')) return 'cogs'
  if (c.startsWith('6')) return 'operating_expense'
  if (c.startsWith('7')) return 'other_income'
  if (c.startsWith('8')) return 'other_expense'
  return 'asset'
}

export function buildPath(parentPath, id) {
  return parentPath ? `${parentPath}/${id}` : `/${id}`
}

export function levelFromPath(path) {
  return path.split('/').filter(Boolean).length
}

export async function parseXlsxBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer)

  // 1. Read shared strings
  const strings = []
  const ssFile = zip.file('xl/sharedStrings.xml')
  if (ssFile) {
    let ssXml = await ssFile.async('string')
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

  const rowRegex = /<(?:[a-zA-Z0-9_]+:)?row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?row>/g
  const cellRegex = /<(?:[a-zA-Z0-9_]+:)?c[^>]*r="([A-Z]+)(\d+)"([^>]*)>(?:<(?:[a-zA-Z0-9_]+:)?v>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?v>)?/g

  const extractedRows = []
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

    extractedRows.push({ rowNum, cells: rowCells })
  }

  if (!extractedRows.length) return []

  const headerCells = extractedRows[0].cells
  const seenHeader = new Set()
  const headers = headerCells.map(h => {
    const text = String(h ?? '').trim()
    if (text === 'الحساب الأعلى') {
      if (!seenHeader.has('parentCode')) {
        seenHeader.add('parentCode')
        return 'parentCode'
      } else {
        return 'parentName'
      }
    }
    const mapped = COLUMN_MAP[text] ?? text
    seenHeader.add(mapped)
    return mapped
  })

  const rows = []
  for (let i = 1; i < extractedRows.length; i++) {
    const cells = extractedRows[i].cells
    const rowObj = {}
    headers.forEach((hKey, colIdx) => {
      if (hKey) {
        rowObj[hKey] = cells[colIdx] !== undefined ? String(cells[colIdx]).trim() : ''
      }
    })
    if (rowObj.code || rowObj.nameAr) {
      rows.push(rowObj)
    }
  }

  return rows
}

export function normalizeImportRows(rawRows) {
  return rawRows.map((r, i) => {
    const code = String(r.code ?? '').trim()
    const nameAr = String(r.nameAr ?? '').trim()
    const parentCode = r.parentCode ? String(r.parentCode).trim() : ''
    
    // Determine isPosting
    const kindStr = String(r.kind ?? '').trim()
    let isPosting = true
    if (kindStr.includes('رئيسي') || kindStr.toLowerCase() === 'group') {
      isPosting = false
    } else if (kindStr.includes('فرعي') || kindStr.toLowerCase() === 'posting') {
      isPosting = true
    } else if (r.isPosting !== undefined) {
      isPosting = String(r.isPosting).toLowerCase() === 'true' || r.isPosting === '1'
    }

    // Determine normal balance
    const nbStr = String(r.normalBalance ?? '').trim()
    let normalBalance = undefined
    if (nbStr.includes('مدين') || nbStr.toLowerCase() === 'debit') {
      normalBalance = 'debit'
    } else if (nbStr.includes('دائن') || nbStr.toLowerCase() === 'credit') {
      normalBalance = 'credit'
    }

    // Determine active status
    const activeStr = String(r.active ?? '').trim()
    let active = true
    if (activeStr === '1' || activeStr.includes('موقوف') || activeStr.toLowerCase() === 'false') {
      active = false
    }

    // Determine account class
    let accountClass = r.accountClass ? String(r.accountClass).trim() : ''
    const validClasses = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'operating_expense', 'other_income', 'other_expense']
    if (!validClasses.includes(accountClass)) {
      accountClass = inferClassFromCode(code)
    }

    // Default ledger type
    let type = 'asset'
    if (accountClass === 'asset') type = 'asset'
    else if (accountClass === 'liability') type = 'liability'
    else if (accountClass === 'equity') type = 'equity'
    else if (accountClass === 'revenue' || accountClass === 'other_income') type = 'income'
    else type = 'expense'

    if (!normalBalance) {
      normalBalance = (accountClass === 'asset' || accountClass === 'cogs' || accountClass === 'operating_expense' || accountClass === 'other_expense') ? 'debit' : 'credit'
    }

    // FS Section
    const fsStr = String(r.fsSection ?? '').trim()
    let fsSection = (accountClass === 'asset' || accountClass === 'liability' || accountClass === 'equity') ? 'balance_sheet' : 'income_statement'
    if (fsStr.includes('الميزانية') || fsStr === 'balance_sheet') fsSection = 'balance_sheet'
    if (fsStr.includes('الدخل') || fsStr === 'income_statement') fsSection = 'income_statement'

    return {
      rowNumber: i + 2,
      code,
      nameAr,
      nameEn: r.nameEn ? String(r.nameEn).trim() : null,
      parentCode,
      isPosting,
      accountClass,
      type,
      normalBalance,
      fsSection,
      active,
      reportCategory: r.reportCategory ? String(r.reportCategory).trim() : null,
    }
  })
}

async function main() {
  const args = process.argv.slice(2)
  const fileArg = args.find(a => !a.startsWith('--')) ?? 'دليل الحسابات (1).xlsx'
  const dryRun = args.includes('--dry-run')
  const updateExisting = args.includes('--update-existing')

  const filePath = resolve(fileArg)
  if (!existsSync(filePath)) {
    console.error(`✖ الملف غير موجود: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n📦 استيراد دليل الحسابات من الملف: ${relative(process.cwd(), filePath)}`)
  console.log(`   النمط: ${dryRun ? '🔍 فحص التجربة (Dry-Run)' : '⚡ تطبيق فعلي (Real Import)'}`)
  console.log(`   تحديث الموجود: ${updateExisting ? 'نعم (Update)' : 'لا (Skip/Error)'}\n`)

  const buffer = readFileSync(filePath)
  const rawRows = await parseXlsxBuffer(buffer)
  console.log(`📊 تم قراءة ${rawRows.length} صفاً من Excel.`)

  const rows = normalizeImportRows(rawRows)

  // Validation
  const errors = []
  const seen = new Set()
  const byCode = new Map(rows.map(r => [r.code, r]))

  const existingInDb = await db.account.findMany({
    where: { code: { in: rows.map(r => r.code).filter(Boolean) } },
    select: { id: true, code: true, isSystem: true, accountClass: true, path: true }
  })
  const dbByCode = new Map(existingInDb.map(e => [e.code, e]))

  for (const r of rows) {
    const tag = `صف ${r.rowNumber} (حساب ${r.code || 'بدون كود'})`
    if (!r.code) { errors.push(`${tag}: رمز الحساب مطلوب`); continue }
    if (!r.nameAr) { errors.push(`${tag}: اسم الحساب بالعربي مطلوب`) }

    if (seen.has(r.code)) {
      errors.push(`${tag}: رمز الحساب "${r.code}" مكرر داخل الملف`)
    }
    seen.add(r.code)

    const dbAcc = dbByCode.get(r.code)
    if (dbAcc && !updateExisting) {
      errors.push(`${tag}: الحساب "${r.code}" موجود مسبقاً في قاعدة البيانات`)
    }
    if (dbAcc?.isSystem && updateExisting) {
      // Allow updateExisting for system accounts if name or active state changes, but do not error out unless system rules broken
    }

    if (r.parentCode) {
      const parentInFile = byCode.get(r.parentCode)
      const parentInDb = dbByCode.get(r.parentCode) ?? await db.account.findUnique({ where: { code: r.parentCode }, select: { id: true, isPosting: true, accountClass: true } })

      if (!parentInFile && !parentInDb) {
        errors.push(`${tag}: الحساب الأعلى "${r.parentCode}" غير موجود`)
      } else {
        const parentIsPosting = parentInFile ? parentInFile.isPosting : parentInDb.isPosting
        if (parentIsPosting) {
          errors.push(`${tag}: الحساب الأعلى "${r.parentCode}" هو حساب فرعي (Posting) ولا يمكن إضافة أبناء تحته`)
        }
      }
      if (r.parentCode === r.code) {
        errors.push(`${tag}: لا يمكن أن يكون الحساب أباً لنفسه`)
      }
    }
  }

  // Circular reference check
  for (const r of rows) {
    let cursor = r.parentCode
    const guard = new Set([r.code])
    let depth = 0
    while (cursor && depth++ < 50) {
      if (guard.has(cursor)) {
        errors.push(`صف ${r.rowNumber}: حلقة دائرية في التسلسل عند "${r.code}" -> "${cursor}"`)
        break
      }
      guard.add(cursor)
      cursor = byCode.get(cursor)?.parentCode ?? ''
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ تم العثور على ${errors.length} أخطاء في البيانات:`)
    errors.slice(0, 25).forEach(e => console.error(`   - ${e}`))
    if (errors.length > 25) console.error(`   ... و ${errors.length - 25} خطأ آخر.`)
    await db.$disconnect()
    process.exit(1)
  }

  console.log('✅ جميع البيانات سليمة ومفحوصة بنجاح!')

  const toCreateCount = rows.filter(r => !dbByCode.has(r.code)).length
  const toUpdateCount = rows.filter(r => dbByCode.has(r.code)).length

  console.log(`📈 التلخيص: ${toCreateCount} إنشاء جديد | ${toUpdateCount} تحديث`)

  if (dryRun) {
    console.log('\n✨ [DRY-RUN] تم نجاح الفحص دون التعديل على قاعدة البيانات.')
    await db.$disconnect()
    process.exit(0)
  }

  // Sort by hierarchy depth so parents are created before children
  const depthOf = (code, guard = new Set()) => {
    const r = byCode.get(code)
    if (!r || !r.parentCode || guard.has(code)) return 0
    guard.add(code)
    return 1 + depthOf(r.parentCode, guard)
  }
  const ordered = [...rows].sort((a, b) => depthOf(a.code) - depthOf(b.code) || a.code.localeCompare(b.code))

  console.log('\n🚀 جاري تنفيذ الاستيراد داخل معاملة واحدة (Transaction)...')

  let created = 0
  let updated = 0

  const codeToId = new Map(existingInDb.map(e => [e.code, e.id]))
  const pathById = new Map(existingInDb.filter(e => e.path).map(e => [e.id, e.path]))

  await db.$transaction(async (tx) => {
    for (const r of ordered) {
      const parentId = r.parentCode ? codeToId.get(r.parentCode) ?? null : null
      const data = {
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        accountClass: r.accountClass,
        type: r.type,
        parentId,
        isPosting: r.isPosting,
        normalBalance: r.normalBalance,
        fsSection: r.fsSection,
        active: r.active,
        reportCategory: r.reportCategory,
      }

      const existingId = codeToId.get(r.code)
      if (existingId) {
        const acc = await tx.account.update({ where: { id: existingId }, data })
        const parentPath = parentId ? pathById.get(parentId) ?? null : null
        const path = buildPath(parentPath, acc.id)
        await tx.account.update({ where: { id: acc.id }, data: { path, level: levelFromPath(path) } })
        pathById.set(acc.id, path)
        updated++
      } else {
        const acc = await tx.account.create({
          data: {
            ...data,
            code: r.code,
            isSystem: false,
          }
        })
        const parentPath = parentId ? pathById.get(parentId) ?? null : null
        const path = buildPath(parentPath, acc.id)
        await tx.account.update({ where: { id: acc.id }, data: { path, level: levelFromPath(path) } })
        codeToId.set(r.code, acc.id)
        pathById.set(acc.id, path)
        created++
      }
    }
  }, { timeout: 120_000 })

  console.log(`\n🎉 اكتمل الاستيراد بنجاح! تم إنشاء ${created} حساب جديد وتحديث ${updated} حساب.`)
  await db.$disconnect()
}

if (process.argv[1] && process.argv[1].endsWith('import-excel-coa.mjs')) {
  main().catch(err => {
    console.error('✖ خطأ في النظام:', err)
    process.exit(1)
  })
}
