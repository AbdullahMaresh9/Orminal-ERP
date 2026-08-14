import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, conflict, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/stock-transfers
export async function GET(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: any = { companyId: context.companyId }
    if (q) where.code = { contains: q }
    if (status) where.status = status

    const [data, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          fromWarehouse: { select: { id: true, code: true, nameAr: true } },
          toWarehouse: { select: { id: true, code: true, nameAr: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.stockTransfer.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — create. On done: 2 StockMoves, update StockQuants.
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.fromWarehouseId) return badRequest('fromWarehouseId is required')
    if (!body.toWarehouseId) return badRequest('toWarehouseId is required')
    if (body.fromWarehouseId === body.toWarehouseId) return badRequest('Source and destination warehouses must differ')
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('lines are required')
    if (body.lines.some((l: any) => !l.productId || !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0)) {
      return badRequest('each line must have a product and a positive quantity')
    }

    const [company, fromWh, toWh] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.warehouse.findFirst({ where: { id: body.fromWarehouseId, branch: { companyId: context.companyId } } }),
      db.warehouse.findFirst({ where: { id: body.toWarehouseId, branch: { companyId: context.companyId } } }),
    ])
    if (!company) return badRequest('company not found')
    if (!fromWh) return badRequest('source warehouse not found')
    if (!toWh) return badRequest('destination warehouse not found')

    const code = await nextNumber('stock_transfer', company.id)
    const status = body.status === 'done' || body.status === 'received' ? 'done' : 'draft'
    const transferDate = body.transferDate ? new Date(body.transferDate) : new Date()

    // Aggregate requested quantities per product for the availability pre-check
    const wanted = new Map<string, number>()
    for (const l of body.lines) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + Number(l.quantity))

    if (status === 'done') {
      for (const [productId, qty] of wanted) {
        const srcQuant = await db.stockQuant.findFirst({
          where: { productId, warehouseId: body.fromWarehouseId, locationId: null, lotId: null },
        })
        const onHand = srcQuant?.quantity ?? 0
        if (onHand < qty) {
          return conflict(`Insufficient stock in source warehouse for product ${productId} (on hand ${onHand}, requested ${qty})`, 'INSUFFICIENT_STOCK')
        }
      }
    }

    const transfer = await db.$transaction(async (tx) => {
      const trn = await tx.stockTransfer.create({
        data: {
          companyId: company.id,
          code,
          fromWarehouseId: body.fromWarehouseId,
          toWarehouseId: body.toWarehouseId,
          transferDate,
          status,
          notes: body.notes,
          createdBy: context.userId,
          lines: {
            create: body.lines.map((l: any) => ({
              productId: l.productId,
              quantity: Number(l.quantity),
              uomId: l.uomId,
              lotId: l.lotId,
            })),
          },
        },
        include: { lines: { include: { product: true } } },
      })

      if (status === 'done') {
        for (const l of body.lines) {
          const qty = Number(l.quantity)
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: trn.id,
              productId: l.productId,
              sourceWarehouseId: body.fromWarehouseId,
              quantity: qty,
              uomId: l.uomId,
              state: 'done',
              postingDate: transferDate,
            },
          })
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: trn.id,
              productId: l.productId,
              destWarehouseId: body.toWarehouseId,
              quantity: qty,
              uomId: l.uomId,
              state: 'done',
              postingDate: transferDate,
            },
          })

          // Decrement source with a hard negative guard
          const srcQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.fromWarehouseId, locationId: null, lotId: null },
          })
          if (!srcQuant || srcQuant.quantity < qty) throw new Error(`INSUFFICIENT_STOCK: ${l.productId}`)
          await tx.stockQuant.update({ where: { id: srcQuant.id }, data: { quantity: { decrement: qty } } })

          // Increment destination
          const destQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.toWarehouseId, locationId: null, lotId: null },
          })
          if (destQuant) {
            await tx.stockQuant.update({ where: { id: destQuant.id }, data: { quantity: { increment: qty } } })
          } else {
            await tx.stockQuant.create({
              data: { productId: l.productId, warehouseId: body.toWarehouseId, quantity: qty },
            })
          }
        }
      }
      return trn
    })

    const result = await db.stockTransfer.findUnique({
      where: { id: transfer.id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        lines: { include: { product: true } },
      },
    })
    return created(result)
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.startsWith('INSUFFICIENT_STOCK')) {
      return conflict('Insufficient stock in source warehouse', 'INSUFFICIENT_STOCK')
    }
    return serverError(e.message)
  }
}
