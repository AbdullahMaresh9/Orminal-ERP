import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const employeeId = url.searchParams.get('employeeId')
    const status = url.searchParams.get('status')
    const leaveType = url.searchParams.get('leaveType')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (leaveType) where.leaveType = leaveType
    if (q) {
      where.OR = [{ reason: { contains: q } }]
      where.employee = { OR: [{ nameAr: { contains: q } }, { nameEn: { contains: q } }, { employeeNo: { contains: q } }] }
    }

    const [data, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { employee: { select: { id: true, employeeNo: true, nameAr: true, nameEn: true, department: { select: { nameAr: true } } } } },
      }),
      db.leaveRequest.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return badRequest('الموظف وتاريخ البداية والنهاية مطلوبة')
    }
    const start = new Date(body.startDate)
    const end = new Date(body.endDate)
    if (end < start) return badRequest('تاريخ النهاية قبل تاريخ البداية')

    // Auto-calc days if not provided
    const diffMs = end.getTime() - start.getTime()
    const days = body.days !== undefined ? Number(body.days) : Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1

    const created = await db.leaveRequest.create({
      data: {
        employeeId: body.employeeId,
        leaveType: body.leaveType || 'annual',
        startDate: start,
        endDate: end,
        days,
        status: body.status || 'submitted',
        reason: body.reason,
      },
      include: { employee: { select: { id: true, employeeNo: true, nameAr: true } } },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
