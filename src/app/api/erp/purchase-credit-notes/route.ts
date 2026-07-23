import { db } from '@/lib/db'
import { ok, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'
import { nextNumber } from '@/lib/erp/number-sequence'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const status = new URL(req.url).searchParams.get('status')
    const partnerId = new URL(req.url).searchParams.get('partnerId')

    const where: any = {}
    if (status) where.status = status
    if (partnerId) where.partnerId = partnerId
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { reason: { contains: q } },
        { notes: { contains: q } },
      ]
    }

    const [data, total] = await Promise.all([
      db.purchaseCreditNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          partner: { select: { id: true, nameAr: true, nameEn: true, code: true, phone: true } },
        },
      }),
      db.purchaseCreditNote.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.partnerId) return badRequest('المورد مطلوب')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company')

    const partner = await db.partner.findUnique({ where: { id: body.partnerId } })
    if (!partner || !partner.isSupplier) return badRequest('المورد غير موجود')

    const subtotal = Number(body.subtotal) || 0
    const taxTotal = Number(body.taxTotal) || 0
    const total = subtotal + taxTotal

    const code = await nextNumber('purchase_credit_note', company.id)

    const created = await db.purchaseCreditNote.create({
      data: {
        companyId: company.id,
        code,
        partnerId: body.partnerId,
        invoiceId: body.invoiceId || null,
        date: body.date ? new Date(body.date) : new Date(),
        reason: body.reason || null,
        status: 'posted',
        subtotal,
        taxTotal,
        total,
        notes: body.notes || null,
      },
      include: { partner: true },
    })

    // Update partner balance (reduce AP)
    await db.partner.update({
      where: { id: body.partnerId },
      data: { currentBalance: { decrement: total } },
    })

    return ok(created)
  } catch (e: any) {
    return serverError(e.message)
  }
}
