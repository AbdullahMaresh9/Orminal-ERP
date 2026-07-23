import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry } from '@/lib/erp/accounting-engine'
import { SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'

// GET /api/erp/inventory-adjustments
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const warehouseId = url.searchParams.get('warehouseId')

    const where: any = {}
    if (q) where.code = { contains: q }
    if (status) where.status = status
    if (warehouseId) where.warehouseId = warehouseId

    const [data, total] = await Promise.all([
      db.inventoryAdjustment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          warehouse: { select: { id: true, code: true, nameAr: true } },
          reasonCode: { select: { id: true, code: true, nameAr: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, costPrice: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryAdjustment.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST — create. On post: create StockMove, update StockQuant, post inventory gain/loss journal
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.warehouseId) return badRequest('warehouseId is required')
    if (!body.lines || body.lines.length === 0) return badRequest('lines are required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')
    const branch = await db.branch.findFirst({ where: { companyId: company.id } })

    const code = await nextNumber('inventory_adjustment', company.id, branch?.id)
    const status = body.status ?? 'draft'

    // Compute variance per line
    const lines = body.lines.map((l: any) => {
      const variance = (l.countedQty ?? 0) - (l.systemQty ?? 0)
      return { ...l, variance }
    })

    const adjustment = await db.inventoryAdjustment.create({
      data: {
        companyId: company.id,
        code,
        warehouseId: body.warehouseId,
        adjustmentDate: body.adjustmentDate ? new Date(body.adjustmentDate) : new Date(),
        reason: body.reason,
        reasonCodeId: body.reasonCodeId,
        status,
        notes: body.notes,
        createdBy: body.createdBy,
        lines: {
          create: lines.map((l: any) => ({
            productId: l.productId,
            systemQty: l.systemQty,
            countedQty: l.countedQty,
            variance: l.variance,
            unitCost: l.unitCost,
            lotId: l.lotId,
          })),
        },
      },
      include: { lines: { include: { product: true } } },
    })

    // On post: process stock and journal
    if (status === 'posted') {
      let gainAmount = 0
      let lossAmount = 0
      await db.$transaction(async (tx) => {
        for (const l of lines) {
          const variance = l.variance
          if (variance === 0) continue

          // StockMove
          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'adjustment',
              documentId: adjustment.id,
              productId: l.productId,
              sourceWarehouseId: variance < 0 ? body.warehouseId : undefined,
              destWarehouseId: variance > 0 ? body.warehouseId : undefined,
              quantity: Math.abs(variance),
              uomId: l.uomId,
              state: 'done',
              valuationAmount: Math.abs(variance) * (l.unitCost || 0),
              costPrice: l.unitCost,
              postingDate: new Date(),
            },
          })

          // Update StockQuant
          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
          })
          if (quant) {
            await tx.stockQuant.update({
              where: { id: quant.id },
              data: { quantity: { increment: variance } },
            })
          } else if (variance > 0) {
            await tx.stockQuant.create({
              data: {
                productId: l.productId,
                warehouseId: body.warehouseId,
                quantity: variance,
              },
            })
          }

          // Track gain/loss
          const lineValue = Math.abs(variance) * (l.unitCost || 0)
          if (variance > 0) gainAmount += lineValue
          else lossAmount += lineValue
        }
        await tx.inventoryAdjustment.update({ where: { id: adjustment.id }, data: { status: 'posted' } })
      })

      // Post journal entry: Dr/Cr Inventory vs Operating Expenses/Other Revenue
      const journalLines: any[] = []
      if (gainAmount > 0) {
        // Inventory gain: Dr Inventory / Cr Other Revenue
        journalLines.push({ accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: gainAmount, credit: 0, description: 'زيادة مخزون' })
        journalLines.push({ accountCode: SYSTEM_ACCOUNTS.OTHER_REVENUE, debit: 0, credit: gainAmount, description: 'إيراد آخر - زيادة مخزون' })
      }
      if (lossAmount > 0) {
        // Inventory loss: Dr Operating Expenses / Cr Inventory
        journalLines.push({ accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: lossAmount, credit: 0, description: 'مصروف - نقص مخزون' })
        journalLines.push({ accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: 0, credit: lossAmount, description: 'نقص مخزون' })
      }

      if (journalLines.length > 0) {
        const je = await postJournalEntry({
          companyId: company.id,
          branchId: branch?.id,
          journalType: 'general',
          postingDate: new Date(),
          description: `تسوية مخزون ${code}`,
          refType: 'inventory_adjustment',
          refId: adjustment.id,
          lines: journalLines,
          userId: body.createdBy,
        })
        await db.inventoryAdjustment.update({
          where: { id: adjustment.id },
          data: { journalEntryId: je.id },
        })
      }
    }

    const result = await db.inventoryAdjustment.findUnique({
      where: { id: adjustment.id },
      include: {
        lines: { include: { product: true } },
        warehouse: true,
        reasonCode: true,
      },
    })
    return created(result)
  } catch (e: any) {
    return serverError(e.message)
  }
}
