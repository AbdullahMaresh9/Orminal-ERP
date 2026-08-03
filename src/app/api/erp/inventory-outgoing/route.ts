import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, cogsPosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/inventory-outgoing
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const storehouseId = url.searchParams.get('storehouseId') || url.searchParams.get('warehouseId')

    const where: any = {}
    if (q) where.code = { contains: q }
    if (storehouseId && storehouseId !== 'all') where.warehouseId = storehouseId

    const [data, total] = await Promise.all([
      db.delivery.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, code: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, salePrice: true, costPrice: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.delivery.count({ where }),
    ])

    const mapped: any[] = []
    for (const del of data) {
      if (del.lines && del.lines.length > 0) {
        for (const l of del.lines) {
          mapped.push({
            id: `${del.id}-${l.id}`,
            productId: l.productId,
            storehouseId: del.warehouseId,
            type: 'delivery',
            quantity: Number(l.deliveredQty || l.orderedQty || 0),
            refType: del.code,
            note: del.notes,
            createdAt: del.createdAt.toISOString(),
            product: {
              id: l.product?.id || l.productId || '',
              name: l.product?.nameAr || 'منتج',
              sku: l.product?.sku || 'SKU',
              salePrice: Number(l.product?.salePrice ?? l.product?.costPrice ?? 0),
            },
            storehouse: {
              id: del.warehouse?.id || '',
              name: del.warehouse?.nameAr || 'غير محدد',
              code: del.warehouse?.code || '',
            },
          })
        }
      }
    }

    return list(mapped, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/inventory-outgoing
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const warehouseId = body.warehouseId || body.storehouseId
    const partnerId = body.partnerId || body.clientId

    if (!warehouseId) return badRequest('المستودع مطلوب')
    if (!body.items || body.items.length === 0) return badRequest('المنتجات مطلوبة')

    const company = await db.company.findFirst()
    if (!company) return badRequest('لم يتم العثور على شركة بالمنظومة')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    let partner = partnerId ? await db.partner.findUnique({ where: { id: partnerId } }) : null
    if (!partner) {
      partner = await db.partner.findFirst({ where: { isCustomer: true } })
    }
    if (!partner) {
      partner = await db.partner.findFirst()
    }

    const code = await nextNumber('delivery', company.id, branch?.id)

    const itemsData = body.items.map((it: any) => ({
      productId: it.productId,
      orderedQty: Number(it.quantity || it.deliveredQty || 0),
      deliveredQty: Number(it.quantity || it.deliveredQty || 0),
    }))

    const status = 'done'

    // First validate stock levels if posting immediately
    for (const it of itemsData) {
      const quant = await db.stockQuant.findFirst({
        where: { productId: it.productId, warehouseId, locationId: null, lotId: null },
      })
      const currentQty = quant?.quantity ?? 0
      if (currentQty < it.deliveredQty) {
        const product = await db.product.findUnique({ where: { id: it.productId } })
        return badRequest(`الكمية المتوفرة في المخزون غير كافية للمنتج ${product?.nameAr || it.productId} (المتاح: ${currentQty}، المطلوب: ${it.deliveredQty})`)
      }
    }

    const delivery = await db.delivery.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: partner?.id,
        warehouseId,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : new Date(),
        status,
        notes: body.notes || body.note || null,
        lines: {
          create: itemsData,
        },
      },
      include: { lines: { include: { product: true } }, warehouse: true, partner: true },
    })

    let cogsAmount = 0
    await db.$transaction(async (tx) => {
      for (const l of itemsData) {
        const product = await tx.product.findUnique({ where: { id: l.productId } })
        const cost = product?.costPrice ?? 0
        const lineCost = cost * l.deliveredQty
        cogsAmount += lineCost

        await tx.stockMove.create({
          data: {
            companyId: company.id,
            documentType: 'delivery',
            documentId: delivery.id,
            productId: l.productId,
            sourceWarehouseId: warehouseId,
            quantity: l.deliveredQty,
            state: 'done',
            valuationAmount: lineCost,
            costPrice: cost,
            postingDate: new Date(),
          },
        })

        const quant = await tx.stockQuant.findFirst({
          where: { productId: l.productId, warehouseId, locationId: null, lotId: null },
        })
        if (quant) {
          await tx.stockQuant.update({
            where: { id: quant.id },
            data: { quantity: { decrement: l.deliveredQty } },
          })
        }
      }
    })

    if (cogsAmount > 0) {
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'general',
        postingDate: new Date(),
        description: `إخراج مخزوني (تكلفة المبيعات) ${code}`,
        refType: 'delivery',
        refId: delivery.id,
        lines: cogsPosting({ amount: cogsAmount }),
      })

      await db.delivery.update({
        where: { id: delivery.id },
        data: { journalEntryId: je.id },
      })
    }

    return created(delivery)
  } catch (e: any) {
    return serverError(e.message)
  }
}
