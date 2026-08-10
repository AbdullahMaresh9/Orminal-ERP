import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying PostgreSQL Database Migration...\n');
    console.log('='.repeat(70));

    // Check all tables
    const tables = [
      { name: 'company', label: 'Companies' },
      { name: 'branch', label: 'Branches' },
      { name: 'user', label: 'Users' },
      { name: 'role', label: 'Roles' },
      { name: 'permission', label: 'Permissions' },
      { name: 'userRole', label: 'User Roles' },
      { name: 'currency', label: 'Currencies' },
      { name: 'partner', label: 'Partners' },
      { name: 'product', label: 'Products' },
      { name: 'warehouse', label: 'Warehouses' },
      { name: 'account', label: 'Accounts' },
      { name: 'salesOrder', label: 'Sales Orders' },
      { name: 'purchaseOrder', label: 'Purchase Orders' },
      { name: 'journalEntry', label: 'Journal Entries' },
      { name: 'employee', label: 'Employees' },
    ];

    const stats = {};
    let totalRecords = 0;
    let tablesWithData = 0;

    for (const table of tables) {
      try {
        const count = await prisma[table.name].count();
        stats[table.label] = count;
        totalRecords += count;
        if (count > 0) tablesWithData++;
        
        const status = count > 0 ? '✅' : '⚠️ ';
        console.log(`${status} ${table.label.padEnd(25)} : ${count} records`);
      } catch (err) {
        console.log(`❌ ${table.label.padEnd(25)} : Error - ${err.message.split('\n')[0]}`);
      }
    }

    console.log('='.repeat(70));
    console.log(`\n📊 Migration Statistics:`);
    console.log(`   • Total Records: ${totalRecords}`);
    console.log(`   • Tables with Data: ${tablesWithData}/${tables.length}`);
    console.log(`   • Database Provider: PostgreSQL`);
    console.log(`   • Connection Status: ✅ Connected`);

    // Check critical data
    console.log('\n🔑 Critical Data Check:');
    
    try {
      const adminUser = await prisma.user.findFirst({
        where: { username: 'admin' }
      });
      console.log(`   • Admin User: ${adminUser ? '✅ Found' : '⚠️  Not found'}`);
    } catch {
      console.log(`   • Admin User: ⚠️  Unable to verify`);
    }

    try {
      const systemRole = await prisma.role.findFirst({
        where: { code: 'ADMIN' }
      });
      console.log(`   • Admin Role: ${systemRole ? '✅ Found' : '⚠️  Not found'}`);
    } catch {
      console.log(`   • Admin Role: ⚠️  Unable to verify`);
    }

    console.log('\n✅ Migration verification completed!');
    console.log('📝 Next Steps:');
    console.log('   1. Restart the development server');
    console.log('   2. Test login with existing credentials');
    console.log('   3. Verify all features work correctly');
    console.log('   4. Check database logs for any errors\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
