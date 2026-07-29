import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, goodsReceiptPosting } from '@/lib/erp/accounting-engine'

// GET /api/erp/inventory-incoming
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
      db.goodsReceipt.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, code: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, costPrice: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.goodsReceipt.count({ where }),
    ])

    const mapped: any[] = []
    for (const grn of data) {
      if (grn.lines && grn.lines.length > 0) {
        for (const l of grn.lines) {
          mapped.push({
            id: `${grn.id}-${l.id}`,
            productId: l.productId,
            storehouseId: grn.warehouseId,
            type: 'receipt',
            quantity: Number(l.receivedQty || l.orderedQty || 0),
            refType: grn.code,
            note: grn.notes,
            createdAt: grn.createdAt.toISOString(),
            product: {
              id: l.product?.id || l.productId || '',
              name: l.product?.nameAr || 'منتج',
              sku: l.product?.sku || 'SKU',
              costPrice: Number(l.unitCost ?? l.product?.costPrice ?? 0),
            },
            storehouse: {
              id: grn.warehouse?.id || '',
              name: grn.warehouse?.nameAr || 'غير محدد',
              code: grn.warehouse?.code || '',
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

// POST /api/erp/inventory-incoming
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const warehouseId = body.warehouseId || body.storehouseId
    const partnerId = body.partnerId || body.supplierId

    if (!warehouseId) return badRequest('المستودع مطلوب')
    if (!body.items || body.items.length === 0) return badRequest('المنتجات مطلوبة')

    const company = await db.company.findFirst()
    if (!company) return badRequest('لم يتم العثور على شركة بالمنظومة')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    let partner = partnerId ? await db.partner.findUnique({ where: { id: partnerId } }) : null
    if (!partner) {
      partner = await db.partner.findFirst({ where: { isSupplier: true } })
    }
    if (!partner) {
      partner = await db.partner.findFirst()
    }
    if (!partner) return badRequest('لا يوجد مورد أو شريك تجاري مسجل')

    const code = await nextNumber('goods_receipt', company.id, branch?.id)

    const linesData = body.items.map((it: any) => {
      const qty = Number(it.quantity || it.receivedQty || 0)
      const cost = Number(it.cost || it.unitCost || it.costPrice || 0)
      return {
        productId: it.productId,
        orderedQty: qty,
        receivedQty: qty,
        unitCost: cost,
        total: qty * cost,
      }
    })

    const totalAmount = linesData.reduce((s: number, l: any) => s + l.total, 0)
    const status = 'validated'

    const grn = await db.goodsReceipt.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: partner.id,
        warehouseId,
        receiptDate: body.receiptDate ? new Date(body.receiptDate) : new Date(),
        status,
        notes: body.notes || body.note || null,
        lines: {
          create: linesData,
        },
      },
      include: { lines: { include: { product: true } }, warehouse: true, partner: true },
    })

    await db.$transaction(async (tx) => {
      for (const l of linesData) {
        await tx.stockMove.create({
          data: {
            companyId: company.id,
            documentType: 'receipt',
            documentId: grn.id,
            productId: l.productId,
            destWarehouseId: warehouseId,
            quantity: l.receivedQty,
            state: 'done',
            valuationAmount: l.total,
            costPrice: l.unitCost,
            postingDate: new Date(),
          },
        })

        const existing = await tx.stockQuant.findFirst({
          where: { productId: l.productId, warehouseId, locationId: null, lotId: null },
        })
        if (existing) {
          await tx.stockQuant.update({
            where: { id: existing.id },
            data: { quantity: { increment: l.receivedQty } },
          })
        } else {
          await tx.stockQuant.create({
            data: {
              productId: l.productId,
              warehouseId,
              quantity: l.receivedQty,
            },
          })
        }
      }
    })

    if (totalAmount > 0) {
      const je = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'purchase',
        postingDate: new Date(),
        description: `إدخال مخزوني ${code}`,
        refType: 'goods_receipt',
        refId: grn.id,
        lines: goodsReceiptPosting({ amount: totalAmount }),
      })

      await db.goodsReceipt.update({
        where: { id: grn.id },
        data: { journalEntryId: je.id },
      })
    }

    return created(grn)
  } catch (e: any) {
    return serverError(e.message)
  }
}
