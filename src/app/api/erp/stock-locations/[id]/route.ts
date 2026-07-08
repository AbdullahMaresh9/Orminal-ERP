import { db } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.stockLocation.findUnique({ where: { id }, include: { warehouse: true, parent: true } })
    if (!item) return notFound()
    return ok(item)
  } catch (e: any) { return serverError(e.message) }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await db.stockLocation.update({ where: { id }, data: { code: body.code, nameAr: body.nameAr, nameEn: body.nameEn, type: body.type, parentId: body.parentId, active: body.active } })
    return ok(updated)
  } catch (e: any) { return serverError(e.message) }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.stockLocation.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) { return serverError(e.message) }
}
