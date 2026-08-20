// Enterprise ERP — Comprehensive Seed Script
// Source: Volume 4 SDTA + Volume 2 Blueprint + Volume 3 FTS + Arabic Accounting Spec
import { db } from '../src/lib/db'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const N = 16384, r = 8, p = 1
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await (scryptAsync as any)(password, Buffer.from(salt, 'hex'), 64, { N, r, p })) as Buffer
  return `scrypt:${N}:${r}:${p}$${salt}$${derivedKey.toString('hex')}`
}

async function main() {
  console.log('Seeding Enterprise ERP...')

  // === Currencies ===
  const sar = await db.currency.upsert({ where: { code: 'SAR' }, update: {}, create: { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', decimals: 2 } })
  await db.currency.upsert({ where: { code: 'YER' }, update: {}, create: { code: 'YER', nameAr: 'ريال يمني', nameEn: 'Yemeni Riyal', symbol: 'ر.ي', decimals: 2 } })
  await db.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', decimals: 2 } })
  await db.currency.upsert({ where: { code: 'EUR' }, update: {}, create: { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', decimals: 2 } })
  await db.currency.upsert({ where: { code: 'AED' }, update: {}, create: { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', decimals: 2 } })
  await db.currency.upsert({ where: { code: 'EGP' }, update: {}, create: { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', decimals: 2 } })

  // === Exchange Rates ===
  await db.exchangeRate.create({ data: { currencyId: sar.id, baseCurrencyId: sar.id, rate: 1, rateDate: new Date(), rateType: 'spot' } }).catch(() => { })

  // === Countries ===
  await db.country.upsert({ where: { code: 'SA' }, update: {}, create: { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', dialCode: '+966' } })
  await db.country.upsert({ where: { code: 'YE' }, update: {}, create: { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', dialCode: '+967' } })
  await db.country.upsert({ where: { code: 'AE' }, update: {}, create: { code: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', dialCode: '+971' } })
  await db.country.upsert({ where: { code: 'EG' }, update: {}, create: { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', dialCode: '+20' } })

  // === Units of Measure ===
  for (const u of [
    { code: 'PCE', nameAr: 'قطعة', nameEn: 'Piece', category: 'unit' },
    { code: 'KG', nameAr: 'كيلوجرام', nameEn: 'Kilogram', category: 'weight' },
    { code: 'GM', nameAr: 'جرام', nameEn: 'Gram', category: 'weight' },
    { code: 'LTR', nameAr: 'لتر', nameEn: 'Liter', category: 'volume' },
    { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box', category: 'unit' },
    { code: 'PACK', nameAr: 'عبوة', nameEn: 'Pack', category: 'unit' },
    { code: 'M', nameAr: 'متر', nameEn: 'Meter', category: 'length' },
    { code: 'HR', nameAr: 'ساعة', nameEn: 'Hour', category: 'time' },
  ]) {
    await db.unitOfMeasure.upsert({ where: { code: u.code }, update: {}, create: u as any })
  }

  // === Tax Codes ===
  const vat15 = await db.taxCode.upsert({ where: { code: 'VAT15' }, update: {}, create: { code: 'VAT15', nameAr: 'ضريبة القيمة المضافة 15%', nameEn: 'VAT 15%', rate: 15, taxType: 'vat', inputAccount: '1400', outputAccount: '2100' } as any })
  await db.taxCode.upsert({ where: { code: 'VAT0' }, update: {}, create: { code: 'VAT0', nameAr: 'صفرية', nameEn: 'Zero Rated', rate: 0, taxType: 'vat' } as any })
  await db.taxCode.upsert({ where: { code: 'EXEMPT' }, update: {}, create: { code: 'EXEMPT', nameAr: 'معفاة', nameEn: 'Exempt', rate: 0, taxType: 'vat' } as any })

  // === Payment Terms ===
  await db.paymentTerm.upsert({ where: { code: 'NET30' }, update: {}, create: { code: 'NET30', nameAr: 'آجل 30 يوم', nameEn: 'Net 30', dueDays: 30 } })
  await db.paymentTerm.upsert({ where: { code: 'NET60' }, update: {}, create: { code: 'NET60', nameAr: 'آجل 60 يوم', nameEn: 'Net 60', dueDays: 60 } })
  await db.paymentTerm.upsert({ where: { code: 'COD' }, update: {}, create: { code: 'COD', nameAr: 'دفع عند الاستلام', nameEn: 'Cash on Delivery', dueDays: 0 } })
  await db.paymentTerm.upsert({ where: { code: 'PREPAID' }, update: {}, create: { code: 'PREPAID', nameAr: 'مدفوع مسبقاً', nameEn: 'Prepaid', dueDays: 0 } })

  // ===  Reason Codes ===
  for (const r of [
    { code: 'DAMAGED', nameAr: 'تالف', nameEn: 'Damaged', category: 'scrap' },
    { code: 'EXPIRED', nameAr: 'منتهي الصلاحية', nameEn: 'Expired', category: 'scrap' },
    { code: 'CANCEL_ORDER', nameAr: 'إلغاء الطلب', nameEn: 'Order Cancelled', category: 'cancel' },
    { code: 'PRICE_CHANGE', nameAr: 'تغيير السعر', nameEn: 'Price Change', category: 'reverse' },
    { code: 'COUNTING_ERROR', nameAr: 'خطأ في الجرد', nameEn: 'Counting Error', category: 'adjustment' },
  ]) {
    await db.reasonCode.upsert({ where: { code: r.code }, update: {}, create: r })
  }

  // === Company ===
  const company = await db.company.create({
    data: {
      code: 'HQ',
      nameAr: 'مؤسسة أورمنال التجارية',
      nameEn: 'Ormenal Trading Co.',
      legalName: 'Ormenal Trading Establishment',
      taxNumber: '300000000000003',
      vatNumber: '300000000000003',
      crNumber: '1010000000',
      address: 'الرياض، المملكة العربية السعودية',
      phone: '0112345678',
      email: 'info@ormenal.io',
      currencyId: sar.id,
      timezone: 'Asia/Riyadh',
      locale: 'ar',
      active: true,
    },
  })

  // === Branch ===
  const branch = await db.branch.create({
    data: {
      code: 'MAIN',
      nameAr: 'الفرع الرئيسي',
      nameEn: 'Main Branch',
      companyId: company.id,
      address: 'الرياض',
      phone: '0112345678',
      isMain: true,
      active: true,
    },
  })

  // === Chart of Accounts (5 types + subtypes, 30+ system accounts) ===
  const accounts = [
    // Assets (1xxx)
    { code: '1000', nameAr: 'النقدية', nameEn: 'Cash', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1010', nameAr: 'النقدية - الصندوق', nameEn: 'Cash - Safe', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1020', nameAr: 'النقدية - البنك', nameEn: 'Cash - Bank', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1100', nameAr: 'الذمم المدينة', nameEn: 'Accounts Receivable', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1200', nameAr: 'المخزون', nameEn: 'Inventory', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1210', nameAr: 'المواد الخام', nameEn: 'Raw Materials', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1220', nameAr: 'البضائع الجاهزة', nameEn: 'Finished Goods', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1230', nameAr: 'تحت التشغيل', nameEn: 'Work in Process', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1300', nameAr: 'الراتب المقدم', nameEn: 'Prepaid Expenses', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1400', nameAr: 'ضريبة القيمة المضافة القابلة للخصم', nameEn: 'Input VAT', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1500', nameAr: 'الأصول الثابتة', nameEn: 'Fixed Assets', type: 'asset', subtype: 'fixed_asset', isSystem: true },
    { code: '1510', nameAr: 'الأثاث والمعدات', nameEn: 'Furniture & Equipment', type: 'asset', subtype: 'fixed_asset', isSystem: true },
    { code: '1520', nameAr: 'المركبات', nameEn: 'Vehicles', type: 'asset', subtype: 'fixed_asset', isSystem: true },
    { code: '1590', nameAr: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation', type: 'asset', subtype: 'fixed_asset', isSystem: true },
    // Liabilities (2xxx)
    { code: '2000', nameAr: 'الذمم الدائنة', nameEn: 'Accounts Payable', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2100', nameAr: 'ضريبة القيمة المضافة المستحقة', nameEn: 'Output VAT', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2200', nameAr: 'الرواتب المستحقة', nameEn: 'Salaries Payable', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2300', nameAr: 'بضاعة مستلمة غير مفوتر', nameEn: 'GRNI', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2400', nameAr: 'ضريبة الدخل المستحقة', nameEn: 'Income Tax Payable', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2500', nameAr: 'قروض طويلة الأجل', nameEn: 'Long-term Loans', type: 'liability', subtype: 'long_term_liability', isSystem: true },
    // Equity (3xxx)
    { code: '3000', nameAr: 'رأس المال', nameEn: 'Owner Capital', type: 'equity', subtype: 'capital', isSystem: true },
    { code: '3100', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', isSystem: true },
    // Revenue (4xxx)
    { code: '4000', nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'income', subtype: 'operating_revenue', isSystem: true },
    { code: '4100', nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', type: 'income', subtype: 'other_revenue', isSystem: true },
    { code: '4200', nameAr: 'مرتجع المبيعات', nameEn: 'Sales Returns', type: 'income', subtype: 'operating_revenue', isSystem: true },
    // Expenses (5xxx)
    { code: '5000', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'COGS', type: 'expense', subtype: 'cogs', isSystem: true },
    { code: '5100', nameAr: 'المشتريات', nameEn: 'Purchases', type: 'expense', subtype: 'cogs', isSystem: true },
    { code: '5200', nameAr: 'تكلفة الإنتاج', nameEn: 'Production Cost', type: 'expense', subtype: 'cogs', isSystem: true },
    { code: '6000', nameAr: 'الرواتب والأجور', nameEn: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense', isSystem: true },
    { code: '6100', nameAr: 'الإيجار', nameEn: 'Rent', type: 'expense', subtype: 'operating_expense', isSystem: true },
    { code: '6200', nameAr: 'الكهرباء والمياه', nameEn: 'Utilities', type: 'expense', subtype: 'operating_expense', isSystem: true },
    { code: '6300', nameAr: 'مصاريف تشغيلية', nameEn: 'Operating Expenses', type: 'expense', subtype: 'operating_expense', isSystem: true },
    { code: '6400', nameAr: 'الإهلاك', nameEn: 'Depreciation Expense', type: 'expense', subtype: 'operating_expense', isSystem: true },
    { code: '6500', nameAr: 'مصاريف إدارية', nameEn: 'Administrative Expenses', type: 'expense', subtype: 'operating_expense', isSystem: true },
  ]
  // Derive the enterprise class fields from the legacy type/subtype so a fresh
  // install is consistent with the re-engineered Chart of Accounts. Run
  // `npm run coa:migrate` afterwards to build the group hierarchy and the
  // account-determination mappings.
  const classOf = (type: string, subtype?: string): string => {
    const st = (subtype ?? '').toLowerCase()
    if (type === 'income') return st.includes('other') ? 'other_income' : 'revenue'
    if (type === 'expense') {
      if (st === 'cogs' || st === 'purchases') return 'cogs'
      if (st === 'other_expense' || st === 'fx_loss') return 'other_expense'
      return 'operating_expense'
    }
    return type
  }
  const CREDIT_CLASSES = new Set(['liability', 'equity', 'revenue', 'other_income'])
  // Contra accounts carry the opposite normal balance of their class.
  const CONTRA_CODES: Record<string, 'debit' | 'credit'> = { '1590': 'credit', '4200': 'debit' }

  for (const a of accounts) {
    const accountClass = classOf(a.type, (a as { subtype?: string }).subtype)
    const normalBalance = CONTRA_CODES[a.code] ?? (CREDIT_CLASSES.has(accountClass) ? 'credit' : 'debit')
    await db.account.create({
      data: {
        ...a,
        accountClass,
        normalBalance,
        fsSection: ['asset', 'liability', 'equity'].includes(accountClass) ? 'balance_sheet' : 'income_statement',
      } as any,
    })
  }
  const cashAccount = await db.account.findUnique({ where: { code: '1000' } })!
  const arAccount = await db.account.findUnique({ where: { code: '1100' } })!
  const apAccount = await db.account.findUnique({ where: { code: '2000' } })!
  const salesAccount = await db.account.findUnique({ where: { code: '4000' } })!
  const vatOutput = await db.account.findUnique({ where: { code: '2100' } })!
  const vatInput = await db.account.findUnique({ where: { code: '1400' } })!
  const purchasesAccount = await db.account.findUnique({ where: { code: '5100' } })!
  const inventoryAccount = await db.account.findUnique({ where: { code: '1200' } })!
  const cogsAccount = await db.account.findUnique({ where: { code: '5000' } })!
  const capitalAccount = await db.account.findUnique({ where: { code: '3000' } })!

  // === Journals ===
  for (const j of [
    { code: 'SJ', nameAr: 'يومية المبيعات', nameEn: 'Sales Journal', type: 'sale' },
    { code: 'PJ', nameAr: 'يومية المشتريات', nameEn: 'Purchase Journal', type: 'purchase' },
    { code: 'CJ', nameAr: 'يومية النقدية', nameEn: 'Cash Journal', type: 'cash' },
    { code: 'BJ', nameAr: 'يومية البنك', nameEn: 'Bank Journal', type: 'bank' },
    { code: 'GJ', nameAr: 'يومية عامة', nameEn: 'General Journal', type: 'general' },
    { code: 'OJ', nameAr: 'يومية افتتاحية', nameEn: 'Opening Journal', type: 'opening' },
    { code: 'CLJ', nameAr: 'يومية الإقفال', nameEn: 'Closing Journal', type: 'closing' },
  ]) {
    await db.journal.create({ data: j as any })
  }

  // === Cost Centers ===
  await db.costCenter.create({ data: { code: 'CC-001', nameAr: 'الإدارة', nameEn: 'Administration' } })
  await db.costCenter.create({ data: { code: 'CC-002', nameAr: 'المبيعات', nameEn: 'Sales' } })
  await db.costCenter.create({ data: { code: 'CC-003', nameAr: 'المشتريات', nameEn: 'Procurement' } })
  await db.costCenter.create({ data: { code: 'CC-004', nameAr: 'المخزون', nameEn: 'Warehouse' } })
  await db.costCenter.create({ data: { code: 'CC-005', nameAr: 'الإنتاج', nameEn: 'Production' } })

  // === Fiscal Year & Periods ===
  const fiscalYear = await db.fiscalYear.create({
    data: {
      companyId: company.id,
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      state: 'open',
    },
  })
  for (let m = 0; m < 12; m++) {
    const start = new Date(2026, m, 1)
    const end = new Date(2026, m + 1, 0)
    await db.fiscalPeriod.create({
      data: {
        fiscalYearId: fiscalYear.id,
        name: `2026-${String(m + 1).padStart(2, '0')}`,
        startDate: start,
        endDate: end,
        quarter: Math.floor(m / 3) + 1,
        state: m < 6 ? 'open' : 'open',
      },
    })
  }

  // === Roles & Permissions ===
  const roles = [
    { code: 'ADMIN', nameAr: 'مدير النظام', nameEn: 'System Administrator', isSystem: true },
    { code: 'CEO', nameAr: 'الرئيس التنفيذي', nameEn: 'CEO', isSystem: true },
    { code: 'FIN_MGR', nameAr: 'مدير مالي', nameEn: 'Finance Manager', isSystem: true },
    { code: 'ACCOUNTANT', nameAr: 'محاسب', nameEn: 'Accountant', isSystem: true },
    { code: 'CHIEF_ACC', nameAr: 'محاسب أول', nameEn: 'Chief Accountant', isSystem: true },
    { code: 'CASHIER', nameAr: 'أمين صندوق', nameEn: 'Cashier', isSystem: true },
    { code: 'SALES_MGR', nameAr: 'مدير مبيعات', nameEn: 'Sales Manager', isSystem: true },
    { code: 'SALES_REP', nameAr: 'مندوب مبيعات', nameEn: 'Sales Representative', isSystem: true },
    { code: 'PUR_MGR', nameAr: 'مدير مشتريات', nameEn: 'Purchase Manager', isSystem: true },
    { code: 'BUYER', nameAr: 'مشتري', nameEn: 'Buyer', isSystem: true },
    { code: 'WH_MGR', nameAr: 'مدير مخزون', nameEn: 'Warehouse Manager', isSystem: true },
    { code: 'WH_KEEPER', nameAr: 'أمين مخزن', nameEn: 'Warehouse Keeper', isSystem: true },
    { code: 'PROD_MGR', nameAr: 'مدير إنتاج', nameEn: 'Production Manager', isSystem: true },
    { code: 'HR_MGR', nameAr: 'مدير موارد بشرية', nameEn: 'HR Manager', isSystem: true },
    { code: 'AUDITOR', nameAr: 'مدقق', nameEn: 'Auditor', isSystem: true },
    { code: 'VIEWER', nameAr: 'مشاهد', nameEn: 'Viewer', isSystem: true },
  ]
  for (const r of roles) {
    await db.role.create({ data: r })
  }

  // === Admin User ===
  const admin = await db.user.create({
    data: {
      username: 'admin',
      email: 'admin@ormenal.io',
      nameAr: 'مدير النظام',
      nameEn: 'System Administrator',
      passwordHash: await hashPassword('admin123'),
      defaultCompanyId: company.id,
      defaultBranchId: branch.id,
      locale: 'ar',
      timezone: 'Asia/Riyadh',
      active: true,
    },
  })
  const adminRole = (await db.role.findUnique({ where: { code: 'ADMIN' } }))!
  await db.userRole.create({ data: { userId: admin.id, roleId: adminRole.id, companyId: company.id, branchId: branch.id, active: true } })

  // === Categories ===
  const catFood = await db.category.create({ data: { code: 'FOOD', nameAr: 'أغذية', nameEn: 'Food', type: 'product' } })
  const catBev = await db.category.create({ data: { code: 'BEV', nameAr: 'مشروبات', nameEn: 'Beverages', type: 'product' } })
  const catStat = await db.category.create({ data: { code: 'STAT', nameAr: 'قرطاسية', nameEn: 'Stationery', type: 'product' } })

  // === Warehouse & Locations ===
  const warehouse = await db.warehouse.create({
    data: { code: 'WH-01', nameAr: 'المستودع الرئيسي', nameEn: 'Main Warehouse', branchId: branch.id, active: true },
  })
  const locStock = await db.stockLocation.create({ data: { code: 'STOCK', nameAr: 'مخزون', nameEn: 'Stock', warehouseId: warehouse.id, type: 'internal' } })
  const locTransit = await db.stockLocation.create({ data: { code: 'TRANSIT', nameAr: 'عبور', nameEn: 'Transit', warehouseId: warehouse.id, type: 'transit' } })
  const locLoss = await db.stockLocation.create({ data: { code: 'LOSS', nameAr: 'خسائر', nameEn: 'Loss', warehouseId: warehouse.id, type: 'loss' } })

  // === Products ===
  const pceUom = (await db.unitOfMeasure.findUnique({ where: { code: 'PCE' } }))!
  const kgUom = (await db.unitOfMeasure.findUnique({ where: { code: 'KG' } }))!
  const ltrUom = (await db.unitOfMeasure.findUnique({ where: { code: 'LTR' } }))!
  const packUom = (await db.unitOfMeasure.findUnique({ where: { code: 'PACK' } }))!

  const products = [
    { sku: 'P-001', barcode: '628100001', nameAr: 'زيت أرغان 100مل', nameEn: 'Argan Oil 100ml', categoryId: catFood.id, uomId: pceUom.id, costPrice: 45, salePrice: 80, taxCodeId: vat15.id, type: 'finished', tracking: 'none', minStock: 10, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-002', barcode: '628100002', nameAr: 'عسل 500جم', nameEn: 'Honey 500g', categoryId: catFood.id, uomId: kgUom.id, costPrice: 60, salePrice: 110, taxCodeId: vat15.id, type: 'finished', tracking: 'none', minStock: 8, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-003', barcode: '628100003', nameAr: 'قهوة 1كجم', nameEn: 'Coffee 1kg', categoryId: catBev.id, uomId: kgUom.id, costPrice: 70, salePrice: 130, taxCodeId: vat15.id, type: 'finished', tracking: 'lot', minStock: 5, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-004', barcode: '628100004', nameAr: 'شاي 250جم', nameEn: 'Tea 250g', categoryId: catBev.id, uomId: packUom.id, costPrice: 25, salePrice: 50, taxCodeId: vat15.id, type: 'finished', tracking: 'none', minStock: 15, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-005', barcode: '628100005', nameAr: 'دفتر A4', nameEn: 'Notebook A4', categoryId: catStat.id, uomId: pceUom.id, costPrice: 8, salePrice: 18, taxCodeId: vat15.id, type: 'product', tracking: 'none', minStock: 20, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-006', barcode: '628100006', nameAr: 'قلم أزرق', nameEn: 'Pen Blue', categoryId: catStat.id, uomId: pceUom.id, costPrice: 1, salePrice: 3, taxCodeId: vat15.id, type: 'product', tracking: 'none', minStock: 50, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-007', barcode: '628100007', nameAr: 'تمور 1كجم', nameEn: 'Dates 1kg', categoryId: catFood.id, uomId: kgUom.id, costPrice: 35, salePrice: 65, taxCodeId: vat15.id, type: 'finished', tracking: 'lot', minStock: 12, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-008', barcode: '628100008', nameAr: 'زيت زيتون 1ل', nameEn: 'Olive Oil 1L', categoryId: catFood.id, uomId: ltrUom.id, costPrice: 50, salePrice: 95, taxCodeId: vat15.id, type: 'finished', tracking: 'none', minStock: 10, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-009', barcode: '628100009', nameAr: 'لوز خام', nameEn: 'Raw Almonds', categoryId: catFood.id, uomId: kgUom.id, costPrice: 40, salePrice: 0, taxCodeId: vat15.id, type: 'raw_material', tracking: 'lot', minStock: 20, costingMethod: 'fifo', valuationAccountId: inventoryAccount!.id, cogsAccountId: cogsAccount!.id, revenueAccountId: salesAccount!.id },
    { sku: 'P-010', barcode: '628100010', nameAr: 'خدمة توصيل', nameEn: 'Delivery Service', categoryId: catStat.id, uomId: pceUom.id, costPrice: 0, salePrice: 25, taxCodeId: vat15.id, type: 'service', tracking: 'none', minStock: 0, costingMethod: 'standard', valuationAccountId: null, cogsAccountId: null, revenueAccountId: salesAccount!.id },
  ]
  for (const p of products) {
    const prod = await db.product.create({ data: { ...p, companyId: company.id } as any })
    // Initial stock
    await db.stockQuant.create({
      data: { productId: prod.id, warehouseId: warehouse.id, locationId: locStock.id, quantity: Math.floor(Math.random() * 50) + p.minStock },
    })
  }

  // === Partners (Customers + Suppliers) ===
  const net30 = (await db.paymentTerm.findUnique({ where: { code: 'NET30' } }))!
  const partners = [
    // Customers
    { code: 'C-001', nameAr: 'شركة النخبة التجارية', nameEn: 'Elite Trading Co.', isCustomer: true, contactName: 'أحمد محمد', phone: '0551234567', email: 'info@elite.sa', creditLimit: 50000, currentBalance: 12500, receivableAccountId: arAccount!.id, paymentTermId: net30.id },
    { code: 'C-002', nameAr: 'مؤسسة الرياض للمقاولات', nameEn: 'Riyadh Contracting', isCustomer: true, contactName: 'سعد القحطاني', phone: '0552345678', email: 'info@riyadh.sa', creditLimit: 30000, currentBalance: 8300, receivableAccountId: arAccount!.id, paymentTermId: net30.id },
    { code: 'C-003', nameAr: 'متجر الجودة', nameEn: 'Quality Store', isCustomer: true, contactName: 'فهد العتيبي', phone: '0553456789', email: 'info@quality.sa', creditLimit: 10000, currentBalance: 0, receivableAccountId: arAccount!.id, paymentTermId: net30.id },
    { code: 'C-004', nameAr: 'شركة المستقبل', nameEn: 'Future Co.', isCustomer: true, contactName: 'خالد الدوسري', phone: '0554567890', email: 'info@future.sa', creditLimit: 80000, currentBalance: 21000, receivableAccountId: arAccount!.id, paymentTermId: net30.id },
    { code: 'C-005', nameAr: 'مكتب الأمل', nameEn: 'Alaml Office', isCustomer: true, contactName: 'عبدالله الشمري', phone: '0555678901', email: 'info@amal.sa', creditLimit: 20000, currentBalance: 4500, receivableAccountId: arAccount!.id, paymentTermId: net30.id },
    // Suppliers
    { code: 'S-001', nameAr: 'مصنع جدة للأغذية', nameEn: 'Jeddah Food Factory', isSupplier: true, supplierApproved: true, contactName: 'ماجد السلمي', phone: '0561234567', email: 'sales@jfood.sa', currentBalance: 18000, payableAccountId: apAccount!.id, paymentTermId: net30.id },
    { code: 'S-002', nameAr: 'شركة الشرق للقرطاسية', nameEn: 'Sharq Stationery', isSupplier: true, supplierApproved: true, contactName: 'تركي الحربي', phone: '0562345678', email: 'info@sharq.sa', currentBalance: 5200, payableAccountId: apAccount!.id, paymentTermId: net30.id },
    { code: 'S-003', nameAr: 'مؤسسة الإمداد', nameEn: 'Supply Establishment', isSupplier: true, supplierApproved: true, contactName: 'ناصر القحطاني', phone: '0563456789', email: 'info@supply.sa', currentBalance: 0, payableAccountId: apAccount!.id, paymentTermId: net30.id },
  ]
  for (const p of partners) {
    await db.partner.create({ data: { ...p, companyId: company.id } as any })
  }

  // === Bank Account & Safe ===
  await db.bankAccount.create({
    data: { companyId: company.id, nameAr: 'الحساب الرئيسي', nameEn: 'Main Account', bankName: 'البنك الأهلي', iban: 'SA0380000000608010167519', accountNo: '608010167519', currencyId: sar.id, accountId: cashAccount!.id, balance: 100000, active: true },
  })
  await db.safe.create({
    data: { companyId: company.id, branchId: branch.id, code: 'SAFE-01', nameAr: 'الخزنة الرئيسية', nameEn: 'Main Safe', currencyId: sar.id, accountId: cashAccount!.id, balance: 25000, active: true },
  })

  // === Settings ===
  const settings = [
    { key: 'company.name', value: 'مؤسسة أورمنال التجارية' },
    { key: 'company.currency', value: 'SAR' },
    { key: 'company.timezone', value: 'Asia/Riyadh' },
    { key: 'company.address', value: 'الرياض، المملكة العربية السعودية' },
    { key: 'company.phone', value: '0112345678' },
    { key: 'company.email', value: 'info@ormenal.io' },
    { key: 'company.taxNumber', value: '300000000000003' },
    { key: 'company.vatNumber', value: '300000000000003' },
    { key: 'accounting.defaultTaxRate', value: '15' },
    { key: 'accounting.vatRate', value: '15' },
    { key: 'inventory.defaultUnit', value: 'PCE' },
    { key: 'inventory.lowStockAlert', value: 'true' },
    { key: 'inventory.costingMethod', value: 'fifo' },
    { key: 'appearance.theme', value: 'light' },
    { key: 'appearance.language', value: 'ar' },
    { key: 'zatca.enabled', value: 'false' },
    { key: 'zatca.environment', value: 'sandbox' },
    { key: 'doc.headerTitle', value: 'أورمنال — نظام إدارة موارد المؤسسات ERP' },
    { key: 'doc.footerNote', value: 'شكراً لتعاملكم معنا' },
  ]
  for (const s of settings) {
    await db.setting.upsert({
      where: { key_companyId_branchId: { key: s.key, companyId: '*', branchId: '*' } },
      update: {},
      create: s,
    })
  }

  // === Opening Journal Entry ===
  const generalJournal = (await db.journal.findUnique({ where: { code: 'OJ' } }))!
  const openingPeriod = await db.fiscalPeriod.findFirst({ where: { fiscalYearId: fiscalYear.id }, orderBy: { startDate: 'asc' } })
  await db.journalEntry.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      code: 'JE-2026-000001',
      journalId: generalJournal.id,
      postingDate: new Date('2026-01-01'),
      description: 'قيد افتتاحي - رأس المال',
      refType: 'opening',
      state: 'posted',
      totalDebit: 100000,
      totalCredit: 100000,
      fiscalPeriodId: openingPeriod?.id,
      createdBy: admin.id,
      postedBy: admin.id,
      lines: {
        create: [
          { accountId: cashAccount!.id, debit: 100000, credit: 0, description: 'النقدية' },
          { accountId: capitalAccount!.id, debit: 0, credit: 100000, description: 'رأس المال' },
        ],
      },
    },
  })

  // === Notifications ===
  const notifs = [
    { title: 'مخزون منخفض', message: 'منتج "زيت أرغان 100مل" وصل للحد الأدنى', type: 'warning', category: 'inventory', link: 'products' },
    { title: 'فاتورة جديدة', message: 'تم إنشاء فاتورة ضريبية جديدة', type: 'success', category: 'sales', link: 'sales-invoices' },
    { title: 'سند قبض', message: 'تم تسجيل سند قبض بقيمة 8,300 ريال', type: 'info', category: 'finance', link: 'sales-payments' },
    { title: 'فترة مالية', message: 'تم فتح السنة المالية 2026', type: 'info', category: 'finance', link: 'fiscal-periods' },
  ]
  for (const n of notifs) {
    await db.notification.create({ data: { userId: admin.id, ...n } })
  }

  console.log('✅ Seed completed!')
  console.log(`   Company: ${company.code} (${company.nameAr})`)
  console.log(`   Branch: ${branch.code} (${branch.nameAr})`)
  console.log(`   Accounts: ${accounts.length} (${accounts.filter(a => a.isSystem).length} system)`)
  console.log(`   Products: ${products.length}`)
  console.log(`   Partners: ${partners.length} (${partners.filter(p => p.isCustomer).length} customers, ${partners.filter(p => p.isSupplier).length} suppliers)`)
  console.log(`   Roles: ${roles.length}`)
  console.log(`   User: admin@ormenal.io (password: admin123 — set hash in production)`)
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
