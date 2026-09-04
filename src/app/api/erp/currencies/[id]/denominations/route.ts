import { db } from '@/lib/db'
import { ok, created, badRequest, notFound, serverError } from '@/lib/erp/api-response'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currency = await db.currency.findUnique({
      where: { id },
      select: { id: true, code: true, nameAr: true, symbol: true },
    })

    if (!currency) {
      return notFound('العملة غير موجودة')
    }

    const denominations = await db.currencyDenomination.findMany({
      where: { currencyId: id },
      orderBy: [{ sortOrder: 'asc' }, { value: 'desc' }],
    })

    return ok({ currency, denominations })
  } catch (e: any) {
    console.error('GET /api/erp/currencies/[id]/denominations Error:', e)
    return serverError(e.message)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const currency = await db.currency.findUnique({
      where: { id },
    })

    if (!currency) {
      return notFound('العملة غير موجودة')
    }

    const { code, nameAr, nameEn, value, sortOrder = 0, isSuspended = false } = body

    if (!code || typeof code !== 'string' || !code.trim()) {
      return badRequest('رقم أو كود فئة العملة مطلوب')
    }
    if (!nameAr || typeof nameAr !== 'string' || !nameAr.trim()) {
      return badRequest('اسم الفئة بالعربية مطلوب (مثل 100 ريال / 50 دولار)')
    }
    if (value == null || isNaN(Number(value)) || Number(value) <= 0) {
      return badRequest('قيمة الفئة يجب أن تكون رقماً أكبر من صفر')
    }

    const denomination = await db.currencyDenomination.create({
      data: {
        currencyId: id,
        code: code.trim().toUpperCase(),
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        value: Number(value),
        sortOrder: Number(sortOrder) || 0,
        isSuspended: Boolean(isSuspended),
      },
    })

    return created(denomination)
  } catch (e: any) {
    console.error('POST /api/erp/currencies/[id]/denominations Error:', e)
    return serverError(e.message)
  }
}
