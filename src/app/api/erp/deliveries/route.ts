import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, cogsPosting } from '@/lib/erp/accounting-engine'
import { n } from '@/lib/erp/money'

// GET /api/erp/deliveries
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
    const body = await req.json()
    if (!body.warehouseId) return badRequest('warehouseId is required')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('delivery', company.id, branch?.id)
    const status = body.status ?? 'draft'

    const delivery = await db.delivery.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        salesOrderId: body.salesOrderId,
        partnerId: body.partnerId,
        warehouseId: body.warehouseId,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : new Date(),
        status,
        notes: body.notes,
        createdBy: body.createdBy,
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

    // On done: create stock moves, decrement quants, post COGS journal, update SO delivery status
    if (status === 'done') {
      let cogsAmount = 0
      await db.$transaction(async (tx) => {
        for (const l of body.lines) {
          // Get product cost price
          const product = await tx.product.findUnique({ where: { id: l.productId } })
          const cost = n(product?.costPrice ?? 0)
          const lineCost = cost * (l.deliveredQty || 0)
          cogsAmount += lineCost

          // StockMove (out)
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'delivery',
              documentId: delivery.id,
              productId: l.productId,
              sourceWarehouseId: body.warehouseId,
              quantity: l.deliveredQty,
              uomId: l.uomId,
              state: 'done',
              valuationAmount: lineCost,
              costPrice: cost,
              postingDate: new Date(),
            },
          })

          // Decrement StockQuant
          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
          })
          if (quant) {
            await tx.stockQuant.update({
              where: { id: quant.id },
              data: { quantity: { decrement: l.deliveredQty } },
            })
          }
        }
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: 'done' } })
      })

      // Post COGS journal
      if (cogsAmount > 0) {
        const je = await postJournalEntry({
          companyId: company.id,
          branchId: branch?.id,
          journalType: 'general',
          postingDate: new Date(),
          description: `تكلفة بضاعة مباعة - تسليم ${code}`,
          refType: 'delivery',
          refId: delivery.id,
          lines: cogsPosting({ amount: cogsAmount }),
          userId: body.createdBy,
        })
        await db.delivery.update({
          where: { id: delivery.id },
          data: { journalEntryId: je.id },
        })
      }

      // Update SO delivery status
      if (body.salesOrderId) {
        await db.salesOrder.update({
          where: { id: body.salesOrderId },
          data: { deliveryStatus: 'delivered', status: 'delivered' },
        })
      }
    }

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
    return serverError(e.message)
  }
}
