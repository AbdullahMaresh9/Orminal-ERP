// POST /api/erp/accounts/import — bulk import accounts (Excel .xlsx, CSV text or JSON rows).
//
// Contract:
//   { fileBase64: "..." }      Base64 encoded Excel (.xlsx) or CSV file
//   { rows: [...] }            JSON rows
//   { csv: "code,nameAr,..." } CSV text (header row required)
//   { dryRun: true }           validate only, write nothing
//   { updateExisting: true }   update accounts whose code already exists

import JSZip from 'jszip'
import { db } from '@/lib/db'
import { ok, serverError, badRequest, unprocessableEntity } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { writeAudit } from '@/lib/erp/audit'
import { buildPath, deriveAccountFields, levelFromPath, validateAccountInput, type FieldError } from '@/lib/erp/account-service'
import { classFromLegacyType, isAccountClass, type AccountClass } from '@/lib/erp/account-classes'

interface ImportRow {
  code?: string
  nameAr?: string
  nameEn?: string
  shortName?: string
  accountClass?: string
  type?: string
  subtype?: string
  parentCode?: string
  kind?: string // 'group' | 'posting'
  isPosting?: boolean | string
  normalBalance?: string
  taxBehavior?: string
  fsSection?: string
  reportCategory?: string
  allowReconciliation?: boolean | string
  requireCostCenter?: boolean | string
  requireBranch?: boolean | string
  requireProject?: boolean | string
  active?: boolean | string
  currency?: string
}

const COLUMN_MAP: Record<string, string> = {
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

function inferClassFromCode(code: string): AccountClass {
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

async function parseXlsxBuffer(buffer: Buffer): Promise<ImportRow[]> {
  const zip = await JSZip.loadAsync(buffer)

  const strings: string[] = []
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

  const sheetFile = zip.file('xl/worksheets/sheet1.xml') || zip.file('xl/worksheets/sheet.xml')
  if (!sheetFile) {
    throw new Error('لم يتم العثور على ورقة عمل داخل ملف Excel')
  }

  let sheetXml = await sheetFile.async('string')
  sheetXml = sheetXml.replace(/^\uFEFF/, '')

  const rowRegex = /<(?:[a-zA-Z0-9_]+:)?row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?row>/g
  const cellRegex = /<(?:[a-zA-Z0-9_]+:)?c[^>]*r="([A-Z]+)(\d+)"([^>]*)>(?:<(?:[a-zA-Z0-9_]+:)?v>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?v>)?/g

  const extractedRows: { rowNum: number; cells: string[] }[] = []
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10)
    const rowContent = rowMatch[2]
    const rowCells: string[] = []
    let cellMatch: RegExpExecArray | null

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
  const seenHeader = new Set<string>()
  const headers = headerCells.map((h) => {
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

  const rows: ImportRow[] = []
  for (let i = 1; i < extractedRows.length; i++) {
    const cells = extractedRows[i].cells
    const rowObj: Record<string, string> = {}
    headers.forEach((hKey, colIdx) => {
      if (hKey) {
        rowObj[hKey] = cells[colIdx] !== undefined ? String(cells[colIdx]).trim() : ''
      }
    })
    if (rowObj.code || rowObj.nameAr) {
      rows.push(rowObj as ImportRow)
    }
  }

  return rows
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const splitLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',' || ch === ';') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim())
  }
  const rawHeaders = splitLine(lines[0])
  const seenHeader = new Set<string>()
  const headers = rawHeaders.map((h) => {
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

  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { if (h) row[h] = cells[i] ?? '' })
    return row as ImportRow
  })
}

const toBool = (v: unknown, dflt: boolean): boolean => {
  if (v === undefined || v === null || v === '') return dflt
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'نعم'].includes(s)) return true
  if (['false', '0', 'no', 'n', 'لا'].includes(s)) return false
  return dflt
}

export async function POST(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canImport')
  if (isAuthFailure(auth)) return auth

  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = Boolean(body.dryRun)
    const updateExisting = Boolean(body.updateExisting)

    let rows: ImportRow[] = []

    if (typeof body.fileBase64 === 'string' && body.fileBase64.trim()) {
      const base64Data = body.fileBase64.replace(/^data:[^;]+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      try {
        rows = await parseXlsxBuffer(buffer)
      } catch {
        // Fallback to text CSV if binary Excel parse fails
        const text = buffer.toString('utf-8')
        rows = parseCsv(text)
      }
    } else if (typeof body.csv === 'string' && body.csv.trim()) {
      rows = parseCsv(body.csv)
    } else if (Array.isArray(body.rows)) {
      rows = body.rows
    } else {
      return badRequest('يجب إرسال fileBase64 أو rows (JSON) أو csv (نص)', 'NO_INPUT')
    }

    if (!rows.length) return badRequest('لا توجد صفوف للاستيراد في الملف', 'EMPTY_INPUT')
    if (rows.length > 5000) return badRequest('الحد الأقصى 5000 صف في الاستيراد الواحد', 'TOO_MANY_ROWS')

    // ---- normalize ----
    const normalized = rows.map((r, i) => {
      const code = String(r.code ?? '').trim()
      const kindStr = String(r.kind ?? '').trim()
      let isPosting = true
      if (kindStr.includes('رئيسي') || kindStr.toLowerCase() === 'group') {
        isPosting = false
      } else if (kindStr.includes('فرعي') || kindStr.toLowerCase() === 'posting') {
        isPosting = true
      } else if (r.isPosting !== undefined) {
        isPosting = toBool(r.isPosting, true)
      }

      let accountClass = r.accountClass && isAccountClass(r.accountClass)
        ? (r.accountClass as AccountClass)
        : classFromLegacyType(r.type ?? 'asset', r.subtype ?? null)

      if (!accountClass) {
        accountClass = inferClassFromCode(code)
      }

      const nbStr = String(r.normalBalance ?? '').trim()
      let normalBalance: string | undefined = undefined
      if (nbStr.includes('مدين') || nbStr.toLowerCase() === 'debit') {
        normalBalance = 'debit'
      } else if (nbStr.includes('دائن') || nbStr.toLowerCase() === 'credit') {
        normalBalance = 'credit'
      }

      const fsStr = String(r.fsSection ?? '').trim()
      let fsSection: string | undefined = undefined
      if (fsStr.includes('الميزانية') || fsStr === 'balance_sheet') fsSection = 'balance_sheet'
      if (fsStr.includes('الدخل') || fsStr === 'income_statement') fsSection = 'income_statement'

      return {
        rowNumber: i + 1,
        code,
        nameAr: String(r.nameAr ?? '').trim(),
        nameEn: r.nameEn ? String(r.nameEn).trim() : null,
        shortName: r.shortName ? String(r.shortName).trim() : null,
        accountClass,
        subtype: r.subtype ? String(r.subtype).trim() : null,
        parentCode: r.parentCode ? String(r.parentCode).trim() : '',
        isPosting,
        normalBalance,
        taxBehavior: r.taxBehavior ? String(r.taxBehavior).trim() : 'none',
        fsSection,
        reportCategory: r.reportCategory ? String(r.reportCategory).trim() : null,
        allowReconciliation: toBool(r.allowReconciliation, false),
        requireCostCenter: toBool(r.requireCostCenter, false),
        requireBranch: toBool(r.requireBranch, false),
        requireProject: toBool(r.requireProject, false),
        active: toBool(r.active, true),
        currency: r.currency ? String(r.currency).trim() : '',
      }
    })

    // ---- validate ----
    const errors: FieldError[] = []
    const seen = new Set<string>()
    const byCode = new Map(normalized.map((n) => [n.code, n]))

    interface ExistingAccount {
      id: string
      code: string
      isSystem: boolean
      isPosting: boolean
      accountClass: string
      path: string | null
      _count: { journalLines: number }
    }

    const existing = (await db.account.findMany({
      where: { code: { in: normalized.map((n) => n.code).filter(Boolean) } },
      select: { id: true, code: true, isSystem: true, isPosting: true, accountClass: true, path: true, _count: { select: { journalLines: true } } },
    })) as unknown as ExistingAccount[]
    const existingByCode = new Map<string, ExistingAccount>(existing.map((e) => [e.code, e]))

    for (const n of normalized) {
      const prefix = `row[${n.rowNumber}]`
      if (!n.code) { errors.push({ field: `${prefix}.code`, code: 'REQUIRED', message: 'رمز الحساب مطلوب' }); continue }
      if (!n.nameAr) { errors.push({ field: `${prefix}.nameAr`, code: 'REQUIRED', message: 'اسم الحساب بالعربي مطلوب' }) }

      if (seen.has(n.code)) errors.push({ field: `${prefix}.code`, code: 'DUPLICATE_IN_FILE', message: `الرمز "${n.code}" مكرر داخل الملف`, rejectedValue: n.code })
      seen.add(n.code)

      const exists = existingByCode.get(n.code)
      if (exists && !updateExisting) {
        errors.push({ field: `${prefix}.code`, code: 'ALREADY_EXISTS', message: `الرمز "${n.code}" موجود مسبقاً (استخدم updateExisting)`, rejectedValue: n.code })
      }
      if (exists?.isSystem && !updateExisting) {
        errors.push({ field: `${prefix}.code`, code: 'SYSTEM_ACCOUNT', message: `لا يمكن استيراد/تعديل حساب نظامي (${n.code})` })
      }
      if (exists && exists._count.journalLines > 0 && exists.accountClass !== n.accountClass) {
        errors.push({ field: `${prefix}.accountClass`, code: 'HAS_POSTINGS', message: `لا يمكن تغيير فئة الحساب ${n.code} لوجود قيود مرحّلة` })
      }

      // parent must exist either in the file or in the DB, and must be a group
      if (n.parentCode) {
        const inFile = byCode.get(n.parentCode)
        const inDb = existingByCode.get(n.parentCode) ?? (await db.account.findUnique({ where: { code: n.parentCode }, select: { id: true, isPosting: true, accountClass: true, path: true } }))
        if (!inFile && !inDb) {
          errors.push({ field: `${prefix}.parentCode`, code: 'PARENT_NOT_FOUND', message: `الحساب الأب "${n.parentCode}" غير موجود`, rejectedValue: n.parentCode })
        } else {
          const parentIsPosting = inFile ? inFile.isPosting : (inDb as { isPosting: boolean }).isPosting
          const parentClass = inFile ? inFile.accountClass : (inDb as { accountClass: string }).accountClass
          if (parentIsPosting) {
            errors.push({ field: `${prefix}.parentCode`, code: 'PARENT_NOT_GROUP', message: `الأب "${n.parentCode}" حساب ترحيل ولا يقبل فروعاً` })
          }
          if (parentClass !== n.accountClass) {
            errors.push({ field: `${prefix}.accountClass`, code: 'CLASS_MISMATCH_PARENT', message: `فئة الحساب ${n.code} لا تطابق فئة الأب ${n.parentCode}` })
          }
        }
        if (n.parentCode === n.code) {
          errors.push({ field: `${prefix}.parentCode`, code: 'SELF_PARENT', message: 'لا يمكن أن يكون الحساب أباً لنفسه' })
        }
      }

      errors.push(
        ...validateAccountInput(
          { code: n.code, nameAr: n.nameAr, accountClass: n.accountClass, subtype: n.subtype, normalBalance: n.normalBalance, taxBehavior: n.taxBehavior, fsSection: n.fsSection },
          { isCreate: true }
        ).map((e) => ({ ...e, field: `${prefix}.${e.field}` }))
      )
    }

    // cycle check inside the file
    for (const n of normalized) {
      let cursor = n.parentCode
      const guard = new Set<string>([n.code])
      let depth = 0
      while (cursor && depth++ < 100) {
        if (guard.has(cursor)) {
          errors.push({ field: `row[${n.rowNumber}].parentCode`, code: 'CIRCULAR_HIERARCHY', message: `حلقة دائرية في التسلسل عند "${n.code}"` })
          break
        }
        guard.add(cursor)
        cursor = byCode.get(cursor)?.parentCode ?? ''
      }
    }

    if (errors.length) {
      return unprocessableEntity(`فشل التحقق: ${errors.length} خطأ — لم يتم استيراد أي صف`, errors.slice(0, 200))
    }

    if (dryRun) {
      return ok({
        dryRun: true,
        valid: true,
        rows: normalized.length,
        toCreate: normalized.filter((n) => !existingByCode.has(n.code)).length,
        toUpdate: normalized.filter((n) => existingByCode.has(n.code)).length,
      })
    }

    // ---- depth-sorted write (parents before children) ----
    const depthOf = (code: string, guard = new Set<string>()): number => {
      const n = byCode.get(code)
      if (!n || !n.parentCode || guard.has(code)) return 0
      guard.add(code)
      return 1 + depthOf(n.parentCode, guard)
    }
    const ordered = [...normalized].sort((a, b) => depthOf(a.code) - depthOf(b.code) || a.code.localeCompare(b.code))

    const currencies = await db.currency.findMany({ select: { id: true, code: true } })
    const currencyByCode = new Map(currencies.map((c) => [c.code, c.id]))

    let createdCount = 0
    let updatedCount = 0
    const codeToId = new Map(existing.map((e) => [e.code, e.id]))
    const pathById = new Map(existing.filter((e) => e.path).map((e) => [e.id, e.path as string]))

    await db.$transaction(async (tx) => {
      for (const n of ordered) {
        const derived = deriveAccountFields({ accountClass: n.accountClass, normalBalance: n.normalBalance, fsSection: n.fsSection })
        const parentId = n.parentCode ? codeToId.get(n.parentCode) ?? null : null
        const data = {
          nameAr: n.nameAr,
          nameEn: n.nameEn,
          shortName: n.shortName,
          accountClass: n.accountClass,
          type: derived.type,
          subtype: n.subtype,
          parentId,
          isPosting: n.isPosting,
          normalBalance: derived.normalBalance,
          fsSection: derived.fsSection,
          taxBehavior: n.taxBehavior,
          reportCategory: n.reportCategory,
          allowReconciliation: n.allowReconciliation,
          requireCostCenter: n.requireCostCenter,
          requireBranch: n.requireBranch,
          requireProject: n.requireProject,
          active: n.active,
          currencyId: n.currency ? currencyByCode.get(n.currency) ?? null : null,
          updatedBy: auth.userId,
        }

        const existingId = codeToId.get(n.code)
        if (existingId) {
          const pPath: string | null = parentId ? (pathById.get(parentId) ?? null) : null
          const row = await tx.account.update({ where: { id: existingId }, data })
          const path = buildPath(pPath, row.id)
          await tx.account.update({ where: { id: row.id }, data: { path, level: levelFromPath(path) } })
          pathById.set(row.id, path)
          updatedCount++
        } else {
          const pPath: string | null = parentId ? (pathById.get(parentId) ?? null) : null
          const row = await tx.account.create({ data: { ...data, code: n.code, isSystem: false, createdBy: auth.userId } })
          const path = buildPath(pPath, row.id)
          await tx.account.update({ where: { id: row.id }, data: { path, level: levelFromPath(path) } })
          codeToId.set(n.code, row.id)
          pathById.set(row.id, path)
          createdCount++
        }
      }
    }, { timeout: 120_000 })

    await writeAudit({
      userId: auth.userId,
      companyId: auth.companyId,
      moduleCode: 'FIN',
      documentType: 'account',
      action: 'import',
      newValue: { rows: normalized.length, created: createdCount, updated: updatedCount },
      reason: body.reason ?? null,
    })

    return ok({ success: true, rows: normalized.length, created: createdCount, updated: updatedCount })
  } catch (e: unknown) {
    console.error('[v0] Account import failed:', e)
    return serverError('تعذر استيراد الدليل المحاسبي. تحقق من ملف Excel وإعدادات قاعدة البيانات ثم حاول مرة أخرى.')
  }
}
