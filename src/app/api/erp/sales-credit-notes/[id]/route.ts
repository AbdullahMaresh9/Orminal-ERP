import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesCreditNote.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!item) return notFound('Credit note not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesCreditNote.findUnique({ where: { id } })
    if (!exists) return notFound('Credit note not found')
    if (exists.status !== 'draft') return badRequest('Only draft credit notes can be edited')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.salesCreditNote.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesCreditNote.findUnique({ where: { id } })
    if (!exists) return notFound('Credit note not found')
    if (exists.status !== 'draft') return badRequest('Only draft credit notes can be deleted')

    await db.salesCreditNote.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
