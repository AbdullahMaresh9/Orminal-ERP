import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.costCenter.findUnique({
      where: { id },
      include: { parent: true, children: true },
    })
    if (!item) return notFound('Cost center not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.costCenter.findUnique({ where: { id } })
    if (!exists) return notFound('Cost center not found')

    const { id: _id, ...rest } = body
    const updated = await db.costCenter.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.costCenter.findUnique({ where: { id } })
    if (!exists) return notFound('Cost center not found')

    const children = await db.costCenter.count({ where: { parentId: id } })
    if (children > 0) return badRequest('Cannot delete: has sub-centers')

    await db.costCenter.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
