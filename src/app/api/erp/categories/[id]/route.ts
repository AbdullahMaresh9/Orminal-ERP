import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.category.findUnique({
      where: { id },
      include: { parent: true, children: true, products: { select: { id: true, sku: true, nameAr: true } } },
    })
    if (!item) return notFound('Category not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.category.findUnique({ where: { id } })
    if (!exists) return notFound('Category not found')

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = body
    const updated = await db.category.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.category.findUnique({ where: { id } })
    if (!exists) return notFound('Category not found')

    const childrenCount = await db.category.count({ where: { parentId: id } })
    if (childrenCount > 0) return badRequest('Cannot delete: category has sub-categories')

    const productsCount = await db.product.count({ where: { categoryId: id } })
    if (productsCount > 0) return badRequest('Cannot delete: category has products')

    await db.category.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
