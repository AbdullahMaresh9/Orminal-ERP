import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const url = new URL(req.url)
    const employeeId = url.searchParams.get('employeeId')
    const status = url.searchParams.get('status')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const [data, total] = await Promise.all([
      db.contract.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              nameAr: true,
              nameEn: true,
              department: { select: { nameAr: true } },
            },
          },
        },
      }),
      db.contract.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.employeeId || !body.startDate || body.baseSalary === undefined) {
      return badRequest('الموظف وتاريخ البدء والراتب الأساسي مطلوبة')
    }

    const employeeExists = await db.employee.findUnique({ where: { id: body.employeeId } })
    if (!employeeExists) {
      return badRequest('الموظف غير موجود')
    }

    // If new contract is active, expire all older active contracts for this employee
    if (body.status === 'active') {
      await db.contract.updateMany({
        where: { employeeId: body.employeeId, status: 'active' },
        data: { status: 'expired', endDate: new Date(body.startDate) },
      })
    }

    const created = await db.contract.create({
      data: {
        employeeId: body.employeeId,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        baseSalary: parseFloat(body.baseSalary),
        allowances: parseFloat(body.allowances || 0),
        status: body.status || 'active',
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
