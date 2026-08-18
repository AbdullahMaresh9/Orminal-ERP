import { db } from '@/lib/db'
import { ok, list, notFound, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { n } from '@/lib/erp/money'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const companyId = url.searchParams.get('companyId')

    const where: any = {}
    if (status) where.status = status
    if (companyId) where.companyId = companyId
    if (q) where.period = { contains: q }

    const [data, total] = await Promise.all([
      db.payrollRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { _count: { select: { payslips: true } } },
      }),
      db.payrollRun.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body.action

    // ============= Calculate payslips from employee contracts =============
    if (action === 'calculate') {
      if (!body.id) return badRequest('معرف تشغيل الرواتب مطلوب')
      const run = await db.payrollRun.findUnique({ where: { id: body.id } })
      if (!run) return notFound('Payroll run not found')
      if (run.status !== 'draft' && run.status !== 'calculated') {
        return badRequest(`لا يمكن الحساب لحالة ${run.status}`)
      }

      const employees = await db.employee.findMany({
        where: { status: 'active', companyId: run.companyId },
        include: {
          contracts: { where: { status: 'active' }, orderBy: { startDate: 'desc' }, take: 1 },
        },
      })

      // Delete previous payslips for re-calculation
      await db.payslip.deleteMany({ where: { payrollRunId: run.id } })

      let totalGross = 0
      let totalDeductions = 0
      const year = new Date(run.period + '-01').getFullYear()

      for (const emp of employees) {
        const contract = emp.contracts[0]
        const baseSalary = n(contract?.baseSalary ?? 0)
        const allowances = n(contract?.allowances ?? 0)
        const gross = baseSalary + allowances
        const deductions = Math.round(gross * 0.05 * 100) / 100
        const net = gross - deductions
        if (gross <= 0) continue

        const code = await nextNumber('payslip', run.companyId, undefined, year)
        await db.payslip.create({
          data: {
            payrollRunId: run.id,
            employeeId: emp.id,
            code,
            grossSalary: gross,
            allowances,
            deductions,
            netSalary: net,
            status: 'calculated',
          },
        })
        totalGross += gross
        totalDeductions += deductions
      }

      const updated = await db.payrollRun.update({
        where: { id: run.id },
        data: {
          status: 'calculated',
          totalGross: Math.round(totalGross * 100) / 100,
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          totalNet: Math.round((totalGross - totalDeductions) * 100) / 100,
        },
        include: { payslips: { include: { employee: { select: { employeeNo: true, nameAr: true } } } } },
      })
      return ok(updated)
    }

    // ============= Default: create new payroll run =============
    if (!body.period || !body.startDate || !body.endDate) {
      return badRequest('الفترة وتاريخ البداية والنهاية مطلوبة')
    }
    const company = await db.company.findFirst()
    if (!company) return badRequest('لا توجد شركة')

    const created = await db.payrollRun.create({
      data: {
        companyId: body.companyId || company.id,
        period: body.period,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: 'draft',
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
