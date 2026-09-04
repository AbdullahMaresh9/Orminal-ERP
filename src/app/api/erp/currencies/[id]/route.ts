import { db } from '@/lib/db'
import { ok, badRequest, notFound, serverError } from '@/lib/erp/api-response'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currency = await db.currency.findUnique({
      where: { id },
      include: {
        denominations: {
          orderBy: [{ sortOrder: 'asc' }, { value: 'desc' }],
        },
        exchangeRates: {
          orderBy: { rateDate: 'desc' },
          take: 50,
          include: {
            baseCurrency: { select: { code: true, nameAr: true, symbol: true } },
          },
        },
      },
    })

    if (!currency) {
      return notFound('العملة المطلوبة غير موجودة')
    }

    return ok(currency)
  } catch (e: any) {
    console.error('GET /api/erp/currencies/[id] Error:', e)
    return serverError(e.message)
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.currency.findUnique({
      where: { id },
    })

    if (!existing) {
      return notFound('العملة المراد تعديلها غير موجودة')
    }

    const {
      code,
      nameAr,
      nameEn,
      symbol,
      fractionNameAr,
      fractionNameEn,
      decimals,
      exchangeRate,
      buyRate,
      sellRate,
      minLimit,
      maxLimit,
      sortOrder,
      isBase,
      isInventory,
      status,
      notes,
    } = body

    if (code && code.trim().toUpperCase() !== existing.code) {
      const cleanCode = code.trim().toUpperCase()
      const codeCheck = await db.currency.findUnique({
        where: { code: cleanCode },
      })
      if (codeCheck) {
        return badRequest(`رمز العملة "${cleanCode}" مستخدم بالفعل`)
      }
    }

    const newIsBase = isBase !== undefined ? Boolean(isBase) : existing.isBase

    // If changing to base currency, un-set other base currencies
    if (newIsBase && !existing.isBase) {
      await db.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false },
      })
    }

    const numExchangeRate = newIsBase
      ? 1.0
      : exchangeRate != null
        ? Number(exchangeRate)
        : existing.exchangeRate

    const newStatus = status || existing.status
    const isSuspendedNow = newStatus === 'suspended'
    const isReactivated = existing.status === 'suspended' && newStatus === 'active'

    const updated = await db.currency.update({
      where: { id },
      data: {
        code: code ? code.trim().toUpperCase() : existing.code,
        nameAr: nameAr !== undefined ? nameAr.trim() : existing.nameAr,
        nameEn: nameEn !== undefined ? (nameEn ? nameEn.trim() : null) : existing.nameEn,
        symbol: symbol !== undefined ? symbol.trim() : existing.symbol,
        fractionNameAr: fractionNameAr !== undefined ? (fractionNameAr ? fractionNameAr.trim() : null) : existing.fractionNameAr,
        fractionNameEn: fractionNameEn !== undefined ? (fractionNameEn ? fractionNameEn.trim() : null) : existing.fractionNameEn,
        decimals: decimals !== undefined ? Number(decimals) : existing.decimals,
        exchangeRate: numExchangeRate,
        buyRate: buyRate !== undefined ? (buyRate !== null && buyRate !== '' ? Number(buyRate) : null) : existing.buyRate,
        sellRate: sellRate !== undefined ? (sellRate !== null && sellRate !== '' ? Number(sellRate) : null) : existing.sellRate,
        minLimit: minLimit !== undefined ? (minLimit !== null && minLimit !== '' ? Number(minLimit) : null) : existing.minLimit,
        maxLimit: maxLimit !== undefined ? (maxLimit !== null && maxLimit !== '' ? Number(maxLimit) : null) : existing.maxLimit,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
        isBase: newIsBase,
        isInventory: isInventory !== undefined ? Boolean(isInventory) : existing.isInventory,
        status: newStatus,
        active: newStatus === 'active',
        suspensionCount: isSuspendedNow && existing.status !== 'suspended'
          ? existing.suspensionCount + 1
          : existing.suspensionCount,
        suspendedAt: isSuspendedNow ? new Date() : isReactivated ? null : existing.suspendedAt,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      },
    })

    // If rate updated and not base currency, create history record
    if (!newIsBase && exchangeRate != null && Number(exchangeRate) !== existing.exchangeRate) {
      const baseCurr = await db.currency.findFirst({
        where: { isBase: true },
      })
      if (baseCurr) {
        await db.exchangeRate.create({
          data: {
            currencyId: updated.id,
            baseCurrencyId: baseCurr.id,
            rate: numExchangeRate,
            buyRate: updated.buyRate,
            sellRate: updated.sellRate,
            minLimit: updated.minLimit,
            maxLimit: updated.maxLimit,
            rateType: 'spot',
            status: 'active',
            notes: 'تحديث سعر الصرف من بطاقة العملة',
          },
        })
      }
    }

    return ok(updated)
  } catch (e: any) {
    console.error('PUT /api/erp/currencies/[id] Error:', e)
    return serverError(e.message)
  }
}

function getIsRTL(req: Request): boolean {
  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') || url.searchParams.get('locale')
  if (lang) return lang === 'ar'
  const acceptLang = req.headers.get('accept-language') || req.headers.get('x-locale') || ''
  return !acceptLang.toLowerCase().startsWith('en')
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isRTL = getIsRTL(req)
  try {
    const { id } = await params
    const currency = await db.currency.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            companies: true,
            accounts: true,
            bankAccounts: true,
            safes: true,
            exchangeRates: true,
            denominations: true,
          },
        },
      },
    })

    if (!currency) {
      return notFound(isRTL ? 'العملة المراد حذفها غير موجودة' : 'Currency to be deleted not found')
    }

    if (currency.isBase) {
      return badRequest(
        isRTL ? 'لا يمكن حذف العملة الأساسية للنظام. قم بتحديد عملة أخرى كعملة أساسية أولاً قبل حذف هذه العملة.' : 'Could not delete base currency. Please set another currency as base currency before deleting this currency.'
      )
    }

    const { companies, accounts, bankAccounts, safes, exchangeRates, denominations } = currency._count
    if (companies > 0 || accounts > 0 || bankAccounts > 0 || safes > 0 || exchangeRates > 0 || denominations > 0) {
      return badRequest(
        isRTL ? 'تعذر حذف العملة لوجود معاملات مالية أو سجلات مرتبطة بها. يمكنك توقيف العملة بدلاً من الحذف.' : 'Could not delete currency due to financial references. You can suspend the currency instead of deleting it.'
      )
    }

    try {
      await db.currency.delete({
        where: { id },
      })
      return ok({ message: isRTL ? 'تم حذف العملة بنجاح' : 'Currency deleted successfully' })
    } catch (dbErr: any) {
      console.warn('Prisma currency deletion constraint:', dbErr?.message)
      return badRequest(
        isRTL ? 'تعذر حذف العملة لوجود معاملات مالية مرتبطة بها، يمكنك توقيف العملة بدلاً من الحذف.' : 'Could not delete currency due to financial references. You can suspend the currency instead of deleting it.'
      )
    }
  } catch (e: any) {
    console.error('DELETE /api/erp/currencies/[id] Error:', e)
    return badRequest(
      isRTL ? 'تعذر حذف العمله لوجود ارتباطات مالية بالعملة. يمكنك توقيف العملة بدلاً من حذفها.' : 'Could not delete currency due to financial references. You can suspend the currency instead of deleting it.'
    )

  }
}
