import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

// GET /api/erp/inventory-transfers
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
          fromWarehouse: { select: { id: true, nameAr: true, code: true } },
          toWarehouse: { select: { id: true, nameAr: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.stockTransfer.count({ where }),
    ])

    const mapped = data.map((st: any) => ({
      ...st,
      fromStorehouse: st.fromWarehouse ? { id: st.fromWarehouse.id, name: st.fromWarehouse.nameAr, code: st.fromWarehouse.code } : null,
      toStorehouse: st.toWarehouse ? { id: st.toWarehouse.id, name: st.toWarehouse.nameAr, code: st.toWarehouse.code } : null,
      itemsJson: JSON.stringify(st.lines.map((l: any) => ({
        productId: l.productId,
        quantity: l.quantity,
        doneQty: l.doneQty,
        productName: l.product?.nameAr,
      }))),
    }))

    return list(mapped, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/inventory-transfers
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const fromWarehouseId = body.fromWarehouseId || body.fromStorehouseId
    const toWarehouseId = body.toWarehouseId || body.toStorehouseId

    if (!fromWarehouseId) return badRequest('المستودع المصدر مطلوب')
    if (!toWarehouseId) return badRequest('المستودع الوجهة مطلوب')
    if (fromWarehouseId === toWarehouseId) return badRequest('لا يمكن التحويل لنفس المستودع')
    if (!body.items || body.items.length === 0) return badRequest('المنتجات مطلوبة')

    const company = await db.company.findFirst()
    if (!company) return badRequest('لم يتم العثور على شركة بالمنظومة')

    const code = await nextNumber('stock_transfer', company.id)

    const itemsData = body.items.map((it: any) => ({
      productId: it.productId,
      quantity: Number(it.quantity || 0),
    }))

    const status = body.status ?? 'done'

    // If posting immediately, validate stock availability at source warehouse
    if (status === 'done' || status === 'received') {
      for (const it of itemsData) {
        const quant = await db.stockQuant.findFirst({
          where: { productId: it.productId, warehouseId: fromWarehouseId, locationId: null, lotId: null },
        })
        const currentQty = quant?.quantity ?? 0
        if (currentQty < it.quantity) {
          const product = await db.product.findUnique({ where: { id: it.productId } })
          return badRequest(`المخزون المتوفر في المستودع المصدر غير كافٍ للمنتج ${product?.nameAr || it.productId} (المتاح: ${currentQty}، المطلوب: ${it.quantity})`)
        }
      }
    }

    const transfer = await db.stockTransfer.create({
      data: {
        companyId: company.id,
        code,
        fromWarehouseId,
        toWarehouseId,
        transferDate: body.transferDate ? new Date(body.transferDate) : new Date(),
        status,
        notes: body.notes || body.note || null,
        lines: {
          create: itemsData,
        },
      },
      include: { lines: { include: { product: true } }, fromWarehouse: true, toWarehouse: true },
    })

    if (status === 'done' || status === 'received') {
      await db.$transaction(async (tx) => {
        for (const l of itemsData) {
          // Out of source warehouse
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: transfer.id,
              productId: l.productId,
              sourceWarehouseId: fromWarehouseId,
              quantity: l.quantity,
              state: 'done',
              postingDate: new Date(),
            },
          })
          // Into dest warehouse
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'transfer',
              documentId: transfer.id,
              productId: l.productId,
              destWarehouseId: toWarehouseId,
              quantity: l.quantity,
              state: 'done',
              postingDate: new Date(),
            },
          })

          // Decrement source quant
          const srcQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: fromWarehouseId, locationId: null, lotId: null },
          })
          if (srcQuant) {
            await tx.stockQuant.update({
              where: { id: srcQuant.id },
              data: { quantity: { decrement: l.quantity } },
            })
          }

          // Increment dest quant
          const destQuant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: toWarehouseId, locationId: null, lotId: null },
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
                warehouseId: toWarehouseId,
                quantity: l.quantity,
              },
            })
          }
        }
      })
    }

    return created({
      ...transfer,
      fromStorehouse: { id: transfer.fromWarehouse.id, name: transfer.fromWarehouse.nameAr, code: transfer.fromWarehouse.code },
      toStorehouse: { id: transfer.toWarehouse.id, name: transfer.toWarehouse.nameAr, code: transfer.toWarehouse.code },
      itemsJson: JSON.stringify(transfer.lines.map((l: any) => ({
        productId: l.productId,
        quantity: l.quantity,
        doneQty: l.doneQty,
        productName: l.product?.nameAr,
      }))),
    })
  } catch (e: any) {
    return serverError(e.message)
  }
}
