import { db } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/erp/api-response'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.contract.findUnique({ where: { id } })
    if (!exists) return notFound('Contract not found')

    const data: any = {}
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.baseSalary !== undefined) data.baseSalary = parseFloat(body.baseSalary)
    if (body.allowances !== undefined) data.allowances = parseFloat(body.allowances)
    if (body.status) data.status = body.status

    // If setting to active, expire other active contracts
    if (body.status === 'active' && exists.status !== 'active') {
      await db.contract.updateMany({
        where: { employeeId: exists.employeeId, status: 'active', id: { not: id } },
        data: { status: 'expired', endDate: new Date(body.startDate || exists.startDate) },
      })
    }

    const updated = await db.contract.update({
      where: { id },
      data,
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.contract.findUnique({ where: { id } })
    if (!exists) return notFound('Contract not found')

    await db.contract.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
