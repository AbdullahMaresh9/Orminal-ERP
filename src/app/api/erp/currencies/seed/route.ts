import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/erp/api-response'

export async function POST() {
  try {
    const existingCount = await db.currency.count()
    if (existingCount > 0) {
      return ok({ message: 'العملات موجودة بالفعل بالنظام', count: existingCount })
    }

    // Create Base Currency (SAR)
    const sar = await db.currency.create({
      data: {
        code: 'SAR',
        nameAr: 'الريال السعودي',
        nameEn: 'Saudi Riyal',
        symbol: 'ر.س',
        fractionNameAr: 'هللة',
        fractionNameEn: 'Halala',
        decimals: 2,
        exchangeRate: 1.0,
        buyRate: 1.0,
        sellRate: 1.0,
        sortOrder: 1,
        isBase: true,
        isInventory: true,
        status: 'active',
        active: true,
        notes: 'العملة الأساسية الرسمية للنظام',
        denominations: {
          create: [
            { code: 'SAR-500', nameAr: '500 ريال', nameEn: '500 SAR', value: 500, sortOrder: 1 },
            { code: 'SAR-200', nameAr: '200 ريال', nameEn: '200 SAR', value: 200, sortOrder: 2 },
            { code: 'SAR-100', nameAr: '100 ريال', nameEn: '100 SAR', value: 100, sortOrder: 3 },
            { code: 'SAR-50', nameAr: '50 ريال', nameEn: '50 SAR', value: 50, sortOrder: 4 },
            { code: 'SAR-20', nameAr: '20 ريال', nameEn: '20 SAR', value: 20, sortOrder: 5 },
            { code: 'SAR-10', nameAr: '10 ريال', nameEn: '10 SAR', value: 10, sortOrder: 6 },
            { code: 'SAR-5', nameAr: '5 ريال', nameEn: '5 SAR', value: 5, sortOrder: 7 },
            { code: 'SAR-1', nameAr: '1 ريال', nameEn: '1 SAR', value: 1, sortOrder: 8 },
          ],
        },
      },
    })

    // Create YER (Yemeni Rial)
    const yer = await db.currency.create({
      data: {
        code: 'YER',
        nameAr: 'الريال اليمني',
        nameEn: 'Yemeni Rial',
        symbol: 'ر.ي',
        fractionNameAr: 'فلس',
        fractionNameEn: 'Fils',
        decimals: 2,
        exchangeRate: 142.5,
        buyRate: 142.0,
        sellRate: 143.0,
        sortOrder: 2,
        isBase: false,
        isInventory: false,
        status: 'active',
        active: true,
        notes: 'عملة التعاملات المحلية لفرع اليمن',
        denominations: {
          create: [
            { code: 'YER-1000', nameAr: '1000 ريال', nameEn: '1000 YER', value: 1000, sortOrder: 1 },
            { code: 'YER-500', nameAr: '500 ريال', nameEn: '500 YER', value: 500, sortOrder: 2 },
            { code: 'YER-250', nameAr: '250 ريال', nameEn: '250 YER', value: 250, sortOrder: 3 },
            { code: 'YER-100', nameAr: '100 ريال', nameEn: '100 YER', value: 100, sortOrder: 4 },
          ],
        },
      },
    })

    // Create USD (US Dollar)
    const usd = await db.currency.create({
      data: {
        code: 'USD',
        nameAr: 'الدولار الأمريكي',
        nameEn: 'US Dollar',
        symbol: '$',
        fractionNameAr: 'سنت',
        fractionNameEn: 'Cent',
        decimals: 2,
        exchangeRate: 0.2667, // 1 SAR = 0.2667 USD (or 1 USD = 3.75 SAR)
        buyRate: 0.2660,
        sellRate: 0.2675,
        sortOrder: 3,
        isBase: false,
        isInventory: false,
        status: 'active',
        active: true,
        notes: 'العملة الدولية المعتمدة للتجارة الخارجية',
        denominations: {
          create: [
            { code: 'USD-100', nameAr: '100 دولار', nameEn: '100 USD', value: 100, sortOrder: 1 },
            { code: 'USD-50', nameAr: '50 دولار', nameEn: '50 USD', value: 50, sortOrder: 2 },
            { code: 'USD-20', nameAr: '20 دولار', nameEn: '20 USD', value: 20, sortOrder: 3 },
            { code: 'USD-10', nameAr: '10 دولار', nameEn: '10 USD', value: 10, sortOrder: 4 },
            { code: 'USD-5', nameAr: '5 دولار', nameEn: '5 USD', value: 5, sortOrder: 5 },
            { code: 'USD-1', nameAr: '1 دولار', nameEn: '1 USD', value: 1, sortOrder: 6 },
          ],
        },
      },
    })

    // Exchange rates history
    await db.exchangeRate.createMany({
      data: [
        {
          currencyId: yer.id,
          baseCurrencyId: sar.id,
          rate: 142.5,
          buyRate: 142.0,
          sellRate: 143.0,
          rateType: 'spot',
          status: 'active',
          notes: 'سعر الصرف الافتراضي الأولي',
        },
        {
          currencyId: usd.id,
          baseCurrencyId: sar.id,
          rate: 0.2667,
          buyRate: 0.2660,
          sellRate: 0.2675,
          rateType: 'spot',
          status: 'active',
          notes: 'سعر الصرف الثابت مقابل الريال السعودي',
        },
      ],
    })

    return ok({ message: 'تم تهيئة العملات وفئاتها وأسعار الصرف بنجاح', created: [sar, yer, usd] })
  } catch (e: any) {
    console.error('POST /api/erp/currencies/seed Error:', e)
    return serverError(e.message)
  }
}
