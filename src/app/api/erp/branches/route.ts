import { db } from '@/lib/db'
import { ok, created, list, badRequest, conflict, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

// GET /api/erp/branches — list branches (multi-tenant scoping)
export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (companyId) where.companyId = companyId

    const [data, total] = await Promise.all([
      db.branch.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          company: { select: { id: true, nameAr: true } },
          _count: { select: { users: true, warehouses: true } },
        },
        orderBy: { code: 'asc' },
      }),
      db.branch.count({ where }),
    ])

    // Map nameAr to name for backward compatibility across all frontend components
    const mappedData = data.map((b: any) => ({
      ...b,
      name: b.nameAr,
    }))

    return list(mappedData, total, page, pageSize)
  } catch (e: any) {
    return serverError(e.message)
  }
}

// POST /api/erp/branches — create a new branch
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const nameAr = (body.nameAr || body.name || '').trim()
    if (!nameAr) {
      return badRequest('اسم الفرع مطلوب')
    }

    const nameEn = (body.nameEn || nameAr).trim()
    const address = body.address || null
    const phone = body.phone || null
    const email = body.email || null
    const isMain = Boolean(body.isMain)
    const active = body.active !== undefined ? Boolean(body.active) : true

    // Resolve or find companyId
    let companyId = body.companyId
    if (!companyId) {
      const defaultCompany = await db.company.findFirst()
      if (defaultCompany) {
        companyId = defaultCompany.id
      } else {
        // Create default fallback company if none exists
        const newCompany = await db.company.create({
          data: {
            code: 'COMP-001',
            nameAr: 'الشركة الرئيسية',
            nameEn: 'Main Company',
            currencyId: (await db.currency.findFirst())?.id || 'USD',
          },
        })
        companyId = newCompany.id
      }
    }

    // Generate or validate unique branch code
    let code = (body.code || '').trim()
    if (!code) {
      const count = await db.branch.count({ where: { companyId } })
      code = `BR-${String(count + 1).padStart(3, '0')}`
    }

    // Check code collision
    const existingCode = await db.branch.findFirst({ where: { code } })
    if (existingCode) {
      // Append random or timestamp suffix if user provided code or auto count collided
      const totalCount = await db.branch.count()
      code = `BR-${String(totalCount + 1).padStart(3, '0')}-${Math.floor(100 + Math.random() * 900)}`
    }

    // If marked as main, reset other main flags under the same company
    if (isMain) {
      await db.branch.updateMany({
        where: { companyId },
        data: { isMain: false },
      })
    }

    const branch = await db.branch.create({
      data: {
        code,
        nameAr,
        nameEn,
        companyId,
        address,
        phone,
        email,
        isMain,
        active,
      },
      include: {
        company: { select: { id: true, nameAr: true } },
        _count: { select: { users: true, warehouses: true } },
      },
    })

    return created({
      ...branch,
      name: branch.nameAr,
    })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return conflict('رمز الفرع مستخدم بالفعل، يرجى اختيار رمز آخر')
    }
    return serverError(e.message || 'حدث خطأ غير متوقع أثناء إضافة الفرع')
  }
}
