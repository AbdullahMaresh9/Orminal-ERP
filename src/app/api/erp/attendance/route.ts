import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const employeeId = url.searchParams.get('employeeId')
    const status = url.searchParams.get('status')
    const date = url.searchParams.get('date')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (date) {
      const d0 = new Date(date); d0.setHours(0, 0, 0, 0)
      const d1 = new Date(date); d1.setHours(23, 59, 59, 999)
      where.date = { gte: d0, lte: d1 }
    }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }
    if (q) {
      where.OR = [{ notes: { contains: q } }]
      // Also match employee name via employee relation filter
      where.employee = { OR: [{ nameAr: { contains: q } }, { nameEn: { contains: q } }, { employeeNo: { contains: q } }] }
    }

    const [data, total] = await Promise.all([
      db.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: pageSize,
        include: { employee: { select: { id: true, employeeNo: true, nameAr: true, nameEn: true, department: { select: { nameAr: true } } } } },
      }),
      db.attendance.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.employeeId || !body.date) return badRequest('الموظف والتاريخ مطلوبان')

    const created = await db.attendance.create({
      data: {
        employeeId: body.employeeId,
        date: new Date(body.date),
        checkIn: body.checkIn ? new Date(body.checkIn) : null,
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
        status: body.status || 'present',
        notes: body.notes,
      },
      include: { employee: { select: { id: true, employeeNo: true, nameAr: true } } },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
