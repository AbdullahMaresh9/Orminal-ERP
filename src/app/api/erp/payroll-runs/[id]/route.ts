import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'
import { postJournalEntry, SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                id: true, employeeNo: true, nameAr: true, nameEn: true,
                department: { select: { nameAr: true } },
              },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
    })
    if (!item) return notFound('Payroll run not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.payrollRun.findUnique({ where: { id } })
    if (!exists) return notFound('Payroll run not found')

    const { action } = body
    if (action) {
      // ============= Post: create journal entry (Dr Salaries Expense / Cr Salaries Payable + Cr Deductions) =============
      if (action === 'post') {
        if (exists.status !== 'calculated' && exists.status !== 'reviewed' && exists.status !== 'approved') {
          return badRequest('يجب الحساب أولاً قبل الترحيل')
        }
        if (exists.totalNet <= 0) return badRequest('لا يمكن ترحيل تشغيل بصافي صفري')

        // Use the main branch for the journal sequence (matches existing setup)
        const branch = await db.branch.findFirst({ where: { companyId: exists.companyId }, orderBy: { isMain: 'desc' } })
        const je = await postJournalEntry({
          companyId: exists.companyId,
          branchId: branch?.id,
          postingDate: new Date(),
          description: `ترحيل رواتب فترة ${exists.period}`,
          refType: 'payroll',
          refId: exists.id,
          lines: [
            { accountCode: SYSTEM_ACCOUNTS.SALARIES_EXPENSE, debit: exists.totalGross, credit: 0, description: 'مصروف الرواتب' },
            { accountCode: SYSTEM_ACCOUNTS.SALARIES_PAYABLE, debit: 0, credit: exists.totalNet, description: 'رواتب مستحقة' },
            { accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: 0, credit: exists.totalDeductions, description: 'استقطاعات الرواتب' },
          ],
        })

        // Mark payslips as posted
        await db.payslip.updateMany({ where: { payrollRunId: id }, data: { status: 'posted' } })
        const updated = await db.payrollRun.update({
          where: { id },
          data: { status: 'posted', journalEntryId: je.id },
        })
        return ok({ ...updated, journalEntryCode: je.code })
      }

      if (action === 'pay') {
        if (exists.status !== 'posted') return badRequest('يجب الترحيل أولاً قبل الدفع')
        await db.payslip.updateMany({ where: { payrollRunId: id }, data: { status: 'paid' } })
        const updated = await db.payrollRun.update({ where: { id }, data: { status: 'paid' } })
        return ok(updated)
      }

      if (action === 'review') {
        if (exists.status !== 'calculated') return badRequest('يجب الحساب أولاً')
        const updated = await db.payrollRun.update({ where: { id }, data: { status: 'reviewed' } })
        return ok(updated)
      }

      if (action === 'approve') {
        if (exists.status !== 'reviewed') return badRequest('يجب المراجعة أولاً')
        const updated = await db.payrollRun.update({ where: { id }, data: { status: 'approved' } })
        return ok(updated)
      }

      if (action === 'cancel') {
        const updated = await db.payrollRun.update({ where: { id }, data: { status: 'cancelled' } })
        return ok(updated)
      }

      return badRequest(`إجراء غير معروف: ${action}`)
    }

    // Plain update
    const { id: _id, ...rest } = body
    if (rest.startDate) rest.startDate = new Date(rest.startDate)
    if (rest.endDate) rest.endDate = new Date(rest.endDate)
    if (rest.totalGross !== undefined) rest.totalGross = Number(rest.totalGross) || 0
    if (rest.totalDeductions !== undefined) rest.totalDeductions = Number(rest.totalDeductions) || 0
    if (rest.totalNet !== undefined) rest.totalNet = Number(rest.totalNet) || 0
    const updated = await db.payrollRun.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.payrollRun.findUnique({ where: { id } })
    if (!exists) return notFound('Payroll run not found')
    if (['posted', 'paid'].includes(exists.status)) {
      return badRequest('لا يمكن حذف تشغيل مرحّل أو مدفوع')
    }
    await db.payslip.deleteMany({ where: { payrollRunId: id } })
    await db.payrollRun.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
