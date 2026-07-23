import { db } from '@/lib/db'
import { ok, created, list, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/partners — list with search
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const isCustomer = url.searchParams.get('isCustomer')
    const isSupplier = url.searchParams.get('isSupplier')
    const active = url.searchParams.get('active')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { nameAr: { contains: q } },
        { nameEn: { contains: q } },
        { phone: { contains: q } },
        { taxNumber: { contains: q } },
      ]
    }
    if (isCustomer === 'true') where.isCustomer = true
    if (isSupplier === 'true') where.isSupplier = true
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    const [data, total] = await Promise.all([
      db.partner.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          country: { select: { id: true, nameAr: true, code: true } },
          paymentTerm: { select: { id: true, nameAr: true, dueDays: true } },
          receivableAccount: { select: { id: true, code: true, nameAr: true } },
          payableAccount: { select: { id: true, code: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.partner.count({ where }),
    ])
    return list(data, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/partners — create unified BP
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.nameAr) return badRequest('nameAr is required')

    const company = await db.company.findFirst()
    if (!company) return badRequest('no company in db')

    let code = body.code
    if (!code) {
      const count = await db.partner.count()
      code = `P-${String(count + 1).padStart(5, '0')}`
    }

    const partner = await db.partner.create({
      data: {
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        companyId: company.id,
        isCustomer: body.isCustomer ?? false,
        isSupplier: body.isSupplier ?? false,
        isEmployee: body.isEmployee ?? false,
        taxNumber: body.taxNumber,
        vatNumber: body.vatNumber,
        crNumber: body.crNumber,
        contactName: body.contactName,
        phone: body.phone,
        email: body.email,
        website: body.website,
        address: body.address,
        city: body.city,
        countryId: body.countryId,
        paymentTermId: body.paymentTermId,
        creditLimit: body.creditLimit ?? 0,
        openingBalance: body.openingBalance ?? 0,
        currentBalance: body.openingBalance ?? 0,
        supplierApproved: body.supplierApproved ?? false,
        receivableAccountId: body.receivableAccountId,
        payableAccountId: body.payableAccountId,
        active: body.active ?? true,
      },
      include: {
        country: { select: { id: true, nameAr: true, code: true } },
        paymentTerm: { select: { id: true, nameAr: true } },
      },
    })
    return created(partner)
  } catch (e: any) {
    return serverError(e.message)
  }
}
