import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { created, list, badRequest, serverError, unauthorized, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

async function getRequestContext() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; defaultCompanyId?: string | null; defaultBranchId?: string | null } | undefined
  if (!user?.id || !user.defaultCompanyId) return null
  return { userId: user.id, companyId: user.defaultCompanyId, branchId: user.defaultBranchId ?? undefined }
}

// GET /api/erp/sales-orders
export async function GET(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const partnerId = url.searchParams.get('partnerId')

    const where: any = { companyId: context.companyId }
    if (q) where.OR = [{ code: { contains: q } }, { notes: { contains: q } }]
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId

    const [data, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true } },
          lines: { include: { product: { select: { id: true, sku: true, nameAr: true, nameEn: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.salesOrder.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/sales-orders — create. On confirmed: reserve stock (create StockReservation).
// NO accounting posting yet (posting happens on invoice).
export async function POST(req: Request) {
  try {
    const context = await getRequestContext()
    if (!context) return unauthorized()
    const body = await req.json()
    if (!body.partnerId) return badRequest('partnerId is required')
    if (!Array.isArray(body.lines) || body.lines.length === 0) return badRequest('lines are required')
    if (body.lines.some((line: any) => !line.productId || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0)) {
      return badRequest('Each line must have a product, positive quantity, and non-negative unit price')
    }

    const branchId = body.branchId ?? context.branchId
    const [company, partner, branch] = await Promise.all([
      db.company.findUnique({ where: { id: context.companyId } }),
      db.partner.findFirst({ where: { id: body.partnerId, companyId: context.companyId } }),
      branchId ? db.branch.findFirst({ where: { id: branchId, companyId: context.companyId } }) : Promise.resolve(null),
    ])
    if (!company) return badRequest('company not found')
    if (!partner) return badRequest('partner not found')
    if (branchId && !branch) return badRequest('branch not found')

    const code = await nextNumber('sales_order', company.id, branch?.id)

    // Compute totals from lines
    let subtotal = 0
    let taxTotal = 0
    const processedLines = body.lines.map((l: any) => {
      const lineSubtotal = (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discountPercent || 0) / 100) - (l.discountAmount || 0)
      const lineTax = lineSubtotal * ((l.taxRate || 0) / 100)
      const total = lineSubtotal + lineTax
      subtotal += lineSubtotal
      taxTotal += lineTax
      return {
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        uomId: l.uomId,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent ?? 0,
        discountAmount: l.discountAmount ?? 0,
        taxCodeId: l.taxCodeId,
        taxRate: l.taxRate ?? 0,
        total,
      }
    })
    const total = subtotal + taxTotal - (body.discount ?? 0)

    const status = body.status ?? 'draft'
    if (!['draft', 'confirmed'].includes(status)) return badRequest('Only draft and confirmed orders can be created')

    const order = await db.salesOrder.create({
      data: {
        companyId: company.id,
        branchId: branch?.id,
        code,
        partnerId: body.partnerId,
        quotationId: body.quotationId,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        requiredDate: body.requiredDate ? new Date(body.requiredDate) : undefined,
        priceListId: body.priceListId,
        currencyId: body.currencyId,
        paymentTermId: body.paymentTermId,
        warehouseId: body.warehouseId,
        salespersonId: body.salespersonId,
        status,
        subtotal,
        taxTotal,
        discount: body.discount ?? 0,
        total,
        notes: body.notes,
        createdBy: context.userId,
        lines: { create: processedLines },
      },
      include: {
        partner: true,
        lines: { include: { product: true } },
      },
    })

    // On confirmed: reserve stock (create StockReservation). No accounting posting yet.
    if (status === 'confirmed' && body.warehouseId) {
      await Promise.all(
        body.lines.map((l: any) =>
          db.stockReservation.create({
            data: {
              productId: l.productId,
              warehouseId: body.warehouseId,
              documentType: 'sales_order',
              documentId: order.id,
              quantity: l.quantity,
              state: 'active',
            },
          })
        )
      )
    }
    return created(order)
  } catch (e: any) {
    return serverError(e.message)
  }
}
