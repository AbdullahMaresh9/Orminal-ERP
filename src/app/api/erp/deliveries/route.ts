import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, conflict, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, cogsPosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/deliveries
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
      db.delivery.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, code: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          salesOrder: { select: { id: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.delivery.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — create. On validate (status=done): create StockMove (out), decrement StockQuant, post cogs journal
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.warehouseId) return badRequest('warehouseId is required')
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('lines are required')

    const status = body.status === 'done' ? 'done' : 'draft'
    if (status === 'done' && body.lines.some((l: any) => !l.productId || !Number.isFinite(Number(l.deliveredQty)) || Number(l.deliveredQty) <= 0)) {
      return badRequest('Each line must have a product and a positive delivered quantity to validate the delivery')
    }

    const branchId = body.branchId ?? context.branchId
    const [company, warehouse] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.warehouse.findFirst({ where: { id: body.warehouseId, branch: { companyId: context.companyId } } }),
    ])
    if (!company) return badRequest('company not found')
    if (!warehouse) return badRequest('warehouse not found')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null

    if (body.salesOrderId) {
      const so = await db.salesOrder.findFirst({ where: { id: body.salesOrderId, companyId: context.companyId } })
      if (!so) return badRequest('sales order not found')
    }

    const code = await nextNumber('delivery', company.id, branch?.id)
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : new Date()

    // Pre-check stock availability before opening the transaction (fast fail)
    if (status === 'done') {
      for (const l of body.lines) {
        const quant = await db.stockQuant.findFirst({
          where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
        })
        const onHand = quant?.quantity ?? 0
        if (onHand < Number(l.deliveredQty)) {
          return conflict(`Insufficient stock for product ${l.productId}: on hand ${onHand}, requested ${l.deliveredQty}`, 'INSUFFICIENT_STOCK')
        }
      }
    }

    const delivery = await db.$transaction(async (tx) => {
      const dn = await tx.delivery.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code,
          salesOrderId: body.salesOrderId,
          partnerId: body.partnerId,
          warehouseId: body.warehouseId,
          deliveryDate,
          status,
          notes: body.notes,
          createdBy: context.userId,
          lines: {
            create: body.lines.map((l: any) => ({
              productId: l.productId,
              salesOrderLineId: l.salesOrderLineId,
              orderedQty: l.orderedQty ?? 0,
              deliveredQty: l.deliveredQty,
              lotId: l.lotId,
              uomId: l.uomId,
            })),
          },
        },
        include: { lines: { include: { product: true } } },
      })

      if (status === 'done') {
        let cogsAmount = 0
        for (const l of body.lines) {
          const product = await tx.product.findUnique({ where: { id: l.productId } })
          const cost = product?.costPrice ?? 0
          const lineCost = cost * (Number(l.deliveredQty) || 0)
          cogsAmount += lineCost

          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'delivery',
              documentId: dn.id,
              productId: l.productId,
              sourceWarehouseId: body.warehouseId,
              quantity: l.deliveredQty,
              uomId: l.uomId,
              state: 'done',
              valuationAmount: lineCost,
              costPrice: cost,
              postingDate: deliveryDate,
            },
          })

          // Decrement StockQuant with a guard against negative stock (race-safe)
          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
          })
          if (!quant || quant.quantity < Number(l.deliveredQty)) {
            throw new Error(`INSUFFICIENT_STOCK: ${l.productId}`)
          }
          await tx.stockQuant.update({
            where: { id: quant.id },
            data: { quantity: { decrement: l.deliveredQty } },
          })
        }

        // Post COGS journal in the same transaction
        if (cogsAmount > 0) {
          const je = await postJournalEntry({
            companyId: company.id,
            branchId: branch?.id,
            journalType: 'general',
            postingDate: deliveryDate,
            description: `تكلفة بضاعة مباعة - تسليم ${code}`,
            refType: 'delivery',
            refId: dn.id,
            lines: cogsPosting({ amount: cogsAmount }),
            userId: context.userId,
          }, tx)
          await tx.delivery.update({
            where: { id: dn.id },
            data: { journalEntryId: je.id },
          })
        }

        // Update SO delivery status
        if (body.salesOrderId) {
          await tx.salesOrder.update({
            where: { id: body.salesOrderId },
            data: { deliveryStatus: 'delivered', status: 'delivered' },
          })
        }
      }
      return dn
    })

    const result = await db.delivery.findUnique({
      where: { id: delivery.id },
      include: {
        lines: { include: { product: true } },
        partner: true,
        warehouse: true,
      },
    })
    return created(result)
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.startsWith('INSUFFICIENT_STOCK')) {
      return conflict('Insufficient stock to complete the delivery', 'INSUFFICIENT_STOCK')
    }
    return serverError(e.message)
  }
}
