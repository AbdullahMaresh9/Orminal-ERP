// GET /api/erp/accounts/export?format=xlsx|csv|json — export the chart of accounts.
// XLSX generated via ExcelJS with RTL support & styling.
// CSV is UTF-8 with BOM so Excel renders Arabic correctly.

import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'
import { COA_ACTIONS, isAuthFailure, requireCapability } from '@/lib/erp/rbac'
import { writeAudit } from '@/lib/erp/audit'
import { fetchAccountBalances } from '@/lib/erp/account-service'
import { signedBalance } from '@/lib/erp/account-classes'

const HEADERS = [
  'code', 'nameAr', 'nameEn', 'shortName', 'accountClass', 'type', 'subtype',
  'parentCode', 'kind', 'normalBalance', 'currency', 'taxBehavior', 'fsSection',
  'reportCategory', 'allowReconciliation', 'requireCostCenter', 'requireBranch',
  'requireProject', 'roles', 'isSystem', 'active', 'debit', 'credit', 'balance',
]

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: Request) {
  const auth = await requireCapability(COA_ACTIONS.ACCOUNTS, 'canExport')
  if (isAuthFailure(auth)) return auth

  try {
    const url = new URL(req.url)
    const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase()

    const accounts = await db.account.findMany({
      orderBy: { code: 'asc' },
      include: {
        parent: { select: { code: true } },
        currency: { select: { code: true } },
        roleMappings: { where: { active: true }, select: { role: true } },
      },
    })
    const balances = await fetchAccountBalances()

    const rows = accounts.map((a) => {
      const b = balances.get(a.id) ?? { debit: 0, credit: 0 }
      return {
        code: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn ?? '',
        shortName: a.shortName ?? '',
        accountClass: a.accountClass,
        type: a.type,
        subtype: a.subtype ?? '',
        parentCode: a.parent?.code ?? '',
        kind: a.isPosting ? 'posting' : 'group',
        normalBalance: a.normalBalance,
        currency: a.currency?.code ?? '',
        taxBehavior: a.taxBehavior,
        fsSection: a.fsSection,
        reportCategory: a.reportCategory ?? '',
        allowReconciliation: a.allowReconciliation,
        requireCostCenter: a.requireCostCenter,
        requireBranch: a.requireBranch,
        requireProject: a.requireProject,
        roles: a.roleMappings.map((m) => m.role).join('|'),
        isSystem: a.isSystem,
        active: a.active,
        debit: b.debit,
        credit: b.credit,
        balance: signedBalance(a.normalBalance, b.debit, b.credit),
      }
    })

    await writeAudit({
      userId: auth.userId,
      companyId: auth.companyId,
      moduleCode: 'FIN',
      documentType: 'account',
      action: 'export',
      newValue: { format, count: rows.length },
    })

    if (format === 'json') return ok({ accounts: rows, count: rows.length })

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('دليل الحسابات', {
        views: [{ showGridLines: true, rightToLeft: true } as any]
      })

      sheet.columns = [
        { header: 'رقم الحساب', key: 'code', width: 16 },
        { header: 'اسم الحساب بالعربي', key: 'nameAr', width: 32 },
        { header: 'اسم الحساب بالانجليزي', key: 'nameEn', width: 24 },
        { header: 'كود الحساب الأعلى', key: 'parentCode', width: 18 },
        { header: 'نوع الحساب', key: 'kind', width: 16 },
        { header: 'فئة الحساب', key: 'accountClass', width: 20 },
        { header: 'طبيعة الحساب', key: 'normalBalance', width: 14 },
        { header: 'نوع التقرير', key: 'fsSection', width: 18 },
        { header: 'تبويب الحساب', key: 'reportCategory', width: 20 },
        { header: 'العملة', key: 'currency', width: 12 },
        { header: 'الحالة', key: 'active', width: 12 },
        { header: 'مجموع المدين', key: 'debit', width: 16 },
        { header: 'مجموع الدائن', key: 'credit', width: 16 },
        { header: 'الرصيد القائم', key: 'balance', width: 16 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 28

      const CLASS_LABELS: Record<string, string> = {
        asset: 'أصول (Asset)',
        liability: 'التزامات (Liability)',
        equity: 'حقوق ملكية (Equity)',
        revenue: 'إيرادات (Revenue)',
        cogs: 'تكلفة المبيعات (COGS)',
        operating_expense: 'مصاريف تشغيلية',
        other_income: 'إيرادات أخرى',
        other_expense: 'مصاريف أخرى',
      }

      const FS_LABELS: Record<string, string> = {
        balance_sheet: 'الميزانية العمومية',
        income_statement: 'قائمة الدخل',
      }

      rows.forEach((r) => {
        const row = sheet.addRow({
          code: r.code,
          nameAr: r.nameAr,
          nameEn: r.nameEn,
          parentCode: r.parentCode,
          kind: r.kind === 'group' ? 'رئيسي (Group)' : 'فرعي (Posting)',
          accountClass: CLASS_LABELS[r.accountClass] ?? r.accountClass,
          normalBalance: r.normalBalance === 'debit' ? 'مدين' : 'دائن',
          fsSection: FS_LABELS[r.fsSection] ?? r.fsSection,
          reportCategory: r.reportCategory,
          currency: r.currency || 'YER',
          active: r.active ? 'نشط' : 'موقوف',
          debit: r.debit,
          credit: r.credit,
          balance: r.balance,
        })

        if (r.kind === 'group') {
          row.font = { bold: true }
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="chart-of-accounts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      })
    }

    const csv = [HEADERS.join(','), ...rows.map((r) => HEADERS.map((h) => csvCell((r as Record<string, unknown>)[h])).join(','))].join('\n')
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
