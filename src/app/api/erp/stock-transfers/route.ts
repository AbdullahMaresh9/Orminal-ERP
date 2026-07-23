import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/stock-transfers
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: any = {}
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
    const body = await req.json()
    if (!body.fromWarehouseId) return badRequest('fromWarehouseId is required')
    if (!body.toWarehouseId) return badRequest('toWarehouseId is required')
    if (body.fromWarehouseId === body.toWarehouseId) return badRequest('Source and destination warehouses must differ')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')

    const code = await nextNumber('stock_transfer', company.id)
    const status = body.status ?? 'draft'

    const transfer = await db.stockTransfer.create({
      data: {
        companyId: company.id,
        code,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        transferDate: body.transferDate ? new Date(body.transferDate) : new Date(),
        status,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: {
          create: body.lines.map((l: any) => ({
            productId: l.productId,
            quantity: l.quantity,
            uomId: l.uomId,
            lotId: l.lotId,
          })),
        },
      },
      include: { lines: { include: { product: true } } },
    })

    // On done: create 2 StockMoves (out of source, into dest), update StockQuants
    if (status === 'done' || status === 'received') {
      await db.$transaction(async (tx) => {
        for (const l of body.lines) {
          // Out of source
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: transfer.id,
              productId: l.productId,
              sourceWarehouseId: body.fromWarehouseId,
              quantity: l.quantity,
              uomId: l.uomId,
              state: 'done',
              postingDate: new Date(),
            },
          })
          // Into dest
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: transfer.id,
              productId: l.productId,
              destWarehouseId: body.toWarehouseId,
              quantity: l.quantity,
              uomId: l.uomId,
              state: 'done',
              postingDate: new Date(),
            },
          })

          // Decrement source
          const srcQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.fromWarehouseId, locationId: null, lotId: null },
          })
          if (srcQuant) {
            await tx.stockQuant.update({
              where: { id: srcQuant.id },
              data: { quantity: { decrement: l.quantity } },
            })
          }

          // Increment dest
          const destQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.toWarehouseId, locationId: null, lotId: null },
          })
          if (destQuant) {
            await tx.stockQuant.update({
              where: { id: destQuant.id },
              data: { quantity: { increment: l.quantity } },
            })
          } else {
            await tx.stockQuant.create({
              data: {
                productId: l.productId,
                warehouseId: body.toWarehouseId,
                quantity: l.quantity,
              },
            })
          }
        }
        await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: 'done' } })
      })
    }

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
    return serverError(e.message)
  }
}
