import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

// GET /api/erp/partners/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.partner.findUnique({
      where: { id },
      include: {
        country: true,
        paymentTerm: true,
        receivableAccount: true,
        payableAccount: true,
        contacts: true,
        addresses: true,
        bankAccounts: true,
      },
    })
    if (!item) return notFound('Partner not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT /api/erp/partners/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.partner.findUnique({ where: { id } })
    if (!exists) return notFound('Partner not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.partner.update({
      where: { id },
      data: rest,
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE /api/erp/partners/[id] — soft delete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.partner.findUnique({ where: { id } })
    if (!exists) return notFound('Partner not found')

    const txCount = await db.salesOrder.count({ where: { partnerId: id } })
    if (txCount > 0) {
      const updated = await db.partner.update({ where: { id }, data: { active: false } })
      return ok({ success: true, softDeleted: true, partner: updated })
    }
    await db.partner.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
