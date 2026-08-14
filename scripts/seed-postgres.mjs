import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const db = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}$${salt}$${derivedKey.toString('hex')}`;
}

async function main() {
  try {
    console.log('🌱 Seeding PostgreSQL Enterprise ERP...\n');

    // === Currencies ===
    console.log('💱 Creating currencies...');
    const sar = await db.currency.upsert({
      where: { code: 'SAR' },
      update: {},
      create: { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', decimals: 2 }
    });


    await db.currency.upsert({
      where: { code: 'YER' },
      update: {},
      create: { code: 'YER', nameAr: 'ريال يمني', nameEn: 'Yemeni Riyal', symbol: 'ر.ي', decimals: 2 }
    });

    await db.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', decimals: 2 }
    });

    await db.currency.upsert({
      where: { code: 'EUR' },
      update: {},
      create: { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', decimals: 2 }
    });

    // === Countries ===
    console.log('🌍 Creating countries...');
    await db.country.upsert({
      where: { code: 'SA' },
      update: {},
      create: { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', dialCode: '+966' }
    });

    await db.country.upsert({
      where: { code: 'YE' },
      update: {},
      create: { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', dialCode: '+967' }
    });

    await db.country.upsert({
      where: { code: 'AE' },
      update: {},
      create: { code: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', dialCode: '+971' }
    });

    // === Units of Measure ===
    console.log('📦 Creating units of measure...');
    const uoms = [
      { code: 'PCE', nameAr: 'قطعة', nameEn: 'Piece', category: 'unit' },
      { code: 'KG', nameAr: 'كيلوجرام', nameEn: 'Kilogram', category: 'weight' },
      { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box', category: 'unit' },
    ];

    for (const u of uoms) {
      await db.unitOfMeasure.upsert({
        where: { code: u.code },
        update: {},
        create: u
      });
    }

    // === Tax Codes ===
    console.log('💰 Creating tax codes...');
    await db.taxCode.upsert({
      where: { code: 'VAT15' },
      update: {},
      create: {
        code: 'VAT15',
        nameAr: 'ضريبة القيمة المضافة 15%',
        nameEn: 'VAT 15%',
        rate: 15,
        taxType: 'vat',
        inputAccount: '1400',
        outputAccount: '2100'
      }
    });

    // === Roles ===
    console.log('👥 Creating roles...');
    const adminRole = await db.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        code: 'ADMIN',
        nameAr: 'مدير النظام',
        nameEn: 'System Administrator',
        description: 'Full system access',
        isSystem: true,
      }
    });

    const salesRole = await db.role.upsert({
      where: { code: 'SALES_REP' },
      update: {},
      create: {
        code: 'SALES_REP',
        nameAr: 'مندوب مبيعات',
        nameEn: 'Sales Representative',
        isSystem: true,
      }
    });

    // === Company ===
    console.log('🏢 Creating company...');
    const company = await db.company.upsert({
      where: { code: 'ORG001' },
      update: {},
      create: {
        code: 'ORG001',
        nameAr: 'أورمنال للتجارة',
        nameEn: 'Orminal Trading',
        currencyId: sar.id,
        locale: 'ar',
        timezone: 'Asia/Riyadh',
        active: true,
      }
    });

    // === Branch ===
    console.log('🏬 Creating branch...');
    const branch = await db.branch.upsert({
      where: { code: 'BR001' },
      update: {},
      create: {
        code: 'BR001',
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        companyId: company.id,
        isMain: true,
        active: true,
      }
    });

    // === Users ===
    console.log('👤 Creating users...');
    const adminPassword = await hashPassword('admin123');
    const adminUser = await db.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@orminal.com',
        nameAr: 'المسؤول',
        nameEn: 'Administrator',
        passwordHash: adminPassword,
        defaultCompanyId: company.id,
        defaultBranchId: branch.id,
        locale: 'ar',
        timezone: 'Asia/Riyadh',
        active: true,
      }
    });

    const omarPassword = await hashPassword('Omar775R#');
    const omarUser = await db.user.upsert({
      where: { username: 'omararif' },
      update: {},
      create: {
        username: 'omararif',
        email: 'omararif@example.com',
        nameAr: 'عمر عريف',
        nameEn: 'Omar Arif',
        passwordHash: omarPassword,
        defaultCompanyId: company.id,
        defaultBranchId: branch.id,
        locale: 'ar',
        timezone: 'Asia/Riyadh',
        active: true,
      }
    });

    // === User Roles ===
    console.log('🔐 Assigning roles...');
    await db.userRole.upsert({
      where: { id: 'admin-admin-role' },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      }
    }).catch(() => {
      // Create a new one with different ID if conflict
      return db.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        }
      });
    });

    await db.userRole.create({
      data: {
        userId: omarUser.id,
        roleId: adminRole.id,
      }
    }).catch(() => null);

    console.log('\n✅ Seeding completed successfully!\n');
    console.log('📊 Created:');
    console.log('   ✓ 3 Currencies (SAR, USD, EUR)');
    console.log('   ✓ 2 Countries (SA, AE)');
    console.log('   ✓ 3 Units of Measure');
    console.log('   ✓ 1 Tax Code (VAT 15%)');
    console.log('   ✓ 2 Roles (Admin, Sales Rep)');
    console.log('   ✓ 1 Company');
    console.log('   ✓ 1 Branch');
    console.log('   ✓ 2 Users (admin, omararif)');
    console.log('\n🔑 Test Credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   User:  omararif / Omar775R#\n');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
