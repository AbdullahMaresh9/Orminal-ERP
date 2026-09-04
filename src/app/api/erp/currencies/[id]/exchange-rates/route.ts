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
      select: { id: true, code: true, nameAr: true, symbol: true, exchangeRate: true, buyRate: true, sellRate: true },
    })

    if (!currency) {
      return notFound('العملة غير موجودة')
    }

    const rates = await db.exchangeRate.findMany({
      where: { currencyId: id },
      orderBy: { effectiveDate: 'desc' },
      include: {
        baseCurrency: { select: { code: true, nameAr: true, symbol: true } },
      },
    })

    return ok({ currency, rates })
  } catch (e: any) {
    console.error('GET /api/erp/currencies/[id]/exchange-rates Error:', e)
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

    const {
      rate,
      buyRate,
      sellRate,
      minLimit,
      maxLimit,
      effectiveDate,
      rateType = 'spot',
      notes,
    } = body

    if (rate == null || isNaN(Number(rate)) || Number(rate) <= 0) {
      return badRequest('سعر الصرف يجب أن يكون رقماً أكبر من صفر')
    }

    const baseCurrency = await db.currency.findFirst({
      where: { isBase: true },
    })

    if (!baseCurrency) {
      return badRequest('لم يتم تحديد عملة أساسية للنظام بعد. يرجى تحديد عملة أساسية أولاً.')
    }

    const numRate = Number(rate)
    const numBuyRate = buyRate != null && buyRate !== '' ? Number(buyRate) : null
    const numSellRate = sellRate != null && sellRate !== '' ? Number(sellRate) : null
    const numMinLimit = minLimit != null && minLimit !== '' ? Number(minLimit) : null
    const numMaxLimit = maxLimit != null && maxLimit !== '' ? Number(maxLimit) : null
    const dateEffective = effectiveDate ? new Date(effectiveDate) : new Date()

    // 1. Create exchange rate log entry
    const newRateEntry = await db.exchangeRate.create({
      data: {
        currencyId: id,
        baseCurrencyId: baseCurrency.id,
        rate: numRate,
        buyRate: numBuyRate,
        sellRate: numSellRate,
        minLimit: numMinLimit,
        maxLimit: numMaxLimit,
        rateDate: dateEffective,
        effectiveDate: dateEffective,
        rateType,
        status: 'active',
        notes: notes?.trim() || 'تحديث سعر الصرف الساري',
      },
    })

    // 2. Also update the direct exchange rate cache on Currency record
    await db.currency.update({
      where: { id },
      data: {
        exchangeRate: numRate,
        buyRate: numBuyRate,
        sellRate: numSellRate,
        minLimit: numMinLimit,
        maxLimit: numMaxLimit,
      },
    })

    return created(newRateEntry)
  } catch (e: any) {
    console.error('POST /api/erp/currencies/[id]/exchange-rates Error:', e)
    return serverError(e.message)
  }
}
