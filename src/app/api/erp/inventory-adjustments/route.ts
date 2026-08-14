import { db } from '@/lib/db'
import { created, list, badRequest, serverError, unauthorized, conflict, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, SYSTEM_ACCOUNTS } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// GET /api/erp/inventory-adjustments
export async function GET(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const warehouseId = url.searchParams.get('warehouseId')

    const where: any = { companyId: context.companyId }
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
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.warehouseId) return badRequest('warehouseId is required')
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('lines are required')
    if (body.lines.some((l: any) => !l.productId)) return badRequest('each line must have a product')

    const [company, warehouse] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.warehouse.findFirst({ where: { id: body.warehouseId, branch: { companyId: context.companyId } } }),
    ])
    if (!company) return badRequest('company not found')
    if (!warehouse) return badRequest('warehouse not found')
    const branch = context.branchId ? await db.branch.findFirst({ where: { id: context.branchId, companyId: context.companyId } }) : null

    const code = await nextNumber('inventory_adjustment', company.id, branch?.id)
    const status = body.status === 'posted' ? 'posted' : 'draft'
    const adjustmentDate = body.adjustmentDate ? new Date(body.adjustmentDate) : new Date()

    // Compute variance per line
    const lines = body.lines.map((l: any) => {
      const variance = (Number(l.countedQty) || 0) - (Number(l.systemQty) || 0)
      return { ...l, variance }
    })

    // Pre-check: no shortage may drive on-hand below zero
    if (status === 'posted') {
      for (const l of lines) {
        if (l.variance < 0) {
          const quant = await db.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
          })
          const onHand = quant?.quantity ?? 0
          if (onHand + l.variance < 0) {
            return conflict(`Adjustment would drive stock negative for product ${l.productId} (on hand ${onHand}, shortage ${Math.abs(l.variance)})`, 'INSUFFICIENT_STOCK')
          }
        }
      }
    }

    // Create record + stock moves + quants + journal all in one transaction
    const adjustment = await db.$transaction(async (tx) => {
      const adj = await tx.inventoryAdjustment.create({
        data: {
          companyId: company.id,
          code,
          warehouseId: body.warehouseId,
          adjustmentDate,
          reason: body.reason,
          reasonCodeId: body.reasonCodeId,
          status,
          notes: body.notes,
          createdBy: context.userId,
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

      if (status === 'posted') {
        let gainAmount = 0
        let lossAmount = 0
        for (const l of lines) {
          const variance = l.variance
          if (variance === 0) continue

          await tx.stockMove.create({
            data: {
              companyId: company.id,
              documentType: 'adjustment',
              documentId: adj.id,
              productId: l.productId,
              sourceWarehouseId: variance < 0 ? body.warehouseId : undefined,
              destWarehouseId: variance > 0 ? body.warehouseId : undefined,
              quantity: Math.abs(variance),
              uomId: l.uomId,
              state: 'done',
              valuationAmount: Math.abs(variance) * (l.unitCost || 0),
              costPrice: l.unitCost,
              postingDate: adjustmentDate,
            },
          })

          const quant = await tx.stockQuant.findFirst({
            where: { productId: l.productId, warehouseId: body.warehouseId, locationId: null, lotId: null },
          })
          if (quant) {
            if (quant.quantity + variance < 0) throw new Error(`INSUFFICIENT_STOCK: ${l.productId}`)
            await tx.stockQuant.update({ where: { id: quant.id }, data: { quantity: { increment: variance } } })
          } else if (variance > 0) {
            await tx.stockQuant.create({
              data: { productId: l.productId, warehouseId: body.warehouseId, quantity: variance },
            })
          } else {
            throw new Error(`INSUFFICIENT_STOCK: ${l.productId}`)
          }

          const lineValue = Math.abs(variance) * (l.unitCost || 0)
          if (variance > 0) gainAmount += lineValue
          else lossAmount += lineValue
        }

        const journalLines: any[] = []
        if (gainAmount > 0) {
          journalLines.push({ accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: gainAmount, credit: 0, description: 'زيادة مخزون' })
          journalLines.push({ accountCode: SYSTEM_ACCOUNTS.OTHER_REVENUE, debit: 0, credit: gainAmount, description: 'إيراد آخر - زيادة مخزون' })
        }
        if (lossAmount > 0) {
          journalLines.push({ accountCode: SYSTEM_ACCOUNTS.OPERATING_EXPENSES, debit: lossAmount, credit: 0, description: 'مصروف - نقص مخزون' })
          journalLines.push({ accountCode: SYSTEM_ACCOUNTS.INVENTORY, debit: 0, credit: lossAmount, description: 'نقص مخزون' })
        }

        if (journalLines.length > 0) {
          const je = await postJournalEntry({
            companyId: company.id,
            branchId: branch?.id,
            journalType: 'general',
            postingDate: adjustmentDate,
            description: `تسوية مخزون ${code}`,
            refType: 'inventory_adjustment',
            refId: adj.id,
            lines: journalLines,
            userId: context.userId,
          }, tx)
          await tx.inventoryAdjustment.update({ where: { id: adj.id }, data: { journalEntryId: je.id } })
        }
      }
      return adj
    })

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
    if (typeof e?.message === 'string' && e.message.startsWith('INSUFFICIENT_STOCK')) {
      return conflict('Adjustment would drive stock negative', 'INSUFFICIENT_STOCK')
    }
    if (typeof e?.message === 'string' && e.message.startsWith('PERIOD_CLOSED')) {
      return badRequest('The accounting period for this date is closed')
    }
    return serverError(e.message)
  }
}
