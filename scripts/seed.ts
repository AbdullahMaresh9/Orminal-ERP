// Seed the database with system accounts, default branch, sample data
import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding Alostaz ERP database...')

  // === Settings ===
  const settings = [
    { key: 'company.name', value: 'مؤسسة الأستاذ التجارية' },
    { key: 'company.currency', value: 'SAR' },
    { key: 'company.timezone', value: 'Asia/Riyadh' },
    { key: 'company.address', value: 'الرياض، المملكة العربية السعودية' },
    { key: 'company.phone', value: '0112345678' },
    { key: 'company.email', value: 'info@alostaz.io' },
    { key: 'company.taxNumber', value: '300000000000003' },
    { key: 'company.logo', value: '' },
    { key: 'doc.headerTitle', value: 'الأستاذ — نظام المحاسبة' },
    { key: 'doc.headerSubtitle', value: 'Accounting & Financial Management' },
    { key: 'doc.footerNote', value: 'شكراً لتعاملكم معنا' },
    { key: 'appearance.theme', value: 'light' },
    { key: 'appearance.language', value: 'ar' },
    { key: 'accounting.defaultTaxRate', value: '15' },
    { key: 'inventory.defaultUnit', value: 'piece' },
    { key: 'inventory.lowStockAlert', value: 'true' },
  ]
  for (const s of settings) {
    await db.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }

  // === Default Branch ===
  const branch = await db.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'الفرع الرئيسي',
      code: 'MAIN',
      address: 'الرياض',
      phone: '0112345678',
      isMain: true,
      active: true,
    },
  })

  // === Admin User ===
  const existingUser = await db.user.findUnique({ where: { email: 'admin@alostaz.io' } })
  if (!existingUser) {
    await db.user.create({
      data: {
        email: 'admin@alostaz.io',
        name: 'مدير النظام',
        password: 'admin123',
        role: 'admin',
        branchId: branch.id,
        active: true,
      },
    })
  }

  // === System Accounts (18 protected) ===
  const accounts = [
    { code: '1000', name: 'Cash', nameAr: 'النقدية', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1100', name: 'Bank', nameAr: 'البنك', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1200', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1300', name: 'Inventory', nameAr: 'المخزون', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1310', name: 'Raw Materials', nameAr: 'المواد الخام', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1320', name: 'Finished Goods', nameAr: 'البضائع الجاهزة', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1400', name: 'Input VAT', nameAr: 'ضريبة القيمة المضافة القابلة للخصم', type: 'asset', subtype: 'current_asset', isSystem: true },
    { code: '1500', name: 'Fixed Assets', nameAr: 'الأصول الثابتة', type: 'asset', subtype: 'fixed_asset', isSystem: true },
    { code: '2000', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '2100', name: 'Output VAT', nameAr: 'ضريبة القيمة المضافة مستحقة', type: 'liability', subtype: 'current_liability', isSystem: true },
    { code: '3000', name: 'Retained Earnings', nameAr: 'الأرباح المحتجزة', type: 'equity', isSystem: true },
    { code: '3100', name: 'Owner Capital', nameAr: 'رأس المال', type: 'equity', isSystem: true },
    { code: '4000', name: 'Sales Revenue', nameAr: 'إيرادات المبيعات', type: 'income', isSystem: true },
    { code: '4100', name: 'Other Revenue', nameAr: 'إيرادات أخرى', type: 'income', isSystem: true },
    { code: '5000', name: 'COGS', nameAr: 'تكلفة البضاعة المباعة', type: 'expense', isSystem: true },
    { code: '5100', name: 'Purchases', nameAr: 'المشتريات', type: 'expense', isSystem: true },
    { code: '5200', name: 'Production Cost', nameAr: 'تكلفة الإنتاج', type: 'expense', isSystem: true },
    { code: '6000', name: 'Operating Expenses', nameAr: 'المصروفات التشغيلية', type: 'expense', isSystem: true },
  ]
  for (const a of accounts) {
    await db.account.upsert({
      where: { code: a.code },
      update: {},
      create: a as any,
    })
  }

  // === Categories ===
  const catFood = await db.category.create({ data: { name: 'Food', nameAr: 'أغذية' } })
  const catBev = await db.category.create({ data: { name: 'Beverages', nameAr: 'مشروبات' } })
  const catStationery = await db.category.create({ data: { name: 'Stationery', nameAr: 'قرطاسية' } })

  // === Storehouse ===
  const storehouse = await db.storehouse.create({
    data: { name: 'المستودع الرئيسي', code: 'WH-01', branchId: branch.id, active: true },
  })

  // === Products ===
  const products = [
    { sku: 'P-001', barcode: '628100001', name: 'Argan Oil 100ml', nameAr: 'زيت أرغان 100مل', categoryId: catFood.id, unit: 'piece', costPrice: 45, salePrice: 80, taxRate: 15, minStock: 10, type: 'finished' },
    { sku: 'P-002', barcode: '628100002', name: 'Honey 500g', nameAr: 'عسل 500جم', categoryId: catFood.id, unit: 'piece', costPrice: 60, salePrice: 110, taxRate: 15, minStock: 8, type: 'finished' },
    { sku: 'P-003', barcode: '628100003', name: 'Coffee 1kg', nameAr: 'قهوة 1كجم', categoryId: catBev.id, unit: 'kg', costPrice: 70, salePrice: 130, taxRate: 15, minStock: 5, type: 'finished' },
    { sku: 'P-004', barcode: '628100004', name: 'Tea 250g', nameAr: 'شاي 250جم', categoryId: catBev.id, unit: 'pack', costPrice: 25, salePrice: 50, taxRate: 15, minStock: 15, type: 'finished' },
    { sku: 'P-005', barcode: '628100005', name: 'Notebook A4', nameAr: 'دفتر A4', categoryId: catStationery.id, unit: 'piece', costPrice: 8, salePrice: 18, taxRate: 15, minStock: 20, type: 'product' },
    { sku: 'P-006', barcode: '628100006', name: 'Pen Blue', nameAr: 'قلم أزرق', categoryId: catStationery.id, unit: 'piece', costPrice: 1, salePrice: 3, taxRate: 15, minStock: 50, type: 'product' },
    { sku: 'P-007', barcode: '628100007', name: 'Dates 1kg', nameAr: 'تمور 1كجم', categoryId: catFood.id, unit: 'kg', costPrice: 35, salePrice: 65, taxRate: 15, minStock: 12, type: 'finished' },
    { sku: 'P-008', barcode: '628100008', name: 'Olive Oil 1L', nameAr: 'زيت زيتون 1ل', categoryId: catFood.id, unit: 'liter', costPrice: 50, salePrice: 95, taxRate: 15, minStock: 10, type: 'finished' },
  ]
  const createdProducts: any[] = []
  for (const p of products) {
    const prod = await db.product.create({ data: p as any })
    createdProducts.push(prod)
    await db.stockItem.create({
      data: {
        productId: prod.id,
        storehouseId: storehouse.id,
        quantity: Math.floor(Math.random() * 50) + p.minStock,
      },
    })
  }

  // === Clients ===
  const clients = [
    { code: 'C-001', name: 'شركة النخبة التجارية', contactName: 'أحمد محمد', phone: '0551234567', email: 'info@elite.sa', balance: 12500, creditLimit: 50000 },
    { code: 'C-002', name: 'مؤسسة الرياض للمقاولات', contactName: 'سعد القحطاني', phone: '0552345678', email: 'info@riyadh.sa', balance: 8300, creditLimit: 30000 },
    { code: 'C-003', name: 'متجر الجودة', contactName: 'فهد العتيبي', phone: '0553456789', email: 'info@quality.sa', balance: 0, creditLimit: 10000 },
    { code: 'C-004', name: 'شركة المستقبل', contactName: 'خالد الدوسري', phone: '0554567890', email: 'info@future.sa', balance: 21000, creditLimit: 80000 },
    { code: 'C-005', name: 'مكتب الأمل', contactName: 'عبدالله الشمري', phone: '0555678901', email: 'info@amal.sa', balance: 4500, creditLimit: 20000 },
  ]
  for (const c of clients) {
    await db.client.create({ data: c as any })
  }

  // === Suppliers ===
  const suppliers = [
    { code: 'S-001', name: 'مصنع جدة للأغذية', contactName: 'ماجد السلمي', phone: '0561234567', email: 'sales@jfood.sa', balance: 18000 },
    { code: 'S-002', name: 'شركة الشرق للقرطاسية', contactName: 'تركي الحربي', phone: '0562345678', email: 'info@sharq.sa', balance: 5200 },
    { code: 'S-003', name: 'مؤسسة الإمداد', contactName: 'ناصر القحطاني', phone: '0563456789', email: 'info@supply.sa', balance: 0 },
  ]
  for (const s of suppliers) {
    await db.supplier.create({ data: s as any })
  }

  // === Sales Orders ===
  const clientList = await db.client.findMany()
  for (let i = 0; i < 6; i++) {
    const client = clientList[i % clientList.length]
    const itemCount = Math.floor(Math.random() * 3) + 1
    const items: any[] = []
    for (let j = 0; j < itemCount; j++) {
      const p = createdProducts[Math.floor(Math.random() * createdProducts.length)]
      const qty = Math.floor(Math.random() * 5) + 1
      items.push({
        productId: p.id,
        quantity: qty,
        unitPrice: p.salePrice,
        discount: 0,
        taxRate: p.taxRate,
        total: qty * p.salePrice * (1 + p.taxRate / 100),
      })
    }
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const taxTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice * (it.taxRate / 100), 0)
    const total = subtotal + taxTotal
    const status = ['confirmed', 'delivered', 'paid', 'paid'][i % 4]
    await db.salesOrder.create({
      data: {
        code: `SO-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        clientId: client.id,
        status,
        subtotal,
        taxTotal,
        discount: 0,
        total,
        paid: status === 'paid' ? total : 0,
        paymentMethod: 'cash',
        items: { create: items },
      },
    })
  }

  // === Purchase Orders ===
  const supplierList = await db.supplier.findMany()
  for (let i = 0; i < 4; i++) {
    const supplier = supplierList[i % supplierList.length]
    const itemCount = Math.floor(Math.random() * 3) + 1
    const items: any[] = []
    for (let j = 0; j < itemCount; j++) {
      const p = createdProducts[Math.floor(Math.random() * createdProducts.length)]
      const qty = Math.floor(Math.random() * 10) + 5
      items.push({
        productId: p.id,
        quantity: qty,
        unitPrice: p.costPrice,
        discount: 0,
        taxRate: p.taxRate,
        total: qty * p.costPrice * (1 + p.taxRate / 100),
      })
    }
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const taxTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice * (it.taxRate / 100), 0)
    const total = subtotal + taxTotal
    const status = ['ordered', 'received', 'paid'][i % 3]
    await db.purchaseOrder.create({
      data: {
        code: `PO-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        supplierId: supplier.id,
        status,
        subtotal,
        taxTotal,
        discount: 0,
        total,
        paid: status === 'paid' ? total : 0,
        items: { create: items },
      },
    })
  }

  // === Journal Entry (opening) ===
  const cashAcc = await db.account.findUnique({ where: { code: '1000' } })
  const capitalAcc = await db.account.findUnique({ where: { code: '3100' } })
  if (cashAcc && capitalAcc) {
    await db.journalEntry.create({
      data: {
        code: 'JE-0001',
        date: new Date(),
        description: 'قيد افتتاحي - رأس المال',
        refType: 'manual',
        status: 'posted',
        totalDebit: 100000,
        totalCredit: 100000,
        lines: {
          create: [
            { accountId: cashAcc.id, debit: 100000, credit: 0, description: 'النقدية' },
            { accountId: capitalAcc.id, debit: 0, credit: 100000, description: 'رأس المال' },
          ],
        },
      },
    })
  }

  // === Notifications ===
  const admin = await db.user.findUnique({ where: { email: 'admin@alostaz.io' } })
  if (admin) {
    const notifs = [
      { title: 'مخزون منخفض', message: 'منتج "زيت أرغان 100مل" وصل للحد الأدنى', type: 'warning', category: 'inventory', link: 'products' },
      { title: 'فاتورة جديدة', message: 'تم إنشاء فاتورة ضريبية جديدة SO-0006', type: 'success', category: 'sales', link: 'sales-invoices' },
      { title: 'سند قبض', message: 'تم تسجيل سند قبض بقيمة 8,300 ريال', type: 'info', category: 'finance', link: 'sales-payments' },
      { title: 'نسخة احتياطية', message: 'تم إنشاء نسخة احتياطية تلقائية', type: 'info', category: 'system' },
    ]
    for (const n of notifs) {
      await db.notification.create({ data: { userId: admin.id, ...n } })
    }
  }

  console.log('✅ Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
