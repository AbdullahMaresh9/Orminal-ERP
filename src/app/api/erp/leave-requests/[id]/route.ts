import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, employeeNo: true, nameAr: true, nameEn: true, department: { select: { nameAr: true } } } } },
    })
    if (!item) return notFound('Leave request not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.leaveRequest.findUnique({ where: { id } })
    if (!exists) return notFound('Leave request not found')

    const { action } = body
    if (action) {
      let newStatus = exists.status
      if (action === 'approve') newStatus = 'approved'
      else if (action === 'reject') newStatus = 'rejected'
      else if (action === 'submit') newStatus = 'submitted'
      else return badRequest(`إجراء غير معروف: ${action}`)

      const updated = await db.leaveRequest.update({
        where: { id },
        data: {
          status: newStatus,
          approverId: body.approverId,
          approvedAt: new Date(),
        },
      })
      return ok(updated)
    }

    const { id: _id, ...rest } = body
    if (rest.startDate) rest.startDate = new Date(rest.startDate)
    if (rest.endDate) rest.endDate = new Date(rest.endDate)
    if (rest.days !== undefined) rest.days = Number(rest.days)
    const updated = await db.leaveRequest.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.leaveRequest.findUnique({ where: { id } })
    if (!exists) return notFound('Leave request not found')
    if (exists.status === 'approved') return badRequest('لا يمكن حذف طلب إجازة معتمد')
    await db.leaveRequest.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
