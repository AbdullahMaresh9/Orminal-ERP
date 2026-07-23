import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

// GET /api/erp/sales-quotations/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.salesQuotation.findUnique({
      where: { id },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })
    if (!item) return notFound('Quotation not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// PUT — update quotation (only if draft)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.salesQuotation.findUnique({ where: { id } })
    if (!exists) return notFound('Quotation not found')
    if (exists.status !== 'draft') return badRequest('Only draft quotations can be edited')

    const { id: _id, lines, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.salesQuotation.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// DELETE — only draft
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.salesQuotation.findUnique({ where: { id } })
    if (!exists) return notFound('Quotation not found')
    if (exists.status !== 'draft') return badRequest('Only draft quotations can be deleted')

    await db.salesQuotation.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
