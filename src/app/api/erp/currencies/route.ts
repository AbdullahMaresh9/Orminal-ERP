import { db } from '@/lib/db'
import { ok, created, badRequest, serverError, parsePagination, parseSearch } from '@/lib/erp/api-response'

export async function GET(req: Request) {
  try {
    const { page, pageSize, skip } = parsePagination(req)
    const q = parseSearch(req)
    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')
    const isBaseFilter = url.searchParams.get('isBase')

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { symbol: { contains: q, mode: 'insensitive' } },
        { fractionNameAr: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter
    }

    if (isBaseFilter === 'true') {
      where.isBase = true
    }

    const [data, total, stats, baseCurrency] = await Promise.all([
      db.currency.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isBase: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        include: {
          _count: {
            select: { denominations: true, exchangeRates: true },
          },
        },
      }),
      db.currency.count({ where }),
      db.currency.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      db.currency.findFirst({
        where: { isBase: true },
        select: { id: true, code: true, nameAr: true, symbol: true },
      }),
    ])

    const totalCount = stats.reduce((acc, curr) => acc + curr._count.id, 0)
    const activeCount = stats.find((s) => s.status === 'active')?._count.id || 0
    const suspendedCount = stats.find((s) => s.status === 'suspended')?._count.id || 0

    return ok({
      items: data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      stats: {
        total: totalCount,
        active: activeCount,
        suspended: suspendedCount,
        baseCurrency: baseCurrency || null,
      },
    })
  } catch (e: any) {
    console.error('GET /api/erp/currencies Error:', e)
    return serverError(e.message)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    let {
      code,
      nameAr,
      nameEn,
      symbol,
      fractionNameAr,
      fractionNameEn,
      decimals = 2,
      exchangeRate = 1.0,
      buyRate,
      sellRate,
      minLimit,
      maxLimit,
      sortOrder = 0,
      isBase = false,
      isInventory = false,
      status = 'active',
      notes,
    } = body

    if (!code || typeof code !== 'string' || !code.trim()) {
      return badRequest('كود العملة مطلوب (مثل SAR, USD, YER)')
    }
    if (!nameAr || typeof nameAr !== 'string' || !nameAr.trim()) {
      return badRequest('اسم العملة بالعربية مطلوب')
    }
    if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
      return badRequest('رمز العملة مطلوب (مثل ر.س, $, ر.ي)')
    }

    const cleanCode = code.trim().toUpperCase()

    // Check duplicate code
    const existing = await db.currency.findUnique({
      where: { code: cleanCode },
    })
    if (existing) {
      return badRequest(`رمز أو كود العملة "${cleanCode}" مسجل بالفعل بالنظام`)
    }

    // If marked as Base Currency, ensure no other currency is base
    if (isBase) {
      exchangeRate = 1.0
      await db.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false },
      })
    }

    const numDecimals = Number(decimals) >= 0 ? Number(decimals) : 2
    const numExchangeRate = isBase ? 1.0 : Number(exchangeRate) || 1.0

    const newCurrency = await db.currency.create({
      data: {
        code: cleanCode,
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        symbol: symbol.trim(),
        fractionNameAr: fractionNameAr?.trim() || null,
        fractionNameEn: fractionNameEn?.trim() || null,
        decimals: numDecimals,
        exchangeRate: numExchangeRate,
        buyRate: buyRate != null && buyRate !== '' ? Number(buyRate) : null,
        sellRate: sellRate != null && sellRate !== '' ? Number(sellRate) : null,
        minLimit: minLimit != null && minLimit !== '' ? Number(minLimit) : null,
        maxLimit: maxLimit != null && maxLimit !== '' ? Number(maxLimit) : null,
        sortOrder: Number(sortOrder) || 0,
        isBase: Boolean(isBase),
        isInventory: Boolean(isInventory),
        status: status || 'active',
        active: status === 'active',
        notes: notes?.trim() || null,
      },
    })

    // If there is a base currency and this is not base, record initial exchange rate in history
    if (!isBase) {
      const baseCurr = await db.currency.findFirst({
        where: { isBase: true },
      })
      if (baseCurr) {
        await db.exchangeRate.create({
          data: {
            currencyId: newCurrency.id,
            baseCurrencyId: baseCurr.id,
            rate: numExchangeRate,
            buyRate: buyRate != null && buyRate !== '' ? Number(buyRate) : null,
            sellRate: sellRate != null && sellRate !== '' ? Number(sellRate) : null,
            minLimit: minLimit != null && minLimit !== '' ? Number(minLimit) : null,
            maxLimit: maxLimit != null && maxLimit !== '' ? Number(maxLimit) : null,
            rateType: 'spot',
            status: 'active',
            notes: 'سعر التأسيس الأول للعملة',
          },
        })
      }
    }

    return created(newCurrency)
  } catch (e: any) {
    console.error('POST /api/erp/currencies Error:', e)
    return serverError(e.message)
  }
}
