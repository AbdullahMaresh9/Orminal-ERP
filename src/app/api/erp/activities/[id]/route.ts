import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.activity.findUnique({
      where: { id },
      include: { branch: true },
    })
    if (!item) return notFound('Activity not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.activity.findUnique({ where: { id } })
    if (!exists) return notFound('Activity not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.activity.update({
      where: { id },
      data: rest,
      include: { branch: true },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.activity.findUnique({ where: { id } })
    if (!exists) return notFound('Activity not found')

    await db.activity.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
