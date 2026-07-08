import { db } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const note = await db.purchaseCreditNote.findUnique({
      where: { id },
      include: { partner: true },
    })
    if (!note) return notFound('غير موجود')
    return ok(note)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await db.purchaseCreditNote.findUnique({ where: { id } })
    if (!existing) return notFound('غير موجود')

    const updated = await db.purchaseCreditNote.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        reason: body.reason ?? existing.reason,
      },
    })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.purchaseCreditNote.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
