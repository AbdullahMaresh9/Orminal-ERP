// POST /api/erp/accounts/import — bulk import accounts (CSV text or JSON rows).
//
// Contract:
//   { rows: [...] }            JSON rows
//   { csv: "code,nameAr,..." } CSV text (header row required)
//   { dryRun: true }           validate only, write nothing
//   { updateExisting: true }   update accounts whose code already exists
//
// Parents are referenced by `parentCode`, so a file can be imported in any order:
// the importer sorts by depth, creates parents first, then resolves the rest.
// Nothing is written unless the WHOLE file validates — one bad row aborts the
// import rather than leaving a half-built chart.

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
  const headers = splitLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
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
    if (typeof body.csv === 'string' && body.csv.trim()) rows = parseCsv(body.csv)
    else if (Array.isArray(body.rows)) rows = body.rows
    else return badRequest('يجب إرسال rows (JSON) أو csv (نص)', 'NO_INPUT')

    if (!rows.length) return badRequest('لا توجد صفوف للاستيراد', 'EMPTY_INPUT')
    if (rows.length > 5000) return badRequest('الحد الأقصى 5000 صف في الاستيراد الواحد', 'TOO_MANY_ROWS')

    // ---- normalize ----
    const normalized = rows.map((r, i) => {
      const kindIsGroup = String(r.kind ?? '').toLowerCase() === 'group'
      const accountClass = r.accountClass && isAccountClass(r.accountClass)
        ? r.accountClass
        : classFromLegacyType(r.type ?? 'asset', r.subtype ?? null)
      return {
        rowNumber: i + 1,
        code: String(r.code ?? '').trim(),
        nameAr: String(r.nameAr ?? '').trim(),
        nameEn: r.nameEn ? String(r.nameEn).trim() : null,
        shortName: r.shortName ? String(r.shortName).trim() : null,
        accountClass: accountClass as AccountClass,
        subtype: r.subtype ? String(r.subtype).trim() : null,
        parentCode: r.parentCode ? String(r.parentCode).trim() : '',
        isPosting: r.kind !== undefined ? !kindIsGroup : toBool(r.isPosting, true),
        normalBalance: r.normalBalance ? String(r.normalBalance).trim() : undefined,
        taxBehavior: r.taxBehavior ? String(r.taxBehavior).trim() : 'none',
        fsSection: r.fsSection ? String(r.fsSection).trim() : undefined,
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

    const existing = await db.account.findMany({
      where: { code: { in: normalized.map((n) => n.code).filter(Boolean) } },
      select: { id: true, code: true, isSystem: true, isPosting: true, accountClass: true, path: true, _count: { select: { journalLines: true } } },
    })
    const existingByCode = new Map(existing.map((e) => [e.code, e]))

    for (const n of normalized) {
      const prefix = `row[${n.rowNumber}]`
      if (!n.code) { errors.push({ field: `${prefix}.code`, code: 'REQUIRED', message: 'رمز الحساب مطلوب' }); continue }
      if (seen.has(n.code)) errors.push({ field: `${prefix}.code`, code: 'DUPLICATE_IN_FILE', message: `الرمز "${n.code}" مكرر داخل الملف`, rejectedValue: n.code })
      seen.add(n.code)

      const exists = existingByCode.get(n.code)
      if (exists && !updateExisting) {
        errors.push({ field: `${prefix}.code`, code: 'ALREADY_EXISTS', message: `الرمز "${n.code}" موجود مسبقاً (استخدم updateExisting)`, rejectedValue: n.code })
      }
      if (exists?.isSystem) {
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

      // field-level rules reuse the single validator
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
          const row = await tx.account.update({ where: { id: existingId }, data })
          const path = buildPath(parentId ? pathById.get(parentId) ?? null : null, row.id)
          await tx.account.update({ where: { id: row.id }, data: { path, level: levelFromPath(path) } })
          pathById.set(row.id, path)
          updatedCount++
        } else {
          const row = await tx.account.create({ data: { ...data, code: n.code, isSystem: false, createdBy: auth.userId } })
          const path = buildPath(parentId ? pathById.get(parentId) ?? null : null, row.id)
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
  } catch (e: any) {
    return serverError(e.message)
  }
}
