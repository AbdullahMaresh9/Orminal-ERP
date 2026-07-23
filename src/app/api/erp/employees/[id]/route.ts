import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, nameAr: true, nameEn: true } },
        jobPosition: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        contracts: { orderBy: { startDate: 'desc' } },
      },
    })
    if (!item) return notFound('Employee not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.employee.findUnique({ where: { id } })
    if (!exists) return notFound('Employee not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    if (rest.hireDate) rest.hireDate = new Date(rest.hireDate)
    if (rest.terminationDate) rest.terminationDate = new Date(rest.terminationDate)
    if (rest.birthDate) rest.birthDate = new Date(rest.birthDate)

    // Resolve jobPositionId (free text or CUID)
    if ('jobPositionId' in rest) {
      if (rest.jobPositionId) {
        const inputVal = rest.jobPositionId
        const byId = await db.jobPosition.findUnique({ where: { id: inputVal } })
        if (byId) {
          rest.jobPositionId = byId.id
        } else {
          const byName = await db.jobPosition.findFirst({
            where: { OR: [{ nameAr: inputVal }, { nameEn: inputVal }] }
          })
          if (byName) {
            rest.jobPositionId = byName.id
          } else {
            const jobCount = await db.jobPosition.count()
            const code = `JOB-${String(jobCount + 1).padStart(4, '0')}`
            const newJob = await db.jobPosition.create({
              data: {
                code,
                nameAr: inputVal,
                nameEn: inputVal,
                active: true
              }
            })
            rest.jobPositionId = newJob.id
          }
        }
      } else {
        rest.jobPositionId = null
      }
    }

    const updated = await db.employee.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.employee.findUnique({ where: { id } })
    if (!exists) return notFound('Employee not found')

    // Soft terminate if has attendance / payroll history
    const [attCount, payCount] = await Promise.all([
      db.attendance.count({ where: { employeeId: id } }),
      db.payslip.count({ where: { employeeId: id } }),
    ])
    if (attCount > 0 || payCount > 0) {
      const updated = await db.employee.update({
        where: { id },
        data: { status: 'terminated', terminationDate: new Date() },
      })
      return ok({ success: true, softTerminated: true, employee: updated })
    }
    await db.employee.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
