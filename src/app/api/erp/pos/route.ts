import { db } from '@/lib/db'
import { created, badRequest, serverError, unauthorized, conflict } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'
import { postJournalEntry, salesCashPosting, cogsPosting } from '@/lib/erp/accounting-engine'
import { getRequestContext } from '@/lib/erp/context'

// Round money to 2 decimals to avoid float drift in journal balance checks
const money = (n: number) => Math.round(n * 100) / 100

interface PosItem {
  productId: string
  quantity: number
  unitPrice: number
  taxRate?: number
}

// POST /api/erp/pos — atomic cash sale: invoice + receipt + revenue/VAT/cash journal + COGS + stock-out
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()

    const body = await req.json()
    const items: PosItem[] = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return badRequest('items are required')
    if (items.some((i) => !i.productId || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0 || !Number.isFinite(Number(i.unitPrice)) || Number(i.unitPrice) < 0)) {
      return badRequest('Each item must have a product, positive quantity, and non-negative unit price')
    }
    if (!body.partnerId && !body.clientId) return badRequest('a customer (partnerId) is required')
    const partnerId = body.partnerId ?? body.clientId
    const method = ['cash', 'card', 'transfer', 'check'].includes(body.paymentMethod) ? body.paymentMethod : 'cash'

    const branchId = body.branchId ?? context.branchId
    const [company, partner] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: partnerId, companyId: context.companyId } }),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('customer not found')
    const branch = branchId ? await db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : null

    // Resolve the POS warehouse: explicit → branch default → first company warehouse
    const warehouse = body.warehouseId
      ? await db.warehouse.findFirst({ where: { id: body.warehouseId, branch: { companyId: context.companyId } } })
      : await db.warehouse.findFirst({
          where: { active: true, branch: { companyId: context.companyId, ...(branch ? { id: branch.id } : {}) } },
          orderBy: { createdAt: 'asc' },
        })
    if (!warehouse) return badRequest('no warehouse available for this company/branch')

    // Load products (scoped) and compute totals server-side from stored data
    const productIds = [...new Set(items.map((i) => i.productId))]
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((p) => [p.id, p]))
    for (const it of items) {
      if (!productMap.has(it.productId)) return badRequest(`product not found: ${it.productId}`)
    }

    // Server-authoritative totals (never trust client subtotal/tax)
    let subtotal = 0
    let taxTotal = 0
    let cogsAmount = 0
    const invoiceLines = items.map((it) => {
      const qty = Number(it.quantity)
      const price = Number(it.unitPrice)
      const rate = Number.isFinite(Number(it.taxRate)) ? Number(it.taxRate) : 0
      const lineNet = money(qty * price)
      const lineTax = money(lineNet * (rate / 100))
      subtotal = money(subtotal + lineNet)
      taxTotal = money(taxTotal + lineTax)
      const cost = productMap.get(it.productId)?.costPrice ?? 0
      cogsAmount = money(cogsAmount + cost * qty)
      return {
        productId: it.productId,
        quantity: qty,
        unitPrice: price,
        taxRate: rate,
        total: money(lineNet + lineTax),
      }
    })
    const total = money(subtotal + taxTotal)

    // Pre-check stock availability (fast fail before opening the transaction)
    const wanted = new Map<string, number>()
    for (const it of items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + Number(it.quantity))
    for (const [productId, qty] of wanted) {
      const quant = await db.stockQuant.findFirst({
        where: { productId, warehouseId: warehouse.id, locationId: null, lotId: null },
      })
      const onHand = quant?.quantity ?? 0
      if (onHand < qty) {
        return conflict(`Insufficient stock for product ${productId}: on hand ${onHand}, requested ${qty}`, 'INSUFFICIENT_STOCK')
      }
    }

    const invoiceDate = new Date()
    const [invoiceCode, paymentCode] = await Promise.all([
      nextNumber('sales_invoice', company.id, branch?.id),
      nextNumber('sales_payment', company.id, branch?.id),
    ])

    const result = await db.$transaction(async (tx) => {
      // 1) Posted cash invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code: invoiceCode,
          partnerId,
          invoiceDate,
          status: 'paid',
          subtotal,
          taxTotal,
          discount: 0,
          total,
          paid: total,
          notes: body.notes ?? 'POS Sale',
          createdBy: context.userId,
          lines: { create: invoiceLines },
        },
      })

      // 2) Revenue + VAT + Cash journal
      const revenueJe = await postJournalEntry({
        companyId: company.id,
        branchId: branch?.id,
        journalType: 'cash',
        postingDate: invoiceDate,
        description: `مبيعات نقطة بيع ${invoiceCode}`,
        refType: 'pos_sale',
        refId: invoice.id,
        lines: salesCashPosting({ total, subtotal, taxTotal }),
        userId: context.userId,
      }, tx)
      await tx.salesInvoice.update({ where: { id: invoice.id }, data: { journalEntryId: revenueJe.id } })

      // 3) Receipt voucher (records the cash collection against the invoice/partner)
      const payment = await tx.salesPayment.create({
        data: {
          companyId: company.id,
          branchId: branch?.id,
          code: paymentCode,
          partnerId,
          invoiceId: invoice.id,
          amount: total,
          paymentDate: invoiceDate,
          method,
          status: 'posted',
          notes: `POS ${invoiceCode}`,
          createdBy: context.userId,
        },
      })

      // 4) COGS + stock-out (append-only moves + decrement quants with negative guard)
      for (const [productId, qty] of wanted) {
        const product = productMap.get(productId)!
        const lineCost = money((product.costPrice ?? 0) * qty)
        await tx.stockMove.create({
          data: {
            companyId: company.id,
            documentType: 'pos_sale',
            documentId: invoice.id,
            productId,
            sourceWarehouseId: warehouse.id,
            quantity: qty,
            state: 'done',
            valuationAmount: lineCost,
            costPrice: product.costPrice ?? 0,
            postingDate: invoiceDate,
          },
        })
        const quant = await tx.stockQuant.findFirst({
          where: { productId, warehouseId: warehouse.id, locationId: null, lotId: null },
        })
        if (!quant || quant.quantity < qty) throw new Error(`INSUFFICIENT_STOCK: ${productId}`)
        await tx.stockQuant.update({ where: { id: quant.id }, data: { quantity: { decrement: qty } } })
      }

      // 5) COGS journal (Dr COGS / Cr Inventory)
      if (cogsAmount > 0) {
        await postJournalEntry({
          companyId: company.id,
          branchId: branch?.id,
          journalType: 'general',
          postingDate: invoiceDate,
          description: `تكلفة بضاعة مباعة - نقطة بيع ${invoiceCode}`,
          refType: 'pos_cogs',
          refId: invoice.id,
          lines: cogsPosting({ amount: cogsAmount }),
          userId: context.userId,
        }, tx)
      }

      // 6) Partner balance nets to zero (invoice +total, receipt -total) — no change needed for cash sale

      return { invoice, payment }
    })

    return created({
      id: result.invoice.id,
      code: result.invoice.code,
      paymentCode: result.payment.code,
      subtotal,
      taxTotal,
      total,
    })
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.startsWith('INSUFFICIENT_STOCK')) {
      return conflict('Insufficient stock to complete the sale', 'INSUFFICIENT_STOCK')
    }
    if (typeof e?.message === 'string' && e.message.startsWith('PERIOD_CLOSED')) {
      return badRequest('The accounting period for this date is closed')
    }
    return serverError(e.message)
  }
}
