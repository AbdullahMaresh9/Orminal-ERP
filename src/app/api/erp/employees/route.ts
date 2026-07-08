import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const status = new URL(req.url).searchParams.get('status')
    const where: any = {}
    if (status) where.status = status
    if (q) {
      where.OR = [{ employeeNo: { contains: q } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }, { phone: { contains: q } }]
    }
    const [data, total] = await Promise.all([
      db.employee.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { department: { select: { id: true, nameAr: true, nameEn: true } } } }),
      db.employee.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nameAr) return badRequest('الاسم مطلوب')
    const company = await db.company.findFirst()
    if (!company) return badRequest('no company')
    const count = await db.employee.count()
    const employeeNo = `EMP-${String(count + 1).padStart(4, '0')}`
    const created = await db.employee.create({
      data: {
        employeeNo,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        companyId: company.id,
        branchId: body.branchId,
        departmentId: body.departmentId,
        jobPositionId: body.jobPositionId,
        hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
        status: body.status || 'active',
        nationalId: body.nationalId,
        phone: body.phone,
        email: body.email,
        address: body.address,
        gender: body.gender,
        nationality: body.nationality,
      },
    })
    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
